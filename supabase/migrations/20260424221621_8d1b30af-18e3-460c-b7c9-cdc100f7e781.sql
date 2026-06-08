CREATE OR REPLACE FUNCTION public.guard_tiebreaker_match_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_depth integer;
BEGIN
  SELECT COALESCE(tiebreaker_depth, 0) INTO v_depth
  FROM public.tournaments WHERE id = NEW.tournament_id;

  -- Block tiebreaker phase entirely when depth = 0
  IF NEW.phase = 'tiebreaker' AND v_depth = 0 THEN
    RAISE EXCEPTION 'Cannot create tiebreaker matches: tournament has tiebreaker_depth = 0';
  END IF;

  -- Block pre_top_cut when depth = 0
  IF NEW.phase = 'pre_top_cut' AND v_depth = 0 THEN
    RAISE EXCEPTION 'Cannot create pre_top_cut playoff matches: tournament has tiebreaker_depth = 0';
  END IF;

  -- NOTE: 3rd/4th place match guard removed — it incorrectly blocked semifinal
  -- match_number=2 during batch bracket inserts. Application code already
  -- guards 3rd/4th place generation via tiebreakerDepth >= 4 check.

  RETURN NEW;
END;
$function$;