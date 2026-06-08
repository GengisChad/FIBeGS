
CREATE TABLE IF NOT EXISTS public.user_external_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('challonge','challengermode')),
  external_user_id text,
  external_username text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform),
  UNIQUE (platform, external_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_external_accounts_username_unique
  ON public.user_external_accounts (platform, lower(external_username));

ALTER TABLE public.user_external_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external accounts public username read"
  ON public.user_external_accounts FOR SELECT USING (true);

CREATE POLICY "users manage own external accounts"
  ON public.user_external_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_external_accounts_user_idx ON public.user_external_accounts(user_id);

CREATE TRIGGER update_user_external_accounts_updated_at
  BEFORE UPDATE ON public.user_external_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.link_external_account_backfill(
  _user_id uuid, _platform text, _external_username text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _norm text := lower(trim(_external_username));
  _registrations_updated int := 0;
  _matches_p1 int := 0;
  _matches_p2 int := 0;
  _matches_w int := 0;
  _standings_updated int := 0;
  _ghost_user_ids uuid[];
BEGIN
  SELECT array_agg(internal_user_id::uuid) INTO _ghost_user_ids
  FROM public.external_player_mappings
  WHERE platform = _platform
    AND lower(external_username) = _norm
    AND internal_user_id IS NOT NULL
    AND internal_user_id <> _user_id::text;

  IF _ghost_user_ids IS NULL OR array_length(_ghost_user_ids, 1) = 0 THEN
    UPDATE public.external_player_mappings
    SET internal_user_id = _user_id::text
    WHERE platform = _platform AND lower(external_username) = _norm;
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
  WHERE platform = _platform AND lower(external_username) = _norm;

  RETURN jsonb_build_object(
    'registrations_updated', _registrations_updated,
    'matches_p1_updated', _matches_p1,
    'matches_p2_updated', _matches_p2,
    'matches_winner_updated', _matches_w,
    'standings_updated', _standings_updated,
    'ghost_user_ids_replaced', array_length(_ghost_user_ids, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_external_account_backfill TO authenticated;
