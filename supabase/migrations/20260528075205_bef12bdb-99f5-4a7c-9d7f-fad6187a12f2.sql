
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

  drop table if exists _elig_results;
  create temp table _elig_results on commit drop as
  select tr2.user_id, tr2.base_points, tr2.placement, t.event_date
  from tournament_results tr2
  join tournaments t on t.id = tr2.tournament_id
  where t.championship_id is null
    and t.is_ranked = true
    and (_season_start is null or t.event_date >= _season_start)
    and (_season_end is null or t.event_date <= _season_end);

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
      select er.user_id,
             sum(er.base_points) as total,
             count(*) filter (where er.placement = 1) as win_count
      from (
        select user_id, base_points, placement,
               row_number() over (partition by user_id order by base_points desc) as rn
        from _elig_results
        where date_trunc('month', event_date) = date_trunc('month', now())
      ) er
      where er.rn <= greatest(_monthly_bfl, 1)
      group by er.user_id
    ) sub
    where p.user_id = sub.user_id
      and not exists (select 1 from child_profiles cp where cp.id = sub.user_id);

    update child_profiles cp
    set points_monthly = coalesce(sub.total, 0),
        wins_monthly = coalesce(sub.win_count, 0),
        updated_at = now()
    from (
      select er.user_id,
             sum(er.base_points) as total,
             count(*) filter (where er.placement = 1) as win_count
      from (
        select user_id, base_points, placement,
               row_number() over (partition by user_id order by base_points desc) as rn
        from _elig_results
        where date_trunc('month', event_date) = date_trunc('month', now())
      ) er
      where er.rn <= greatest(_monthly_bfl, 1)
      group by er.user_id
    ) sub
    where cp.id = sub.user_id;
  end if;
end;
$function$;

-- Also update per-user recalc to drop the weekly dedup
CREATE OR REPLACE FUNCTION public.recalculate_user_points(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _bfl int;
  _monthly_bfl_enabled boolean;
  _monthly_bfl int;
  _season_start date;
  _season_end date;
  _is_child boolean;
begin
  select coalesce(bfl,10), coalesce(monthly_bfl_enabled,false), coalesce(monthly_bfl,2), start_date, end_date
    into _bfl, _monthly_bfl_enabled, _monthly_bfl, _season_start, _season_end
  from ranking_seasons where is_active = true limit 1;
  if _bfl is null then _bfl := 10; end if;

  _is_child := exists (select 1 from child_profiles where id = _user_id);

  drop table if exists _u_elig;
  create temp table _u_elig on commit drop as
  select tr.base_points, tr.placement, t.event_date
  from tournament_results tr
  join tournaments t on t.id = tr.tournament_id
  where tr.user_id = _user_id
    and t.championship_id is null
    and t.is_ranked = true
    and (_season_start is null or t.event_date >= _season_start)
    and (_season_end is null or t.event_date <= _season_end);

  if _is_child then
    update child_profiles cp
       set points = coalesce(sub.total,0),
           wins = coalesce(sub.win_count,0),
           updated_at = now()
      from (
        select sum(base_points) as total,
               count(*) filter (where placement = 1) as win_count
          from (
            select base_points, placement,
                   row_number() over (order by base_points desc) as rn
              from _u_elig
          ) x
         where rn <= _bfl
      ) sub
     where cp.id = _user_id;
  else
    update profiles p
       set points = coalesce(sub.total,0),
           wins = coalesce(sub.win_count,0),
           updated_at = now()
      from (
        select sum(base_points) as total,
               count(*) filter (where placement = 1) as win_count
          from (
            select base_points, placement,
                   row_number() over (order by base_points desc) as rn
              from _u_elig
          ) x
         where rn <= _bfl
      ) sub
     where p.user_id = _user_id;
  end if;

  if _monthly_bfl_enabled then
    if _is_child then
      update child_profiles cp
        set points_monthly = coalesce(sub.total,0),
            wins_monthly = coalesce(sub.win_count,0),
            updated_at = now()
        from (
          select sum(base_points) as total, count(*) filter (where placement=1) as win_count
            from (
              select base_points, placement,
                     row_number() over (order by base_points desc) as rn
                from _u_elig
               where date_trunc('month', event_date) = date_trunc('month', now())
            ) x
           where rn <= greatest(_monthly_bfl, 1)
        ) sub
       where cp.id = _user_id;
    else
      update profiles p
        set points_monthly = coalesce(sub.total,0),
            wins_monthly = coalesce(sub.win_count,0),
            updated_at = now()
        from (
          select sum(base_points) as total, count(*) filter (where placement=1) as win_count
            from (
              select base_points, placement,
                     row_number() over (order by base_points desc) as rn
                from _u_elig
               where date_trunc('month', event_date) = date_trunc('month', now())
            ) x
           where rn <= greatest(_monthly_bfl, 1)
        ) sub
       where p.user_id = _user_id;
    end if;
  end if;
end;
$$;

SELECT public.recalculate_all_rankings(
  coalesce((select bfl from ranking_seasons where is_active = true limit 1), 10),
  coalesce((select monthly_bfl_enabled from ranking_seasons where is_active = true limit 1), false),
  coalesce((select monthly_bfl from ranking_seasons where is_active = true limit 1), 2)
);
