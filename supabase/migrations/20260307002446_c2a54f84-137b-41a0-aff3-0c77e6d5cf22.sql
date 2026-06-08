
-- 1. Forum reports table
CREATE TABLE public.forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_reports_target_check CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR 
    (post_id IS NULL AND reply_id IS NOT NULL)
  )
);

ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create forum reports" ON public.forum_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view forum reports" ON public.forum_reports FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update forum reports" ON public.forum_reports FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete forum reports" ON public.forum_reports FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Update notify_report_to_staff to handle forum_reports
CREATE OR REPLACE FUNCTION public.notify_report_to_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _staff_id uuid;
  _report_type text;
  _link text;
BEGIN
  IF TG_TABLE_NAME = 'deck_reports' THEN
    _report_type := 'deck';
    _link := '/decks';
  ELSIF TG_TABLE_NAME = 'market_reports' THEN
    _report_type := 'annuncio';
    _link := '/market';
  ELSIF TG_TABLE_NAME = 'forum_reports' THEN
    _report_type := 'post/commento del forum';
    _link := '/forum';
  ELSE
    _report_type := 'contenuto';
    _link := '/admin';
  END IF;

  FOR _staff_id IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'staff', 'moderator')
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      _staff_id,
      'report',
      '⚠️ Nuova segnalazione',
      'È stata ricevuta una segnalazione su un ' || _report_type || '. Controlla la sezione segnalazioni.',
      _link
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_forum_report_notify
  AFTER INSERT ON public.forum_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_to_staff();

-- 2. Deck likes notification trigger
CREATE OR REPLACE FUNCTION public.notify_deck_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _deck_owner uuid;
  _deck_name text;
  _liker_name text;
BEGIN
  SELECT user_id, name INTO _deck_owner, _deck_name
  FROM decks WHERE id = NEW.deck_id;

  IF _deck_owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _liker_name
  FROM profiles WHERE user_id = NEW.user_id LIMIT 1;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    _deck_owner,
    'deck_like',
    'Nuovo like al tuo deck',
    _liker_name || ' ha messo like a "' || _deck_name || '"',
    '/decks'
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_deck_like_notify
  AFTER INSERT ON public.deck_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_deck_like();

-- 3. Recalculate user points when tournament_results are deleted
CREATE OR REPLACE FUNCTION public.recalculate_user_points_on_result_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  active_bfl INTEGER;
BEGIN
  SELECT bfl INTO active_bfl FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  IF EXISTS (SELECT 1 FROM child_profiles WHERE id = OLD.user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM tournament_results WHERE user_id = OLD.user_id) THEN
      UPDATE child_profiles SET points = 0, wins = 0, updated_at = now() WHERE id = OLD.user_id;
    ELSE
      UPDATE child_profiles cp
      SET points = COALESCE(sub.total, 0),
          wins = COALESCE(sub.win_count, 0),
          updated_at = now()
      FROM (
        SELECT tr.user_id,
               SUM(tr.scaled_points) as total,
               COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
        FROM (
          SELECT user_id, scaled_points, placement,
                 ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY scaled_points DESC) as rn
          FROM tournament_results
          WHERE user_id = OLD.user_id
        ) tr
        WHERE tr.rn <= active_bfl
        GROUP BY tr.user_id
      ) sub
      WHERE cp.id = sub.user_id;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM tournament_results WHERE user_id = OLD.user_id) THEN
      UPDATE profiles SET points = 0, wins = 0, updated_at = now() WHERE user_id = OLD.user_id;
    ELSE
      UPDATE profiles p
      SET points = COALESCE(sub.total, 0),
          wins = COALESCE(sub.win_count, 0),
          updated_at = now()
      FROM (
        SELECT tr.user_id,
               SUM(tr.scaled_points) as total,
               COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
        FROM (
          SELECT user_id, scaled_points, placement,
                 ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY scaled_points DESC) as rn
          FROM tournament_results
          WHERE user_id = OLD.user_id
        ) tr
        WHERE tr.rn <= active_bfl
        GROUP BY tr.user_id
      ) sub
      WHERE p.user_id = sub.user_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$function$;

CREATE TRIGGER on_tournament_result_delete
  AFTER DELETE ON public.tournament_results
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_user_points_on_result_delete();
