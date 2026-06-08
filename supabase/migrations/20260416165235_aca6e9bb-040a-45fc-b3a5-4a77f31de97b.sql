
-- Make feedback-attachments private (it should not be public)
UPDATE storage.buckets SET public = false WHERE id = 'feedback-attachments';

-- Add SELECT policies for all public buckets to restrict listing to authenticated users only
-- This prevents anonymous API listing while keeping direct URL access working

CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Public read club-banners" ON storage.objects FOR SELECT USING (bucket_id = 'club-banners');
CREATE POLICY "Public read club-logos" ON storage.objects FOR SELECT USING (bucket_id = 'club-logos');
CREATE POLICY "Public read collection-images" ON storage.objects FOR SELECT USING (bucket_id = 'collection-images');
CREATE POLICY "Public read forum-images" ON storage.objects FOR SELECT USING (bucket_id = 'forum-images');
CREATE POLICY "Public read manga-chapters" ON storage.objects FOR SELECT USING (bucket_id = 'manga-chapters');
CREATE POLICY "Public read market-images" ON storage.objects FOR SELECT USING (bucket_id = 'market-images');
CREATE POLICY "Public read media-covers" ON storage.objects FOR SELECT USING (bucket_id = 'media-covers');
CREATE POLICY "Public read profile-banners" ON storage.objects FOR SELECT USING (bucket_id = 'profile-banners');
CREATE POLICY "Public read referee-test" ON storage.objects FOR SELECT USING (bucket_id = 'referee-test');
CREATE POLICY "Public read stickers" ON storage.objects FOR SELECT USING (bucket_id = 'stickers');
CREATE POLICY "Public read tournament-flyers" ON storage.objects FOR SELECT USING (bucket_id = 'tournament-flyers');
