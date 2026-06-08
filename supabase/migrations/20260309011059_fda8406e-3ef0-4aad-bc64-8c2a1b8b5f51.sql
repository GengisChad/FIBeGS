-- Fix: Restrict club_members SELECT to protect phone numbers

-- Drop the overly permissive SELECT policies
DROP POLICY IF EXISTS "Anon can view club members basic info" ON club_members;
DROP POLICY IF EXISTS "Authenticated can view club members" ON club_members;

-- Create restrictive SELECT policy: only own record, club staff, or admin
CREATE POLICY "Users can view own membership" ON club_members
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Club staff can view club members" ON club_members
  FOR SELECT
  USING (is_club_staff(auth.uid(), club_id));

CREATE POLICY "Admins can view all club members" ON club_members
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));