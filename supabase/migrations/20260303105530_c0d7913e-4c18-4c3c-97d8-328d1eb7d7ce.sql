
-- Add city, phone, and activity tracking to club_members
ALTER TABLE public.club_members
  ADD COLUMN city text,
  ADD COLUMN phone text,
  ADD COLUMN last_tournament_at timestamptz DEFAULT NULL;
