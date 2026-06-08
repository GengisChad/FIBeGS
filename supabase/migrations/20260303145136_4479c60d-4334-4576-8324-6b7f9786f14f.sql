
-- Enforce one club per user
CREATE UNIQUE INDEX IF NOT EXISTS club_members_user_id_unique ON public.club_members (user_id);

-- Allow leaders to delete their own club
CREATE POLICY "Leaders can delete their club"
ON public.clubs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = clubs.id
    AND cm.user_id = auth.uid()
    AND cm.role = 'leader'
  )
);
