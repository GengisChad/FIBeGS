CREATE OR REPLACE FUNCTION public.validate_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.display_name IS NOT NULL AND (char_length(NEW.display_name) < 1 OR char_length(NEW.display_name) > 60) THEN
    RAISE EXCEPTION 'Display name must be between 1 and 60 characters';
  END IF;
  IF NEW.bio IS NOT NULL AND char_length(NEW.bio) > 500 THEN
    RAISE EXCEPTION 'Bio must be at most 500 characters';
  END IF;
  IF NEW.username IS NOT NULL AND (char_length(NEW.username) < 3 OR char_length(NEW.username) > 40) THEN
    RAISE EXCEPTION 'Username must be between 3 and 40 characters';
  END IF;
  RETURN NEW;
END;
$$;