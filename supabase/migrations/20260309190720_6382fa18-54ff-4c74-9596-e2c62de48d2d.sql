
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS table_assignment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS matches_per_table integer NOT NULL DEFAULT 1;
