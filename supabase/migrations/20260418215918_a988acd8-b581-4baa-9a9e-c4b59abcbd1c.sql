-- Bucket pubblico per sprite arena/beyblade del Random Picker minigame
INSERT INTO storage.buckets (id, name, public)
VALUES ('random-picker-assets', 'random-picker-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Lettura pubblica
CREATE POLICY "Random picker assets are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'random-picker-assets');

-- Solo admin può caricare
CREATE POLICY "Admins can upload random picker assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'random-picker-assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Solo admin può aggiornare
CREATE POLICY "Admins can update random picker assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'random-picker-assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Solo admin può eliminare
CREATE POLICY "Admins can delete random picker assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'random-picker-assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);