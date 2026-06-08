CREATE INDEX IF NOT EXISTS idx_tournament_standings_user
  ON public.tournament_standings (user_id, tournament_id) INCLUDE (wins);

CREATE INDEX IF NOT EXISTS idx_tournaments_ranked_event_date
  ON public.tournaments (event_date)
  WHERE is_ranked = true AND is_external = false;

CREATE INDEX IF NOT EXISTS idx_tournaments_status_date
  ON public.tournaments (status, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_tournaments_club_status_date
  ON public.tournaments (club_id, status, event_date DESC)
  WHERE club_id IS NOT NULL;