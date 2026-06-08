CREATE OR REPLACE FUNCTION public.auto_promote_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_tournament_id uuid;
  freed_slot boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    freed_slot := OLD.status IN ('confirmed', 'pending_payment');
    affected_tournament_id := OLD.tournament_id;
  ELSIF TG_OP = 'UPDATE' THEN
    freed_slot := OLD.status IN ('confirmed', 'pending_payment')
      AND NEW.status NOT IN ('confirmed', 'pending_payment');
    affected_tournament_id := COALESCE(NEW.tournament_id, OLD.tournament_id);
  ELSE
    -- A new row must keep the status chosen by the app.
    -- In particular, paid tournament signups must stay in pending_payment
    -- and never be moved to confirmed automatically.
    RETURN NEW;
  END IF;

  IF freed_slot AND affected_tournament_id IS NOT NULL THEN
    PERFORM public.promote_tournament_waitlist(affected_tournament_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_insert ON public.tournament_registrations;
DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_delete ON public.tournament_registrations;
DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_update ON public.tournament_registrations;

CREATE TRIGGER trg_auto_promote_waitlist_delete
AFTER DELETE ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_waitlist();

CREATE TRIGGER trg_auto_promote_waitlist_update
AFTER UPDATE OF status ON public.tournament_registrations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.auto_promote_waitlist();