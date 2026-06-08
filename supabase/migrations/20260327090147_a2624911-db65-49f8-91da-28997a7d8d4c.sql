ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS custom_rules text;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS banlist text DEFAULT 'all';