
-- Add is_hidden flag to tournaments so club staff can prepare/calendar tournaments without exposing them publicly
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tournaments_is_hidden ON public.tournaments(is_hidden);

-- Replace the permissive public SELECT policy with one that hides "hidden" tournaments from regular users.
-- Club staff, admins, and championship managers must still be able to see and manage their hidden tournaments.
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON public.tournaments;

CREATE POLICY "Tournaments are viewable by everyone"
  ON public.tournaments
  FOR SELECT
  USING (
    is_hidden = false
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (club_id IS NOT NULL AND is_club_staff(auth.uid(), club_id))
    OR (
      championship_id IS NOT NULL
      AND has_role(auth.uid(), 'sponsor'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.championship_managers cm
        WHERE cm.championship_id = tournaments.championship_id
          AND cm.user_id = auth.uid()
      )
    )
  );
