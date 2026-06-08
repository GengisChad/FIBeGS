
CREATE OR REPLACE FUNCTION public.enforce_tournament_max_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_p integer;
  current_confirmed integer;
BEGIN
  -- Only check when status is being set to 'confirmed'
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT max_participants INTO max_p
    FROM tournaments
    WHERE id = NEW.tournament_id;

    SELECT count(*) INTO current_confirmed
    FROM tournament_registrations
    WHERE tournament_id = NEW.tournament_id
      AND status = 'confirmed'
      AND id IS DISTINCT FROM NEW.id;

    IF current_confirmed >= max_p THEN
      RAISE EXCEPTION 'Tournament has reached maximum participants (% / %)', current_confirmed, max_p
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_max_participants
  BEFORE INSERT OR UPDATE ON public.tournament_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tournament_max_participants();
