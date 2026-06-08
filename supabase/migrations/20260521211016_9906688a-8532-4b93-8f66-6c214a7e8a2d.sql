WITH swiss_matches AS (
  SELECT *
  FROM public.tournament_matches
  WHERE tournament_id = 'fbc02710-cdc9-4db1-9290-074403992a1f'::uuid
    AND phase = 'swiss'
    AND status = 'completed'
), metrics AS (
  SELECT
    ts.id,
    ts.user_id,
    ts.points,
    ts.resistance,
    ts.game_wins,
    ts.game_losses,
    COALESCE((
      SELECT SUM(CASE
        WHEN opp.points = ts.points AND sm.player1_id = ts.user_id AND sm.winner_id = ts.user_id THEN 4
        WHEN opp.points = ts.points AND sm.player2_id = ts.user_id AND sm.winner_id = ts.user_id THEN 4
        WHEN opp.points = ts.points AND sm.winner_id IS NULL THEN 1
        ELSE 0 END)
      FROM swiss_matches sm
      JOIN public.tournament_standings opp
        ON opp.tournament_id = ts.tournament_id
       AND opp.user_id = CASE WHEN sm.player1_id = ts.user_id THEN sm.player2_id ELSE sm.player1_id END
      WHERE (sm.player1_id = ts.user_id OR sm.player2_id = ts.user_id)
        AND sm.player1_id IS NOT NULL AND sm.player2_id IS NOT NULL
    ), 0) AS head_to_head,
    COALESCE((
      SELECT SUM(CASE
        WHEN sm.player1_id = ts.user_id THEN GREATEST(0, COALESCE(sm.player1_score, 0) - 4)
        WHEN sm.player2_id = ts.user_id THEN GREATEST(0, COALESCE(sm.player2_score, 0) - 4)
        ELSE 0 END)
      FROM swiss_matches sm
      WHERE (sm.player1_id = ts.user_id OR sm.player2_id = ts.user_id)
        AND sm.player1_id IS NOT NULL AND sm.player2_id IS NOT NULL
    ), 0) AS gw_diff,
    COALESCE((
      SELECT SUM(COALESCE(opp.points, 0))
      FROM swiss_matches sm
      JOIN public.tournament_standings opp
        ON opp.tournament_id = ts.tournament_id
       AND opp.user_id = CASE WHEN sm.player1_id = ts.user_id THEN sm.player2_id ELSE sm.player1_id END
      WHERE (sm.player1_id = ts.user_id OR sm.player2_id = ts.user_id)
        AND sm.player1_id IS NOT NULL AND sm.player2_id IS NOT NULL
    ), 0) AS buchholz,
    COALESCE((
      SELECT COUNT(*)
      FROM swiss_matches sm
      WHERE (sm.player1_id = ts.user_id OR sm.player2_id = ts.user_id)
        AND sm.player1_id IS NOT NULL AND sm.player2_id IS NOT NULL
    ), 0) AS matches_played
  FROM public.tournament_standings ts
  WHERE ts.tournament_id = 'fbc02710-cdc9-4db1-9290-074403992a1f'::uuid
    AND COALESCE(ts.dropped, false) = false
), ranked AS (
  SELECT
    metrics.id,
    row_number() OVER (
      ORDER BY
        metrics.points DESC,
        metrics.head_to_head DESC,
        metrics.resistance DESC,
        CASE WHEN (metrics.game_wins + metrics.game_losses) > 0 THEN metrics.game_wins::numeric / (metrics.game_wins + metrics.game_losses) ELSE 0 END DESC,
        metrics.gw_diff DESC,
        metrics.buchholz DESC,
        metrics.matches_played ASC,
        metrics.user_id
    ) AS new_seed
  FROM metrics
)
UPDATE public.tournament_standings ts
SET seed = ranked.new_seed,
    opponent_match_win_pct = ts.resistance
FROM ranked
WHERE ts.id = ranked.id;

DO $$
DECLARE
  repair_result jsonb;
BEGIN
  SELECT public.repair_top_cut_pairings('fbc02710-cdc9-4db1-9290-074403992a1f'::uuid)
  INTO repair_result;

  IF COALESCE((repair_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Top Cut repair failed: %', repair_result;
  END IF;
END $$;