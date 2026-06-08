
-- Fix RESTRICTIVE policies → PERMISSIVE for tournament_standings
DROP POLICY IF EXISTS "Admins can insert standings" ON public.tournament_standings;
DROP POLICY IF EXISTS "Club staff can insert standings" ON public.tournament_standings;
DROP POLICY IF EXISTS "Admins can update standings" ON public.tournament_standings;
DROP POLICY IF EXISTS "Club staff can update standings" ON public.tournament_standings;
DROP POLICY IF EXISTS "Admins can delete standings" ON public.tournament_standings;
DROP POLICY IF EXISTS "Club staff can delete standings" ON public.tournament_standings;
DROP POLICY IF EXISTS "Standings are viewable by everyone" ON public.tournament_standings;

CREATE POLICY "Admins can insert standings" ON public.tournament_standings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can insert standings" ON public.tournament_standings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_standings.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Admins can update standings" ON public.tournament_standings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can update standings" ON public.tournament_standings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_standings.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Admins can delete standings" ON public.tournament_standings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can delete standings" ON public.tournament_standings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_standings.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Standings are viewable by everyone" ON public.tournament_standings FOR SELECT USING (true);

-- Fix RESTRICTIVE policies → PERMISSIVE for tournament_matches
DROP POLICY IF EXISTS "Admins can insert matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Club staff can insert matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Admins can update matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Club staff can update matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Admins can delete matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Club staff can delete matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Matches are viewable by everyone" ON public.tournament_matches;

CREATE POLICY "Admins can insert matches" ON public.tournament_matches FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can insert matches" ON public.tournament_matches FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_matches.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Admins can update matches" ON public.tournament_matches FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can update matches" ON public.tournament_matches FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_matches.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Admins can delete matches" ON public.tournament_matches FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can delete matches" ON public.tournament_matches FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_matches.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Matches are viewable by everyone" ON public.tournament_matches FOR SELECT USING (true);

-- Fix RESTRICTIVE policies → PERMISSIVE for tournament_results
DROP POLICY IF EXISTS "Admins can insert results" ON public.tournament_results;
DROP POLICY IF EXISTS "Staff can insert results" ON public.tournament_results;
DROP POLICY IF EXISTS "Admins can delete results" ON public.tournament_results;
DROP POLICY IF EXISTS "Club staff can delete results" ON public.tournament_results;
DROP POLICY IF EXISTS "Results viewable by everyone" ON public.tournament_results;

CREATE POLICY "Admins can insert results" ON public.tournament_results FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can insert results" ON public.tournament_results FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_results.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Admins can delete results" ON public.tournament_results FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can delete results" ON public.tournament_results FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_results.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Results viewable by everyone" ON public.tournament_results FOR SELECT USING (true);

-- Fix RESTRICTIVE policies → PERMISSIVE for tournament_registrations
DROP POLICY IF EXISTS "Admins can insert registrations" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Club staff can insert registrations" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Admins can delete any registration" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Club staff can delete registrations" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Users can register themselves" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Users can delete their own registration" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Users can update their own registration" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Registration counts are viewable by everyone" ON public.tournament_registrations;

CREATE POLICY "Admins can insert registrations" ON public.tournament_registrations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can insert registrations" ON public.tournament_registrations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_registrations.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Users can register themselves" ON public.tournament_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can delete any registration" ON public.tournament_registrations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can delete registrations" ON public.tournament_registrations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_registrations.tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
CREATE POLICY "Users can delete their own registration" ON public.tournament_registrations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own registration" ON public.tournament_registrations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Registration counts are viewable by everyone" ON public.tournament_registrations FOR SELECT USING (true);

-- Fix RESTRICTIVE policies → PERMISSIVE for tournaments
DROP POLICY IF EXISTS "Admins can insert tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Club staff can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can update any tournament" ON public.tournaments;
DROP POLICY IF EXISTS "Club staff can update their tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can delete any tournament" ON public.tournaments;
DROP POLICY IF EXISTS "Club staff can delete their tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON public.tournaments;

CREATE POLICY "Admins can insert tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can create tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (club_id IS NOT NULL AND is_club_staff(auth.uid(), club_id));
CREATE POLICY "Admins can update any tournament" ON public.tournaments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can update their tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (club_id IS NOT NULL AND is_club_staff(auth.uid(), club_id));
CREATE POLICY "Admins can delete any tournament" ON public.tournaments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can delete their tournaments" ON public.tournaments FOR DELETE TO authenticated USING (club_id IS NOT NULL AND is_club_staff(auth.uid(), club_id));
CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments FOR SELECT USING (true);
