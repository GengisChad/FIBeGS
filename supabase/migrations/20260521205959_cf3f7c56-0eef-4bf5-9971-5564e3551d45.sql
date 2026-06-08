CREATE OR REPLACE FUNCTION public.topcut_bracket_order(_n integer)
RETURNS integer[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _order integer[] := ARRAY[]::integer[];
  _i integer;
BEGIN
  IF _n NOT IN (2,4,8,16,32) THEN
    RAISE EXCEPTION 'Unsupported top_cut_size %', _n;
  END IF;

  FOR _i IN 1..(_n / 2) LOOP
    _order := _order || _i || (_n + 1 - _i);
  END LOOP;

  RETURN _order;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_top_cut_pairings(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_size int;
  v_first_round int;
  v_played int;
  v_order int[];
  v_match record;
  v_idx int := 1;
  v_seed1 int;
  v_seed2 int;
  v_p1 uuid;
  v_p2 uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(t.top_cut_size, 8)
  INTO v_size
  FROM public.tournaments t
  WHERE t.id = _tournament_id;

  IF v_size NOT IN (2,4,8,16,32) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_size', 'size', v_size);
  END IF;

  SELECT MIN(round)
  INTO v_first_round
  FROM public.tournament_matches
  WHERE tournament_id = _tournament_id
    AND phase = 'top_cut';

  IF v_first_round IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_top_cut');
  END IF;

  SELECT COUNT(*)
  INTO v_played
  FROM public.tournament_matches
  WHERE tournament_id = _tournament_id
    AND phase = 'top_cut'
    AND (winner_id IS NOT NULL OR status = 'completed' OR COALESCE(player1_score, 0) <> 0 OR COALESCE(player2_score, 0) <> 0);

  IF v_played > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'matches_already_played', 'played', v_played);
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.tournament_standings
    WHERE tournament_id = _tournament_id
      AND COALESCE(dropped, false) = false
      AND seed BETWEEN 1 AND v_size
  ) < v_size THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'seeds_unavailable');
  END IF;

  v_order := public.topcut_bracket_order(v_size);

  FOR v_match IN
    SELECT id
    FROM public.tournament_matches
    WHERE tournament_id = _tournament_id
      AND phase = 'top_cut'
      AND round = v_first_round
    ORDER BY match_number
  LOOP
    v_seed1 := v_order[v_idx];
    v_seed2 := v_order[v_idx + 1];

    SELECT user_id INTO v_p1
    FROM public.tournament_standings
    WHERE tournament_id = _tournament_id
      AND seed = v_seed1;

    SELECT user_id INTO v_p2
    FROM public.tournament_standings
    WHERE tournament_id = _tournament_id
      AND seed = v_seed2;

    UPDATE public.tournament_matches
    SET player1_id = v_p1,
        player2_id = v_p2,
        pairing_meta = COALESCE(pairing_meta, '{}'::jsonb)
          || jsonb_build_object(
            'pairing', 'ibna_high_low_v1',
            'seed1', v_seed1,
            'seed2', v_seed2,
            'top_cut_size', v_size,
            'repaired_at', now()
          )
    WHERE id = v_match.id;

    v_idx := v_idx + 2;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'size', v_size, 'first_round', v_first_round, 'pairing', 'ibna_high_low_v1');
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_top8_pairings(p_tournament_id uuid)
RETURNS TABLE(match_number integer, p1_seed integer, p2_seed integer, high_seed integer, low_seed integer, valid_pair boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH qf AS (
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
    LEAST(qf.p1_seed, qf.p2_seed) AS high_seed,
    GREATEST(qf.p1_seed, qf.p2_seed) AS low_seed,
    (LEAST(qf.p1_seed, qf.p2_seed), GREATEST(qf.p1_seed, qf.p2_seed)) IN ((1,8),(2,7),(3,6),(4,5)) AS valid_pair
  FROM qf
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