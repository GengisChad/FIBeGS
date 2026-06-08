-- Table for tracking simple "PARTECIPO" attendance on free_play (allenamento) events
CREATE TABLE public.event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX idx_event_participants_tournament ON public.event_participants(tournament_id);
CREATE INDEX idx_event_participants_user ON public.event_participants(user_id);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view
CREATE POLICY "Event participants are viewable by everyone"
ON public.event_participants
FOR SELECT
USING (true);

-- Users can register themselves
CREATE POLICY "Users can register themselves to events"
ON public.event_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can remove themselves
CREATE POLICY "Users can remove their own event participation"
ON public.event_participants
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
