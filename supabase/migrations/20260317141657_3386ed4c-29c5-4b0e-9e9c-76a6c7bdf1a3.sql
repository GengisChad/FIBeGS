
-- RPC that returns all ghost user_ids (profiles without auth.users entry)
-- Used by admin panel to split registered vs imported profiles
CREATE OR REPLACE FUNCTION public.get_all_ghost_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
  FROM profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
$$;
