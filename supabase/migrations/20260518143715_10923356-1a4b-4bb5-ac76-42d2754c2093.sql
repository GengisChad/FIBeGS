
-- Update backfill function to match platform variants (challengermode vs challengermode_api)
CREATE OR REPLACE FUNCTION public.link_external_account_backfill(_user_id uuid, _platform text, _external_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _norm text := lower(trim(_external_username));
  _platform_like text := _platform || '%';
  _registrations_updated int := 0;
  _matches_p1 int := 0;
  _matches_p2 int := 0;
  _matches_w int := 0;
  _standings_updated int := 0;
  _ghost_user_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT internal_user_id::uuid) INTO _ghost_user_ids
  FROM public.external_player_mappings
  WHERE platform ILIKE _platform_like
    AND lower(external_username) = _norm
    AND internal_user_id IS NOT NULL
    AND internal_user_id <> _user_id::text;

  IF _ghost_user_ids IS NULL OR array_length(_ghost_user_ids, 1) = 0 THEN
    UPDATE public.external_player_mappings
    SET internal_user_id = _user_id::text
    WHERE platform ILIKE _platform_like AND lower(external_username) = _norm;
    RETURN jsonb_build_object('updated', 0, 'note', 'no ghost found, mapping refreshed');
  END IF;

  UPDATE public.tournament_registrations r SET user_id = _user_id
  FROM public.tournaments t
  WHERE r.tournament_id = t.id AND r.user_id = ANY(_ghost_user_ids)
    AND COALESCE(t.external_source, '') ILIKE '%' || _platform || '%';
  GET DIAGNOSTICS _registrations_updated = ROW_COUNT;

  UPDATE public.tournament_matches m SET player1_id = _user_id
  FROM public.tournaments t
  WHERE m.tournament_id = t.id AND m.player1_id = ANY(_ghost_user_ids)
    AND COALESCE(t.external_source, '') ILIKE '%' || _platform || '%';
  GET DIAGNOSTICS _matches_p1 = ROW_COUNT;

  UPDATE public.tournament_matches m SET player2_id = _user_id
  FROM public.tournaments t
  WHERE m.tournament_id = t.id AND m.player2_id = ANY(_ghost_user_ids)
    AND COALESCE(t.external_source, '') ILIKE '%' || _platform || '%';
  GET DIAGNOSTICS _matches_p2 = ROW_COUNT;

  UPDATE public.tournament_matches m SET winner_id = _user_id
  FROM public.tournaments t
  WHERE m.tournament_id = t.id AND m.winner_id = ANY(_ghost_user_ids)
    AND COALESCE(t.external_source, '') ILIKE '%' || _platform || '%';
  GET DIAGNOSTICS _matches_w = ROW_COUNT;

  UPDATE public.tournament_standings s SET user_id = _user_id
  FROM public.tournaments t
  WHERE s.tournament_id = t.id AND s.user_id = ANY(_ghost_user_ids)
    AND COALESCE(t.external_source, '') ILIKE '%' || _platform || '%';
  GET DIAGNOSTICS _standings_updated = ROW_COUNT;

  UPDATE public.external_player_mappings
  SET internal_user_id = _user_id::text
  WHERE platform ILIKE _platform_like AND lower(external_username) = _norm;

  RETURN jsonb_build_object(
    'registrations_updated', _registrations_updated,
    'matches_p1_updated', _matches_p1,
    'matches_p2_updated', _matches_p2,
    'matches_winner_updated', _matches_w,
    'standings_updated', _standings_updated,
    'ghost_user_ids_replaced', array_length(_ghost_user_ids, 1)
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
  _registrations_updated int := 0;
BEGIN
  UPDATE public.tournament_registrations r
  SET child_profile_id = _child_id, user_id = NULL
  FROM public.tournaments t, public.external_player_mappings m
  WHERE r.tournament_id = t.id
    AND COALESCE(t.external_source, '') ILIKE '%' || _platform || '%'
    AND m.platform ILIKE _platform_like
    AND lower(m.external_username) = _norm
    AND r.user_id::text = m.internal_user_id;
  GET DIAGNOSTICS _registrations_updated = ROW_COUNT;

  UPDATE public.external_player_mappings
  SET internal_user_id = _child_id::text
  WHERE platform ILIKE _platform_like AND lower(external_username) = _norm;

  RETURN jsonb_build_object(
    'registrations_updated', _registrations_updated,
    'standings_updated', 0
  );
END;
$function$;

-- Retroactive reconciliation for already-linked accounts
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT user_id, child_profile_id, platform, external_username
    FROM public.user_external_accounts
    WHERE external_username IS NOT NULL
  LOOP
    IF r.child_profile_id IS NOT NULL THEN
      PERFORM public.link_external_account_backfill_child(r.child_profile_id, r.platform, r.external_username);
    ELSIF r.user_id IS NOT NULL THEN
      PERFORM public.link_external_account_backfill(r.user_id, r.platform, r.external_username);
    END IF;
  END LOOP;
END $$;
