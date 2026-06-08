CREATE POLICY "Club staff can update their club"
ON public.clubs FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM club_members cm
  WHERE cm.club_id = clubs.id AND cm.user_id = auth.uid() AND cm.role IN ('leader', 'staff')
));