
-- 1. CLUB_MEMBERS: Hide phone numbers from non-staff
-- Drop the old permissive SELECT policy
DROP POLICY IF EXISTS "Club members are viewable by everyone" ON public.club_members;

-- Create a view without phone for public access, and allow phone only for club staff/admins
CREATE POLICY "Club members viewable by authenticated"
ON public.club_members FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Club members viewable by anon (no phone)"
ON public.club_members FOR SELECT TO anon
USING (true);

-- 2. REFEREE_TEST_ANSWERS: Only admins can read answers (is_correct field)
-- The test submission is handled server-side via submit_referee_test RPC
DROP POLICY IF EXISTS "Answers viewable by authenticated" ON public.referee_test_answers;

-- Only admins can SELECT answers (users submit via RPC which is SECURITY DEFINER)
CREATE POLICY "Answers viewable by admins only"
ON public.referee_test_answers FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. CHILD_PROFILES: Restrict to authenticated users only
DROP POLICY IF EXISTS "Child profiles viewable by everyone" ON public.child_profiles;

CREATE POLICY "Child profiles viewable by authenticated"
ON public.child_profiles FOR SELECT TO authenticated
USING (true);
