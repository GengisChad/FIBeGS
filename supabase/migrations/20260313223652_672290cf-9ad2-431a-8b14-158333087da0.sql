
-- Update claim trigger to also handle ghost profile merging
CREATE OR REPLACE FUNCTION public.claim_pending_tournament_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending RECORD;
  ghost RECORD;
  _region uuid;
  _claimed boolean := false;
BEGIN
  -- Only process if the new profile has a username
  IF NEW.username IS NULL OR NEW.username = '' THEN
    RETURN NEW;
  END IF;

  -- 1) Claim pending_tournament_results (legacy path)
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

  -- 2) Merge ghost profiles: find profiles with matching username that have no auth.users entry
  FOR ghost IN
    SELECT p.user_id AS ghost_user_id, p.region_id AS ghost_region_id
    FROM profiles p
    LEFT JOIN auth.users au ON au.id = p.user_id
    WHERE lower(p.username) = lower(NEW.username)
      AND p.user_id != NEW.user_id
      AND au.id IS NULL
  LOOP
    -- Transfer all tournament_results from ghost to real user
    UPDATE tournament_results
    SET user_id = NEW.user_id
    WHERE user_id = ghost.ghost_user_id;

    -- Transfer tournament_standings
    UPDATE tournament_standings
    SET user_id = NEW.user_id
    WHERE user_id = ghost.ghost_user_id;

    -- Capture region
    IF _region IS NULL AND ghost.ghost_region_id IS NOT NULL THEN
      _region := ghost.ghost_region_id;
    END IF;

    -- Delete ghost profile
    DELETE FROM profiles WHERE user_id = ghost.ghost_user_id;
    _claimed := true;
  END LOOP;

  -- Update external_player_mappings
  UPDATE external_player_mappings
  SET internal_user_id = NEW.user_id::text, updated_at = now()
  WHERE lower(external_username) = lower(NEW.username)
    AND (internal_user_id IS NULL OR internal_user_id = '');

  -- Apply region to profile if found and profile has no region
  IF _region IS NOT NULL AND NEW.region_id IS NULL THEN
    NEW.region_id := _region;
  END IF;

  -- Recalculate rankings if any results were claimed
  IF _claimed THEN
    PERFORM recalculate_all_rankings();
  END IF;

  RETURN NEW;
END;
$$;
