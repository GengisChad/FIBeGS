
CREATE TABLE public.market_listing_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.collection_components(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_listing_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view listing components"
  ON public.market_listing_components FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can manage their own listing components"
  ON public.market_listing_components FOR ALL
  TO authenticated
  USING (
    listing_id IN (SELECT id FROM public.market_listings WHERE user_id = auth.uid())
  )
  WITH CHECK (
    listing_id IN (SELECT id FROM public.market_listings WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all listing components"
  ON public.market_listing_components FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
