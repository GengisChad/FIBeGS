
-- Fix: Change phone sync trigger from BEFORE to AFTER INSERT to avoid FK violation
-- The BEFORE INSERT trigger tried to insert into club_member_phones referencing
-- a club_members row that didn't exist yet, causing FK constraint failures.

DROP TRIGGER IF EXISTS trg_sync_club_member_phone ON public.club_members;

-- Recreate the function to work as AFTER trigger (no RETURN NEW needed for AFTER)
CREATE OR REPLACE FUNCTION upsert_club_member_phone_from_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    -- If phone was cleared on UPDATE, remove the phone record
    IF TG_OP = 'UPDATE' AND OLD.phone IS NOT NULL AND btrim(OLD.phone) != '' THEN
      DELETE FROM public.club_member_phones WHERE club_member_id = NEW.id;
    END IF;
    -- Clear phone from club_members to keep it in the separate table only
    UPDATE public.club_members SET phone = NULL WHERE id = NEW.id AND phone IS NOT NULL;
    RETURN NULL;
  END IF;

  INSERT INTO public.club_member_phones (club_member_id, club_id, user_id, phone)
  VALUES (NEW.id, NEW.club_id, NEW.user_id, NEW.phone)
  ON CONFLICT (club_member_id)
  DO UPDATE SET
    club_id = EXCLUDED.club_id,
    user_id = EXCLUDED.user_id,
    phone = EXCLUDED.phone,
    updated_at = now();

  -- Clear phone from club_members
  UPDATE public.club_members SET phone = NULL WHERE id = NEW.id;

  RETURN NULL;
END;
$$;

-- Create as AFTER trigger so the club_members row exists when we reference it
CREATE TRIGGER trg_sync_club_member_phone
  AFTER INSERT OR UPDATE OF phone ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION upsert_club_member_phone_from_members();
