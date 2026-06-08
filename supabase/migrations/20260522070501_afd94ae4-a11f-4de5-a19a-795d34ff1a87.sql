-- Apply placement-bracket overrides: for each tiebreaker match flagged as
-- "final" in its consolation subgroup (pairing_meta.tb_is_final=true),
-- override the placements of its winner/loser in tournament_results.
CREATE OR REPLACE FUNCTION public.apply_placement_bracket_overrides(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_winner uuid;
  v_loser uuid;
  v_pw int;
  v_pl int;
  v_total int;
BEGIN
  SELECT COUNT(*) INTO v_total FROM tournament_results WHERE tournament_id = _tournament_id;
  IF v_total = 0 THEN RETURN; END IF;

  FOR rec IN
    SELECT tm.winner_id, tm.player1_id, tm.player2_id, tm.pairing_meta
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id
      AND tm.phase = 'tiebreaker'
      AND tm.status = 'completed'
      AND tm.winner_id IS NOT NULL
      AND tm.pairing_meta IS NOT NULL
      AND (tm.pairing_meta->>'tb_is_final') = 'true'
      AND (tm.pairing_meta->>'tb_placement_winner') IS NOT NULL
      AND (tm.pairing_meta->>'tb_placement_loser') IS NOT NULL
  LOOP
    v_winner := rec.winner_id;
    v_loser := CASE WHEN rec.player1_id = rec.winner_id THEN rec.player2_id ELSE rec.player1_id END;
    v_pw := (rec.pairing_meta->>'tb_placement_winner')::int;
    v_pl := (rec.pairing_meta->>'tb_placement_loser')::int;

    UPDATE tournament_results
       SET placement = v_pw
     WHERE tournament_id = _tournament_id AND user_id = v_winner;

    IF v_loser IS NOT NULL THEN
      UPDATE tournament_results
         SET placement = v_pl
       WHERE tournament_id = _tournament_id AND user_id = v_loser;
    END IF;
  END LOOP;

  -- Refresh scaled points for any updated rows using the standard scaled-points ladder
  UPDATE tournament_results SET
    base_points = CASE
      WHEN placement = 1  THEN 100
      WHEN placement = 2  THEN 85
      WHEN placement = 3  THEN 70
      WHEN placement = 4  THEN 60
      WHEN placement = 5  THEN 52
      WHEN placement = 6  THEN 46
      WHEN placement = 7  THEN 40
      WHEN placement = 8  THEN 35
      WHEN placement = 9  THEN 30
      WHEN placement = 10 THEN 26
      WHEN placement = 11 THEN 23
      WHEN placement = 12 THEN 20
      WHEN placement = 13 THEN 18
      WHEN placement = 14 THEN 16
      WHEN placement = 15 THEN 14
      WHEN placement = 16 THEN 12
      WHEN placement <= 24 THEN 8
      WHEN placement <= 32 THEN 5
      ELSE 3
    END
  WHERE tournament_id = _tournament_id;
END;
$$;

-- Hook the override into finalize_tournament_points by wrapping its body.
CREATE OR REPLACE FUNCTION public.finalize_tournament_points_with_placement_overrides(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.finalize_tournament_points(_tournament_id);
  PERFORM public.apply_placement_bracket_overrides(_tournament_id);
END;
$$;