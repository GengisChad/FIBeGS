-- Function to count real registered Bladers (excluding bots, guests, and ghost profiles without auth)
CREATE OR REPLACE FUNCTION public.get_real_bladers_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (SELECT count(*)::int FROM public.profiles p
      WHERE p.display_name IS NOT NULL
        AND p.display_name NOT ILIKE '[BOT]%'
        AND p.display_name NOT ILIKE '[Guest]%'
        AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id))
    +
    (SELECT count(*)::int FROM public.child_profiles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_real_bladers_count() TO anon, authenticated;