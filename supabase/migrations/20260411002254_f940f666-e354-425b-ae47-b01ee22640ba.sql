
-- Fix users_export: remove email, use security_invoker
DROP VIEW IF EXISTS public.users_export CASCADE;
CREATE VIEW public.users_export
WITH (security_invoker = on) AS
SELECT
  id,
  created_at,
  last_sign_in_at,
  (raw_user_meta_data ->> 'name'::text) AS name
FROM auth.users;

-- Fix club_members_public: security_invoker, no phone
DROP VIEW IF EXISTS public.club_members_public CASCADE;
CREATE VIEW public.club_members_public
WITH (security_invoker = on) AS
SELECT
  id, club_id, user_id, role, joined_at, city, last_tournament_at
FROM public.club_members;

-- Create profiles_public view without birth_date
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  id, user_id, username, display_name, avatar_url, bio, city,
  points, wins, created_at, updated_at, region_id, last_seen_at,
  banner_url, favorite_deck_id, best_launch_speed, card_code
FROM public.profiles;

-- Remove anon read on profiles (exposes birth_date)
DROP POLICY IF EXISTS "Profiles public read basic" ON public.profiles;
