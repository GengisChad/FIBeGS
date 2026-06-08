
-- Allow club staff to delete registrations for their tournaments
CREATE POLICY "Club staff can delete registrations"
ON public.tournament_registrations FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournaments t
  WHERE t.id = tournament_registrations.tournament_id
  AND t.club_id IS NOT NULL
  AND is_club_staff(auth.uid(), t.club_id)
));

-- Allow club staff to delete results for their tournaments
CREATE POLICY "Club staff can delete results"
ON public.tournament_results FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournaments t
  WHERE t.id = tournament_results.tournament_id
  AND t.club_id IS NOT NULL
  AND is_club_staff(auth.uid(), t.club_id)
));
