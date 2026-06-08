
CREATE POLICY "Admins can update results"
ON public.tournament_results
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can update their tournament results"
ON public.tournament_results
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_results.tournament_id
    AND t.club_id IS NOT NULL
    AND is_club_staff(auth.uid(), t.club_id)
  )
);
