
-- Create market_listings table
CREATE TABLE public.market_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  image_url TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  condition TEXT NOT NULL,
  sale_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create market_reports table
CREATE TABLE public.market_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;

-- Listings RLS
CREATE POLICY "Listings viewable by everyone" ON public.market_listings FOR SELECT USING (true);
CREATE POLICY "Users can create listings" ON public.market_listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own listings" ON public.market_listings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any listing" ON public.market_listings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own listings" ON public.market_listings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any listing" ON public.market_listings FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Reports RLS
CREATE POLICY "Users can create reports" ON public.market_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view reports" ON public.market_reports FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update reports" ON public.market_reports FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete reports" ON public.market_reports FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for market images
INSERT INTO storage.buckets (id, name, public) VALUES ('market-images', 'market-images', true);

-- Storage RLS
CREATE POLICY "Anyone can view market images" ON storage.objects FOR SELECT USING (bucket_id = 'market-images');
CREATE POLICY "Authenticated users can upload market images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'market-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own market images" ON storage.objects FOR DELETE USING (bucket_id = 'market-images' AND auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_market_listings_updated_at
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
