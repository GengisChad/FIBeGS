
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS max_members INT NOT NULL DEFAULT 3;

CREATE OR REPLACE FUNCTION public.enforce_team_max_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INT;
  cap INT;
BEGIN
  SELECT COALESCE(max_members, 3) INTO cap FROM public.teams WHERE id = NEW.team_id;
  SELECT COUNT(*) INTO current_count FROM public.team_members WHERE team_id = NEW.team_id;
  IF current_count >= cap THEN
    RAISE EXCEPTION 'La squadra ha raggiunto il numero massimo di membri (%).', cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_team_max_members ON public.team_members;
CREATE TRIGGER trg_enforce_team_max_members
BEFORE INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_team_max_members();
