
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow club leaders to upload logos
CREATE POLICY "Club leaders can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'club-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT cm.club_id::text FROM public.club_members cm
    WHERE cm.user_id = auth.uid() AND cm.role = 'leader'
  )
);

-- Allow club leaders to update logos
CREATE POLICY "Club leaders can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'club-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT cm.club_id::text FROM public.club_members cm
    WHERE cm.user_id = auth.uid() AND cm.role = 'leader'
  )
);

-- Allow club leaders to delete logos
CREATE POLICY "Club leaders can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'club-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT cm.club_id::text FROM public.club_members cm
    WHERE cm.user_id = auth.uid() AND cm.role = 'leader'
  )
);

-- Allow public read access
CREATE POLICY "Club logos are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'club-logos');
