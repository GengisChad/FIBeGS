
-- Fix: Make profiles_public use security_invoker and restore a limited anon policy on profiles
-- Drop the security definer view
DROP VIEW IF EXISTS public.profiles_public;

-- Instead, use column-level GRANT to control what anon can see
-- First, revoke all anon SELECT on profiles, then grant only safe columns
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, user_id, username, display_name, avatar_url, banner_url, bio, city, region_id, points, wins, best_launch_speed, favorite_deck_id, created_at, updated_at) ON public.profiles TO anon;

-- Re-add the anon read policy (needed for RLS) but now column grants protect sensitive data
CREATE POLICY "Profiles public read basic"
ON public.profiles
FOR SELECT
TO anon
USING (true);
