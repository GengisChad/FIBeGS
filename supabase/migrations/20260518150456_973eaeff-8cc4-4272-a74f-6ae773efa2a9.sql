
-- Enhanced backfill: also discover ghost profiles by username/display_name match,
-- merge all their tournament data into the real account, and delete the ghost profile.

CREATE OR REPLACE FUNCTION public.link_external_account_backfill(_user_id uuid, _platform text, _external_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _norm text := lower(trim(_external_username));
  _platform_like text := _platform || '%';
  _ghost_ids uuid[];
  _registrations_updated int := 0;
  _matches_p1 int := 0;
  _matches_p2 int := 0;
  _matches_w int := 0;
  _standings_updated int := 0;
  _results_updated int := 0;
  _profiles_deleted int := 0;
BEGIN
  -- 1) Ghosts from external_player_mappings
  SELECT array_agg(DISTINCT id) INTO _ghost_ids
  FROM (
    SELECT internal_user_id::uuid AS id
    FROM public.external_player_mappings
    WHERE platform ILIKE _platform_like
      AND lower(external_username) = _norm
      AND internal_user_id IS NOT NULL
      AND internal_user_id <> _user_id::text
    UNION
    -- 2) Ghost profiles (no auth user) matching username/display_name
    SELECT p.user_id AS id
    FROM public.profiles p
    WHERE p.user_id <> _user_id
      AND (lower(p.username) = _norm OR lower(p.display_name) = _norm)
      AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
  ) g WHERE id IS NOT NULL;

  IF _ghost_ids IS NULL OR array_length(_ghost_ids, 1) = 0 THEN
    UPDATE public.external_player_mappings
    SET internal_user_id = _user_id::text
    WHERE platform ILIKE _platform_like AND lower(external_username) = _norm;
    RETURN jsonb_build_object('updated', 0, 'note', 'no ghost found, mapping refreshed');
  END IF;

  -- Resolve conflicts on unique constraints BEFORE update:
  -- tournament_registrations UNIQUE (tournament_id, user_id, child_profile_id)
  DELETE FROM public.tournament_registrations gr
  USING public.tournament_registrations rr
  WHERE gr.user_id = ANY(_ghost_ids)
    AND rr.user_id = _user_id
    AND gr.tournament_id = rr.tournament_id
    AND COALESCE(gr.child_profile_id::text, '') = COALESCE(rr.child_profile_id::text, '');

  -- tournament_results UNIQUE (tournament_id, user_id)
  DELETE FROM public.tournament_results gr
  USING public.tournament_results rr
  WHERE gr.user_id = ANY(_ghost_ids)
    AND rr.user_id = _user_id
    AND gr.tournament_id = rr.tournament_id;

  -- tournament_standings UNIQUE (tournament_id, user_id)
  DELETE FROM public.tournament_standings gs
  USING public.tournament_standings rs
  WHERE gs.user_id = ANY(_ghost_ids)
    AND rs.user_id = _user_id
    AND gs.tournament_id = rs.tournament_id;

  -- tournament_team_members UNIQUE (team_id, user_id)
  DELETE FROM public.tournament_team_members gm
  USING public.tournament_team_members rm
  WHERE gm.user_id = ANY(_ghost_ids)
    AND rm.user_id = _user_id
    AND gm.team_id = rm.team_id;

  -- 3) Reassign all references (no platform filter — ghosts are import-only)
  UPDATE public.tournament_registrations SET user_id = _user_id WHERE user_id = ANY(_ghost_ids);
  GET DIAGNOSTICS _registrations_updated = ROW_COUNT;

  UPDATE public.tournament_matches SET player1_id = _user_id WHERE player1_id = ANY(_ghost_ids);
  GET DIAGNOSTICS _matches_p1 = ROW_COUNT;
  UPDATE public.tournament_matches SET player2_id = _user_id WHERE player2_id = ANY(_ghost_ids);
  GET DIAGNOSTICS _matches_p2 = ROW_COUNT;
  UPDATE public.tournament_matches SET winner_id = _user_id WHERE winner_id = ANY(_ghost_ids);
  GET DIAGNOSTICS _matches_w = ROW_COUNT;

  UPDATE public.tournament_standings SET user_id = _user_id WHERE user_id = ANY(_ghost_ids);
  GET DIAGNOSTICS _standings_updated = ROW_COUNT;

  UPDATE public.tournament_results SET user_id = _user_id WHERE user_id = ANY(_ghost_ids);
  GET DIAGNOSTICS _results_updated = ROW_COUNT;

  UPDATE public.tournament_team_members SET user_id = _user_id WHERE user_id = ANY(_ghost_ids);
  UPDATE public.tournament_match_decks SET user_id = _user_id WHERE user_id = ANY(_ghost_ids);
  UPDATE public.tournament_deck_selections SET user_id = _user_id WHERE user_id = ANY(_ghost_ids);

  -- 4) Update mappings
  UPDATE public.external_player_mappings
  SET internal_user_id = _user_id::text
  WHERE internal_user_id = ANY(SELECT unnest(_ghost_ids)::text)
     OR (platform ILIKE _platform_like AND lower(external_username) = _norm);

  -- 5) Delete ghost profiles (only those without an auth user)
  DELETE FROM public.profiles p
  WHERE p.user_id = ANY(_ghost_ids)
    AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id);
  GET DIAGNOSTICS _profiles_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'registrations_updated', _registrations_updated,
    'matches_p1_updated', _matches_p1,
    'matches_p2_updated', _matches_p2,
    'matches_winner_updated', _matches_w,
    'standings_updated', _standings_updated,
    'results_updated', _results_updated,
    'ghost_profiles_deleted', _profiles_deleted,
    'ghost_user_ids_replaced', array_length(_ghost_ids, 1)
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.link_external_account_backfill_child(_child_id uuid, _platform text, _external_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _norm text := lower(trim(_external_username));
  _platform_like text := _platform || '%';
  _ghost_ids uuid[];
  _registrations_updated int := 0;
  _profiles_deleted int := 0;
BEGIN
  SELECT array_agg(DISTINCT id) INTO _ghost_ids
  FROM (
    SELECT internal_user_id::uuid AS id
    FROM public.external_player_mappings
    WHERE platform ILIKE _platform_like
      AND lower(external_username) = _norm
      AND internal_user_id IS NOT NULL
      AND internal_user_id <> _child_id::text
    UNION
    SELECT p.user_id AS id
    FROM public.profiles p
    WHERE p.user_id <> _child_id
      AND (lower(p.username) = _norm OR lower(p.display_name) = _norm)
      AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
  ) g WHERE id IS NOT NULL;

  IF _ghost_ids IS NULL OR array_length(_ghost_ids, 1) = 0 THEN
    UPDATE public.external_player_mappings
    SET internal_user_id = _child_id::text
    WHERE platform ILIKE _platform_like AND lower(external_username) = _norm;
    RETURN jsonb_build_object('updated', 0, 'note', 'no ghost found, mapping refreshed');
  END IF;

  -- Reassign registrations to the child profile
  UPDATE public.tournament_registrations
  SET child_profile_id = _child_id, user_id = NULL
  WHERE user_id = ANY(_ghost_ids);
  GET DIAGNOSTICS _registrations_updated = ROW_COUNT;

  -- Match/standings/results stay on the parent: clean up via NULL or move? For child path, only registrations are tracked.
  -- Other tables retain ghost id; remove ghost references to keep DB clean.
  UPDATE public.tournament_matches SET player1_id = NULL WHERE player1_id = ANY(_ghost_ids);
  UPDATE public.tournament_matches SET player2_id = NULL WHERE player2_id = ANY(_ghost_ids);
  UPDATE public.tournament_matches SET winner_id = NULL WHERE winner_id = ANY(_ghost_ids);
  DELETE FROM public.tournament_standings WHERE user_id = ANY(_ghost_ids);
  DELETE FROM public.tournament_results WHERE user_id = ANY(_ghost_ids);

  UPDATE public.external_player_mappings
  SET internal_user_id = _child_id::text
  WHERE internal_user_id = ANY(SELECT unnest(_ghost_ids)::text)
     OR (platform ILIKE _platform_like AND lower(external_username) = _norm);

  DELETE FROM public.profiles p
  WHERE p.user_id = ANY(_ghost_ids)
    AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id);
  GET DIAGNOSTICS _profiles_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'registrations_updated', _registrations_updated,
    'ghost_profiles_deleted', _profiles_deleted,
    'ghost_user_ids_replaced', array_length(_ghost_ids, 1)
  );
END;
$function$;


-- Retroactive reconciliation for ALL already-linked accounts using the new logic.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT user_id, child_profile_id, platform, external_username
    FROM public.user_external_accounts
    WHERE external_username IS NOT NULL
  LOOP
    BEGIN
      IF r.child_profile_id IS NOT NULL THEN
        PERFORM public.link_external_account_backfill_child(r.child_profile_id, r.platform, r.external_username);
      ELSIF r.user_id IS NOT NULL THEN
        PERFORM public.link_external_account_backfill(r.user_id, r.platform, r.external_username);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill failed for %/% (%): %', r.user_id, r.platform, r.external_username, SQLERRM;
    END;
  END LOOP;
END $$;
