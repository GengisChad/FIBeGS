
-- Function to finalize tournament and sync points to national rankings
CREATE OR REPLACE FUNCTION public.finalize_tournament_points(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  rank_pos INTEGER := 0;
  award INTEGER;
BEGIN
  -- Loop through standings ordered by points/resistance
  FOR rec IN
    SELECT ts.user_id, ts.wins as t_wins,
           ROW_NUMBER() OVER (ORDER BY ts.points DESC, ts.resistance DESC) as placement
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false
  LOOP
    -- Award points based on placement
    CASE
      WHEN rec.placement = 1 THEN award := 100;
      WHEN rec.placement = 2 THEN award := 75;
      WHEN rec.placement <= 4 THEN award := 50;
      WHEN rec.placement <= 8 THEN award := 30;
      WHEN rec.placement <= 16 THEN award := 15;
      ELSE award := 5;
    END CASE;

    -- Update profile: add points, increment wins if 1st place
    UPDATE profiles
    SET points = COALESCE(points, 0) + award,
        wins = CASE WHEN rec.placement = 1 THEN COALESCE(wins, 0) + 1 ELSE COALESCE(wins, 0) END,
        updated_at = now()
    WHERE user_id = rec.user_id;
  END LOOP;
END;
$$;
