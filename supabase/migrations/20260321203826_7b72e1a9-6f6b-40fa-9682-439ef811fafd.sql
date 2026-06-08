
-- Create storage bucket for tournament flyers
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tournament-flyers', 'tournament-flyers', true, 524288)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload flyers
CREATE POLICY "Club staff can upload tournament flyers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tournament-flyers');

-- Allow anyone to read flyers (public)
CREATE POLICY "Anyone can read tournament flyers"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'tournament-flyers');

-- Allow authenticated users to delete flyers  
CREATE POLICY "Club staff can delete tournament flyers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tournament-flyers');
