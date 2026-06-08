-- Drop both overloaded versions to start clean
DROP FUNCTION IF EXISTS public.recalculate_all_rankings(integer);
DROP FUNCTION IF EXISTS public.recalculate_all_rankings(integer, boolean, integer);

CREATE OR REPLACE FUNCTION public.recalculate_all_rankings(
  _bfl integer DEFAULT 10,
  _monthly_bfl_enabled boolean DEFAULT false,
  _monthly_bfl integer DEFAULT 2
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _season_start date;
BEGIN
  SELECT start_date INTO _season_start FROM ranking_seasons WHERE is_active = true LIMIT 1;

  -- Reset all points
  UPDATE profiles SET points = 0, wins = 0, updated_at = now() WHERE true;
  UPDATE child_profiles SET points = 0, wins = 0, updated_at = now() WHERE true;

  -- Update adult profiles (excludes child profile ids)
  UPDATE profiles p
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id,
           SUM(tr.scaled_points) AS total,
           COUNT(*) FILTER (WHERE tr.placement = 1) AS win_count
    FROM (
      SELECT trf.user_id,
             trf.scaled_points,
             trf.placement,
             ROW_NUMBER() OVER (PARTITION BY trf.user_id ORDER BY trf.scaled_points DESC) AS rn
      FROM (
        -- Monthly pre-filter: keep only top _monthly_bfl tournaments per user per calendar month
        SELECT tr2.user_id,
               tr2.scaled_points,
               tr2.placement,
               ROW_NUMBER() OVER (
                 PARTITION BY tr2.user_id, date_trunc('month', t.event_date)
                 ORDER BY tr2.scaled_points DESC
               ) AS rn_month
        FROM tournament_results tr2
        JOIN tournaments t ON t.id = tr2.tournament_id
        WHERE t.championship_id IS NULL
          AND t.is_external = false
          AND t.is_ranked = true
          AND NOT EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = tr2.user_id)
          AND (_season_start IS NULL OR t.event_date >= _season_start)
      ) trf
      WHERE NOT _monthly_bfl_enabled
         OR trf.rn_month <= GREATEST(_monthly_bfl, 1)
    ) tr
    WHERE tr.rn <= _bfl
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;

  -- Update child profiles
  UPDATE child_profiles cp
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id AS child_id,
           SUM(tr.scaled_points) AS total,
           COUNT(*) FILTER (WHERE tr.placement = 1) AS win_count
    FROM (
      SELECT trf.user_id,
             trf.scaled_points,
             trf.placement,
             ROW_NUMBER() OVER (PARTITION BY trf.user_id ORDER BY trf.scaled_points DESC) AS rn
      FROM (
        SELECT tr2.user_id,
               tr2.scaled_points,
               tr2.placement,
               ROW_NUMBER() OVER (
                 PARTITION BY tr2.user_id, date_trunc('month', t.event_date)
                 ORDER BY tr2.scaled_points DESC
               ) AS rn_month
        FROM tournament_results tr2
        JOIN tournaments t ON t.id = tr2.tournament_id
        WHERE t.championship_id IS NULL
          AND t.is_external = false
          AND t.is_ranked = true
          AND EXISTS (SELECT 1 FROM child_profiles c WHERE c.id = tr2.user_id)
          AND (_season_start IS NULL OR t.event_date >= _season_start)
      ) trf
      WHERE NOT _monthly_bfl_enabled
         OR trf.rn_month <= GREATEST(_monthly_bfl, 1)
    ) tr
    WHERE tr.rn <= _bfl
    GROUP BY tr.user_id
  ) sub
  WHERE cp.id = sub.child_id;
END;
$$;