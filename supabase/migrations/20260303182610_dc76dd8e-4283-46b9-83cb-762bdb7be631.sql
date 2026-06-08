CREATE TABLE public.municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  province text NOT NULL,
  province_code text NOT NULL,
  region_id uuid REFERENCES public.regions(id) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_municipalities_name ON public.municipalities(name);
CREATE INDEX idx_municipalities_region_id ON public.municipalities(region_id);
CREATE INDEX idx_municipalities_province ON public.municipalities(province);

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Municipalities viewable by everyone"
ON public.municipalities FOR SELECT
USING (true);