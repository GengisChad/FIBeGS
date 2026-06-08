
DROP POLICY IF EXISTS "Users can delete own market images" ON storage.objects;
CREATE POLICY "Users can delete own market images"
ON storage.objects FOR DELETE USING (
  bucket_id = 'market-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Also allow admins to delete any market image
CREATE POLICY "Admins can delete any market images"
ON storage.objects FOR DELETE USING (
  bucket_id = 'market-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);
