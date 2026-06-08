-- Restore club_members read access for authenticated users
CREATE POLICY "Authenticated can view club members"
ON public.club_members
FOR SELECT
TO authenticated
USING (true);
