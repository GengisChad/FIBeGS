
-- Function: recalc a single user's seasonal points/wins using the same logic as recalculate_all_rankings
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

  -- Eligible season-active, ranked, non-championship results (best per ISO week per club for external)
  drop table if exists _u_elig;
  create temp table _u_elig on commit drop as
  with base as (
    select tr.base_points, tr.placement, t.event_date, t.is_external, t.club_id,
           case when t.is_external = true then
             row_number() over (
               partition by coalesce(t.club_id::text,'_nc'), date_trunc('week', t.event_date)
               order by tr.base_points desc, t.event_date desc, t.id
             )
           else 1 end as ext_rn
    from tournament_results tr
    join tournaments t on t.id = tr.tournament_id
    where tr.user_id = _user_id
      and t.championship_id is null
      and t.is_ranked = true
      and (_season_start is null or t.event_date >= _season_start)
      and (_season_end is null or t.event_date <= _season_end)
  )
  select base_points, placement, event_date from base where ext_rn = 1;

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

  -- Monthly recalc (best of current month + rollover) if enabled
  if _monthly_bfl_enabled then
    drop table if exists _u_elig_m;
    create temp table _u_elig_m on commit drop as
    select base_points, placement, event_date,
           case when date_trunc('month', event_date) = date_trunc('month', now()) then 1 else 0 end as is_monthly
      from _u_elig;

    if _is_child then
      update child_profiles cp
        set points_monthly = coalesce(sub.total,0),
            wins_monthly = coalesce(sub.win_count,0),
            updated_at = now()
        from (
          select sum(base_points) as total, count(*) filter (where placement=1) as win_count
            from (
              select base_points, placement,
                     row_number() over (order by is_monthly desc, base_points desc) as rn
                from _u_elig_m
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
                     row_number() over (order by is_monthly desc, base_points desc) as rn
                from _u_elig_m
            ) x
           where rn <= greatest(_monthly_bfl, 1)
        ) sub
       where p.user_id = _user_id;
    end if;
  end if;
end;
$$;

-- Trigger function to auto-recalc on insert/update/delete
CREATE OR REPLACE FUNCTION public.tr_recalc_user_points_on_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if (TG_OP = 'DELETE') then
    perform public.recalculate_user_points(old.user_id);
    return old;
  else
    perform public.recalculate_user_points(new.user_id);
    if (TG_OP = 'UPDATE' and old.user_id is distinct from new.user_id) then
      perform public.recalculate_user_points(old.user_id);
    end if;
    return new;
  end if;
end;
$$;

-- Replace the old DELETE-only trigger with INSERT/UPDATE/DELETE trigger
DROP TRIGGER IF EXISTS on_tournament_result_delete ON public.tournament_results;
DROP TRIGGER IF EXISTS on_tournament_result_change ON public.tournament_results;
CREATE TRIGGER on_tournament_result_change
AFTER INSERT OR UPDATE OR DELETE ON public.tournament_results
FOR EACH ROW EXECUTE FUNCTION public.tr_recalc_user_points_on_result();

-- One-shot recalculation to fix existing stale totals
SELECT public.recalculate_all_rankings(
  coalesce((select bfl from ranking_seasons where is_active = true limit 1), 10),
  coalesce((select monthly_bfl_enabled from ranking_seasons where is_active = true limit 1), false),
  coalesce((select monthly_bfl from ranking_seasons where is_active = true limit 1), 2)
);
