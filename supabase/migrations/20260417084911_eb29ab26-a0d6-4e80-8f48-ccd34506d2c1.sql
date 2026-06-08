
-- Create storage bucket for market images (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('market-images', 'market-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for market-images bucket
CREATE POLICY "Market images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'market-images');

CREATE POLICY "Authenticated users can upload market images to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'market-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own market images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'market-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own market images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'market-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Update cleanup function to also delete storage files
-- (cleanup-market-listings already deletes listings >30d; we extend it to handle storage in code)
-- Schedule daily cleanup via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Database function to cleanup expired market listings + their storage files
CREATE OR REPLACE FUNCTION public.cleanup_expired_market_listings()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  _cutoff TIMESTAMPTZ := now() - INTERVAL '30 days';
  _deleted_count INT := 0;
  _listing RECORD;
  _path TEXT;
BEGIN
  FOR _listing IN
    SELECT id, image_url FROM market_listings WHERE created_at < _cutoff
  LOOP
    -- If image is in our bucket, delete the storage object
    IF _listing.image_url IS NOT NULL AND _listing.image_url LIKE '%/market-images/%' THEN
      _path := substring(_listing.image_url FROM '/market-images/(.+)$');
      IF _path IS NOT NULL THEN
        DELETE FROM storage.objects
        WHERE bucket_id = 'market-images' AND name = _path;
      END IF;
    END IF;

    -- Delete reports + listing
    DELETE FROM market_reports WHERE listing_id = _listing.id;
    DELETE FROM market_listings WHERE id = _listing.id;
    _deleted_count := _deleted_count + 1;
  END LOOP;

  RETURN _deleted_count;
END;
$$;

-- Schedule daily run at 03:00 UTC
SELECT cron.unschedule('cleanup-expired-market-listings')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-market-listings');

SELECT cron.schedule(
  'cleanup-expired-market-listings',
  '0 3 * * *',
  $$ SELECT public.cleanup_expired_market_listings(); $$
);
