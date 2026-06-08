
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _username text;
  _ghost_id uuid;
BEGIN
  _username := new.raw_user_meta_data ->> 'username';

  -- Check if a ghost profile exists with the same username
  IF _username IS NOT NULL AND _username != '' THEN
    SELECT p.user_id INTO _ghost_id
    FROM profiles p
    LEFT JOIN auth.users au ON au.id = p.user_id
    WHERE lower(p.username) = lower(_username)
      AND au.id IS NULL
    LIMIT 1;

    IF _ghost_id IS NOT NULL THEN
      -- Transfer all tournament data from ghost to real user
      UPDATE tournament_results SET user_id = new.id WHERE user_id = _ghost_id;
      UPDATE tournament_standings SET user_id = new.id WHERE user_id = _ghost_id;
      
      -- Update external player mappings
      UPDATE external_player_mappings
      SET internal_user_id = new.id::text, updated_at = now()
      WHERE lower(external_username) = lower(_username)
        AND (internal_user_id IS NULL OR internal_user_id = '' OR internal_user_id = _ghost_id::text);

      -- Delete the ghost profile (the new one will be created below)
      DELETE FROM profiles WHERE user_id = _ghost_id;
    END IF;
  END IF;

  -- Create the real profile
  INSERT INTO public.profiles (user_id, display_name, username, region_id, city)
  VALUES (
    new.id,
    COALESCE(_username, new.raw_user_meta_data ->> 'display_name'),
    _username,
    CASE WHEN new.raw_user_meta_data ->> 'region_id' IS NOT NULL 
         THEN (new.raw_user_meta_data ->> 'region_id')::uuid 
         ELSE NULL END,
    new.raw_user_meta_data ->> 'city'
  );
  RETURN new;
END;
$$;
