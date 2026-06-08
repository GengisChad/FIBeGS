-- Allow anyone (including anonymous visitors) to view club memberships,
-- so the public Rankings page can show each player's club.
DROP POLICY IF EXISTS "Authenticated can view club members" ON public.club_members;

CREATE POLICY "Anyone can view club members"
  ON public.club_members
  FOR SELECT
  USING (true);