
CREATE POLICY "Profiles public read authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
