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
    NULLIF(BTRIM(COALESCE(payment_method, '')), '') AS payment_method,
    EXISTS (
      SELECT 1
      FROM public.tournament_registrations existing
      WHERE existing.tournament_id = tournaments.id
        AND existing.status = 'pending_payment'
    ) AS has_pending_payment_entries
  INTO v_tournament
  FROM public.tournaments
  WHERE id = NEW.tournament_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_has_payment := v_tournament.entry_fee > 0
    OR v_tournament.payment_method IS NOT NULL
    OR v_tournament.has_pending_payment_entries;

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
      (
        (
          COALESCE(t.entry_fee, 0) > 0
          OR NULLIF(BTRIM(COALESCE(t.payment_method, '')), '') IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM public.tournament_registrations pp
            WHERE pp.tournament_id = t.id
              AND pp.status = 'pending_payment'
          )
        )
        AND tr.status IN ('confirmed', 'pending_payment')
      )
      OR (
        COALESCE(t.entry_fee, 0) <= 0
        AND NULLIF(BTRIM(COALESCE(t.payment_method, '')), '') IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.tournament_registrations pp
          WHERE pp.tournament_id = t.id
            AND pp.status = 'pending_payment'
        )
        AND tr.status = 'confirmed'
      )
    )
  GROUP BY tr.tournament_id;
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
  SELECT
    id,
    max_participants,
    COALESCE(entry_fee, 0) AS entry_fee,
    NULLIF(BTRIM(COALESCE(payment_method, '')), '') AS payment_method,
    EXISTS (
      SELECT 1
      FROM public.tournament_registrations existing
      WHERE existing.tournament_id = tournaments.id
        AND existing.status = 'pending_payment'
    ) AS has_pending_payment_entries
  INTO t_record
  FROM public.tournaments
  WHERE id = _tournament_id;

  IF NOT FOUND OR t_record.max_participants IS NULL THEN
    RETURN 0;
  END IF;

  IF t_record.entry_fee > 0 OR t_record.payment_method IS NOT NULL OR t_record.has_pending_payment_entries THEN
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

UPDATE public.tournament_registrations tr
SET status = 'pending_payment',
    is_ready = false,
    confirmed_by = NULL,
    confirmed_at = NULL
FROM public.tournaments t
WHERE t.id = tr.tournament_id
  AND tr.tournament_id = 'a6f2e6b2-a8af-4aca-a1d7-1244f05354fb'
  AND tr.user_id = '123a147a-be70-45a1-bfc3-54f779afd00b'
  AND tr.status = 'confirmed';