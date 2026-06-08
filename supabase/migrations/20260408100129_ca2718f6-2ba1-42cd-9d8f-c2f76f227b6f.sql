
-- Add card_code column
ALTER TABLE public.profiles ADD COLUMN card_code integer UNIQUE;

-- Create sequence starting at 100001
CREATE SEQUENCE IF NOT EXISTS public.card_code_seq START WITH 100001 INCREMENT BY 1;

-- Backfill existing profiles
UPDATE public.profiles SET card_code = nextval('public.card_code_seq') WHERE card_code IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN card_code SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN card_code SET DEFAULT nextval('public.card_code_seq');

-- Index for fast lookup
CREATE INDEX idx_profiles_card_code ON public.profiles (card_code);
