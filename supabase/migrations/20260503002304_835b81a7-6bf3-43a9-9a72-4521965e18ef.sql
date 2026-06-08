CREATE OR REPLACE FUNCTION public.recalculate_all_rankings(
  _bfl integer DEFAULT 10,
  _monthly_bfl_enabled boolean DEFAULT false,
  _monthly_bfl integer DEFAULT 2
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _season_start date;
  _season_end date;
BEGIN
  SELECT start_date, end_date INTO _season_start, _season_end
  FROM ranking_seasons WHERE is_active = true LIMIT 1;

  UPDATE profiles
    SET points = 0, wins = 0, points_monthly = 0, wins_monthly = 0, updated_at = now()
    WHERE true;
  UPDATE child_profiles
    SET points = 0, wins = 0, points_monthly = 0, wins_monthly = 0, updated_at = now()
    WHERE true;

  ---------------------------------------------------------------
  -- (A) SEASONAL-ONLY -> points / wins
  ---------------------------------------------------------------
  UPDATE profiles p
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id,
           SUM(tr.scaled_points) AS total,
           COUNT(*) FILTER (WHERE tr.placement = 1) AS win_count
    FROM (
      SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
             ROW_NUMBER() OVER (PARTITION BY tr2.user_id ORDER BY tr2.scaled_points DESC) AS rn
      FROM tournament_results tr2
      JOIN tournaments t ON t.id = tr2.tournament_id
      WHERE t.championship_id IS NULL
        AND t.is_external = false
        AND t.is_ranked = true
        AND NOT EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = tr2.user_id)
        AND (_season_start IS NULL OR t.event_date >= _season_start)
        AND (_season_end IS NULL OR t.event_date <= _season_end)
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
    SELECT tr.user_id AS child_id,
           SUM(tr.scaled_points) AS total,
           COUNT(*) FILTER (WHERE tr.placement = 1) AS win_count
    FROM (
      SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
             ROW_NUMBER() OVER (PARTITION BY tr2.user_id ORDER BY tr2.scaled_points DESC) AS rn
      FROM tournament_results tr2
      JOIN tournaments t ON t.id = tr2.tournament_id
      WHERE t.championship_id IS NULL
        AND t.is_external = false
        AND t.is_ranked = true
        AND EXISTS (SELECT 1 FROM child_profiles c WHERE c.id = tr2.user_id)
        AND (_season_start IS NULL OR t.event_date >= _season_start)
        AND (_season_end IS NULL OR t.event_date <= _season_end)
    ) tr
    WHERE tr.rn <= _bfl
    GROUP BY tr.user_id
  ) sub
  WHERE cp.id = sub.child_id;

  ---------------------------------------------------------------
  -- (B) MONTHLY + ROLLOVER -> points_monthly / wins_monthly
  -- Rollover cap is per-user: number of full months between season start
  -- and the month BEFORE the user's first ranked tournament, * monthly_bfl.
  ---------------------------------------------------------------
  IF _monthly_bfl_enabled THEN
    -- Adult profiles
    UPDATE profiles p
    SET points_monthly = COALESCE(sub.total, 0),
        wins_monthly = COALESCE(sub.win_count, 0),
        updated_at = now()
    FROM (
      SELECT pool.user_id,
             SUM(pool.scaled_points) AS total,
             COUNT(*) FILTER (WHERE pool.placement = 1) AS win_count
      FROM (
        SELECT cand.user_id, cand.scaled_points, cand.placement,
               ROW_NUMBER() OVER (
                 PARTITION BY cand.user_id
                 ORDER BY cand.is_monthly DESC, cand.scaled_points DESC
               ) AS rn_final
        FROM (
          SELECT base.user_id, base.scaled_points, base.placement,
                 CASE WHEN base.rn_month <= GREATEST(_monthly_bfl, 1) THEN 1 ELSE 0 END AS is_monthly,
                 ROW_NUMBER() OVER (
                   PARTITION BY base.user_id, CASE WHEN base.rn_month <= GREATEST(_monthly_bfl, 1) THEN 1 ELSE 0 END
                   ORDER BY base.scaled_points DESC
                 ) AS rn_within_group,
                 base.user_rollover_cap
          FROM (
            SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
                   ROW_NUMBER() OVER (
                     PARTITION BY tr2.user_id, date_trunc('month', t.event_date)
                     ORDER BY tr2.scaled_points DESC
                   ) AS rn_month,
                   GREATEST(0,
                     ((EXTRACT(YEAR FROM MIN(t.event_date) OVER (PARTITION BY tr2.user_id))::int
                       - EXTRACT(YEAR FROM _season_start)::int) * 12
                      + (EXTRACT(MONTH FROM MIN(t.event_date) OVER (PARTITION BY tr2.user_id))::int
                         - EXTRACT(MONTH FROM _season_start)::int))
                   ) * GREATEST(_monthly_bfl, 1) AS user_rollover_cap
            FROM tournament_results tr2
            JOIN tournaments t ON t.id = tr2.tournament_id
            WHERE t.championship_id IS NULL
              AND t.is_external = false
              AND t.is_ranked = true
              AND NOT EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = tr2.user_id)
              AND (_season_start IS NULL OR t.event_date >= _season_start)
              AND (_season_end IS NULL OR t.event_date <= _season_end)
          ) base
        ) cand
        WHERE cand.is_monthly = 1
           OR cand.rn_within_group <= cand.user_rollover_cap
      ) pool
      WHERE pool.rn_final <= _bfl
      GROUP BY pool.user_id
    ) sub
    WHERE p.user_id = sub.user_id;

    -- Child profiles
    UPDATE child_profiles cp
    SET points_monthly = COALESCE(sub.total, 0),
        wins_monthly = COALESCE(sub.win_count, 0),
        updated_at = now()
    FROM (
      SELECT pool.user_id AS child_id,
             SUM(pool.scaled_points) AS total,
             COUNT(*) FILTER (WHERE pool.placement = 1) AS win_count
      FROM (
        SELECT cand.user_id, cand.scaled_points, cand.placement,
               ROW_NUMBER() OVER (
                 PARTITION BY cand.user_id
                 ORDER BY cand.is_monthly DESC, cand.scaled_points DESC
               ) AS rn_final
        FROM (
          SELECT base.user_id, base.scaled_points, base.placement,
                 CASE WHEN base.rn_month <= GREATEST(_monthly_bfl, 1) THEN 1 ELSE 0 END AS is_monthly,
                 ROW_NUMBER() OVER (
                   PARTITION BY base.user_id, CASE WHEN base.rn_month <= GREATEST(_monthly_bfl, 1) THEN 1 ELSE 0 END
                   ORDER BY base.scaled_points DESC
                 ) AS rn_within_group,
                 base.user_rollover_cap
          FROM (
            SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
                   ROW_NUMBER() OVER (
                     PARTITION BY tr2.user_id, date_trunc('month', t.event_date)
                     ORDER BY tr2.scaled_points DESC
                   ) AS rn_month,
                   GREATEST(0,
                     ((EXTRACT(YEAR FROM MIN(t.event_date) OVER (PARTITION BY tr2.user_id))::int
                       - EXTRACT(YEAR FROM _season_start)::int) * 12
                      + (EXTRACT(MONTH FROM MIN(t.event_date) OVER (PARTITION BY tr2.user_id))::int
                         - EXTRACT(MONTH FROM _season_start)::int))
                   ) * GREATEST(_monthly_bfl, 1) AS user_rollover_cap
            FROM tournament_results tr2
            JOIN tournaments t ON t.id = tr2.tournament_id
            WHERE t.championship_id IS NULL
              AND t.is_external = false
              AND t.is_ranked = true
              AND EXISTS (SELECT 1 FROM child_profiles c WHERE c.id = tr2.user_id)
              AND (_season_start IS NULL OR t.event_date >= _season_start)
              AND (_season_end IS NULL OR t.event_date <= _season_end)
          ) base
        ) cand
        WHERE cand.is_monthly = 1
           OR cand.rn_within_group <= cand.user_rollover_cap
      ) pool
      WHERE pool.rn_final <= _bfl
      GROUP BY pool.user_id
    ) sub
    WHERE cp.id = sub.child_id;
  END IF;
END;
$function$;