ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS social_whatsapp_group text,
  ADD COLUMN IF NOT EXISTS social_whatsapp_channel text,
  ADD COLUMN IF NOT EXISTS social_discord text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_tiktok text;