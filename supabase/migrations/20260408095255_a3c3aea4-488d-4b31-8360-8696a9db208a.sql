
-- =====================================================
-- REMOVE REDUNDANT SELECT POLICIES
-- These tables already have a SELECT policy with USING(true),
-- so additional SELECT policies with has_role()/is_club_staff()
-- are pure overhead - they cause extra queries on user_roles 
-- and club_members for EVERY ROW evaluated.
-- =====================================================

-- 1. club_members: has "Anyone can view club members public data" USING(true)
--    Remove 4 redundant SELECT policies
DROP POLICY IF EXISTS "Club members viewable by authenticated" ON public.club_members;
DROP POLICY IF EXISTS "Admins can view all club members" ON public.club_members;
DROP POLICY IF EXISTS "Club staff can view club members" ON public.club_members;
DROP POLICY IF EXISTS "Users can view own membership" ON public.club_members;

-- 2. profiles: has "Profiles public read basic" USING(true)
--    Remove duplicate
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

-- 3. club_follows: has "Anyone can count follows" USING(true)
--    Remove redundant user-specific SELECT
DROP POLICY IF EXISTS "Users can view own follows" ON public.club_follows;

-- =====================================================
-- REMOVE REDUNDANT INDEXES
-- =====================================================

-- idx_tournaments_club_id is now superseded by idx_tournaments_club_event
DROP INDEX IF EXISTS public.idx_tournaments_club_id;
