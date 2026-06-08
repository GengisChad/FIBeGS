
-- Allow admins to delete club members
CREATE POLICY "Admins can delete club members"
ON public.club_members FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update club members
CREATE POLICY "Admins can update club members"
ON public.club_members FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
