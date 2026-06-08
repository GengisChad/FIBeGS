CREATE OR REPLACE FUNCTION public.topcut_bracket_order(_n integer)
RETURNS integer[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _n
    WHEN 2 THEN ARRAY[1,2]
    WHEN 4 THEN ARRAY[1,4,2,3]
    WHEN 8 THEN ARRAY[1,8,4,5,3,6,2,7]
    WHEN 16 THEN ARRAY[1,16,8,9,4,13,5,12,3,14,6,11,7,10,2,15]
    WHEN 32 THEN ARRAY[1,32,16,17,8,25,9,24,4,29,13,20,5,28,12,21,3,30,14,19,6,27,11,22,7,26,10,23,2,31,15,18]
    ELSE NULL
  END;
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