CREATE OR REPLACE FUNCTION public.generate_top_cut_bracket(_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- CRITICAL: recalc standings FIRST so ts.seed reflects full tiebreaker chain
  -- (points → H2H → resistance → GW% → GWD → Buchholz → matches played)
  perform public.recalc_tournament_standings(_tournament_id);

  select coalesce(t.top_cut_size, 8)
  into _top_cut
  from public.tournaments t
  where t.id = _tournament_id;

  if _top_cut not in (2,4,8,16,32) then
    raise exception 'Unsupported top_cut_size % (allowed: 2,4,8,16,32)', _top_cut;
  end if;

  -- Use ts.seed directly (already computed with full tiebreaker chain by recalc_tournament_standings).
  -- This guarantees the bracket seeds match exactly what the UI standings table shows.
  create temp table _seeds on commit drop as
  select ts.user_id, ts.seed as seed_no
  from public.tournament_standings ts
  where ts.tournament_id = _tournament_id
    and coalesce(ts.dropped,false) = false
    and ts.seed is not null
    and ts.seed between 1 and _top_cut
  order by ts.seed;

  if (select count(*) from _seeds) < _top_cut then
    raise exception 'Not enough players for top cut size % (found % seeded players)',
      _top_cut, (select count(*) from _seeds);
  end if;

  -- Sanity: seeds must be exactly 1..N with no gaps/duplicates
  if exists (
    select 1 from generate_series(1, _top_cut) g
    where not exists (select 1 from _seeds s where s.seed_no = g)
  ) then
    raise exception 'Seed integrity failure for tournament %: seeds 1..% not all present', _tournament_id, _top_cut;
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
        'pairing', 'standard_bracket_v4_uses_ts_seed'
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
    'pairing', 'standard_bracket_v4_uses_ts_seed'
  );
end;
$function$;