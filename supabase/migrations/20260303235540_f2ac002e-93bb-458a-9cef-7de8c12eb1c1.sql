
CREATE POLICY "Club staff can update registrations"
ON public.tournament_registrations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_registrations.tournament_id
    AND t.club_id IS NOT NULL
    AND is_club_staff(auth.uid(), t.club_id)
  )
);
