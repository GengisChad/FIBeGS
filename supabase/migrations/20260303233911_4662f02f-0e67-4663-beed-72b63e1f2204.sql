
ALTER TABLE public.tournament_registrations 
  ADD COLUMN IF NOT EXISTS is_ready boolean NOT NULL DEFAULT false;

ALTER TABLE public.tournaments 
  ADD COLUMN IF NOT EXISTS check_in_enabled boolean NOT NULL DEFAULT false;
