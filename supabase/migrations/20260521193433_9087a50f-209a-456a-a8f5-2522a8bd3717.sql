CREATE OR REPLACE FUNCTION public.get_tournament_registration_counts(_tournament_ids uuid[])
RETURNS TABLE(tournament_id uuid, reg_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT tr.tournament_id, COUNT(*) AS reg_count
  FROM public.tournament_registrations tr
  JOIN public.tournaments t ON t.id = tr.tournament_id
  WHERE tr.tournament_id = ANY(_tournament_ids)
    AND (
      (COALESCE(t.entry_fee, 0) > 0 AND tr.status IN ('confirmed', 'pending_payment'))
      OR (COALESCE(t.entry_fee, 0) <= 0 AND tr.status = 'confirmed')
    )
  GROUP BY tr.tournament_id;
$$;