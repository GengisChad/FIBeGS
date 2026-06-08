
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'staff_announcement', 'market_like', 'badge_earned', 'ranking_record', 'club_tournament'
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  link text, -- optional link to navigate to
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- System/admins can insert notifications (via triggers with SECURITY DEFINER)
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger: notify listing owner on market like
CREATE OR REPLACE FUNCTION public.notify_market_like()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  _listing_owner uuid;
  _product_name text;
  _liker_name text;
BEGIN
  -- Get listing owner
  SELECT user_id, product_name INTO _listing_owner, _product_name
  FROM market_listings WHERE id = NEW.listing_id;

  -- Don't notify yourself
  IF _listing_owner = NEW.user_id THEN RETURN NEW; END IF;

  -- Get liker display name
  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _liker_name
  FROM profiles WHERE user_id = NEW.user_id LIMIT 1;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    _listing_owner,
    'market_like',
    'Nuovo like al tuo annuncio',
    _liker_name || ' ha messo like a "' || _product_name || '"',
    '/market'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_market_like_insert
  AFTER INSERT ON public.market_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_market_like();

-- Trigger: notify user on badge assignment
CREATE OR REPLACE FUNCTION public.notify_badge_earned()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  _badge_name text;
BEGIN
  SELECT name INTO _badge_name FROM badges WHERE id = NEW.badge_id;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    NEW.user_id,
    'badge_earned',
    'Nuovo badge ottenuto!',
    'Hai ottenuto il badge "' || COALESCE(_badge_name, 'Sconosciuto') || '"',
    '/profile'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_badge_earned
  AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.notify_badge_earned();

-- Trigger: notify club members on new tournament
CREATE OR REPLACE FUNCTION public.notify_club_tournament()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  _member RECORD;
  _club_name text;
BEGIN
  IF NEW.club_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO _club_name FROM clubs WHERE id = NEW.club_id;

  FOR _member IN
    SELECT user_id FROM club_members WHERE club_id = NEW.club_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      _member.user_id,
      'club_tournament',
      'Nuovo torneo del tuo club!',
      _club_name || ' ha creato il torneo "' || NEW.title || '"',
      '/tournaments/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_club_tournament_created
  AFTER INSERT ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.notify_club_tournament();
