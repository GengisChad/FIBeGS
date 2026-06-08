
-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Club staff can upload tournament flyers" ON storage.objects;

-- Create a proper insert policy that checks club staff role
CREATE POLICY "Club staff can upload tournament flyers"
ON storage.objects FOR INSERT TO authenticated
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

-- Drop overly permissive delete policy
DROP POLICY IF EXISTS "Club staff can delete tournament flyers" ON storage.objects;

-- Proper delete policy
CREATE POLICY "Club staff can delete tournament flyers"
ON storage.objects FOR DELETE TO authenticated
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
);
