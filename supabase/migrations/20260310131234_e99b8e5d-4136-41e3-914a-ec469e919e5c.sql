CREATE POLICY "Club members can view children of club members"
ON public.child_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM club_members cm1
    JOIN club_members cm2 ON cm2.club_id = cm1.club_id
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = child_profiles.parent_user_id
  )
);