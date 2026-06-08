ALTER TABLE public.tournaments
ADD COLUMN under12_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN under12_separate_topcut boolean NOT NULL DEFAULT false;