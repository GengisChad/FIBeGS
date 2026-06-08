-- Allow public read access to child profiles so they have public profile pages
-- (same level of exposure as the adult `profiles` table, which is also public-read).
CREATE POLICY "Child profiles viewable by everyone"
ON public.child_profiles
FOR SELECT
USING (true);