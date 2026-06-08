
-- Add image_url column to forum_posts
ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS image_url text;

-- Create forum-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-images', 'forum-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can view forum images
CREATE POLICY "Forum images viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'forum-images');

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload forum images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'forum-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: users can delete their own forum images
CREATE POLICY "Users can delete own forum images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'forum-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: admins can delete any forum image
CREATE POLICY "Admins can delete any forum image"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'forum-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);
