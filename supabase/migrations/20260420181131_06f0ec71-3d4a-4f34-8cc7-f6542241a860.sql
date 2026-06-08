
-- Auto-promote first waitlist registration when a confirmed registration is removed/cancelled
-- Skips paid tournaments (waitlist = awaiting payment) and tournaments with has_waitlist=false

CREATE OR REPLACE FUNCTION public.auto_promote_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_record RECORD;
  current_confirmed INTEGER;
  next_waitlist_id UUID;
  freed_slot BOOLEAN := false;
BEGIN
  -- Determine tournament_id and whether a confirmed slot was freed
  IF (TG_OP = 'DELETE') THEN
    IF OLD.status = 'confirmed' THEN
      freed_slot := true;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
      freed_slot := true;
    END IF;
  END IF;

  IF NOT freed_slot THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Load tournament info
  SELECT id, max_participants, has_waitlist, COALESCE(entry_fee, 0) AS entry_fee
  INTO t_record
  FROM public.tournaments
  WHERE id = COALESCE(NEW.tournament_id, OLD.tournament_id);

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Skip if waitlist disabled or paid tournament (manual confirmation required)
  IF t_record.has_waitlist = false OR t_record.entry_fee > 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check available spots
  SELECT COUNT(*) INTO current_confirmed
  FROM public.tournament_registrations
  WHERE tournament_id = t_record.id AND status = 'confirmed';

  IF current_confirmed >= t_record.max_participants THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get oldest waitlisted registration
  SELECT id INTO next_waitlist_id
  FROM public.tournament_registrations
  WHERE tournament_id = t_record.id AND status = 'waitlist'
  ORDER BY registered_at ASC
  LIMIT 1;

  IF next_waitlist_id IS NOT NULL THEN
    UPDATE public.tournament_registrations
    SET status = 'confirmed'
    WHERE id = next_waitlist_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_delete ON public.tournament_registrations;
DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_update ON public.tournament_registrations;

CREATE TRIGGER trg_auto_promote_waitlist_delete
AFTER DELETE ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_waitlist();

CREATE TRIGGER trg_auto_promote_waitlist_update
AFTER UPDATE OF status ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_waitlist();
