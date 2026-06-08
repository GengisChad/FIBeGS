
CREATE OR REPLACE FUNCTION public.get_tournament_registration_counts(_tournament_ids uuid[])
RETURNS TABLE(tournament_id uuid, reg_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT tournament_id, COUNT(*) as reg_count
  FROM public.tournament_registrations
  WHERE tournament_id = ANY(_tournament_ids)
    AND status = 'confirmed'
  GROUP BY tournament_id;
$$;
