
-- 1. Fix clubs: restrict SELECT to authenticated only
-- Drop existing public SELECT policies on clubs
DROP POLICY IF EXISTS "Clubs are viewable by everyone" ON public.clubs;
DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;
DROP POLICY IF EXISTS "clubs_select" ON public.clubs;

-- Create authenticated-only SELECT
CREATE POLICY "Clubs viewable by authenticated users"
ON public.clubs
FOR SELECT
TO authenticated
USING (true);

-- 2. Fix profiles: restrict SELECT to authenticated only
DROP POLICY IF EXISTS "Profiles viewable by everyone (fix)" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 3. Fix Realtime authorization
-- Enable Realtime RLS (Realtime Authorization) by setting the realtime policies
-- We need to use Supabase Realtime's built-in authorization via RLS on the source tables
-- The source tables already have RLS. We need to ensure Realtime respects them.

-- For notifications: users should only receive their own notifications via realtime
-- The existing RLS on notifications table should already filter by user_id
-- Let's verify and tighten the realtime subscription by ensuring proper policies exist

-- Ensure notifications only visible to owner
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ensure market_messages only visible to chat participants
DROP POLICY IF EXISTS "Chat participants can view messages" ON public.market_messages;
DROP POLICY IF EXISTS "market_messages_select" ON public.market_messages;
CREATE POLICY "Chat participants can view messages"
ON public.market_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.market_chats mc
    WHERE mc.id = chat_id
    AND (mc.buyer_id = auth.uid() OR mc.seller_id = auth.uid())
  )
);

-- Ensure announcements only visible to authenticated
DROP POLICY IF EXISTS "Announcements viewable by everyone" ON public.announcements;
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can view announcements" ON public.announcements;
CREATE POLICY "Announcements viewable by authenticated"
ON public.announcements
FOR SELECT
TO authenticated
USING (true);
