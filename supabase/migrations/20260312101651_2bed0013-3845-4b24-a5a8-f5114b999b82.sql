CREATE OR REPLACE FUNCTION public.get_club_member_counts()
RETURNS TABLE(club_id uuid, member_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT club_id, COUNT(*) as member_count
  FROM public.club_members
  GROUP BY club_id;
$$;