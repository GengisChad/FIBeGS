-- 1) REMOVE DUPLICATE TRIGGER on market_likes (notify_market_like fires TWICE!)
DROP TRIGGER IF EXISTS on_market_like_insert ON public.market_likes;

-- 2) REMOVE DUPLICATE TRIGGER on profiles (update_updated_at fires TWICE!)
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

-- 3) REMOVE DUPLICATE TRIGGER on market_listings (update_updated_at fires TWICE!)
DROP TRIGGER IF EXISTS on_market_listing_updated ON public.market_listings;

-- 4) CRITICAL FIX: claim_pending_tournament_results fires on EVERY profile UPDATE
-- (including heartbeats!) doing expensive scans. Restrict to INSERT or username change only.
DROP TRIGGER IF EXISTS trg_claim_pending_results ON public.profiles;

CREATE OR REPLACE FUNCTION public.claim_pending_tournament_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pending RECORD;
  ghost RECORD;
  _region uuid;
  _claimed boolean := false;
BEGIN
  -- Only process on INSERT or when username actually changed
  IF TG_OP = 'UPDATE' AND (OLD.username IS NOT DISTINCT FROM NEW.username) THEN
    RETURN NEW;
  END IF;

  IF NEW.username IS NULL OR NEW.username = '' THEN
    RETURN NEW;
  END IF;

  FOR pending IN
    SELECT * FROM pending_tournament_results
    WHERE lower(external_username) = lower(NEW.username)
  LOOP
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    VALUES (pending.tournament_id, NEW.user_id, pending.placement, pending.participants_count, pending.base_points, pending.scaled_points)
    ON CONFLICT DO NOTHING;
    IF _region IS NULL AND pending.region_id IS NOT NULL THEN
      _region := pending.region_id;
    END IF;
    DELETE FROM pending_tournament_results WHERE id = pending.id;
    _claimed := true;
  END LOOP;

  FOR ghost IN
    SELECT p.user_id AS ghost_user_id, p.region_id AS ghost_region_id
    FROM profiles p
    LEFT JOIN auth.users au ON au.id = p.user_id
    WHERE lower(p.username) = lower(NEW.username)
      AND p.user_id != NEW.user_id
      AND au.id IS NULL
  LOOP
    UPDATE tournament_results SET user_id = NEW.user_id WHERE user_id = ghost.ghost_user_id;
    UPDATE tournament_standings SET user_id = NEW.user_id WHERE user_id = ghost.ghost_user_id;
    IF _region IS NULL AND ghost.ghost_region_id IS NOT NULL THEN
      _region := ghost.ghost_region_id;
    END IF;
    DELETE FROM profiles WHERE user_id = ghost.ghost_user_id;
    _claimed := true;
  END LOOP;

  UPDATE external_player_mappings
  SET internal_user_id = NEW.user_id::text, updated_at = now()
  WHERE lower(external_username) = lower(NEW.username)
    AND (internal_user_id IS NULL OR internal_user_id = '');

  IF _region IS NOT NULL AND NEW.region_id IS NULL THEN
    NEW.region_id := _region;
  END IF;

  IF _claimed THEN
    PERFORM recalculate_all_rankings();
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_claim_pending_results
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.claim_pending_tournament_results();