
-- Admin function to merge two user accounts
CREATE OR REPLACE FUNCTION public.admin_merge_users(
  _keep_user_id uuid,
  _merge_user_id uuid,
  _keep_display_name boolean DEFAULT true,
  _keep_username boolean DEFAULT true,
  _keep_avatar boolean DEFAULT true,
  _keep_city boolean DEFAULT true,
  _keep_region boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _keep_profile RECORD;
  _merge_profile RECORD;
  _updated_tables text[] := '{}';
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  IF _keep_user_id = _merge_user_id THEN
    RAISE EXCEPTION 'Cannot merge a user with itself';
  END IF;

  SELECT * INTO _keep_profile FROM profiles WHERE user_id = _keep_user_id;
  SELECT * INTO _merge_profile FROM profiles WHERE user_id = _merge_user_id;

  IF _keep_profile IS NULL THEN RAISE EXCEPTION 'Keep user profile not found'; END IF;
  IF _merge_profile IS NULL THEN RAISE EXCEPTION 'Merge user profile not found'; END IF;

  -- Transfer tournament results
  UPDATE tournament_results SET user_id = _keep_user_id WHERE user_id = _merge_user_id
    AND NOT EXISTS (SELECT 1 FROM tournament_results tr2 WHERE tr2.user_id = _keep_user_id AND tr2.tournament_id = tournament_results.tournament_id);
  DELETE FROM tournament_results WHERE user_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'tournament_results');

  -- Transfer tournament standings
  UPDATE tournament_standings SET user_id = _keep_user_id WHERE user_id = _merge_user_id
    AND NOT EXISTS (SELECT 1 FROM tournament_standings ts2 WHERE ts2.user_id = _keep_user_id AND ts2.tournament_id = tournament_standings.tournament_id);
  DELETE FROM tournament_standings WHERE user_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'tournament_standings');

  -- Transfer tournament registrations
  UPDATE tournament_registrations SET user_id = _keep_user_id WHERE user_id = _merge_user_id
    AND NOT EXISTS (SELECT 1 FROM tournament_registrations tr2 WHERE tr2.user_id = _keep_user_id AND tr2.tournament_id = tournament_registrations.tournament_id);
  DELETE FROM tournament_registrations WHERE user_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'tournament_registrations');

  -- Transfer matches
  UPDATE tournament_matches SET player1_id = _keep_user_id WHERE player1_id = _merge_user_id;
  UPDATE tournament_matches SET player2_id = _keep_user_id WHERE player2_id = _merge_user_id;
  UPDATE tournament_matches SET winner_id = _keep_user_id WHERE winner_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'tournament_matches');

  -- Transfer club memberships (keep existing if conflict)
  UPDATE club_members SET user_id = _keep_user_id WHERE user_id = _merge_user_id
    AND NOT EXISTS (SELECT 1 FROM club_members cm2 WHERE cm2.user_id = _keep_user_id AND cm2.club_id = club_members.club_id);
  DELETE FROM club_members WHERE user_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'club_members');

  -- Transfer forum posts & replies
  UPDATE forum_posts SET user_id = _keep_user_id WHERE user_id = _merge_user_id;
  UPDATE forum_replies SET user_id = _keep_user_id WHERE user_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'forum_posts');

  -- Transfer market listings
  UPDATE market_listings SET user_id = _keep_user_id WHERE user_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'market_listings');

  -- Transfer badges
  INSERT INTO user_badges (user_id, badge_id, assigned_by)
  SELECT _keep_user_id, badge_id, assigned_by FROM user_badges WHERE user_id = _merge_user_id
  ON CONFLICT DO NOTHING;
  DELETE FROM user_badges WHERE user_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'user_badges');

  -- Transfer user_roles
  INSERT INTO user_roles (user_id, role)
  SELECT _keep_user_id, role FROM user_roles WHERE user_id = _merge_user_id
  ON CONFLICT DO NOTHING;
  DELETE FROM user_roles WHERE user_id = _merge_user_id;

  -- Transfer notifications
  UPDATE notifications SET user_id = _keep_user_id WHERE user_id = _merge_user_id;
  _updated_tables := array_append(_updated_tables, 'notifications');

  -- Transfer collection data (merge items)
  UPDATE user_collection_data SET user_id = _keep_user_id WHERE user_id = _merge_user_id
    AND NOT EXISTS (SELECT 1 FROM user_collection_data ucd2 WHERE ucd2.user_id = _keep_user_id);
  DELETE FROM user_collection_data WHERE user_id = _merge_user_id;

  -- Transfer decks
  UPDATE decks SET user_id = _keep_user_id WHERE user_id = _merge_user_id;

  -- Transfer feedback
  UPDATE feedback SET user_id = _keep_user_id WHERE user_id = _merge_user_id;

  -- Transfer external mappings
  UPDATE external_player_mappings SET internal_user_id = _keep_user_id::text WHERE internal_user_id = _merge_user_id::text;

  -- Update keep profile with selected fields from merge profile
  UPDATE profiles SET
    display_name = CASE WHEN NOT _keep_display_name AND _merge_profile.display_name IS NOT NULL THEN _merge_profile.display_name ELSE profiles.display_name END,
    username = CASE WHEN NOT _keep_username AND _merge_profile.username IS NOT NULL THEN _merge_profile.username ELSE profiles.username END,
    avatar_url = CASE WHEN NOT _keep_avatar AND _merge_profile.avatar_url IS NOT NULL THEN _merge_profile.avatar_url ELSE profiles.avatar_url END,
    city = CASE WHEN NOT _keep_city AND _merge_profile.city IS NOT NULL THEN _merge_profile.city ELSE profiles.city END,
    region_id = CASE WHEN NOT _keep_region AND _merge_profile.region_id IS NOT NULL THEN _merge_profile.region_id ELSE profiles.region_id END,
    updated_at = now()
  WHERE user_id = _keep_user_id;

  -- Delete the merge profile
  DELETE FROM profiles WHERE user_id = _merge_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'kept_user_id', _keep_user_id,
    'merged_user_id', _merge_user_id,
    'updated_tables', to_jsonb(_updated_tables)
  );
END;
$$;

-- Admin function to replace a player in a tournament
CREATE OR REPLACE FUNCTION public.admin_replace_tournament_player(
  _tournament_id uuid,
  _old_user_id uuid,
  _new_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Check new user doesn't already exist in tournament
  IF EXISTS (SELECT 1 FROM tournament_registrations WHERE tournament_id = _tournament_id AND user_id = _new_user_id) THEN
    RAISE EXCEPTION 'New player is already registered in this tournament';
  END IF;

  -- Replace in registrations
  UPDATE tournament_registrations SET user_id = _new_user_id WHERE tournament_id = _tournament_id AND user_id = _old_user_id;

  -- Replace in standings
  UPDATE tournament_standings SET user_id = _new_user_id WHERE tournament_id = _tournament_id AND user_id = _old_user_id;

  -- Replace in matches
  UPDATE tournament_matches SET player1_id = _new_user_id WHERE tournament_id = _tournament_id AND player1_id = _old_user_id;
  UPDATE tournament_matches SET player2_id = _new_user_id WHERE tournament_id = _tournament_id AND player2_id = _old_user_id;
  UPDATE tournament_matches SET winner_id = _new_user_id WHERE tournament_id = _tournament_id AND winner_id = _old_user_id;

  -- Replace in results
  UPDATE tournament_results SET user_id = _new_user_id WHERE tournament_id = _tournament_id AND user_id = _old_user_id;

  -- Replace in team members if applicable
  UPDATE tournament_team_members SET user_id = _new_user_id
  WHERE user_id = _old_user_id
    AND team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = _tournament_id);

  RETURN jsonb_build_object('success', true, 'replaced', _old_user_id, 'with', _new_user_id);
END;
$$;

-- Admin function to manually register a player
CREATE OR REPLACE FUNCTION public.admin_register_player(
  _tournament_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  IF EXISTS (SELECT 1 FROM tournament_registrations WHERE tournament_id = _tournament_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Player is already registered';
  END IF;

  INSERT INTO tournament_registrations (tournament_id, user_id, status) VALUES (_tournament_id, _user_id, 'confirmed');

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'tournament_id', _tournament_id);
END;
$$;

-- Admin function to swap players between matches
CREATE OR REPLACE FUNCTION public.admin_swap_match_players(
  _tournament_id uuid,
  _match1_id uuid,
  _player1_id uuid,
  _match2_id uuid,
  _player2_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _m1 RECORD;
  _m2 RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT * INTO _m1 FROM tournament_matches WHERE id = _match1_id AND tournament_id = _tournament_id;
  SELECT * INTO _m2 FROM tournament_matches WHERE id = _match2_id AND tournament_id = _tournament_id;

  IF _m1 IS NULL OR _m2 IS NULL THEN
    RAISE EXCEPTION 'One or both matches not found';
  END IF;

  -- Swap player1 in match1 with player in match2
  IF _m1.player1_id = _player1_id THEN
    UPDATE tournament_matches SET player1_id = _player2_id WHERE id = _match1_id;
  ELSIF _m1.player2_id = _player1_id THEN
    UPDATE tournament_matches SET player2_id = _player2_id WHERE id = _match1_id;
  ELSE
    RAISE EXCEPTION 'Player1 not found in match1';
  END IF;

  IF _m2.player1_id = _player2_id THEN
    UPDATE tournament_matches SET player1_id = _player1_id WHERE id = _match2_id;
  ELSIF _m2.player2_id = _player2_id THEN
    UPDATE tournament_matches SET player2_id = _player1_id WHERE id = _match2_id;
  ELSE
    RAISE EXCEPTION 'Player2 not found in match2';
  END IF;

  RETURN jsonb_build_object('success', true, 'swapped', true);
END;
$$;

-- Admin function to resync a tournament with rankings
CREATE OR REPLACE FUNCTION public.admin_resync_tournament(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _t RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT * INTO _t FROM tournaments WHERE id = _tournament_id;
  IF _t IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;

  -- Recalculate standings
  PERFORM recalc_tournament_standings(_tournament_id);

  -- Re-finalize points
  PERFORM finalize_tournament_points(_tournament_id);

  RETURN jsonb_build_object('success', true, 'tournament_id', _tournament_id, 'title', _t.title);
END;
$$;

-- Admin function to update profile fields
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  _user_id uuid,
  _username text DEFAULT NULL,
  _display_name text DEFAULT NULL,
  _city text DEFAULT NULL,
  _region_id uuid DEFAULT NULL,
  _bio text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE profiles SET
    username = COALESCE(_username, username),
    display_name = COALESCE(_display_name, display_name),
    city = COALESCE(_city, city),
    region_id = COALESCE(_region_id, region_id),
    bio = COALESCE(_bio, bio),
    updated_at = now()
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('success', true, 'user_id', _user_id);
END;
$$;
