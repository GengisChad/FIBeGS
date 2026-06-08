UPDATE storage.buckets SET public = true WHERE id = 'feedback-attachments';

-- Ensure a public read policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Feedback attachments are publicly readable'
  ) THEN
    CREATE POLICY "Feedback attachments are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'feedback-attachments');
  END IF;
END $$;