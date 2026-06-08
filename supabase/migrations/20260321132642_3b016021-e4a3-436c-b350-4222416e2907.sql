
CREATE OR REPLACE FUNCTION public.finalize_tournament_points(_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  total_participants INTEGER;
  base_award INTEGER;
  scale_factor NUMERIC;
  final_award INTEGER;
  active_bfl INTEGER;
  _championship_id uuid;
  _top_cut_size INTEGER;
  _total_tc_rounds INTEGER;
  _has_top_cut BOOLEAN;
  _has_tiebreakers BOOLEAN;
  placement_counter INTEGER := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = _tournament_id
    AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)
  )) THEN
    RAISE EXCEPTION 'Unauthorized: only admins and tournament staff can finalize points';
  END IF;

  SELECT championship_id INTO _championship_id FROM tournaments WHERE id = _tournament_id;

  SELECT COUNT(*) INTO total_participants
  FROM tournament_standings
  WHERE tournament_id = _tournament_id AND dropped = false;

  -- Logarithmic scale factor based on tournament size
  scale_factor := GREATEST(1.0, LEAST(1.64,
    1.0 + 0.64 * ln(GREATEST(total_participants, 16)::numeric / 16.0) / ln(8.0)
  ));

  SELECT bfl INTO active_bfl FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  SELECT EXISTS(
    SELECT 1 FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut'
  ) INTO _has_top_cut;

  SELECT EXISTS(
    SELECT 1 FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'tiebreaker'
  ) INTO _has_tiebreakers;

  DELETE FROM tournament_results WHERE tournament_id = _tournament_id;

  IF _has_top_cut THEN
    SELECT COALESCE(MAX(round), 0) INTO _total_tc_rounds
    FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut';

    -- 1) WINNER
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, tm.winner_id, 1, total_participants, 100, ROUND(100 * scale_factor)
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
      AND tm.round = _total_tc_rounds AND tm.match_number = 1
      AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
    LIMIT 1;

    -- 2) FINALIST
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id,
           CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END,
           2, total_participants, 85, ROUND(85 * scale_factor)
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
      AND tm.round = _total_tc_rounds AND tm.match_number = 1
      AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
    LIMIT 1;

    -- 3) Losers of each earlier round
    placement_counter := 2;
    FOR rec IN
      SELECT r as tc_round,
             CASE WHEN (_total_tc_rounds - r) = 1 THEN 3
               ELSE POWER(2, _total_tc_rounds - r)::int + 1
             END as placement_start
      FROM generate_series(_total_tc_rounds - 1, 1, -1) r
    LOOP
      INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
      SELECT _tournament_id, loser_id,
             rec.placement_start + (row_number() OVER (ORDER BY tb_placement ASC NULLS LAST, swiss_points DESC, swiss_resistance DESC))::int - 1,
             total_participants, 0, 0
      FROM (
        SELECT
          CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END as loser_id,
          (SELECT CASE
            WHEN EXISTS (SELECT 1 FROM tournament_matches tb WHERE tb.tournament_id = _tournament_id AND tb.phase = 'tiebreaker' AND tb.status = 'completed'
              AND tb.winner_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END) THEN 0
            WHEN EXISTS (SELECT 1 FROM tournament_matches tb WHERE tb.tournament_id = _tournament_id AND tb.phase = 'tiebreaker' AND tb.status = 'completed'
              AND tb.winner_id IS NOT NULL
              AND (tb.player1_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
                OR tb.player2_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END)
              AND tb.winner_id != CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END) THEN 2
            ELSE 1 END) as tb_placement,
          COALESCE(ts.points, 0) as swiss_points,
          COALESCE(ts.resistance, 0) as swiss_resistance
        FROM tournament_matches tm
        LEFT JOIN tournament_standings ts ON ts.tournament_id = _tournament_id
          AND ts.user_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
        WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
          AND tm.round = rec.tc_round AND tm.status = 'completed'
          AND tm.winner_id IS NOT NULL AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
          AND CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END NOT IN (
            SELECT tr.user_id FROM tournament_results tr WHERE tr.tournament_id = _tournament_id
          )
      ) losers;
    END LOOP;

    -- 4) Non-top-cut players
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           (SELECT COUNT(*) FROM tournament_results WHERE tournament_id = _tournament_id)
           + (row_number() OVER (ORDER BY ts.points DESC, ts.resistance DESC))::int,
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false
      AND ts.user_id NOT IN (SELECT tr.user_id FROM tournament_results tr WHERE tr.tournament_id = _tournament_id);

  ELSE
    -- No top cut: Swiss standings
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           (row_number() OVER (ORDER BY ts.points DESC, ts.resistance DESC))::int,
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false;
  END IF;

  -- Set base_points based on placement
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

  -- Calculate per-player scaled_points using MATCH WINS (not rounds played)
  -- This prevents gaming by inflating round count in small tournaments
  -- swiss_wins * 0.03 + topcut_wins * 0.06
  UPDATE tournament_results tr SET
    scaled_points = ROUND(
      tr.base_points * scale_factor * (
        1.0
        + COALESCE(mc.swiss_wins, 0) * 0.03
        + COALESCE(mc.topcut_wins, 0) * 0.06
      )
    )
  FROM (
    SELECT uid,
           COUNT(*) FILTER (WHERE phase = 'swiss' AND is_winner) as swiss_wins,
           COUNT(*) FILTER (WHERE phase IN ('top_cut', 'tiebreaker') AND is_winner) as topcut_wins
    FROM (
      SELECT player1_id as uid, phase, (winner_id = player1_id) as is_winner
      FROM tournament_matches
      WHERE tournament_id = _tournament_id AND status = 'completed' AND player1_id IS NOT NULL
      UNION ALL
      SELECT player2_id as uid, phase, (winner_id = player2_id) as is_winner
      FROM tournament_matches
      WHERE tournament_id = _tournament_id AND status = 'completed' AND player2_id IS NOT NULL
    ) x
    GROUP BY uid
  ) mc
  WHERE tr.tournament_id = _tournament_id AND tr.user_id = mc.uid;

  -- Handle players with no matches
  UPDATE tournament_results SET
    scaled_points = ROUND(base_points * scale_factor)
  WHERE tournament_id = _tournament_id AND scaled_points = 0 AND base_points > 0;

  IF _championship_id IS NOT NULL THEN
    RETURN;
  END IF;

  -- Update regular profiles
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
    ) tr
    WHERE tr.rn <= active_bfl
    AND NOT EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = tr.user_id)
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;

  -- Update child profiles
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
    ) tr
    WHERE tr.rn <= active_bfl
    AND EXISTS (SELECT 1 FROM child_profiles c WHERE c.id = tr.user_id)
    GROUP BY tr.user_id
  ) sub
  WHERE cp.id = sub.child_id;
END;
$function$;
