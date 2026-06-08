
CREATE OR REPLACE FUNCTION public.recalc_tournament_standings(_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  rec record;
  m record;
  opp_rec record;
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
  WIN_POINTS constant integer := 4;
  BYE_POINTS constant integer := 4;
  _tc_final_round int;
begin
  select coalesce(max(tm.round), 0) into _tc_final_round
  from tournament_matches tm
  where tm.tournament_id = _tournament_id and tm.phase = 'top_cut';

  for rec in
    select ts.user_id::text as uid
    from tournament_standings ts
    where ts.tournament_id = _tournament_id
  loop
    stats := jsonb_set(stats, array[rec.uid], '{"w":0,"l":0,"d":0,"gw":0,"gl":0,"byes":0}'::jsonb);
    swiss_stats := jsonb_set(swiss_stats, array[rec.uid], '{"w":0,"l":0,"d":0}'::jsonb);
  end loop;

  for m in
    select tm.player1_id::text as p1, tm.player2_id::text as p2,
           tm.winner_id::text as winner, tm.player1_score as p1s, tm.player2_score as p2s, tm.phase,
           tm.round, tm.match_number
    from tournament_matches tm
    where tm.tournament_id = _tournament_id and tm.status = 'completed'
  loop
    if m.phase in ('tiebreaker', 'pre_top_cut') then
      continue;
    end if;

    if m.phase = 'top_cut' and m.round = _tc_final_round and m.match_number = 2 then
      continue;
    end if;

    if m.phase = 'swiss' then
      if m.p1 is not null and m.p2 is null then
        if stats ? m.p1 then
          stats := jsonb_set(stats, array[m.p1, 'byes'], to_jsonb((stats->m.p1->>'byes')::int + 1));
          stats := jsonb_set(stats, array[m.p1, 'gw'], to_jsonb((stats->m.p1->>'gw')::int + 2));
          swiss_stats := jsonb_set(swiss_stats, array[m.p1, 'w'], to_jsonb((swiss_stats->m.p1->>'w')::int + 1));
        end if;
        continue;
      end if;

      if m.p1 is not null and stats ? m.p1 then
        stats := jsonb_set(stats, array[m.p1, 'gw'], to_jsonb((stats->m.p1->>'gw')::int + m.p1s));
        stats := jsonb_set(stats, array[m.p1, 'gl'], to_jsonb((stats->m.p1->>'gl')::int + m.p2s));
      end if;
      if m.p2 is not null and stats ? m.p2 then
        stats := jsonb_set(stats, array[m.p2, 'gw'], to_jsonb((stats->m.p2->>'gw')::int + m.p2s));
        stats := jsonb_set(stats, array[m.p2, 'gl'], to_jsonb((stats->m.p2->>'gl')::int + m.p1s));
      end if;

      if m.winner = m.p1 then
        if stats ? m.p1 then stats := jsonb_set(stats, array[m.p1, 'w'], to_jsonb((stats->m.p1->>'w')::int + 1)); end if;
        if stats ? m.p2 then stats := jsonb_set(stats, array[m.p2, 'l'], to_jsonb((stats->m.p2->>'l')::int + 1)); end if;
        if swiss_stats ? m.p1 then swiss_stats := jsonb_set(swiss_stats, array[m.p1, 'w'], to_jsonb((swiss_stats->m.p1->>'w')::int + 1)); end if;
        if swiss_stats ? m.p2 then swiss_stats := jsonb_set(swiss_stats, array[m.p2, 'l'], to_jsonb((swiss_stats->m.p2->>'l')::int + 1)); end if;
      elsif m.winner = m.p2 then
        if stats ? m.p2 then stats := jsonb_set(stats, array[m.p2, 'w'], to_jsonb((stats->m.p2->>'w')::int + 1)); end if;
        if stats ? m.p1 then stats := jsonb_set(stats, array[m.p1, 'l'], to_jsonb((stats->m.p1->>'l')::int + 1)); end if;
        if swiss_stats ? m.p2 then swiss_stats := jsonb_set(swiss_stats, array[m.p2, 'w'], to_jsonb((swiss_stats->m.p2->>'w')::int + 1)); end if;
        if swiss_stats ? m.p1 then swiss_stats := jsonb_set(swiss_stats, array[m.p1, 'l'], to_jsonb((swiss_stats->m.p1->>'l')::int + 1)); end if;
      else
        if stats ? m.p1 then stats := jsonb_set(stats, array[m.p1, 'd'], to_jsonb((stats->m.p1->>'d')::int + 1)); end if;
        if stats ? m.p2 then stats := jsonb_set(stats, array[m.p2, 'd'], to_jsonb((stats->m.p2->>'d')::int + 1)); end if;
        if swiss_stats ? m.p1 then swiss_stats := jsonb_set(swiss_stats, array[m.p1, 'd'], to_jsonb((swiss_stats->m.p1->>'d')::int + 1)); end if;
        if swiss_stats ? m.p2 then swiss_stats := jsonb_set(swiss_stats, array[m.p2, 'd'], to_jsonb((swiss_stats->m.p2->>'d')::int + 1)); end if;
      end if;
    else
      if m.p1 is null or m.p2 is null then continue; end if;
      if not stats ? m.p1 then stats := jsonb_set(stats, array[m.p1], '{"w":0,"l":0,"d":0,"gw":0,"gl":0,"byes":0}'::jsonb); end if;
      if not stats ? m.p2 then stats := jsonb_set(stats, array[m.p2], '{"w":0,"l":0,"d":0,"gw":0,"gl":0,"byes":0}'::jsonb); end if;

      stats := jsonb_set(stats, array[m.p1, 'gw'], to_jsonb((stats->m.p1->>'gw')::int + m.p1s));
      stats := jsonb_set(stats, array[m.p1, 'gl'], to_jsonb((stats->m.p1->>'gl')::int + m.p2s));
      stats := jsonb_set(stats, array[m.p2, 'gw'], to_jsonb((stats->m.p2->>'gw')::int + m.p2s));
      stats := jsonb_set(stats, array[m.p2, 'gl'], to_jsonb((stats->m.p2->>'gl')::int + m.p1s));

      if m.winner = m.p1 then
        stats := jsonb_set(stats, array[m.p1, 'w'], to_jsonb((stats->m.p1->>'w')::int + 1));
        stats := jsonb_set(stats, array[m.p2, 'l'], to_jsonb((stats->m.p2->>'l')::int + 1));
      elsif m.winner = m.p2 then
        stats := jsonb_set(stats, array[m.p2, 'w'], to_jsonb((stats->m.p2->>'w')::int + 1));
        stats := jsonb_set(stats, array[m.p1, 'l'], to_jsonb((stats->m.p1->>'l')::int + 1));
      end if;
    end if;
  end loop;

  for rec in
    select ts.id, ts.user_id::text as uid
    from tournament_standings ts
    where ts.tournament_id = _tournament_id
  loop
    s := stats->rec.uid;
    if s is null then continue; end if;

    select array_agg(distinct opp) into opps from (
      select case when tm.player1_id::text = rec.uid then tm.player2_id::text else tm.player1_id::text end as opp
      from tournament_matches tm
      where tm.tournament_id = _tournament_id and tm.phase = 'swiss' and tm.status = 'completed'
        and (tm.player1_id::text = rec.uid or tm.player2_id::text = rec.uid)
        and tm.player1_id is not null and tm.player2_id is not null
    ) sub where opp is not null;

    avg_res := 0;
    if opps is not null and array_length(opps, 1) > 0 then
      opp_win_pcts := array[]::numeric[];
      for i in 1..array_length(opps, 1)
      loop
        opp_id := opps[i];
        ss := swiss_stats->opp_id;
        if ss is null then
          opp_win_pcts := array_append(opp_win_pcts, 0.33);
        else
          total_games := (ss->>'w')::int + (ss->>'l')::int + (ss->>'d')::int;
          if total_games > 0 then
            opp_win_pcts := array_append(opp_win_pcts, greatest(0.33, (ss->>'w')::numeric / total_games));
          else
            opp_win_pcts := array_append(opp_win_pcts, 0.33);
          end if;
        end if;
      end loop;

      select avg(v) into avg_res from unnest(opp_win_pcts) as v;
    end if;

    update tournament_standings set
      wins = (s->>'w')::int,
      losses = (s->>'l')::int,
      draws = (s->>'d')::int,
      game_wins = (s->>'gw')::int,
      game_losses = (s->>'gl')::int,
      points = (s->>'w')::int * WIN_POINTS + (s->>'d')::int + coalesce((s->>'byes')::int, 0) * BYE_POINTS,
      resistance = round(avg_res * 100)
    where id = rec.id;
  end loop;

  with ranked as (
    select
      ts.id,
      row_number() over (
        order by coalesce(ts.points, 0) desc,
                 coalesce(ts.resistance, 0) desc,
                 ts.user_id
      ) as new_seed
    from public.tournament_standings ts
    where ts.tournament_id = _tournament_id
      and coalesce(ts.dropped, false) = false
  )
  update public.tournament_standings ts
  set seed = ranked.new_seed,
      opponent_match_win_pct = ts.resistance
  from ranked
  where ts.id = ranked.id;
end;
$function$;

-- Ricalcola tutte le classifiche dei tornei esistenti con la nuova formula
DO $$
DECLARE t_id uuid;
BEGIN
  FOR t_id IN SELECT DISTINCT tournament_id FROM tournament_standings LOOP
    PERFORM public.recalc_tournament_standings(t_id);
  END LOOP;
END $$;
