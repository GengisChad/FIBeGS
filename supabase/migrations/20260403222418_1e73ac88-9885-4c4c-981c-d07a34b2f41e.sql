CREATE OR REPLACE FUNCTION public.recalc_tournament_standings(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  m RECORD;
  opp_rec RECORD;
  stats jsonb := '{}'::jsonb;
  swiss_stats jsonb := '{}'::jsonb;
  user_id text;
  opp_id text;
  opps text[];
  opp_win_pcts numeric[];
  avg_res numeric;
  total_games int;
  s jsonb;
  ss jsonb;
  BYE_POINTS CONSTANT INTEGER := 4;
  _tc_final_round int;
BEGIN
  -- Determine the final round of top_cut to identify the 3rd/4th place match
  SELECT COALESCE(MAX(tm.round), 0) INTO _tc_final_round
  FROM tournament_matches tm
  WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut';

  -- Initialize stats for all standing players
  FOR rec IN SELECT ts.user_id::text as uid FROM tournament_standings ts WHERE ts.tournament_id = _tournament_id
  LOOP
    stats := jsonb_set(stats, ARRAY[rec.uid], '{"w":0,"l":0,"d":0,"gw":0,"gl":0,"byes":0}'::jsonb);
    swiss_stats := jsonb_set(swiss_stats, ARRAY[rec.uid], '{"w":0,"l":0,"d":0}'::jsonb);
  END LOOP;

  -- Process all completed matches
  FOR m IN 
    SELECT tm.player1_id::text as p1, tm.player2_id::text as p2, 
           tm.winner_id::text as winner, tm.player1_score as p1s, tm.player2_score as p2s, tm.phase,
           tm.round, tm.match_number
    FROM tournament_matches tm 
    WHERE tm.tournament_id = _tournament_id AND tm.status = 'completed'
  LOOP
    -- Skip tiebreaker and pre_top_cut matches entirely (no points)
    IF m.phase IN ('tiebreaker', 'pre_top_cut') THEN
      CONTINUE;
    END IF;

    -- Skip the 3rd/4th place match (top_cut final round, match_number = 2)
    IF m.phase = 'top_cut' AND m.round = _tc_final_round AND m.match_number = 2 THEN
      CONTINUE;
    END IF;

    IF m.phase = 'swiss' THEN
      -- BYE match: track as bye, not as a regular win
      IF m.p1 IS NOT NULL AND m.p2 IS NULL THEN
        IF stats ? m.p1 THEN
          stats := jsonb_set(stats, ARRAY[m.p1, 'byes'], to_jsonb((stats->m.p1->>'byes')::int + 1));
          stats := jsonb_set(stats, ARRAY[m.p1, 'gw'], to_jsonb((stats->m.p1->>'gw')::int + 2));
          swiss_stats := jsonb_set(swiss_stats, ARRAY[m.p1, 'w'], to_jsonb((swiss_stats->m.p1->>'w')::int + 1));
        END IF;
        CONTINUE;
      END IF;
      
      -- Regular swiss match
      IF m.p1 IS NOT NULL AND stats ? m.p1 THEN
        stats := jsonb_set(stats, ARRAY[m.p1, 'gw'], to_jsonb((stats->m.p1->>'gw')::int + m.p1s));
        stats := jsonb_set(stats, ARRAY[m.p1, 'gl'], to_jsonb((stats->m.p1->>'gl')::int + m.p2s));
      END IF;
      IF m.p2 IS NOT NULL AND stats ? m.p2 THEN
        stats := jsonb_set(stats, ARRAY[m.p2, 'gw'], to_jsonb((stats->m.p2->>'gw')::int + m.p2s));
        stats := jsonb_set(stats, ARRAY[m.p2, 'gl'], to_jsonb((stats->m.p2->>'gl')::int + m.p1s));
      END IF;
      
      IF m.winner = m.p1 THEN
        IF stats ? m.p1 THEN stats := jsonb_set(stats, ARRAY[m.p1, 'w'], to_jsonb((stats->m.p1->>'w')::int + 1)); END IF;
        IF stats ? m.p2 THEN stats := jsonb_set(stats, ARRAY[m.p2, 'l'], to_jsonb((stats->m.p2->>'l')::int + 1)); END IF;
        IF swiss_stats ? m.p1 THEN swiss_stats := jsonb_set(swiss_stats, ARRAY[m.p1, 'w'], to_jsonb((swiss_stats->m.p1->>'w')::int + 1)); END IF;
        IF swiss_stats ? m.p2 THEN swiss_stats := jsonb_set(swiss_stats, ARRAY[m.p2, 'l'], to_jsonb((swiss_stats->m.p2->>'l')::int + 1)); END IF;
      ELSIF m.winner = m.p2 THEN
        IF stats ? m.p2 THEN stats := jsonb_set(stats, ARRAY[m.p2, 'w'], to_jsonb((stats->m.p2->>'w')::int + 1)); END IF;
        IF stats ? m.p1 THEN stats := jsonb_set(stats, ARRAY[m.p1, 'l'], to_jsonb((stats->m.p1->>'l')::int + 1)); END IF;
        IF swiss_stats ? m.p2 THEN swiss_stats := jsonb_set(swiss_stats, ARRAY[m.p2, 'w'], to_jsonb((swiss_stats->m.p2->>'w')::int + 1)); END IF;
        IF swiss_stats ? m.p1 THEN swiss_stats := jsonb_set(swiss_stats, ARRAY[m.p1, 'l'], to_jsonb((swiss_stats->m.p1->>'l')::int + 1)); END IF;
      ELSE
        IF stats ? m.p1 THEN stats := jsonb_set(stats, ARRAY[m.p1, 'd'], to_jsonb((stats->m.p1->>'d')::int + 1)); END IF;
        IF stats ? m.p2 THEN stats := jsonb_set(stats, ARRAY[m.p2, 'd'], to_jsonb((stats->m.p2->>'d')::int + 1)); END IF;
        IF swiss_stats ? m.p1 THEN swiss_stats := jsonb_set(swiss_stats, ARRAY[m.p1, 'd'], to_jsonb((swiss_stats->m.p1->>'d')::int + 1)); END IF;
        IF swiss_stats ? m.p2 THEN swiss_stats := jsonb_set(swiss_stats, ARRAY[m.p2, 'd'], to_jsonb((swiss_stats->m.p2->>'d')::int + 1)); END IF;
      END IF;
    ELSE
      -- Elimination matches (top_cut only, tiebreaker/pre_top_cut already skipped)
      IF m.p1 IS NULL OR m.p2 IS NULL THEN CONTINUE; END IF;
      IF NOT stats ? m.p1 THEN stats := jsonb_set(stats, ARRAY[m.p1], '{"w":0,"l":0,"d":0,"gw":0,"gl":0,"byes":0}'::jsonb); END IF;
      IF NOT stats ? m.p2 THEN stats := jsonb_set(stats, ARRAY[m.p2], '{"w":0,"l":0,"d":0,"gw":0,"gl":0,"byes":0}'::jsonb); END IF;
      
      stats := jsonb_set(stats, ARRAY[m.p1, 'gw'], to_jsonb((stats->m.p1->>'gw')::int + m.p1s));
      stats := jsonb_set(stats, ARRAY[m.p1, 'gl'], to_jsonb((stats->m.p1->>'gl')::int + m.p2s));
      stats := jsonb_set(stats, ARRAY[m.p2, 'gw'], to_jsonb((stats->m.p2->>'gw')::int + m.p2s));
      stats := jsonb_set(stats, ARRAY[m.p2, 'gl'], to_jsonb((stats->m.p2->>'gl')::int + m.p1s));
      
      IF m.winner = m.p1 THEN
        stats := jsonb_set(stats, ARRAY[m.p1, 'w'], to_jsonb((stats->m.p1->>'w')::int + 1));
        stats := jsonb_set(stats, ARRAY[m.p2, 'l'], to_jsonb((stats->m.p2->>'l')::int + 1));
      ELSIF m.winner = m.p2 THEN
        stats := jsonb_set(stats, ARRAY[m.p2, 'w'], to_jsonb((stats->m.p2->>'w')::int + 1));
        stats := jsonb_set(stats, ARRAY[m.p1, 'l'], to_jsonb((stats->m.p1->>'l')::int + 1));
      END IF;
    END IF;
  END LOOP;

  -- Calculate resistance (Swiss-only OMW%) and update all standings in one batch
  FOR rec IN SELECT ts.id, ts.user_id::text as uid FROM tournament_standings ts WHERE ts.tournament_id = _tournament_id
  LOOP
    s := stats->rec.uid;
    IF s IS NULL THEN CONTINUE; END IF;
    
    -- Get Swiss opponents for resistance
    SELECT array_agg(DISTINCT opp) INTO opps FROM (
      SELECT CASE WHEN tm.player1_id::text = rec.uid THEN tm.player2_id::text ELSE tm.player1_id::text END as opp
      FROM tournament_matches tm
      WHERE tm.tournament_id = _tournament_id AND tm.phase = 'swiss' AND tm.status = 'completed'
        AND (tm.player1_id::text = rec.uid OR tm.player2_id::text = rec.uid)
        AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
    ) sub WHERE opp IS NOT NULL;
    
    avg_res := 0;
    IF opps IS NOT NULL AND array_length(opps, 1) > 0 THEN
      opp_win_pcts := ARRAY[]::numeric[];
      FOR i IN 1..array_length(opps, 1)
      LOOP
        opp_id := opps[i];
        ss := swiss_stats->opp_id;
        IF ss IS NULL THEN
          opp_win_pcts := array_append(opp_win_pcts, 0.33);
        ELSE
          total_games := (ss->>'w')::int + (ss->>'l')::int + (ss->>'d')::int;
          IF total_games > 0 THEN
            opp_win_pcts := array_append(opp_win_pcts, GREATEST(0.33, (ss->>'w')::numeric / total_games));
          ELSE
            opp_win_pcts := array_append(opp_win_pcts, 0.33);
          END IF;
        END IF;
      END LOOP;
      
      SELECT AVG(v) INTO avg_res FROM unnest(opp_win_pcts) AS v;
    END IF;
    
    -- Points = wins * 3 + draws + byes * BYE_POINTS
    UPDATE tournament_standings SET
      wins = (s->>'w')::int,
      losses = (s->>'l')::int,
      draws = (s->>'d')::int,
      game_wins = (s->>'gw')::int,
      game_losses = (s->>'gl')::int,
      points = (s->>'w')::int * 3 + (s->>'d')::int + COALESCE((s->>'byes')::int, 0) * BYE_POINTS,
      resistance = ROUND(avg_res * 100)
    WHERE id = rec.id;
  END LOOP;
END;
$$;