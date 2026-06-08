-- =====================================================================
-- 1. FIX: finalize_tournament_points must call recalculate_all_rankings
--    so points get refreshed in profiles.points / points_monthly when a
--    tournament is closed. Without this the Monthly BFL tab is empty
--    and players' totals don't update until admin clicks "Ricalcola BFL".
--    Also: explicitly EXCLUDE all phase='tiebreaker' matches from win-points.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.finalize_tournament_points(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  total_participants INTEGER;
  active_bfl INTEGER;
  _championship_id uuid;
  _total_tc_rounds INTEGER;
  _has_top_cut BOOLEAN;
  _season_start date;
  _is_ranked BOOLEAN;
  _custom_swiss INTEGER;
  _custom_top INTEGER;
  PARTICIPATION_BONUS INTEGER := 2;
  POINTS_PER_WIN INTEGER := 4;
  _swiss_pts INTEGER;
  _top_pts INTEGER;
  _setting_val TEXT;
  _monthly_enabled BOOLEAN := false;
  _monthly_bfl INTEGER := 2;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = _tournament_id
    AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)
  )) THEN
    RAISE EXCEPTION 'Unauthorized: only admins and tournament staff can finalize points';
  END IF;

  SELECT championship_id, is_ranked, custom_swiss_win_points, custom_top_win_points
    INTO _championship_id, _is_ranked, _custom_swiss, _custom_top
    FROM tournaments WHERE id = _tournament_id;

  -- Read global competitive defaults from site_settings
  BEGIN
    SELECT value INTO _setting_val FROM site_settings WHERE key = 'competitive_participation_bonus';
    IF _setting_val IS NOT NULL AND _setting_val ~ '^\d+$' THEN
      PARTICIPATION_BONUS := _setting_val::int;
    END IF;
    SELECT value INTO _setting_val FROM site_settings WHERE key = 'competitive_points_per_win';
    IF _setting_val IS NOT NULL AND _setting_val ~ '^\d+$' THEN
      POINTS_PER_WIN := _setting_val::int;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PARTICIPATION_BONUS := 2;
    POINTS_PER_WIN := 4;
  END;

  _swiss_pts := CASE WHEN NOT _is_ranked AND _custom_swiss IS NOT NULL THEN _custom_swiss ELSE POINTS_PER_WIN END;
  _top_pts := CASE WHEN NOT _is_ranked AND _custom_top IS NOT NULL THEN _custom_top ELSE POINTS_PER_WIN END;

  SELECT COUNT(*) INTO total_participants
  FROM tournament_standings
  WHERE tournament_id = _tournament_id AND dropped = false;

  SELECT bfl, start_date,
         COALESCE(monthly_bfl_enabled, false),
         COALESCE(monthly_bfl, 2)
    INTO active_bfl, _season_start, _monthly_enabled, _monthly_bfl
    FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  SELECT EXISTS(
    SELECT 1 FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut'
  ) INTO _has_top_cut;

  DELETE FROM tournament_results WHERE tournament_id = _tournament_id;

  IF _has_top_cut THEN
    SELECT COALESCE(MAX(round), 0) INTO _total_tc_rounds
    FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut';

    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, tm.winner_id, 1, total_participants, 0, 0
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
      AND tm.round = _total_tc_rounds AND tm.match_number = 1
      AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
    LIMIT 1;

    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id,
           CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END,
           2, total_participants, 0, 0
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
      AND tm.round = _total_tc_rounds AND tm.match_number = 1
      AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
    LIMIT 1;

    FOR rec IN
      SELECT r AS tc_round,
             CASE WHEN (_total_tc_rounds - r) = 1 THEN 3
               ELSE POWER(2, _total_tc_rounds - r)::int + 1
             END AS placement_start
      FROM generate_series(_total_tc_rounds - 1, 1, -1) r
    LOOP
      INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
      SELECT _tournament_id, loser_id,
             rec.placement_start + (row_number() OVER (ORDER BY tb_placement ASC NULLS LAST, swiss_points DESC, swiss_resistance DESC))::int - 1,
             total_participants, 0, 0
      FROM (
        SELECT
          CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END AS loser_id,
          (SELECT CASE
            WHEN EXISTS (
              SELECT 1 FROM tournament_matches tb
              WHERE tb.tournament_id = _tournament_id AND tb.phase = 'tiebreaker' AND tb.status = 'completed'
                AND tb.winner_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
            ) THEN 0
            WHEN EXISTS (
              SELECT 1 FROM tournament_matches tb
              WHERE tb.tournament_id = _tournament_id AND tb.phase = 'tiebreaker' AND tb.status = 'completed'
                AND tb.winner_id IS NOT NULL
                AND (
                  tb.player1_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
                  OR tb.player2_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
                )
            ) THEN 1
            ELSE NULL END) AS tb_placement,
          COALESCE((SELECT ts.points FROM tournament_standings ts
                    WHERE ts.tournament_id = _tournament_id
                      AND ts.user_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
          ), 0) AS swiss_points,
          COALESCE((SELECT ts.opponent_match_win_pct FROM tournament_standings ts
                    WHERE ts.tournament_id = _tournament_id
                      AND ts.user_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
          ), 0) AS swiss_resistance
        FROM tournament_matches tm
        WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
          AND tm.round = rec.tc_round
          AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
          AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
          -- Exclude 3rd-place playoff match (final round, match 2)
          AND NOT (rec.tc_round = _total_tc_rounds AND tm.match_number = 2)
      ) sub;
    END LOOP;

    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           POWER(2, _total_tc_rounds)::int + (row_number() OVER (ORDER BY ts.points DESC, ts.opponent_match_win_pct DESC)),
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id
      AND ts.dropped = false
      AND ts.user_id NOT IN (
        SELECT user_id FROM tournament_results WHERE tournament_id = _tournament_id
      );
  ELSE
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           row_number() OVER (ORDER BY ts.points DESC, ts.opponent_match_win_pct DESC, ts.opponent_opponent_match_win_pct DESC),
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false;
  END IF;

  -- Compute base & scaled points
  -- IMPORTANT: phase='tiebreaker' matches NEVER award ranking points.
  -- Also exclude top_cut 3rd-place match (final round, match 2).
  UPDATE tournament_results tr
  SET base_points = sub.base_points,
      scaled_points = sub.scaled_points
  FROM (
    SELECT tr2.user_id,
           PARTICIPATION_BONUS
             + (COALESCE((SELECT COUNT(*) FROM tournament_matches m
                          WHERE m.tournament_id = _tournament_id
                            AND m.phase = 'swiss'
                            AND m.winner_id = tr2.user_id), 0) * _swiss_pts)
             + (COALESCE((SELECT COUNT(*) FROM tournament_matches m
                          WHERE m.tournament_id = _tournament_id
                            AND m.phase = 'top_cut'
                            AND m.winner_id = tr2.user_id
                            AND NOT (m.round = _total_tc_rounds AND m.match_number = 2)
                          ), 0) * _top_pts)
             AS base_points,
           CASE WHEN _is_ranked THEN
             ROUND(
               (PARTICIPATION_BONUS
                 + (COALESCE((SELECT COUNT(*) FROM tournament_matches m
                              WHERE m.tournament_id = _tournament_id
                                AND m.phase = 'swiss'
                                AND m.winner_id = tr2.user_id), 0) * _swiss_pts)
                 + (COALESCE((SELECT COUNT(*) FROM tournament_matches m
                              WHERE m.tournament_id = _tournament_id
                                AND m.phase = 'top_cut'
                                AND m.winner_id = tr2.user_id
                                AND NOT (m.round = _total_tc_rounds AND m.match_number = 2)
                              ), 0) * _top_pts)
               ) * (1 + (LEAST(total_participants, 64)::numeric - 1) / 63 * 0.5)
             )::int
           ELSE 0 END AS scaled_points
    FROM tournament_results tr2
    WHERE tr2.tournament_id = _tournament_id
  ) sub
  WHERE tr.tournament_id = _tournament_id AND tr.user_id = sub.user_id;

  -- CRITICAL: refresh global rankings so profiles.points (and points_monthly when
  -- monthly BFL is enabled on the active season) reflect the freshly closed
  -- tournament. Skip for championship-scoped tournaments and non-ranked ones.
  IF _is_ranked AND _championship_id IS NULL THEN
    PERFORM public.recalculate_all_rankings(active_bfl, _monthly_enabled, _monthly_bfl);
  END IF;
END;
$function$;