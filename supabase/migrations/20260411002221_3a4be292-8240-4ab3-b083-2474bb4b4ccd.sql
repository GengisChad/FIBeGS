
-- Remove anon access to club_members (phone numbers exposed)
DROP POLICY IF EXISTS "Anyone can view club members public data" ON public.club_members;
