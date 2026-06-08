CREATE OR REPLACE FUNCTION public.auto_promote_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_record RECORD;
  occupied INTEGER;
  next_id UUID;
  freed_slot BOOLEAN := false;
  occupied_statuses TEXT[];
  target_status TEXT;
  has_pending_payment BOOLEAN;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    freed_slot := OLD.status IN ('confirmed','pending_payment');
  ELSIF (TG_OP = 'UPDATE') THEN
    freed_slot := OLD.status IN ('confirmed','pending_payment') AND NEW.status NOT IN ('confirmed','pending_payment');
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

  SELECT EXISTS (
    SELECT 1
    FROM public.tournament_registrations
    WHERE tournament_id = t_record.id
      AND status = 'pending_payment'
  ) INTO has_pending_payment;

  IF t_record.entry_fee > 0 OR has_pending_payment THEN
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

  IF occupied >= t_record.max_participants THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO next_id
  FROM public.tournament_registrations
  WHERE tournament_id = t_record.id
    AND status = 'waitlist'
  ORDER BY registered_at ASC
  LIMIT 1;

  IF next_id IS NOT NULL THEN
    UPDATE public.tournament_registrations
    SET status = target_status,
        is_ready = false
    WHERE id = next_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;