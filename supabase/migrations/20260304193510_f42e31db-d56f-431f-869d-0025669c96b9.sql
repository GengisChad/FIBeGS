
-- Add parent_id to collection_categories for sub-categories (1 level)
ALTER TABLE public.collection_categories
ADD COLUMN parent_id uuid REFERENCES public.collection_categories(id) ON DELETE CASCADE DEFAULT NULL;

-- Create collection_component_stats table for radar chart (6 fixed stats per component)
CREATE TABLE public.collection_component_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.collection_components(id) ON DELETE CASCADE,
  stat_name text NOT NULL,
  stat_value integer NOT NULL DEFAULT 0,
  stat_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stat_value_range CHECK (stat_value >= 0 AND stat_value <= 100),
  UNIQUE (component_id, stat_order)
);

-- Enable RLS
ALTER TABLE public.collection_component_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Stats viewable by everyone" ON public.collection_component_stats
FOR SELECT USING (true);

CREATE POLICY "Admins can insert stats" ON public.collection_component_stats
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update stats" ON public.collection_component_stats
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete stats" ON public.collection_component_stats
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
