CREATE OR REPLACE FUNCTION public.recalculate_all_rankings(_bfl integer DEFAULT 10, _monthly_bfl_enabled boolean DEFAULT false, _monthly_bfl integer DEFAULT 2)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _season_start date;
  _season_end date;
begin
  select start_date, end_date into _season_start, _season_end
  from ranking_seasons where is_active = true limit 1;

  update profiles
    set points = 0, wins = 0, points_monthly = 0, wins_monthly = 0, updated_at = now()
    where true;
  update child_profiles
    set points = 0, wins = 0, points_monthly = 0, wins_monthly = 0, updated_at = now()
    where true;

  -- Eligible tournament results: for external (imported) tournaments, keep only the
  -- best result per (player, club, ISO week). Non-external tournaments pass through.
  -- Use a temp table so all four updates below share the same filtered pool.
  drop table if exists _elig_results;
  create temp table _elig_results on commit drop as
  with base as (
    select tr2.user_id,
           tr2.base_points,
           tr2.placement,
           t.event_date,
           t.is_external,
           t.club_id,
           case
             when t.is_external = true then
               row_number() over (
                 partition by tr2.user_id, coalesce(t.club_id::text, '_nc'), date_trunc('week', t.event_date)
                 order by tr2.base_points desc, t.event_date desc, t.id
               )
             else 1
           end as ext_rn
    from tournament_results tr2
    join tournaments t on t.id = tr2.tournament_id
    where t.championship_id is null
      and t.is_ranked = true
      and (_season_start is null or t.event_date >= _season_start)
      and (_season_end is null or t.event_date <= _season_end)
  )
  select user_id, base_points, placement, event_date
  from base
  where ext_rn = 1;

  update profiles p
  set points = coalesce(sub.total, 0),
      wins = coalesce(sub.win_count, 0),
      updated_at = now()
  from (
    select tr.user_id,
           sum(tr.base_points) as total,
           count(*) filter (where tr.placement = 1) as win_count
    from (
      select er.user_id, er.base_points, er.placement,
             row_number() over (partition by er.user_id order by er.base_points desc) as rn
      from _elig_results er
      where not exists (select 1 from child_profiles cp where cp.id = er.user_id)
    ) tr
    where tr.rn <= _bfl
    group by tr.user_id
  ) sub
  where p.user_id = sub.user_id;

  update child_profiles cp
  set points = coalesce(sub.total, 0),
      wins = coalesce(sub.win_count, 0),
      updated_at = now()
  from (
    select tr.user_id as child_id,
           sum(tr.base_points) as total,
           count(*) filter (where tr.placement = 1) as win_count
    from (
      select er.user_id, er.base_points, er.placement,
             row_number() over (partition by er.user_id order by er.base_points desc) as rn
      from _elig_results er
      where exists (select 1 from child_profiles c where c.id = er.user_id)
    ) tr
    where tr.rn <= _bfl
    group by tr.user_id
  ) sub
  where cp.id = sub.child_id;

  if _monthly_bfl_enabled then
    update profiles p
    set points_monthly = coalesce(sub.total, 0),
        wins_monthly = coalesce(sub.win_count, 0),
        updated_at = now()
    from (
      select pool.user_id,
             sum(pool.base_points) as total,
             count(*) filter (where pool.placement = 1) as win_count
      from (
        select cand.user_id, cand.base_points, cand.placement,
               row_number() over (
                 partition by cand.user_id
                 order by cand.is_monthly desc, cand.base_points desc
               ) as rn_final
        from (
          select base.user_id, base.base_points, base.placement,
                 case when base.rn_month <= greatest(_monthly_bfl, 1) then 1 else 0 end as is_monthly,
                 row_number() over (
                   partition by base.user_id, case when base.rn_month <= greatest(_monthly_bfl, 1) then 1 else 0 end
                   order by base.base_points desc
                 ) as rn_within_group,
                 base.user_rollover_cap
          from (
            select er.user_id, er.base_points, er.placement,
                   row_number() over (
                     partition by er.user_id, date_trunc('month', er.event_date)
                     order by er.base_points desc
                   ) as rn_month,
                   greatest(0,
                     ((extract(year from min(er.event_date) over (partition by er.user_id))::int
                       - extract(year from _season_start)::int) * 12
                      + (extract(month from min(er.event_date) over (partition by er.user_id))::int
                         - extract(month from _season_start)::int))
                   ) * greatest(_monthly_bfl, 1) as user_rollover_cap
            from _elig_results er
            where not exists (select 1 from child_profiles cp where cp.id = er.user_id)
          ) base
        ) cand
        where cand.is_monthly = 1
           or cand.rn_within_group <= cand.user_rollover_cap
      ) pool
      where pool.rn_final <= _bfl
      group by pool.user_id
    ) sub
    where p.user_id = sub.user_id;

    update child_profiles cp
    set points_monthly = coalesce(sub.total, 0),
        wins_monthly = coalesce(sub.win_count, 0),
        updated_at = now()
    from (
      select pool.user_id as child_id,
             sum(pool.base_points) as total,
             count(*) filter (where pool.placement = 1) as win_count
      from (
        select cand.user_id, cand.base_points, cand.placement,
               row_number() over (
                 partition by cand.user_id
                 order by cand.is_monthly desc, cand.base_points desc
               ) as rn_final
        from (
          select base.user_id, base.base_points, base.placement,
                 case when base.rn_month <= greatest(_monthly_bfl, 1) then 1 else 0 end as is_monthly,
                 row_number() over (
                   partition by base.user_id, case when base.rn_month <= greatest(_monthly_bfl, 1) then 1 else 0 end
                   order by base.base_points desc
                 ) as rn_within_group,
                 base.user_rollover_cap
          from (
            select er.user_id, er.base_points, er.placement,
                   row_number() over (
                     partition by er.user_id, date_trunc('month', er.event_date)
                     order by er.base_points desc
                   ) as rn_month,
                   greatest(0,
                     ((extract(year from min(er.event_date) over (partition by er.user_id))::int
                       - extract(year from _season_start)::int) * 12
                      + (extract(month from min(er.event_date) over (partition by er.user_id))::int
                         - extract(month from _season_start)::int))
                   ) * greatest(_monthly_bfl, 1) as user_rollover_cap
            from _elig_results er
            where exists (select 1 from child_profiles c where c.id = er.user_id)
          ) base
        ) cand
        where cand.is_monthly = 1
           or cand.rn_within_group <= cand.user_rollover_cap
      ) pool
      where pool.rn_final <= _bfl
      group by pool.user_id
    ) sub
    where cp.id = sub.child_id;
  end if;

  drop table if exists _elig_results;
end;
$function$;

-- Recompute now using current season settings
do $$
declare
  _b int := 10;
  _me boolean := false;
  _mb int := 2;
begin
  select coalesce(bfl, 10), coalesce(monthly_bfl_enabled, false), coalesce(monthly_bfl, 2)
    into _b, _me, _mb
  from ranking_seasons where is_active = true limit 1;
  perform public.recalculate_all_rankings(_b, _me, _mb);
end $$;