
-- Recalculate all existing tournament_results with new scoring curve
-- Using a DO block to apply the new per-placement base points and log-based multiplier

DO $$
DECLARE
  t_rec RECORD;
  r_rec RECORD;
  total_p INTEGER;
  scale_f NUMERIC;
  base_aw INTEGER;
BEGIN
  FOR t_rec IN SELECT DISTINCT tournament_id FROM tournament_results LOOP
    -- Get participant count
    SELECT COUNT(*) INTO total_p FROM tournament_standings 
    WHERE tournament_id = t_rec.tournament_id AND dropped = false;
    
    -- Log-based scaling
    scale_f := 1.0 + GREATEST(0, ln(GREATEST(total_p, 1)::numeric / 8.0)) * 0.15;
    
    FOR r_rec IN SELECT id, placement FROM tournament_results WHERE tournament_id = t_rec.tournament_id LOOP
      CASE
        WHEN r_rec.placement = 1  THEN base_aw := 100;
        WHEN r_rec.placement = 2  THEN base_aw := 85;
        WHEN r_rec.placement = 3  THEN base_aw := 70;
        WHEN r_rec.placement = 4  THEN base_aw := 60;
        WHEN r_rec.placement = 5  THEN base_aw := 52;
        WHEN r_rec.placement = 6  THEN base_aw := 46;
        WHEN r_rec.placement = 7  THEN base_aw := 40;
        WHEN r_rec.placement = 8  THEN base_aw := 35;
        WHEN r_rec.placement = 9  THEN base_aw := 30;
        WHEN r_rec.placement = 10 THEN base_aw := 26;
        WHEN r_rec.placement = 11 THEN base_aw := 23;
        WHEN r_rec.placement = 12 THEN base_aw := 20;
        WHEN r_rec.placement = 13 THEN base_aw := 18;
        WHEN r_rec.placement = 14 THEN base_aw := 16;
        WHEN r_rec.placement = 15 THEN base_aw := 14;
        WHEN r_rec.placement = 16 THEN base_aw := 12;
        WHEN r_rec.placement <= 24 THEN base_aw := 8;
        WHEN r_rec.placement <= 32 THEN base_aw := 5;
        ELSE base_aw := 3;
      END CASE;
      
      UPDATE tournament_results 
      SET base_points = base_aw, scaled_points = ROUND(base_aw * scale_f)
      WHERE id = r_rec.id;
    END LOOP;
  END LOOP;

  -- Now recalculate all profile points
  UPDATE profiles SET points = 0, wins = 0, updated_at = now();
  UPDATE child_profiles SET points = 0, wins = 0, updated_at = now();

  -- Recalculate regular profiles (BFL=10 default)
  UPDATE profiles p
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id,
           SUM(tr.scaled_points) as total,
           COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
    FROM (
      SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
             ROW_NUMBER() OVER (PARTITION BY tr2.user_id ORDER BY tr2.scaled_points DESC) as rn
      FROM tournament_results tr2
      JOIN tournaments t ON t.id = tr2.tournament_id
      WHERE t.championship_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = tr2.user_id)
    ) tr
    WHERE tr.rn <= 10
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;

  -- Recalculate child profiles
  UPDATE child_profiles cp
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id as child_id,
           SUM(tr.scaled_points) as total,
           COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
    FROM (
      SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
             ROW_NUMBER() OVER (PARTITION BY tr2.user_id ORDER BY tr2.scaled_points DESC) as rn
      FROM tournament_results tr2
      JOIN tournaments t ON t.id = tr2.tournament_id
      WHERE t.championship_id IS NULL
        AND EXISTS (SELECT 1 FROM child_profiles c WHERE c.id = tr2.user_id)
    ) tr
    WHERE tr.rn <= 10
    GROUP BY tr.user_id
  ) sub
  WHERE cp.id = sub.child_id;
END;
$$;
