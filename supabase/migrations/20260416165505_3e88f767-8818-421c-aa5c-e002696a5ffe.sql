
-- Drop and recreate profiles_public without card_code
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT
  id, user_id, username, display_name, avatar_url, bio, city,
  points, wins, created_at, updated_at, region_id,
  last_seen_at, banner_url, favorite_deck_id, best_launch_speed
FROM public.profiles;

-- Create clubs_public without default_paypal_link
CREATE VIEW public.clubs_public
WITH (security_invoker = off) AS
SELECT
  id, name, description, logo_url, region_id, city, is_active,
  created_at, updated_at, latitude, longitude, banner_url,
  social_whatsapp_group, social_whatsapp_channel, social_discord,
  social_instagram, social_facebook, social_tiktok
FROM public.clubs;

-- Grant access to both anon and authenticated
GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT SELECT ON public.clubs_public TO anon, authenticated;
