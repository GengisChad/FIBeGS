ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'tournament';

COMMENT ON COLUMN public.tournaments.event_type IS 'tournament | free_play | event';