
-- Fix recursive trigger: the AFTER UPDATE trigger re-fires when it sets phone=NULL,
-- which then DELETES the phone record it just created.
-- Solution: use a session variable flag to prevent recursion.

CREATE OR REPLACE FUNCTION public.upsert_club_member_phone_from_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Prevent recursive calls: if we're already inside this trigger, skip
  IF current_setting('app.syncing_phone', true) = 'true' THEN
    RETURN NULL;
  END IF;

  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    -- If phone was cleared on UPDATE, remove the phone record
    IF TG_OP = 'UPDATE' AND OLD.phone IS NOT NULL AND btrim(OLD.phone) != '' THEN
      DELETE FROM public.club_member_phones WHERE club_member_id = NEW.id;
    END IF;
    RETURN NULL;
  END IF;

  -- Insert/update the phone in the separate table
  INSERT INTO public.club_member_phones (club_member_id, club_id, user_id, phone)
  VALUES (NEW.id, NEW.club_id, NEW.user_id, NEW.phone)
  ON CONFLICT (club_member_id)
  DO UPDATE SET
    club_id = EXCLUDED.club_id,
    user_id = EXCLUDED.user_id,
    phone = EXCLUDED.phone,
    updated_at = now();

  -- Set flag to prevent recursion, then clear phone from club_members
  PERFORM set_config('app.syncing_phone', 'true', true);
  UPDATE public.club_members SET phone = NULL WHERE id = NEW.id;
  PERFORM set_config('app.syncing_phone', 'false', true);

  RETURN NULL;
END;
$function$;
