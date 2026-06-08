
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points_monthly integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wins_monthly integer NOT NULL DEFAULT 0;
ALTER TABLE public.child_profiles ADD COLUMN IF NOT EXISTS points_monthly integer NOT NULL DEFAULT 0;
ALTER TABLE public.child_profiles ADD COLUMN IF NOT EXISTS wins_monthly integer NOT NULL DEFAULT 0;

-- =====================================================================
-- recalculate_all_rankings: seasonal-only into points, monthly+rollover into points_monthly
-- =====================================================================
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
  _months_elapsed integer;
  _expected_slots integer;
BEGIN
  SELECT start_date, end_date INTO _season_start, _season_end
  FROM ranking_seasons WHERE is_active = true LIMIT 1;

  -- Reset all
  UPDATE profiles
    SET points = 0, wins = 0, points_monthly = 0, wins_monthly = 0, updated_at = now()
    WHERE true;
  UPDATE child_profiles
    SET points = 0, wins = 0, points_monthly = 0, wins_monthly = 0, updated_at = now()
    WHERE true;

  -- Months elapsed from season start to current month (inclusive). Used for rollover slot target.
  IF _season_start IS NOT NULL THEN
    _months_elapsed := GREATEST(
      1,
      ((EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM _season_start)::int) * 12
        + (EXTRACT(MONTH FROM CURRENT_DATE)::int - EXTRACT(MONTH FROM _season_start)::int) + 1)
    );
  ELSE
    _months_elapsed := 1;
  END IF;
  _expected_slots := _months_elapsed * GREATEST(_monthly_bfl, 1);

  ---------------------------------------------------------------
  -- (A) SEASONAL-ONLY -> points / wins (no monthly filter)
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
        -- combined pool: monthly top-N + rollover fill (next-best results) per user, then top _bfl
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
                 ) AS rn_within_group
          FROM (
            SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
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
              AND (_season_end IS NULL OR t.event_date <= _season_end)
          ) base
        ) cand
        -- Take all monthly-selected, plus rollover up to fill expected slots
        WHERE cand.is_monthly = 1
           OR cand.rn_within_group <= GREATEST(_expected_slots, _bfl)
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
                 ) AS rn_within_group
          FROM (
            SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
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
              AND (_season_end IS NULL OR t.event_date <= _season_end)
          ) base
        ) cand
        WHERE cand.is_monthly = 1
           OR cand.rn_within_group <= GREATEST(_expected_slots, _bfl)
      ) pool
      WHERE pool.rn_final <= _bfl
      GROUP BY pool.user_id
    ) sub
    WHERE cp.id = sub.child_id;
  END IF;
END;
$function$;

-- =====================================================================
-- finalize_tournament_points: read settings, custom win points, exclude 3rd-place match
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

  -- Read global competitive defaults from app_settings
  SELECT COALESCE((SELECT value::int FROM app_settings WHERE key = 'competitive_participation_bonus'), 2)
    INTO PARTICIPATION_BONUS;
  SELECT COALESCE((SELECT value::int FROM app_settings WHERE key = 'competitive_points_per_win'), 4)
    INTO POINTS_PER_WIN;

  -- For non-ranked tournaments, allow per-tournament custom win points (Swiss/Top)
  _swiss_pts := CASE WHEN NOT _is_ranked AND _custom_swiss IS NOT NULL THEN _custom_swiss ELSE POINTS_PER_WIN END;
  _top_pts := CASE WHEN NOT _is_ranked AND _custom_top IS NOT NULL THEN _custom_top ELSE POINTS_PER_WIN END;

  SELECT COUNT(*) INTO total_participants
  FROM tournament_standings
  WHERE tournament_id = _tournament_id AND dropped = false;

  SELECT bfl, start_date INTO active_bfl, _season_start FROM ranking_seasons WHERE is_active = true LIMIT 1;
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
                AND tb.winner_id != CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
            ) THEN 2
            ELSE 1
          END) AS tb_placement,
          COALESCE(ts.points, 0) AS swiss_points,
          COALESCE(ts.resistance, 0) AS swiss_resistance
        FROM tournament_matches tm
        LEFT JOIN tournament_standings ts
          ON ts.tournament_id = _tournament_id
         AND ts.user_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
        WHERE tm.tournament_id = _tournament_id
          AND tm.phase = 'top_cut'
          AND tm.round = rec.tc_round
          AND tm.status = 'completed'
          AND tm.winner_id IS NOT NULL
          AND tm.player1_id IS NOT NULL
          AND tm.player2_id IS NOT NULL
          AND CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END NOT IN (
            SELECT tr.user_id FROM tournament_results tr WHERE tr.tournament_id = _tournament_id
          )
      ) losers;
    END LOOP;

    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           (SELECT COUNT(*) FROM tournament_results WHERE tournament_id = _tournament_id)
           + (row_number() OVER (ORDER BY ts.points DESC, ts.resistance DESC))::int,
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false
      AND ts.user_id NOT IN (SELECT tr.user_id FROM tournament_results tr WHERE tr.tournament_id = _tournament_id);
  ELSE
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           (row_number() OVER (ORDER BY ts.points DESC, ts.resistance DESC))::int,
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false;
  END IF;

  -- Wins by phase: swiss + top_cut, but EXCLUDE the 3rd-place match (top_cut final round, match 2) and tiebreakers
  UPDATE tournament_results tr
  SET base_points = PARTICIPATION_BONUS,
      scaled_points = PARTICIPATION_BONUS
                    + COALESCE(mc.swiss_wins, 0) * _swiss_pts
                    + COALESCE(mc.top_wins, 0) * _top_pts
  FROM (
    SELECT uid,
           COUNT(*) FILTER (WHERE phase = 'swiss' AND is_winner) AS swiss_wins,
           COUNT(*) FILTER (WHERE phase = 'top_cut' AND is_winner) AS top_wins
    FROM (
      SELECT player1_id AS uid, (winner_id = player1_id) AS is_winner, phase
      FROM tournament_matches
      WHERE tournament_id = _tournament_id AND status = 'completed' AND player1_id IS NOT NULL
        AND phase IN ('swiss', 'top_cut')
        AND NOT (phase = 'top_cut' AND round = (SELECT COALESCE(MAX(round),0) FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut') AND match_number = 2)
      UNION ALL
      SELECT player2_id AS uid, (winner_id = player2_id) AS is_winner, phase
      FROM tournament_matches
      WHERE tournament_id = _tournament_id AND status = 'completed' AND player2_id IS NOT NULL
        AND phase IN ('swiss', 'top_cut')
        AND NOT (phase = 'top_cut' AND round = (SELECT COALESCE(MAX(round),0) FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut') AND match_number = 2)
    ) x
    GROUP BY uid
  ) mc
  WHERE tr.tournament_id = _tournament_id AND tr.user_id = mc.uid;

  UPDATE tournament_results
  SET base_points = PARTICIPATION_BONUS,
      scaled_points = PARTICIPATION_BONUS
  WHERE tournament_id = _tournament_id AND scaled_points = 0;

  IF _championship_id IS NOT NULL THEN
    RETURN;
  END IF;

  -- Update profile totals (only RANKED tournaments)
  UPDATE profiles p
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      last_seen_at = now(),
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
        AND (_season_start IS NULL OR t.event_date >= _season_start)
    ) tr
    WHERE tr.rn <= active_bfl
      AND NOT EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = tr.user_id)
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;

  UPDATE profiles SET points = 0, wins = 0, updated_at = now()
  WHERE points > 0
    AND user_id NOT IN (
      SELECT tr.user_id FROM tournament_results tr
      JOIN tournaments t ON t.id = tr.tournament_id
      WHERE t.championship_id IS NULL AND t.is_external = false AND t.is_ranked = true
        AND (_season_start IS NULL OR t.event_date >= _season_start)
    );

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
        AND (_season_start IS NULL OR t.event_date >= _season_start)
    ) tr
    WHERE tr.rn <= active_bfl
      AND EXISTS (SELECT 1 FROM child_profiles c WHERE c.id = tr.user_id)
    GROUP BY tr.user_id
  ) sub
  WHERE cp.id = sub.child_id;

  UPDATE child_profiles SET points = 0, wins = 0, updated_at = now()
  WHERE points > 0
    AND id NOT IN (
      SELECT tr.user_id FROM tournament_results tr
      JOIN tournaments t ON t.id = tr.tournament_id
      WHERE t.championship_id IS NULL AND t.is_external = false AND t.is_ranked = true
        AND (_season_start IS NULL OR t.event_date >= _season_start)
    );
END;
$function$;

-- =====================================================================
-- Trigger: enforce registration_opens_at server-side
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_registration_open_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _opens timestamptz;
  _club uuid;
BEGIN
  SELECT registration_opens_at, club_id INTO _opens, _club FROM tournaments WHERE id = NEW.tournament_id;
  IF _opens IS NULL OR _opens <= now() THEN
    RETURN NEW;
  END IF;
  -- Allow admins / club staff to bypass the schedule
  IF has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF _club IS NOT NULL AND is_club_staff(auth.uid(), _club) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Le iscrizioni a questo torneo non sono ancora aperte.';
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_registration_open_window ON public.tournament_registrations;
CREATE TRIGGER trg_enforce_registration_open_window
  BEFORE INSERT ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_registration_open_window();
