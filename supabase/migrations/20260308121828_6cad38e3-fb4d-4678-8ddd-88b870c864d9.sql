
-- Fix market-images storage: any authenticated user can delete any file
DROP POLICY IF EXISTS "Users can delete own market images" ON storage.objects;
CREATE POLICY "Users can delete own market images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'market-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix market-images upload to enforce folder structure
DROP POLICY IF EXISTS "Authenticated users can upload market images" ON storage.objects;
CREATE POLICY "Authenticated users can upload market images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'market-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Add input validation trigger for club_members
CREATE OR REPLACE FUNCTION public.validate_club_member()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND (LENGTH(NEW.phone) < 6 OR LENGTH(NEW.phone) > 20) THEN
    RAISE EXCEPTION 'Phone number must be 6-20 characters';
  END IF;
  
  IF NEW.city IS NOT NULL AND LENGTH(TRIM(NEW.city)) = 0 THEN
    RAISE EXCEPTION 'City cannot be empty';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_club_member_trigger
BEFORE INSERT OR UPDATE ON club_members
FOR EACH ROW EXECUTE FUNCTION public.validate_club_member();
