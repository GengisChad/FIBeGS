-- Remove existing duplicate adult registrations (keep earliest)
DELETE FROM public.tournament_registrations a
USING public.tournament_registrations b
WHERE a.child_profile_id IS NULL
  AND b.child_profile_id IS NULL
  AND a.tournament_id = b.tournament_id
  AND a.user_id = b.user_id
  AND a.registered_at > b.registered_at;

-- Partial unique index to prevent duplicate adult registrations
-- (the existing UNIQUE (tournament_id, user_id, child_profile_id) doesn't apply when child_profile_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS tournament_registrations_adult_unique
  ON public.tournament_registrations (tournament_id, user_id)
  WHERE child_profile_id IS NULL;