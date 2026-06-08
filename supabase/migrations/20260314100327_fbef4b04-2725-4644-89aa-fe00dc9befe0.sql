
CREATE OR REPLACE FUNCTION public.get_ghost_profiles_with_results()
RETURNS TABLE(user_id uuid, username text, display_name text, region_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.display_name, p.region_id
  FROM profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
    AND p.username IS NOT NULL
    AND p.username NOT LIKE '[BOT]%'
    AND p.username NOT LIKE '[Guest]%'
    AND EXISTS (SELECT 1 FROM tournament_results tr WHERE tr.user_id = p.user_id)
$$;

CREATE OR REPLACE FUNCTION public.get_real_user_profiles()
RETURNS TABLE(user_id uuid, username text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.display_name
  FROM profiles p
  WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
    AND p.username IS NOT NULL
    AND p.username NOT LIKE '[BOT]%'
    AND p.username NOT LIKE '[Guest]%'
$$;
