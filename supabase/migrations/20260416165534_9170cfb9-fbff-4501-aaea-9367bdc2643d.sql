
-- Re-open profiles and clubs SELECT to everyone (anon + authenticated)
-- The previous restriction to authenticated-only broke public visibility

DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Clubs viewable by authenticated users" ON public.clubs;
CREATE POLICY "Clubs viewable by everyone"
ON public.clubs FOR SELECT
USING (true);
