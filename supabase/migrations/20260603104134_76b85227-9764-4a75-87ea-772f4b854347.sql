-- Add character customization + site deck link + cosmetics to rpg_profiles
ALTER TABLE public.rpg_profiles
  ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'male',
  ADD COLUMN IF NOT EXISTS hair text NOT NULL DEFAULT 'short_dark',
  ADD COLUMN IF NOT EXISTS eyes text NOT NULL DEFAULT 'brown',
  ADD COLUMN IF NOT EXISTS skin text NOT NULL DEFAULT 'fair',
  ADD COLUMN IF NOT EXISTS outfit text NOT NULL DEFAULT 'tunic_blue',
  ADD COLUMN IF NOT EXISTS site_deck_id uuid NULL,
  ADD COLUMN IF NOT EXISTS owned_cosmetics jsonb NOT NULL DEFAULT '[]'::jsonb;
