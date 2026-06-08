
ALTER TABLE public.club_requests 
  ADD COLUMN address text,
  ADD COLUMN latitude numeric,
  ADD COLUMN longitude numeric;
