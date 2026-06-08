
-- Create club-banners storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('club-banners', 'club-banners', true);

-- Add banner_url column to clubs table
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS banner_url text;

-- Storage policies for club-banners (allow leader AND staff)
CREATE POLICY "Club staff can upload banners" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-banners' AND (storage.foldername(name))[1] IN (
  SELECT cm.club_id::text FROM club_members cm WHERE cm.user_id = auth.uid() AND cm.role IN ('leader', 'staff')
));

CREATE POLICY "Club staff can update banners" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'club-banners' AND (storage.foldername(name))[1] IN (
  SELECT cm.club_id::text FROM club_members cm WHERE cm.user_id = auth.uid() AND cm.role IN ('leader', 'staff')
));

CREATE POLICY "Club staff can delete banners" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'club-banners' AND (storage.foldername(name))[1] IN (
  SELECT cm.club_id::text FROM club_members cm WHERE cm.user_id = auth.uid() AND cm.role IN ('leader', 'staff')
));

CREATE POLICY "Club banners are publicly readable" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'club-banners');

-- Fix club-logos: allow staff too (drop and recreate)
DROP POLICY IF EXISTS "Club leaders can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Club leaders can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Club leaders can delete logos" ON storage.objects;

CREATE POLICY "Club staff can upload logos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-logos' AND (storage.foldername(name))[1] IN (
  SELECT cm.club_id::text FROM club_members cm WHERE cm.user_id = auth.uid() AND cm.role IN ('leader', 'staff')
));

CREATE POLICY "Club staff can update logos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'club-logos' AND (storage.foldername(name))[1] IN (
  SELECT cm.club_id::text FROM club_members cm WHERE cm.user_id = auth.uid() AND cm.role IN ('leader', 'staff')
));

CREATE POLICY "Club staff can delete logos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'club-logos' AND (storage.foldername(name))[1] IN (
  SELECT cm.club_id::text FROM club_members cm WHERE cm.user_id = auth.uid() AND cm.role IN ('leader', 'staff')
));
