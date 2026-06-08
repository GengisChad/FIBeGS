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
  SELECT id, max_participants, has_waitlist, COALESCE(entry_fee, 0) AS entry_fee
  INTO t_record
  FROM public.tournaments
  WHERE id = _tournament_id;

  IF NOT FOUND OR t_record.max_participants IS NULL OR t_record.has_waitlist = false THEN
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

CREATE OR REPLACE FUNCTION public.auto_promote_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_tournament_id uuid;
BEGIN
  affected_tournament_id := COALESCE(NEW.tournament_id, OLD.tournament_id);

  IF affected_tournament_id IS NOT NULL THEN
    PERFORM public.promote_tournament_waitlist(affected_tournament_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_waitlist_on_capacity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.max_participants IS DISTINCT FROM OLD.max_participants
     OR NEW.has_waitlist IS DISTINCT FROM OLD.has_waitlist
     OR NEW.entry_fee IS DISTINCT FROM OLD.entry_fee THEN
    PERFORM public.promote_tournament_waitlist(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_insert ON public.tournament_registrations;
DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_delete ON public.tournament_registrations;
DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_update ON public.tournament_registrations;

CREATE TRIGGER trg_auto_promote_waitlist_insert
AFTER INSERT ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_waitlist();

CREATE TRIGGER trg_auto_promote_waitlist_delete
AFTER DELETE ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_waitlist();

CREATE TRIGGER trg_auto_promote_waitlist_update
AFTER UPDATE OF status ON public.tournament_registrations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.auto_promote_waitlist();

DROP TRIGGER IF EXISTS trg_promote_waitlist_on_capacity ON public.tournaments;
CREATE TRIGGER trg_promote_waitlist_on_capacity
AFTER UPDATE OF max_participants, has_waitlist, entry_fee ON public.tournaments
FOR EACH ROW
WHEN (
  NEW.max_participants IS DISTINCT FROM OLD.max_participants
  OR NEW.has_waitlist IS DISTINCT FROM OLD.has_waitlist
  OR NEW.entry_fee IS DISTINCT FROM OLD.entry_fee
)
EXECUTE FUNCTION public.promote_waitlist_on_capacity_change();

DO $$
DECLARE
  tournament_row RECORD;
BEGIN
  FOR tournament_row IN
    SELECT id FROM public.tournaments
    WHERE has_waitlist IS DISTINCT FROM false
  LOOP
    PERFORM public.promote_tournament_waitlist(tournament_row.id);
  END LOOP;
END;
$$;