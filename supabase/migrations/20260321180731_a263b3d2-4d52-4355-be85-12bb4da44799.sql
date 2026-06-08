
-- Create a function to check username availability (considering ghost profiles)
CREATE OR REPLACE FUNCTION public.check_username_available(_username text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing_profile RECORD;
  _is_ghost boolean := false;
BEGIN
  SELECT p.user_id, p.username INTO _existing_profile
  FROM profiles p
  WHERE lower(p.username) = lower(_username)
  LIMIT 1;

  IF _existing_profile IS NULL THEN
    RETURN jsonb_build_object('available', true, 'is_ghost', false);
  END IF;

  -- Check if it's a ghost (no auth.users entry)
  SELECT NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = _existing_profile.user_id
  ) INTO _is_ghost;

  IF _is_ghost THEN
    -- Ghost profile: username is available (will be merged on signup)
    RETURN jsonb_build_object('available', true, 'is_ghost', true);
  ELSE
    -- Real user: username is taken
    RETURN jsonb_build_object('available', false, 'is_ghost', false);
  END IF;
END;
$$;

-- Also clear primary_changed_at for venues that were auto-set as primary on first creation
-- (where it's the only venue in the club)
UPDATE club_venues cv SET primary_changed_at = NULL
WHERE cv.is_primary = true
AND cv.primary_changed_at IS NOT NULL
AND (SELECT COUNT(*) FROM club_venues cv2 WHERE cv2.club_id = cv.club_id) = 1;
