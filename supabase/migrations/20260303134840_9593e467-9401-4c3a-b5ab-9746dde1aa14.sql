
-- Collection categories (e.g. "Bey Completi", "Blade", "Ratchet", "Bit")
CREATE TABLE public.collection_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collection_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories viewable by everyone" ON public.collection_categories FOR SELECT USING (true);
CREATE POLICY "Admins can insert categories" ON public.collection_categories FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update categories" ON public.collection_categories FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete categories" ON public.collection_categories FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Collection components
CREATE TABLE public.collection_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.collection_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  weight_min numeric,
  weight_max numeric,
  recommended_price numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collection_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Components viewable by everyone" ON public.collection_components FOR SELECT USING (true);
CREATE POLICY "Admins can insert components" ON public.collection_components FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update components" ON public.collection_components FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete components" ON public.collection_components FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Component links (parent auto-checks linked children)
CREATE TABLE public.collection_component_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_component_id uuid NOT NULL REFERENCES public.collection_components(id) ON DELETE CASCADE,
  linked_component_id uuid NOT NULL REFERENCES public.collection_components(id) ON DELETE CASCADE,
  UNIQUE(parent_component_id, linked_component_id)
);

ALTER TABLE public.collection_component_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Links viewable by everyone" ON public.collection_component_links FOR SELECT USING (true);
CREATE POLICY "Admins can insert links" ON public.collection_component_links FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete links" ON public.collection_component_links FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- User collection (which components a user owns)
CREATE TABLE public.user_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  component_id uuid NOT NULL REFERENCES public.collection_components(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, component_id)
);

ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collection viewable by everyone" ON public.user_collection FOR SELECT USING (true);
CREATE POLICY "Users can insert own collection" ON public.user_collection FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own collection" ON public.user_collection FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for collection images
INSERT INTO storage.buckets (id, name, public) VALUES ('collection-images', 'collection-images', true);

CREATE POLICY "Anyone can view collection images" ON storage.objects FOR SELECT USING (bucket_id = 'collection-images');
CREATE POLICY "Admins can upload collection images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'collection-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete collection images" ON storage.objects FOR DELETE USING (bucket_id = 'collection-images' AND has_role(auth.uid(), 'admin'::app_role));
