
-- 1. Simplify promote_tournament_waitlist to depend only on the tournament's payment config
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
  SELECT
    id,
    max_participants,
    COALESCE(entry_fee, 0) AS entry_fee,
    NULLIF(BTRIM(COALESCE(payment_method, '')), '') AS payment_method
  INTO t_record
  FROM public.tournaments
  WHERE id = _tournament_id;

  IF NOT FOUND OR t_record.max_participants IS NULL THEN
    RETURN 0;
  END IF;

  IF t_record.entry_fee > 0 OR t_record.payment_method IS NOT NULL THEN
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

-- 2. Simplify enforce_tournament_payment_registration_status as well
CREATE OR REPLACE FUNCTION public.enforce_tournament_payment_registration_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tournament RECORD;
  v_occupied integer;
  v_has_payment boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT
    id,
    max_participants,
    COALESCE(has_waitlist, true) AS has_waitlist,
    COALESCE(entry_fee, 0) AS entry_fee,
    NULLIF(BTRIM(COALESCE(payment_method, '')), '') AS payment_method
  INTO v_tournament
  FROM public.tournaments
  WHERE id = NEW.tournament_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_has_payment := v_tournament.entry_fee > 0 OR v_tournament.payment_method IS NOT NULL;

  IF NOT v_has_payment THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_occupied
  FROM public.tournament_registrations
  WHERE tournament_id = NEW.tournament_id
    AND status IN ('confirmed', 'pending_payment')
    AND id IS DISTINCT FROM NEW.id;

  IF v_occupied >= COALESCE(v_tournament.max_participants, 0) THEN
    IF v_tournament.has_waitlist THEN
      NEW.status := 'waitlist';
    ELSE
      RAISE EXCEPTION 'Tournament has reached maximum participants (% / %)', v_occupied, v_tournament.max_participants
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    NEW.status := 'pending_payment';
  END IF;

  NEW.is_ready := false;
  NEW.confirmed_by := NULL;
  NEW.confirmed_at := NULL;

  RETURN NEW;
END;
$$;

-- 3. Simplify get_tournament_registration_counts to match
CREATE OR REPLACE FUNCTION public.get_tournament_registration_counts(_tournament_ids uuid[])
RETURNS TABLE(tournament_id uuid, reg_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT tr.tournament_id, COUNT(*) AS reg_count
  FROM public.tournament_registrations tr
  JOIN public.tournaments t ON t.id = tr.tournament_id
  WHERE tr.tournament_id = ANY(_tournament_ids)
    AND (
      ((COALESCE(t.entry_fee, 0) > 0 OR NULLIF(BTRIM(COALESCE(t.payment_method, '')), '') IS NOT NULL)
        AND tr.status IN ('confirmed', 'pending_payment'))
      OR ((COALESCE(t.entry_fee, 0) <= 0 AND NULLIF(BTRIM(COALESCE(t.payment_method, '')), '') IS NULL)
        AND tr.status = 'confirmed')
    )
  GROUP BY tr.tournament_id;
$$;

-- 4. Trigger on tournaments: when payments get disabled, convert pending_payment → confirmed (within capacity)
--    and overflow goes back to waitlist; then run promotion to fill any remaining free seats.
CREATE OR REPLACE FUNCTION public.sync_registrations_on_payment_toggle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_has_payment boolean;
  new_has_payment boolean;
  v_max integer;
  v_confirmed integer;
  v_free integer;
  next_id uuid;
BEGIN
  old_has_payment := COALESCE(OLD.entry_fee, 0) > 0
    OR NULLIF(BTRIM(COALESCE(OLD.payment_method, '')), '') IS NOT NULL;
  new_has_payment := COALESCE(NEW.entry_fee, 0) > 0
    OR NULLIF(BTRIM(COALESCE(NEW.payment_method, '')), '') IS NOT NULL;

  IF old_has_payment AND NOT new_has_payment THEN
    v_max := COALESCE(NEW.max_participants, 0);
    PERFORM set_config('app.waitlist_auto_promote', '1', true);

    SELECT COUNT(*) INTO v_confirmed
    FROM public.tournament_registrations
    WHERE tournament_id = NEW.id AND status = 'confirmed';

    v_free := GREATEST(v_max - v_confirmed, 0);

    -- Promote pending_payment → confirmed in registration order, within capacity
    FOR next_id IN
      SELECT id FROM public.tournament_registrations
      WHERE tournament_id = NEW.id AND status = 'pending_payment'
      ORDER BY registered_at ASC, id ASC
      LIMIT v_free
    LOOP
      UPDATE public.tournament_registrations
      SET status = 'confirmed', is_ready = false
      WHERE id = next_id AND status = 'pending_payment';
    END LOOP;

    -- Any remaining pending_payment goes to waitlist
    UPDATE public.tournament_registrations
    SET status = 'waitlist', is_ready = false
    WHERE tournament_id = NEW.id AND status = 'pending_payment';

    -- Finally promote any remaining slots from the waitlist
    PERFORM public.promote_tournament_waitlist(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_registrations_on_payment_toggle ON public.tournaments;
CREATE TRIGGER trg_sync_registrations_on_payment_toggle
AFTER UPDATE OF entry_fee, payment_method ON public.tournaments
FOR EACH ROW
WHEN (
  (COALESCE(OLD.entry_fee, 0) IS DISTINCT FROM COALESCE(NEW.entry_fee, 0))
  OR (COALESCE(OLD.payment_method, '') IS DISTINCT FROM COALESCE(NEW.payment_method, ''))
)
EXECUTE FUNCTION public.sync_registrations_on_payment_toggle();

-- 5. One-time cleanup: for any tournament currently free but with leftover pending_payment rows,
--    convert them to confirmed (within capacity) and overflow to waitlist; then promote waitlist.
DO $$
DECLARE
  t RECORD;
  v_confirmed integer;
  v_free integer;
  next_id uuid;
BEGIN
  PERFORM set_config('app.waitlist_auto_promote', '1', true);
  FOR t IN
    SELECT id, COALESCE(max_participants, 0) AS max_participants
    FROM public.tournaments
    WHERE COALESCE(entry_fee, 0) <= 0
      AND NULLIF(BTRIM(COALESCE(payment_method, '')), '') IS NULL
      AND EXISTS (
        SELECT 1 FROM public.tournament_registrations r
        WHERE r.tournament_id = tournaments.id AND r.status = 'pending_payment'
      )
  LOOP
    SELECT COUNT(*) INTO v_confirmed
    FROM public.tournament_registrations
    WHERE tournament_id = t.id AND status = 'confirmed';
    v_free := GREATEST(t.max_participants - v_confirmed, 0);

    FOR next_id IN
      SELECT id FROM public.tournament_registrations
      WHERE tournament_id = t.id AND status = 'pending_payment'
      ORDER BY registered_at ASC, id ASC
      LIMIT v_free
    LOOP
      UPDATE public.tournament_registrations
      SET status = 'confirmed', is_ready = false
      WHERE id = next_id AND status = 'pending_payment';
    END LOOP;

    UPDATE public.tournament_registrations
    SET status = 'waitlist', is_ready = false
    WHERE tournament_id = t.id AND status = 'pending_payment';

    PERFORM public.promote_tournament_waitlist(t.id);
  END LOOP;
END $$;
