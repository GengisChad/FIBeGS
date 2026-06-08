
-- Fix search_path for validate_club_member
CREATE OR REPLACE FUNCTION public.validate_club_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND (LENGTH(NEW.phone) < 6 OR LENGTH(NEW.phone) > 20) THEN
    RAISE EXCEPTION 'Phone number must be 6-20 characters';
  END IF;
  
  IF NEW.city IS NOT NULL AND LENGTH(TRIM(NEW.city)) = 0 THEN
    RAISE EXCEPTION 'City cannot be empty';
  END IF;
  
  RETURN NEW;
END;
$$;
