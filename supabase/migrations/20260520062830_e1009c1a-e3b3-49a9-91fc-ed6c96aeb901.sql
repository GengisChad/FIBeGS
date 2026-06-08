CREATE OR REPLACE FUNCTION public.guard_tournament_registration_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club_id uuid;
  v_is_staff_or_admin boolean := false;
BEGIN
  IF current_setting('app.waitlist_auto_promote', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT club_id INTO v_club_id FROM public.tournaments WHERE id = NEW.tournament_id;
  v_is_staff_or_admin := public.has_role(auth.uid(), 'admin'::app_role)
    OR (v_club_id IS NOT NULL AND public.is_club_staff(auth.uid(), v_club_id));

  IF v_is_staff_or_admin THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_ready, false) IS DISTINCT FROM COALESCE(OLD.is_ready, false) THEN
    RAISE EXCEPTION 'Only club staff or admins can change is_ready';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('confirmed','pending_payment') AND OLD.status NOT IN (NEW.status) THEN
      RAISE EXCEPTION 'Only club staff or admins can promote a registration';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_tournament_waitlist(_tournament_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t_record RECORD;
  occupied_statuses text[];
  target_status text;
  occupied integer;
  free_slots integer;
  promoted_count integer := 0;
  next_id uuid;
BEGIN
  SELECT id, max_participants, COALESCE(entry_fee, 0) AS entry_fee
  INTO t_record
  FROM public.tournaments
  WHERE id = _tournament_id;

  IF NOT FOUND OR t_record.max_participants IS NULL THEN
    RETURN 0;
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
  WHERE tournament_id = t_record.id
    AND status = ANY(occupied_statuses);

  free_slots := t_record.max_participants - occupied;
  IF free_slots <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.waitlist_auto_promote', '1', true);

  FOR next_id IN
    SELECT id
    FROM public.tournament_registrations
    WHERE tournament_id = t_record.id
      AND status = 'waitlist'
    ORDER BY registered_at ASC, id ASC
    LIMIT free_slots
  LOOP
    UPDATE public.tournament_registrations
    SET status = target_status,
        is_ready = false
    WHERE id = next_id
      AND status = 'waitlist';

    IF FOUND THEN
      promoted_count := promoted_count + 1;
    END IF;
  END LOOP;

  RETURN promoted_count;
END;
$$;

DO $$
DECLARE
  tournament_row RECORD;
BEGIN
  FOR tournament_row IN
    SELECT id FROM public.tournaments
  LOOP
    PERFORM public.promote_tournament_waitlist(tournament_row.id);
  END LOOP;
END;
$$;