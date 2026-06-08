
DROP FUNCTION IF EXISTS public.get_aggregated_match_wins(uuid[]);

CREATE FUNCTION public.get_aggregated_match_wins(_user_ids uuid[])
RETURNS TABLE(user_id uuid, total_wins bigint, tournament_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ts.user_id, 
         SUM(ts.wins)::bigint AS total_wins,
         COUNT(DISTINCT ts.tournament_id)::bigint AS tournament_count
  FROM public.tournament_standings ts
  WHERE ts.user_id = ANY(_user_ids)
  GROUP BY ts.user_id;
$$;
