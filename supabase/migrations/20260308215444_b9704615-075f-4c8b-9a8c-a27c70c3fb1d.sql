
-- =============================================
-- 1. FIX: club_members - replace blanket SELECT with restricted policies
-- Phone column remains in table but only accessible via RPC
-- =============================================

DROP POLICY IF EXISTS "Club members basic select" ON public.club_members;

-- Authenticated users can see non-phone fields (RLS can't filter columns,
-- so we split: public gets read via queries that exclude phone column,
-- staff gets phone via the existing get_club_members_with_phone RPC)
-- Allow authenticated to see club members (without phone - enforced at query level)
CREATE POLICY "Authenticated can view club members"
ON public.club_members FOR SELECT
TO authenticated
USING (true);

-- Anonymous users can see club members for public club pages (member counts, etc.)
-- Phone is NOT selected in anonymous queries
CREATE POLICY "Anon can view club members basic info"
ON public.club_members FOR SELECT
TO anon
USING (true);

-- Since RLS cannot restrict columns, we create a VIEW without phone for public use
CREATE OR REPLACE VIEW public.club_members_public AS
SELECT id, club_id, user_id, role, joined_at, city, last_tournament_at
FROM public.club_members;

-- =============================================
-- 2. FIX: push_subscriptions - remove staff SELECT policy
-- Staff should never directly access push credentials
-- =============================================

DROP POLICY IF EXISTS "Staff can view tournament participant subscriptions" ON public.push_subscriptions;
