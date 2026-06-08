-- Finalize club_members access model:
-- - anon: basic columns only
-- - authenticated: phone only for self / club staff / admin

DROP POLICY IF EXISTS "Authenticated can view club members basic info" ON public.club_members;
DROP POLICY IF EXISTS "Restricted club members select" ON public.club_members;

CREATE POLICY "Authenticated can view allowed club members"
ON public.club_members
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR is_club_staff(auth.uid(), club_id)
  OR has_role(auth.uid(), 'admin')
);

-- Privileges: anon remains column-limited; authenticated regains full-row SELECT (gated by RLS above)
REVOKE SELECT ON public.club_members FROM authenticated;
GRANT SELECT ON public.club_members TO authenticated;