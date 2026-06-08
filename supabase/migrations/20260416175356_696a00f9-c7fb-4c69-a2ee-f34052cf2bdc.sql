-- Allow public visibility of minimal child info (display_name, avatar_url) ONLY for children
-- registered to tournaments. This fixes "Figlio" placeholder for unauthenticated visitors
-- without exposing private child data (city, region, parent_user_id, points, wins, etc.).

CREATE OR REPLACE FUNCTION public.get_tournament_child_profiles(_tournament_id uuid)
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.id, cp.display_name, cp.avatar_url
  FROM public.child_profiles cp
  WHERE cp.id IN (
    SELECT tr.child_profile_id
    FROM public.tournament_registrations tr
    WHERE tr.tournament_id = _tournament_id
      AND tr.child_profile_id IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_tournament_child_profiles(uuid) TO anon, authenticated;