CREATE OR REPLACE FUNCTION public.topcut_bracket_order(_n integer)
RETURNS integer[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _positions integer[];
  _next integer[];
  _seed integer;
  _size integer;
BEGIN
  IF _n NOT IN (2,4,8,16,32) THEN
    RAISE EXCEPTION 'Unsupported top_cut_size %', _n;
  END IF;

  IF _n = 2 THEN
    RETURN ARRAY[1,2];
  END IF;

  _positions := ARRAY[1,2];
  _size := 4;

  WHILE _size <= _n LOOP
    _next := ARRAY[]::integer[];
    FOREACH _seed IN ARRAY _positions LOOP
      _next := _next || _seed || (_size + 1 - _seed);
    END LOOP;
    _positions := _next;
    _size := _size * 2;
  END LOOP;

  RETURN _positions;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_top8_pairings(p_tournament_id uuid)
RETURNS TABLE(match_number integer, p1_seed integer, p2_seed integer, high_seed integer, low_seed integer, valid_pair boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH expected AS (
    SELECT *
    FROM (VALUES
      (1, 1, 8),
      (2, 4, 5),
      (3, 3, 6),
      (4, 2, 7)
    ) AS v(match_number, high_seed, low_seed)
  ), qf AS (
    SELECT
      m.match_number,
      s1.seed AS p1_seed,
      s2.seed AS p2_seed
    FROM public.tournament_matches m
    LEFT JOIN public.tournament_standings s1
      ON s1.tournament_id = m.tournament_id
     AND s1.user_id = m.player1_id
    LEFT JOIN public.tournament_standings s2
      ON s2.tournament_id = m.tournament_id
     AND s2.user_id = m.player2_id
    WHERE m.tournament_id = p_tournament_id
      AND m.phase = 'top_cut'
      AND m.round = 1
  )
  SELECT
    qf.match_number,
    qf.p1_seed,
    qf.p2_seed,
    expected.high_seed,
    expected.low_seed,
    LEAST(qf.p1_seed, qf.p2_seed) = expected.high_seed
      AND GREATEST(qf.p1_seed, qf.p2_seed) = expected.low_seed AS valid_pair
  FROM qf
  JOIN expected USING (match_number)
  ORDER BY qf.match_number;
$$;

DO $$
DECLARE
  repair_result jsonb;
BEGIN
  SELECT public.repair_top_cut_pairings('fbc02710-cdc9-4db1-9290-074403992a1f'::uuid)
  INTO repair_result;

  IF COALESCE((repair_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Top Cut repair failed: %', repair_result;
  END IF;
END $$;