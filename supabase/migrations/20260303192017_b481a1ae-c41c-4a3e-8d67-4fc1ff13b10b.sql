
-- Create collection_component_variants table
CREATE TABLE public.collection_component_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  component_id UUID NOT NULL REFERENCES public.collection_components(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collection_component_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Variants viewable by everyone" ON public.collection_component_variants FOR SELECT USING (true);
CREATE POLICY "Admins can insert variants" ON public.collection_component_variants FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update variants" ON public.collection_component_variants FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete variants" ON public.collection_component_variants FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create collection_variant_links table (variant -> variant linking)
CREATE TABLE public.collection_variant_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_variant_id UUID NOT NULL REFERENCES public.collection_component_variants(id) ON DELETE CASCADE,
  linked_variant_id UUID NOT NULL REFERENCES public.collection_component_variants(id) ON DELETE CASCADE,
  UNIQUE(parent_variant_id, linked_variant_id)
);

ALTER TABLE public.collection_variant_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Variant links viewable by everyone" ON public.collection_variant_links FOR SELECT USING (true);
CREATE POLICY "Admins can insert variant links" ON public.collection_variant_links FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete variant links" ON public.collection_variant_links FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add variant_id to user_collection (nullable - null means base component)
ALTER TABLE public.user_collection ADD COLUMN variant_id UUID REFERENCES public.collection_component_variants(id) ON DELETE CASCADE;
