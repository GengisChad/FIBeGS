
ALTER TABLE public.club_venues
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN primary_changed_at timestamptz;
