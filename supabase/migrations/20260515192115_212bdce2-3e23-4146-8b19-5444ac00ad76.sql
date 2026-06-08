CREATE OR REPLACE FUNCTION public.search_mentionable_users(q text)
RETURNS TABLE(username text, display_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND p.username ILIKE '%' || q || '%'
    AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
  ORDER BY (p.username ILIKE q || '%') DESC, p.username ASC
  LIMIT 8;
$$;

GRANT EXECUTE ON FUNCTION public.search_mentionable_users(text) TO authenticated, anon;