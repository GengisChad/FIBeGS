-- 1. Convert existing [Guest] profiles to [BOT] (only if no name collision)
UPDATE public.profiles p
SET display_name = '[BOT]' || SUBSTRING(p.display_name FROM 8)
WHERE p.display_name LIKE '[Guest]%'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.display_name = '[BOT]' || SUBSTRING(p.display_name FROM 8)
      AND p2.user_id <> p.user_id
  );

-- 2. For any remaining [Guest] (duplicates), delete their profiles + registrations
DELETE FROM public.tournament_registrations
WHERE user_id IN (
  SELECT user_id FROM public.profiles WHERE display_name LIKE '[Guest]%'
);
DELETE FROM public.profiles WHERE display_name LIKE '[Guest]%';

-- 3. Trigger: when a [Guest] registration is removed, delete the profile
--    if that user has no other registrations.
CREATE OR REPLACE FUNCTION public.cleanup_guest_profile_on_unregister()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_other_count int;
BEGIN
  SELECT display_name INTO v_display_name
  FROM public.profiles
  WHERE user_id = OLD.user_id;

  IF v_display_name IS NULL OR v_display_name NOT LIKE '[Guest]%' THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_other_count
  FROM public.tournament_registrations
  WHERE user_id = OLD.user_id;

  IF v_other_count = 0 THEN
    DELETE FROM public.profiles WHERE user_id = OLD.user_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_guest_on_unregister ON public.tournament_registrations;
CREATE TRIGGER trg_cleanup_guest_on_unregister
AFTER DELETE ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_guest_profile_on_unregister();

-- 4. Function to bulk-clean guests when a tournament ends/is deleted
CREATE OR REPLACE FUNCTION public.cleanup_tournament_guests(_tournament_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int := 0;
BEGIN
  WITH guest_users AS (
    SELECT p.user_id
    FROM public.profiles p
    JOIN public.tournament_registrations tr ON tr.user_id = p.user_id
    WHERE tr.tournament_id = _tournament_id
      AND p.display_name LIKE '[Guest]%'
  ),
  del_regs AS (
    DELETE FROM public.tournament_registrations
    WHERE user_id IN (SELECT user_id FROM guest_users)
      AND tournament_id = _tournament_id
    RETURNING user_id
  ),
  orphan AS (
    SELECT du.user_id FROM del_regs du
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tournament_registrations tr2
      WHERE tr2.user_id = du.user_id
    )
  )
  DELETE FROM public.profiles
  WHERE user_id IN (SELECT user_id FROM orphan);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;