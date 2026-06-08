
CREATE TABLE public.ranked_3d_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  download_url text NOT NULL,
  category text DEFAULT 'stadium',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ranked_3d_models ENABLE ROW LEVEL SECURITY;

-- Everyone can read active models
CREATE POLICY "Anyone can view active 3d models"
  ON public.ranked_3d_models FOR SELECT
  USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage 3d models"
  ON public.ranked_3d_models FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
