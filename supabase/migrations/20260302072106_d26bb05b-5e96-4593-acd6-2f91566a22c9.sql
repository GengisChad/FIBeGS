
-- Allow admins to insert profiles (for test users)
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow club staff to insert registrations for their tournaments
CREATE POLICY "Club staff can insert registrations"
ON public.tournament_registrations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_registrations.tournament_id
    AND t.club_id IS NOT NULL
    AND is_club_staff(auth.uid(), t.club_id)
  )
);

-- Allow admins to insert registrations
CREATE POLICY "Admins can insert registrations"
ON public.tournament_registrations
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
