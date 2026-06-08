
INSERT INTO storage.buckets (id, name, public) VALUES ('media-covers', 'media-covers', true);
CREATE POLICY "Anyone can view media covers" ON storage.objects FOR SELECT USING (bucket_id = 'media-covers');
CREATE POLICY "Admins can upload media covers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete media covers" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media-covers' AND public.has_role(auth.uid(), 'admin'));
