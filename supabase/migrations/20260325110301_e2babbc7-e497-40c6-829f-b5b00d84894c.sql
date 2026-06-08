
DROP FUNCTION IF EXISTS public.recalculate_all_rankings(integer);

CREATE OR REPLACE FUNCTION public.recalculate_all_rankings(_bfl integer DEFAULT 10)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _season_start date;
BEGIN
  SELECT start_date INTO _season_start FROM ranking_seasons WHERE is_active = true LIMIT 1;

  UPDATE profiles SET points = 0, wins = 0, updated_at = now() WHERE true;
  UPDATE child_profiles SET points = 0, wins = 0, updated_at = now() WHERE true;

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
        AND t.is_ranked = true
        AND NOT EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = tr2.user_id)
        AND (_season_start IS NULL OR t.date >= _season_start)
    ) tr
    WHERE tr.rn <= _bfl
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;

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
        AND t.is_ranked = true
        AND EXISTS (SELECT 1 FROM child_profiles c WHERE c.id = tr2.user_id)
        AND (_season_start IS NULL OR t.date >= _season_start)
    ) tr
    WHERE tr.rn <= _bfl
    GROUP BY tr.user_id
  ) sub
  WHERE cp.id = sub.child_id;
END;
$$;
