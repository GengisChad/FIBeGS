
ALTER TABLE public.media_series ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.media_seasons ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.media_series ADD COLUMN IF NOT EXISTS genre text;
ALTER TABLE public.media_series ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE public.media_series ADD COLUMN IF NOT EXISTS episodes_count integer;
