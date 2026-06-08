-- Add monthly BFL fields to ranking_seasons (per-season config)
ALTER TABLE public.ranking_seasons
  ADD COLUMN IF NOT EXISTS monthly_bfl_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_bfl integer NOT NULL DEFAULT 2;

-- Recalculate rankings with optional monthly pre-filter.
-- When _monthly_bfl_enabled is true: for each user, group their tournament_results
-- by calendar month (based on tournaments.start_date), keep only the top
-- _monthly_bfl scored tournaments per month, then apply the seasonal _bfl on
-- the resulting set (best _bfl total).
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
  _season_end date;
BEGIN
  -- Get active season window (if any) to scope tournaments
  SELECT start_date, end_date
    INTO _season_start, _season_end
  FROM public.ranking_seasons
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- Aggregated points per user with optional monthly pre-filter
  WITH base AS (
    SELECT
      tr.user_id,
      tr.tournament_id,
      COALESCE(tr.scaled_points, 0)::numeric AS pts,
      date_trunc('month', t.start_date)::date AS month_key
    FROM public.tournament_results tr
    JOIN public.tournaments t ON t.id = tr.tournament_id
    WHERE (_season_start IS NULL OR t.start_date >= _season_start)
      AND (_season_end IS NULL OR t.start_date <= _season_end)
      AND COALESCE(t.is_ranked, false) = true
  ),
  ranked_monthly AS (
    SELECT
      user_id, tournament_id, pts, month_key,
      ROW_NUMBER() OVER (PARTITION BY user_id, month_key ORDER BY pts DESC) AS rn_month
    FROM base
  ),
  monthly_filtered AS (
    SELECT user_id, tournament_id, pts
    FROM ranked_monthly
    WHERE NOT _monthly_bfl_enabled
       OR rn_month <= GREATEST(_monthly_bfl, 1)
  ),
  ranked_season AS (
    SELECT
      user_id, tournament_id, pts,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY pts DESC) AS rn_season
    FROM monthly_filtered
  ),
  totals AS (
    SELECT user_id, SUM(pts)::numeric AS total_points
    FROM ranked_season
    WHERE rn_season <= GREATEST(_bfl, 1)
    GROUP BY user_id
  )
  UPDATE public.profiles p
     SET points = COALESCE(t.total_points, 0)
    FROM totals t
   WHERE p.id = t.user_id;
END;
$$;