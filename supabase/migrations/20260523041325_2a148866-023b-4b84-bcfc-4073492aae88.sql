
CREATE OR REPLACE FUNCTION public.cleanup_waitlist_on_disable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(OLD.has_waitlist, true) = true
     AND COALESCE(NEW.has_waitlist, true) = false THEN
    DELETE FROM public.tournament_registrations
    WHERE tournament_id = NEW.id
      AND status = 'waitlist';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_waitlist_on_disable ON public.tournaments;
CREATE TRIGGER trg_cleanup_waitlist_on_disable
AFTER UPDATE OF has_waitlist ON public.tournaments
FOR EACH ROW
WHEN (OLD.has_waitlist IS DISTINCT FROM NEW.has_waitlist)
EXECUTE FUNCTION public.cleanup_waitlist_on_disable();
