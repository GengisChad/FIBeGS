
-- 1) Update CHECK constraint to allow pending_payment
ALTER TABLE public.tournament_registrations
  DROP CONSTRAINT IF EXISTS tournament_registrations_status_check;
ALTER TABLE public.tournament_registrations
  ADD CONSTRAINT tournament_registrations_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'waitlist'::text, 'pending_payment'::text]));

-- 2) enforce_tournament_max_participants: also bound confirmed+pending_payment
CREATE OR REPLACE FUNCTION public.enforce_tournament_max_participants()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_p integer;
  current_count integer;
BEGIN
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT max_participants INTO max_p FROM tournaments WHERE id = NEW.tournament_id;
    SELECT count(*) INTO current_count
    FROM tournament_registrations
    WHERE tournament_id = NEW.tournament_id
      AND status = 'confirmed'
      AND id IS DISTINCT FROM NEW.id;
    IF current_count >= max_p THEN
      RAISE EXCEPTION 'Tournament has reached maximum participants (% / %)', current_count, max_p
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.status = 'pending_payment' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending_payment') THEN
    SELECT max_participants INTO max_p FROM tournaments WHERE id = NEW.tournament_id;
    SELECT count(*) INTO current_count
    FROM tournament_registrations
    WHERE tournament_id = NEW.tournament_id
      AND status IN ('confirmed','pending_payment')
      AND id IS DISTINCT FROM NEW.id;
    IF current_count >= max_p THEN
      RAISE EXCEPTION 'Tournament has reached maximum participants (% / %)', current_count, max_p
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) auto_promote_waitlist: paid → promote waitlist to pending_payment when slot frees
CREATE OR REPLACE FUNCTION public.auto_promote_waitlist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t_record RECORD;
  occupied INTEGER;
  next_id UUID;
  freed_slot BOOLEAN := false;
  occupied_statuses TEXT[];
  target_status TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.status IN ('confirmed','pending_payment') THEN
      freed_slot := true;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.status IN ('confirmed','pending_payment') AND NEW.status NOT IN ('confirmed','pending_payment') THEN
      freed_slot := true;
    END IF;
  END IF;

  IF NOT freed_slot THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id, max_participants, has_waitlist, COALESCE(entry_fee, 0) AS entry_fee
  INTO t_record
  FROM public.tournaments
  WHERE id = COALESCE(NEW.tournament_id, OLD.tournament_id);

  IF NOT FOUND OR t_record.has_waitlist = false THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF t_record.entry_fee > 0 THEN
    occupied_statuses := ARRAY['confirmed','pending_payment'];
    target_status := 'pending_payment';
  ELSE
    occupied_statuses := ARRAY['confirmed'];
    target_status := 'confirmed';
  END IF;

  SELECT COUNT(*) INTO occupied
  FROM public.tournament_registrations
  WHERE tournament_id = t_record.id AND status = ANY(occupied_statuses);

  IF occupied >= t_record.max_participants THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO next_id
  FROM public.tournament_registrations
  WHERE tournament_id = t_record.id AND status = 'waitlist'
  ORDER BY registered_at ASC
  LIMIT 1;

  IF next_id IS NOT NULL THEN
    UPDATE public.tournament_registrations
    SET status = target_status
    WHERE id = next_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4) guard: prevent non-staff self-promotion to pending_payment
CREATE OR REPLACE FUNCTION public.guard_tournament_registration_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_club_id uuid;
  v_is_staff_or_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT club_id INTO v_club_id FROM public.tournaments WHERE id = NEW.tournament_id;
  v_is_staff_or_admin := has_role(auth.uid(), 'admin'::app_role)
    OR (v_club_id IS NOT NULL AND is_club_staff(auth.uid(), v_club_id));
  IF v_is_staff_or_admin THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.is_ready, false) IS DISTINCT FROM COALESCE(OLD.is_ready, false) THEN
    RAISE EXCEPTION 'Only club staff or admins can change is_ready';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('confirmed','pending_payment') AND OLD.status NOT IN (NEW.status) THEN
      -- allow downgrade between waitlist/cancelled but block self-promotion to confirmed/pending_payment
      RAISE EXCEPTION 'Only club staff or admins can promote a registration';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5) track function: include pending_payment transitions
CREATE OR REPLACE FUNCTION public.track_registration_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF _old_status = _new_status THEN RETURN NEW; END IF;

  IF _new_status = 'confirmed' AND _old_status <> 'confirmed' THEN
    NEW.confirmed_by := _actor;
    NEW.confirmed_at := now();
  ELSIF _new_status <> 'confirmed' AND _old_status = 'confirmed' THEN
    NEW.confirmed_by := NULL;
    NEW.confirmed_at := NULL;
  END IF;

  SELECT COALESCE(username, display_name, 'sistema') INTO _actor_name FROM profiles WHERE user_id = _actor LIMIT 1;
  IF _actor_name IS NULL THEN _actor_name := 'sistema'; END IF;
  SELECT COALESCE(username, display_name, 'utente') INTO _player_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
  IF _player_name IS NULL THEN _player_name := 'utente'; END IF;
  _ts := to_char(now() AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY, HH24:MI');

  IF _new_status = 'confirmed' AND _old_status = 'pending_payment' THEN
    _line := '[' || _ts || '] ' || _actor_name || ': pagamento confermato per ' || _player_name;
  ELSIF _new_status = 'pending_payment' AND _old_status = 'confirmed' THEN
    _line := '[' || _ts || '] ' || _actor_name || ': pagamento revocato per ' || _player_name;
  ELSIF _new_status = 'pending_payment' AND _old_status = 'waitlist' THEN
    _line := '[' || _ts || '] ' || _actor_name || ': ' || _player_name || ' promosso da lista d''attesa a in attesa di pagamento';
  ELSIF _new_status = 'waitlist' AND _old_status = 'pending_payment' THEN
    _line := '[' || _ts || '] ' || _actor_name || ': ' || _player_name || ' rimesso in lista d''attesa';
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
$function$;

-- 6) Backfill: for paid tournaments, move oldest waitlist rows to pending_payment up to available capacity
DO $$
DECLARE
  t RECORD;
  remaining INTEGER;
BEGIN
  FOR t IN
    SELECT id, max_participants
    FROM public.tournaments
    WHERE COALESCE(entry_fee, 0) > 0
  LOOP
    SELECT GREATEST(0, t.max_participants - COUNT(*))
      INTO remaining
      FROM public.tournament_registrations
      WHERE tournament_id = t.id AND status IN ('confirmed','pending_payment');
    IF remaining > 0 THEN
      UPDATE public.tournament_registrations
      SET status = 'pending_payment'
      WHERE id IN (
        SELECT id FROM public.tournament_registrations
        WHERE tournament_id = t.id AND status = 'waitlist'
        ORDER BY registered_at ASC
        LIMIT remaining
      );
    END IF;
  END LOOP;
END $$;
