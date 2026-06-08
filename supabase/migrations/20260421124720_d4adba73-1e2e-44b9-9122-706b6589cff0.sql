-- 1. Add push_eligible flag (default false: opt-in per type)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS push_eligible boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications (created_at)
  WHERE push_sent = false AND push_eligible = true;

-- 2. Update notify_club_tournament: push to members AND followers (only if tournament not hidden)
CREATE OR REPLACE FUNCTION public.notify_club_tournament()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user RECORD;
  _club_name text;
  _is_hidden boolean;
BEGIN
  IF NEW.club_id IS NULL THEN RETURN NEW; END IF;

  -- Skip hidden tournaments
  _is_hidden := COALESCE(NEW.is_hidden, false);
  IF _is_hidden THEN RETURN NEW; END IF;

  SELECT name INTO _club_name FROM clubs WHERE id = NEW.club_id;

  -- Notify all members + followers (deduplicated)
  FOR _user IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM club_members WHERE club_id = NEW.club_id
      UNION
      SELECT user_id FROM club_follows WHERE club_id = NEW.club_id
    ) u
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link, push_eligible)
    VALUES (
      _user.user_id,
      'club_tournament',
      'Nuovo torneo!',
      _club_name || ' ha pubblicato il torneo "' || NEW.title || '"',
      '/tournaments/' || NEW.id,
      true
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Handle case where is_hidden column may not exist: wrap in safe check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'is_hidden'
  ) THEN
    -- Recreate without is_hidden check
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.notify_club_tournament()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $body$
      DECLARE _user RECORD; _club_name text;
      BEGIN
        IF NEW.club_id IS NULL THEN RETURN NEW; END IF;
        SELECT name INTO _club_name FROM clubs WHERE id = NEW.club_id;
        FOR _user IN
          SELECT DISTINCT user_id FROM (
            SELECT user_id FROM club_members WHERE club_id = NEW.club_id
            UNION
            SELECT user_id FROM club_follows WHERE club_id = NEW.club_id
          ) u
        LOOP
          INSERT INTO notifications (user_id, type, title, message, link, push_eligible)
          VALUES (_user.user_id, 'club_tournament', 'Nuovo torneo!',
            _club_name || ' ha pubblicato il torneo "' || NEW.title || '"',
            '/tournaments/' || NEW.id, true);
        END LOOP;
        RETURN NEW;
      END;
      $body$;
    $f$;
  END IF;
END $$;

-- 3. Update notify_badge_earned: push enabled
CREATE OR REPLACE FUNCTION public.notify_badge_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _badge_name text;
BEGIN
  SELECT name INTO _badge_name FROM badges WHERE id = NEW.badge_id;

  INSERT INTO notifications (user_id, type, title, message, link, push_eligible)
  VALUES (
    NEW.user_id,
    'badge_earned',
    'Nuovo badge ottenuto!',
    'Hai ottenuto il badge "' || COALESCE(_badge_name, 'Sconosciuto') || '"',
    '/profile',
    true
  );
  RETURN NEW;
END;
$function$;

-- 4. Update approve_club_request_and_transfer: mark push_eligible
CREATE OR REPLACE FUNCTION public.approve_club_request_and_transfer(_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _req RECORD;
  _club_id UUID;
  _member RECORD;
  _accepted_count INT;
BEGIN
  SELECT * INTO _req FROM club_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club request not found';
  END IF;

  SELECT COUNT(*) INTO _accepted_count
  FROM club_request_invites
  WHERE request_id = _request_id AND status = 'accepted';

  IF _accepted_count < 7 THEN
    RAISE EXCEPTION 'Servono almeno 7 inviti accettati per approvare il club (attualmente: %)', _accepted_count;
  END IF;

  INSERT INTO clubs (name, description, region_id, city, latitude, longitude, is_active)
  VALUES (_req.club_name, _req.description, _req.region_id, _req.city, _req.latitude, _req.longitude, true)
  RETURNING id INTO _club_id;

  DELETE FROM club_members WHERE user_id = _req.user_id;

  INSERT INTO club_members (club_id, user_id, role)
  VALUES (_club_id, _req.user_id, 'leader');

  FOR _member IN
    SELECT user_id FROM club_request_invites
    WHERE request_id = _request_id AND status = 'accepted'
  LOOP
    DELETE FROM club_members WHERE user_id = _member.user_id;
    INSERT INTO club_members (club_id, user_id, role)
    VALUES (_club_id, _member.user_id, 'member');
  END LOOP;

  UPDATE club_requests SET status = 'approved' WHERE id = _request_id;

  -- Notify all accepted members WITH push
  INSERT INTO notifications (user_id, type, title, message, link, push_eligible)
  SELECT cri.user_id, 'club_approved', 'Club Approvato!',
    'Il club "' || _req.club_name || '" è stato approvato! Fai ora parte del club.',
    '/clubs/' || _club_id, true
  FROM club_request_invites cri
  WHERE cri.request_id = _request_id AND cri.status = 'accepted';

  -- Notify requester WITH push
  INSERT INTO notifications (user_id, type, title, message, link, push_eligible)
  VALUES (_req.user_id, 'club_approved', 'Club Approvato!',
    'Il tuo club "' || _req.club_name || '" è stato approvato!',
    '/clubs/' || _club_id, true);

  RETURN _club_id;
END;
$function$;

-- 5. New function: reject_club_request with push notification
CREATE OR REPLACE FUNCTION public.reject_club_request(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _req RECORD;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO _req FROM club_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club request not found';
  END IF;

  UPDATE club_requests
  SET status = 'rejected',
      admin_notes = COALESCE(_reason, admin_notes),
      updated_at = now()
  WHERE id = _request_id;

  -- Notify requester with push
  INSERT INTO notifications (user_id, type, title, message, link, push_eligible)
  VALUES (
    _req.user_id,
    'club_rejected',
    'Richiesta Club Rifiutata',
    'La richiesta per il club "' || _req.club_name || '" è stata rifiutata.' ||
      CASE WHEN _reason IS NOT NULL AND length(_reason) > 0 THEN ' Motivo: ' || _reason ELSE '' END,
    '/clubs',
    true
  );
END;
$function$;

-- 6. Backfill push_eligible on existing pending notifications for important types
UPDATE public.notifications
SET push_eligible = true
WHERE push_sent = false
  AND push_eligible = false
  AND type IN ('club_approved', 'club_rejected', 'club_invite', 'club_tournament', 'badge_earned', 'staff_announcement', 'club_request_ready');