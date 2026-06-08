-- 1. Allow DB superuser to call finalize_tournament_points (for maintenance migrations)
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
  IF NOT (
    current_user IN ('postgres','supabase_admin')
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = _tournament_id
      AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admins and tournament staff can finalize points';
  END IF;

  -- delegate to the rest of the original body unchanged by reusing internal helper
  -- (we keep the full body inline below)
  SELECT championship_id, is_ranked, custom_swiss_win_points, custom_top_win_points
    INTO _championship_id, _is_ranked, _custom_swiss, _custom_top
    FROM tournaments WHERE id = _tournament_id;

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
          ts.points AS swiss_points,
          ts.opponent_match_win_pct AS swiss_resistance,
          NULL::int AS tb_placement
        FROM tournament_matches tm
        LEFT JOIN tournament_standings ts
          ON ts.tournament_id = tm.tournament_id
         AND ts.user_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
        WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
          AND tm.round = rec.tc_round AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
          AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
      ) losers;
    END LOOP;

    -- Swiss-only players (didn't make top cut) get placements after top cut
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           (SELECT COALESCE(MAX(placement),0) FROM tournament_results WHERE tournament_id = _tournament_id)
             + row_number() OVER (ORDER BY ts.points DESC, ts.opponent_match_win_pct DESC NULLS LAST, ts.game_wins DESC),
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id
      AND ts.dropped = false
      AND ts.user_id NOT IN (SELECT user_id FROM tournament_results WHERE tournament_id = _tournament_id);
  ELSE
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           row_number() OVER (ORDER BY ts.points DESC, ts.opponent_match_win_pct DESC NULLS LAST, ts.game_wins DESC),
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false;
  END IF;

  -- Compute base/scaled points
  FOR rec IN SELECT * FROM tournament_results WHERE tournament_id = _tournament_id LOOP
    DECLARE
      _base INTEGER;
      _scaled INTEGER;
      _swiss_wins INTEGER := 0;
      _tc_wins INTEGER := 0;
    BEGIN
      SELECT COALESCE(wins,0) INTO _swiss_wins FROM tournament_standings WHERE tournament_id=_tournament_id AND user_id=rec.user_id;
      SELECT COUNT(*) INTO _tc_wins FROM tournament_matches WHERE tournament_id=_tournament_id AND phase='top_cut' AND winner_id=rec.user_id AND status='completed';
      _base := PARTICIPATION_BONUS + (_swiss_wins * _swiss_pts) + (_tc_wins * _top_pts);
      _scaled := _base;
      UPDATE tournament_results SET base_points=_base, scaled_points=_scaled WHERE id=rec.id;
    END;
  END LOOP;
END;
$function$;

-- 2. Re-finalize all imported completed tournaments
DO $mig$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM tournaments WHERE is_external = true AND status = 'completed' LOOP
    BEGIN
      PERFORM public.finalize_tournament_points(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'finalize failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $mig$;

-- 3. Clean up any orphan tournament_results (user no longer exists)
DELETE FROM tournament_results
WHERE user_id NOT IN (SELECT id FROM profiles);