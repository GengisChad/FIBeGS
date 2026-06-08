
-- Add status to tournaments to track tournament phases
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
-- status values: 'pending', 'swiss', 'top_cut', 'completed'

-- Tournament matches table
CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round integer NOT NULL,
  phase text NOT NULL DEFAULT 'swiss', -- 'swiss' or 'top_cut'
  match_number integer NOT NULL DEFAULT 1,
  player1_id uuid, -- null = BYE
  player2_id uuid, -- null = BYE
  player1_score integer DEFAULT 0,
  player2_score integer DEFAULT 0,
  winner_id uuid,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- Everyone can view matches
CREATE POLICY "Matches are viewable by everyone"
  ON public.tournament_matches FOR SELECT
  USING (true);

-- Club staff can manage matches for their tournaments
CREATE POLICY "Club staff can insert matches"
  ON public.tournament_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
      AND t.club_id IS NOT NULL
      AND public.is_club_staff(auth.uid(), t.club_id)
    )
  );

CREATE POLICY "Club staff can update matches"
  ON public.tournament_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
      AND t.club_id IS NOT NULL
      AND public.is_club_staff(auth.uid(), t.club_id)
    )
  );

CREATE POLICY "Club staff can delete matches"
  ON public.tournament_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
      AND t.club_id IS NOT NULL
      AND public.is_club_staff(auth.uid(), t.club_id)
    )
  );

-- Admin overrides for matches
CREATE POLICY "Admins can insert matches"
  ON public.tournament_matches FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update matches"
  ON public.tournament_matches FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete matches"
  ON public.tournament_matches FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tournament standings table (Swiss standings tracker)
CREATE TABLE public.tournament_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  game_wins integer NOT NULL DEFAULT 0,
  game_losses integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  resistance numeric(5,2) NOT NULL DEFAULT 0,
  seed integer,
  dropped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE public.tournament_standings ENABLE ROW LEVEL SECURITY;

-- Everyone can view standings
CREATE POLICY "Standings are viewable by everyone"
  ON public.tournament_standings FOR SELECT
  USING (true);

-- Club staff can manage standings
CREATE POLICY "Club staff can insert standings"
  ON public.tournament_standings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
      AND t.club_id IS NOT NULL
      AND public.is_club_staff(auth.uid(), t.club_id)
    )
  );

CREATE POLICY "Club staff can update standings"
  ON public.tournament_standings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
      AND t.club_id IS NOT NULL
      AND public.is_club_staff(auth.uid(), t.club_id)
    )
  );

CREATE POLICY "Club staff can delete standings"
  ON public.tournament_standings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
      AND t.club_id IS NOT NULL
      AND public.is_club_staff(auth.uid(), t.club_id)
    )
  );

-- Admin overrides for standings
CREATE POLICY "Admins can insert standings"
  ON public.tournament_standings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update standings"
  ON public.tournament_standings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete standings"
  ON public.tournament_standings FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can also update tournament status
CREATE POLICY "Admins can insert tournaments"
  ON public.tournaments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_tournament_matches_updated_at
  BEFORE UPDATE ON public.tournament_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tournament_standings_updated_at
  BEFORE UPDATE ON public.tournament_standings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_matches_tournament ON public.tournament_matches(tournament_id, round, phase);
CREATE INDEX idx_standings_tournament ON public.tournament_standings(tournament_id, points DESC);
