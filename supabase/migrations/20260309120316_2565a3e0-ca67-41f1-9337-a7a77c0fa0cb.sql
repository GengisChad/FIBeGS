
-- Table to store per-match beyblade selections from player decks
CREATE TABLE public.tournament_match_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  deck_beyblade_id uuid NOT NULL REFERENCES public.deck_beyblades(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id, position)
);

-- Enable RLS
ALTER TABLE public.tournament_match_decks ENABLE ROW LEVEL SECURITY;

-- Everyone can read (visibility logic handled in frontend based on round)
CREATE POLICY "Anyone can read match decks"
  ON public.tournament_match_decks FOR SELECT
  TO authenticated
  USING (true);

-- Players can insert/update their own selections
CREATE POLICY "Players can insert own match decks"
  ON public.tournament_match_decks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players can update own match decks"
  ON public.tournament_match_decks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Players can delete own match decks"
  ON public.tournament_match_decks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
