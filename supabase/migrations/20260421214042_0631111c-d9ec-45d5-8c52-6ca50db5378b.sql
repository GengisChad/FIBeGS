-- Add tracking columns for who confirmed (paid) a registration
ALTER TABLE public.tournament_registrations
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Trigger function: track confirmation + log to tournament action_log
CREATE OR REPLACE FUNCTION public.track_registration_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _actor_name text;
  _player_name text;
  _ts text;
  _line text;
  _old_status text;
  _new_status text;
BEGIN
  _old_status := COALESCE(OLD.status, '');
  _new_status := COALESCE(NEW.status, '');

  IF _old_status = _new_status THEN
    RETURN NEW;
  END IF;

  -- Track who confirmed (paid)
  IF _new_status = 'confirmed' AND _old_status <> 'confirmed' THEN
    NEW.confirmed_by := _actor;
    NEW.confirmed_at := now();
  ELSIF _new_status <> 'confirmed' AND _old_status = 'confirmed' THEN
    -- Reverted: clear confirmation
    NEW.confirmed_by := NULL;
    NEW.confirmed_at := NULL;
  END IF;

  -- Resolve names for log
  SELECT COALESCE(username, display_name, 'sistema') INTO _actor_name
  FROM profiles WHERE user_id = _actor LIMIT 1;
  IF _actor_name IS NULL THEN _actor_name := 'sistema'; END IF;

  SELECT COALESCE(username, display_name, 'utente') INTO _player_name
  FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
  IF _player_name IS NULL THEN _player_name := 'utente'; END IF;

  _ts := to_char(now() AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY, HH24:MI');

  -- Build log line for relevant transitions
  IF _new_status = 'confirmed' AND _old_status = 'waitlist' THEN
    _line := '[' || _ts || '] ' || _actor_name || ': pagamento confermato per ' || _player_name;
  ELSIF _new_status = 'waitlist' AND _old_status = 'confirmed' THEN
    _line := '[' || _ts || '] ' || _actor_name || ': pagamento revocato per ' || _player_name || ' (rimesso in attesa)';
  ELSIF _new_status = 'confirmed' AND _old_status <> 'confirmed' THEN
    _line := '[' || _ts || '] ' || _actor_name || ': iscrizione confermata per ' || _player_name;
  ELSIF _new_status = 'cancelled' THEN
    _line := '[' || _ts || '] ' || _actor_name || ': iscrizione cancellata per ' || _player_name;
  ELSE
    _line := '[' || _ts || '] ' || _actor_name || ': stato iscrizione di ' || _player_name || ' cambiato da ' || _old_status || ' a ' || _new_status;
  END IF;

  UPDATE tournaments
  SET action_log = COALESCE(action_log, '') ||
    CASE WHEN COALESCE(action_log, '') = '' THEN '' ELSE E'\n' END || _line
  WHERE id = NEW.tournament_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_registration_status_change ON public.tournament_registrations;
CREATE TRIGGER trg_track_registration_status_change
BEFORE UPDATE ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.track_registration_status_change();