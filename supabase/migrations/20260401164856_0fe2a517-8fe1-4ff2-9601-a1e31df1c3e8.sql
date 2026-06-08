
CREATE OR REPLACE FUNCTION public.get_aggregated_match_wins(_user_ids uuid[])
RETURNS TABLE(user_id uuid, total_wins bigint, tournament_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ts.user_id,
         SUM(ts.wins)::bigint AS total_wins,
         COUNT(DISTINCT ts.tournament_id)::bigint AS tournament_count
  FROM public.tournament_standings ts
  JOIN public.tournaments t ON t.id = ts.tournament_id
  WHERE ts.user_id = ANY(_user_ids)
    AND t.is_ranked = true
    AND t.event_date >= COALESCE(
      (SELECT s.start_date FROM public.ranking_seasons s WHERE s.is_active = true LIMIT 1),
      '1970-01-01'::timestamptz
    )
  GROUP BY ts.user_id;
$$;
