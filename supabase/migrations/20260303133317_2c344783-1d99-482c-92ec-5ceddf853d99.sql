ALTER TABLE public.market_listings ADD COLUMN shipping_cost numeric NULL;
ALTER TABLE public.market_listings ADD COLUMN free_shipping boolean NOT NULL DEFAULT false;