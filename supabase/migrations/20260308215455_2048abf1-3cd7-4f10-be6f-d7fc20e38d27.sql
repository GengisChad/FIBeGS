
-- Fix: Make the view SECURITY INVOKER (default safe behavior)
-- This ensures RLS policies of the querying user are applied
DROP VIEW IF EXISTS public.club_members_public;

CREATE VIEW public.club_members_public
WITH (security_invoker = true) AS
SELECT id, club_id, user_id, role, joined_at, city, last_tournament_at
FROM public.club_members;
