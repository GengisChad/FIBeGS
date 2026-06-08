-- Promote waitlist entries when a tournament's capacity is increased (or when
-- waitlist is enabled with free spots available).
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_capacity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  occupied_statuses TEXT[];
  target_status TEXT;
  occupied INTEGER;
  free_slots INTEGER;
  has_pending_payment BOOLEAN;
  next_id UUID;
BEGIN
  -- Only act when capacity grows or waitlist is freshly turned on.
  IF NEW.max_participants IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.has_waitlist = false THEN
    RETURN NEW;
  END IF;
  IF NEW.max_participants <= COALESCE(OLD.max_participants, 0)
     AND COALESCE(OLD.has_waitlist, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.tournament_registrations
    WHERE tournament_id = NEW.id AND status = 'pending_payment'
  ) INTO has_pending_payment;

  IF COALESCE(NEW.entry_fee, 0) > 0 OR has_pending_payment THEN
    occupied_statuses := ARRAY['confirmed','pending_payment'];
    target_status := 'pending_payment';
  ELSE
    occupied_statuses := ARRAY['confirmed'];
    target_status := 'confirmed';
  END IF;

  SELECT COUNT(*) INTO occupied
  FROM public.tournament_registrations
  WHERE tournament_id = NEW.id
    AND status = ANY(occupied_statuses);

  free_slots := NEW.max_participants - occupied;
  IF free_slots <= 0 THEN
    RETURN NEW;
  END IF;

  -- Promote the next `free_slots` waitlisted players by registration order.
  FOR next_id IN
    SELECT id FROM public.tournament_registrations
    WHERE tournament_id = NEW.id AND status = 'waitlist'
    ORDER BY registered_at ASC
    LIMIT free_slots
  LOOP
    UPDATE public.tournament_registrations
    SET status = target_status, is_ready = false
    WHERE id = next_id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_waitlist_on_capacity ON public.tournaments;
CREATE TRIGGER trg_promote_waitlist_on_capacity
AFTER UPDATE OF max_participants, has_waitlist ON public.tournaments
FOR EACH ROW
WHEN (
  NEW.max_participants IS DISTINCT FROM OLD.max_participants
  OR NEW.has_waitlist IS DISTINCT FROM OLD.has_waitlist
)
EXECUTE FUNCTION public.promote_waitlist_on_capacity_change();

-- Fix the immediate case: promote the waitlist player who has a free spot
-- in tournament 6ac93dd9-208c-4eb0-bcd6-e4d729b8b405.
UPDATE public.tournament_registrations
SET status = 'pending_payment', is_ready = false
WHERE id = 'd9a81d5a-c882-49a4-8547-bb73ba926f0d'
  AND status = 'waitlist';