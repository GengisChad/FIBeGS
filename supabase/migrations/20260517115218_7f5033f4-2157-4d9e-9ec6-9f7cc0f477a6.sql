
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON public.tournaments(created_by);

CREATE OR REPLACE FUNCTION public.set_tournament_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tournament_created_by ON public.tournaments;
CREATE TRIGGER trg_set_tournament_created_by
BEFORE INSERT ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.set_tournament_created_by();
