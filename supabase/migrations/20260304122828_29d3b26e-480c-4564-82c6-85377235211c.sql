
CREATE TABLE public.club_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues viewable by everyone" ON public.club_venues FOR SELECT USING (true);
CREATE POLICY "Club staff can insert venues" ON public.club_venues FOR INSERT WITH CHECK (is_club_staff(auth.uid(), club_id));
CREATE POLICY "Club staff can update venues" ON public.club_venues FOR UPDATE USING (is_club_staff(auth.uid(), club_id));
CREATE POLICY "Club staff can delete venues" ON public.club_venues FOR DELETE USING (is_club_staff(auth.uid(), club_id));
CREATE POLICY "Admins can manage venues" ON public.club_venues FOR ALL USING (has_role(auth.uid(), 'admin'));
