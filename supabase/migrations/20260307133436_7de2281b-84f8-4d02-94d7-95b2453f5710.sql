
-- Create forum_stickers table
CREATE TABLE public.forum_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_stickers ENABLE ROW LEVEL SECURITY;

-- Everyone can view stickers
CREATE POLICY "Stickers viewable by everyone"
  ON public.forum_stickers FOR SELECT
  USING (true);

-- Only admins can manage stickers
CREATE POLICY "Admins can insert stickers"
  ON public.forum_stickers FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update stickers"
  ON public.forum_stickers FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete stickers"
  ON public.forum_stickers FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create stickers storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('stickers', 'stickers', true);

-- Storage policies for stickers bucket
CREATE POLICY "Anyone can view stickers" ON storage.objects FOR SELECT USING (bucket_id = 'stickers');
CREATE POLICY "Admins can upload stickers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stickers' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete stickers" ON storage.objects FOR DELETE USING (bucket_id = 'stickers' AND has_role(auth.uid(), 'admin'::app_role));
