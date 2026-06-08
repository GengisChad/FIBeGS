
CREATE OR REPLACE FUNCTION public.claim_ghost_username(_real_user_id uuid, _username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ghost_id uuid;
BEGIN
  -- Find ghost profile with matching username (case-insensitive)
  SELECT p.user_id INTO _ghost_id
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE lower(p.username) = lower(_username)
    AND p.user_id != _real_user_id
    AND au.id IS NULL
  LIMIT 1;

  IF _ghost_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_ghost');
  END IF;

  -- Transfer tournament data from ghost to real user
  UPDATE tournament_results SET user_id = _real_user_id WHERE user_id = _ghost_id;
  UPDATE tournament_standings SET user_id = _real_user_id WHERE user_id = _ghost_id;

  -- Update external player mappings
  UPDATE external_player_mappings
  SET internal_user_id = _real_user_id::text, updated_at = now()
  WHERE lower(external_username) = lower(_username)
    AND (internal_user_id IS NULL OR internal_user_id = '' OR internal_user_id = _ghost_id::text);

  -- Delete the ghost profile
  DELETE FROM profiles WHERE user_id = _ghost_id;

  RETURN jsonb_build_object('claimed', true);
END;
$$;
