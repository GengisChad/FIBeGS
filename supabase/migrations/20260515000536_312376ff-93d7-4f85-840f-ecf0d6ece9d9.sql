-- Helper: canonical bracket seed order
create or replace function public.topcut_bracket_order(_n integer)
returns integer[]
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  _prev integer[];
  _out integer[];
  _i integer;
  _s integer;
begin
  if _n not in (2,4,8,16,32) then
    raise exception 'Unsupported top_cut_size %', _n;
  end if;
  _prev := array[1,2];
  _i := 4;
  while _i <= _n loop
    _out := array[]::integer[];
    for _s in 1..array_length(_prev,1) loop
      _out := _out || _prev[_s] || (_i + 1 - _prev[_s]);
    end loop;
    _prev := _out;
    _i := _i * 2;
  end loop;
  if _n = 2 then
    return array[1,2];
  end if;
  return _prev;
end;
$$;

-- Replace top-cut generator with canonical bracket order
create or replace function public.generate_top_cut_bracket(_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _top_cut integer;
  _i integer;
  _order integer[];
  _seed1 integer;
  _seed2 integer;
  _created integer := 0;
  _bad_pairs integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if not (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'staff') or has_role(auth.uid(), 'moderator')) then
    raise exception 'Unauthorized: staff only';
  end if;

  if exists (
    select 1 from public.tournament_matches tm
    where tm.tournament_id = _tournament_id
      and tm.phase = 'swiss'
      and tm.status <> 'completed'
  ) then
    raise exception 'Cannot generate top cut: swiss matches still pending';
  end if;

  if exists (
    select 1 from public.tournament_matches tm
    where tm.tournament_id = _tournament_id
      and tm.phase = 'top_cut'
  ) then
    raise exception 'Top cut already exists for tournament %', _tournament_id;
  end if;

  perform public.recalc_tournament_standings(_tournament_id);

  select coalesce(t.top_cut_size, 8)
  into _top_cut
  from public.tournaments t
  where t.id = _tournament_id;

  if _top_cut not in (2,4,8,16,32) then
    raise exception 'Unsupported top_cut_size % (allowed: 2,4,8,16,32)', _top_cut;
  end if;

  create temp table _seeds on commit drop as
  select ts.user_id,
         row_number() over (
           order by coalesce(ts.points,0) desc,
                    coalesce(ts.resistance,0) desc,
                    coalesce(ts.seed,999999) asc,
                    ts.user_id
         ) as seed_no
  from public.tournament_standings ts
  where ts.tournament_id = _tournament_id
    and coalesce(ts.dropped,false) = false
  limit _top_cut;

  if (select count(*) from _seeds) < _top_cut then
    raise exception 'Not enough players for top cut size %', _top_cut;
  end if;

  _order := public.topcut_bracket_order(_top_cut);

  for _i in 1..(_top_cut/2)
  loop
    _seed1 := _order[(_i-1)*2 + 1];
    _seed2 := _order[(_i-1)*2 + 2];

    insert into public.tournament_matches(
      tournament_id, round, phase, match_number,
      player1_id, player2_id, status, pairing_meta
    )
    values (
      _tournament_id,
      1,
      'top_cut',
      _i,
      (select s.user_id from _seeds s where s.seed_no = _seed1),
      (select s.user_id from _seeds s where s.seed_no = _seed2),
      'pending',
      jsonb_build_object(
        'seed1', _seed1,
        'seed2', _seed2,
        'top_cut_size', _top_cut,
        'pairing', 'standard_bracket_v3'
      )
    );

    _created := _created + 1;
  end loop;

  -- Integrity: every R1 pair must sum to N+1
  select count(*) into _bad_pairs
  from public.tournament_matches tm
  where tm.tournament_id = _tournament_id
    and tm.phase = 'top_cut'
    and tm.round = 1
    and (
      (tm.pairing_meta->>'seed1')::int + (tm.pairing_meta->>'seed2')::int
    ) <> (_top_cut + 1);

  if _bad_pairs > 0 then
    raise exception 'Top cut integrity check failed for tournament %', _tournament_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'tournament_id', _tournament_id,
    'top_cut_size', _top_cut,
    'matches_created', _created,
    'pairing', 'standard_bracket_v3'
  );
end;
$$;