-- Harden club_members SELECT access so phone is never publicly readable

-- Remove any legacy overly-permissive policies if present
DROP POLICY IF EXISTS "Anon can view club members basic info" ON public.club_members;
DROP POLICY IF EXISTS "Authenticated can view club members" ON public.club_members;

-- Replace fragmented SELECT policies with a single least-privilege policy
DROP POLICY IF EXISTS "Users can view own membership" ON public.club_members;
DROP POLICY IF EXISTS "Club staff can view their club members" ON public.club_members;
DROP POLICY IF EXISTS "Admins can view all club members" ON public.club_members;

CREATE POLICY "Restricted club members select"
ON public.club_members
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR is_club_staff(auth.uid(), club_id)
  OR has_role(auth.uid(), 'admin')
);

-- Ensure unauthenticated users cannot read the base table directly
REVOKE SELECT ON public.club_members FROM anon;

-- Keep public-safe view shape stable (no phone column)
CREATE OR REPLACE VIEW public.club_members_public AS
SELECT
  cm.id,
  cm.club_id,
  cm.user_id,
  cm.role,
  cm.joined_at,
  cm.city,
  cm.last_tournament_at
FROM public.club_members cm;

GRANT SELECT ON public.club_members_public TO anon, authenticated;