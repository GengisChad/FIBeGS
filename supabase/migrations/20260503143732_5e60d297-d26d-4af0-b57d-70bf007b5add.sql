-- Add shop owner reference to venues
ALTER TABLE public.club_venues 
  ADD COLUMN IF NOT EXISTS shop_owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_club_venues_shop_owner ON public.club_venues(shop_owner_user_id) WHERE shop_owner_user_id IS NOT NULL;

-- Helper: check if current user is the assigned shop owner for a venue
CREATE OR REPLACE FUNCTION public.is_venue_shop_owner(_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_venues
    WHERE id = _venue_id AND shop_owner_user_id = auth.uid()
  );
$$;

-- Allow shop owner to UPDATE only the shop fields of their assigned venue
DROP POLICY IF EXISTS "Shop owner can update own venue shop fields" ON public.club_venues;
CREATE POLICY "Shop owner can update own venue shop fields"
ON public.club_venues
FOR UPDATE
TO authenticated
USING (shop_owner_user_id = auth.uid())
WITH CHECK (shop_owner_user_id = auth.uid());

-- Allow shop owner to manage free play schedules of their venue
DROP POLICY IF EXISTS "Shop owner manages own venue schedules" ON public.club_free_play_schedules;
CREATE POLICY "Shop owner manages own venue schedules"
ON public.club_free_play_schedules
FOR ALL
TO authenticated
USING (public.is_venue_shop_owner(venue_id))
WITH CHECK (public.is_venue_shop_owner(venue_id));

DROP POLICY IF EXISTS "Shop owner manages own venue exceptions" ON public.club_free_play_exceptions;
CREATE POLICY "Shop owner manages own venue exceptions"
ON public.club_free_play_exceptions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_free_play_schedules s
    WHERE s.id = schedule_id AND public.is_venue_shop_owner(s.venue_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_free_play_schedules s
    WHERE s.id = schedule_id AND public.is_venue_shop_owner(s.venue_id)
  )
);