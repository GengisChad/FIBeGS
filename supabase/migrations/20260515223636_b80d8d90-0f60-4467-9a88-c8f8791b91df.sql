CREATE OR REPLACE FUNCTION public.filter_real_user_ids(_user_ids uuid[])
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id FROM auth.users au WHERE au.id = ANY(_user_ids)
$$;

GRANT EXECUTE ON FUNCTION public.filter_real_user_ids(uuid[]) TO anon, authenticated;