-- Fix club_members access: allow all authenticated users to see members (without phone)

-- Drop overly restrictive policy
DROP POLICY IF EXISTS "Authenticated can view allowed club members" ON public.club_members;

-- Create broader policy for viewing members (phone protected via column privileges)
CREATE POLICY "Authenticated can view club members"
ON public.club_members
FOR SELECT
TO authenticated
USING (true);

-- Ensure column privileges remain: phone is accessible only via RPC for staff/admin
-- (authenticated already has SELECT on non-phone columns from previous migration)