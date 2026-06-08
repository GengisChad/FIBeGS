
-- Repair an existing top-cut by rewriting Round 1 pairings using
-- standard bracket order (topcut_bracket_order helper from previous migration).
-- Only safe to run when no top-cut match has been played yet.
CREATE OR REPLACE FUNCTION public.repair_top_cut_pairings(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size int;
  v_first_round int;
  v_played int;
  v_seeds int[];
  v_order int[];
  v_match record;
  v_idx int;
  v_seed1 int;
  v_seed2 int;
  v_p1 uuid;
  v_p2 uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','moderator')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT MIN(round) INTO v_first_round
  FROM matches
  WHERE tournament_id = _tournament_id AND stage > 0;

  IF v_first_round IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_top_cut');
  END IF;

  SELECT COUNT(*) INTO v_played
  FROM matches
  WHERE tournament_id = _tournament_id AND stage > 0
    AND (winner_id IS NOT NULL OR score_a IS NOT NULL OR score_b IS NOT NULL);

  IF v_played > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'matches_already_played', 'played', v_played);
  END IF;

  -- Collect seeds present in R1 (in their current order) keyed by player_a
  WITH r1 AS (
    SELECT id, player_a_id, player_b_id, match_order
    FROM matches
    WHERE tournament_id = _tournament_id AND stage > 0 AND round = v_first_round
    ORDER BY match_order
  )
  SELECT array_agg(player) INTO v_seeds FROM (
    SELECT player_a_id AS player FROM r1
    UNION ALL
    SELECT player_b_id FROM r1
  ) s WHERE player IS NOT NULL;

  v_size := COALESCE(array_length(v_seeds, 1), 0);

  IF v_size < 2 OR v_size NOT IN (2,4,8,16,32) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_size', 'size', v_size);
  END IF;

  -- We need the original seed ranking (1..N). Recompute from tournament_results when possible
  -- otherwise assume current player order is already seeded.
  SELECT array_agg(user_id ORDER BY position) INTO v_seeds
  FROM tournament_results
  WHERE tournament_id = _tournament_id
    AND user_id = ANY(v_seeds)
    AND position BETWEEN 1 AND v_size;

  IF v_seeds IS NULL OR array_length(v_seeds,1) <> v_size THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'seeds_unavailable');
  END IF;

  v_order := topcut_bracket_order(v_size);

  v_idx := 1;
  FOR v_match IN
    SELECT id FROM matches
    WHERE tournament_id = _tournament_id AND stage > 0 AND round = v_first_round
    ORDER BY match_order
  LOOP
    v_seed1 := v_order[v_idx];
    v_seed2 := v_order[v_idx + 1];
    v_p1 := v_seeds[v_seed1];
    v_p2 := v_seeds[v_seed2];
    UPDATE matches
       SET player_a_id = v_p1,
           player_b_id = v_p2,
           pairing_meta = jsonb_build_object('repair', 'standard_bracket_v3', 'seeds', jsonb_build_array(v_seed1, v_seed2))
     WHERE id = v_match.id;
    v_idx := v_idx + 2;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'size', v_size, 'first_round', v_first_round);
END;
$$;
