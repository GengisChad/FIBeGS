CREATE POLICY "Club staff can update tournament flyers"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tournament-flyers'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('leader', 'vice_leader', 'staff')
    )
  )
)
WITH CHECK (
  bucket_id = 'tournament-flyers'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('leader', 'vice_leader', 'staff')
    )
  )
);