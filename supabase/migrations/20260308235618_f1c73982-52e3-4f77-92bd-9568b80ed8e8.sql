-- Allow public/basic access to club membership rows while preventing phone reads via column privileges

-- Remove now-unneeded restricted SELECT policy (phone access is handled via RPC)
DROP POLICY IF EXISTS "Restricted club members select" ON public.club_members;

-- Replace any existing basic SELECT policies
DROP POLICY IF EXISTS "Anon can view club members basic info" ON public.club_members;
DROP POLICY IF EXISTS "Authenticated can view club members basic info" ON public.club_members;

CREATE POLICY "Anon can view club members basic info"
ON public.club_members
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Authenticated can view club members basic info"
ON public.club_members
FOR SELECT
TO authenticated
USING (true);

-- Column-level privileges: anon/authenticated can SELECT only non-sensitive columns
REVOKE SELECT ON public.club_members FROM anon, authenticated;
GRANT SELECT (id, club_id, user_id, role, joined_at, city, last_tournament_at)
ON public.club_members TO anon, authenticated;