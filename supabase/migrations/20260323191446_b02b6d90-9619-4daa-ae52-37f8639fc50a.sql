
-- 1) Recreate club_members_public view with SECURITY INVOKER
-- This ensures the caller's RLS policies on club_members are enforced
DROP VIEW IF EXISTS public.club_members_public;
CREATE VIEW public.club_members_public
WITH (security_invoker = true)
AS
SELECT id, club_id, user_id, role, joined_at, city, last_tournament_at
FROM public.club_members;

-- 2) Protect profiles from anonymous access to sensitive columns
-- Remove the public (anon) read policy and replace with authenticated-only
DROP POLICY IF EXISTS "Profiles public read basic" ON public.profiles;

-- Create a public view for anonymous access that excludes sensitive fields
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false)
AS
SELECT
  id, user_id, username, display_name, avatar_url, banner_url, bio,
  city, region_id, points, wins, best_launch_speed, favorite_deck_id,
  created_at, updated_at
FROM public.profiles;

-- Grant anon read access to the public view (no birth_date, no last_seen_at)
GRANT SELECT ON public.profiles_public TO anon;
GRANT SELECT ON public.profiles_public TO authenticated;
