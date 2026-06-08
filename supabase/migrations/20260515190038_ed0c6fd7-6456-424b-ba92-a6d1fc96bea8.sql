
-- 1. Schema changes
ALTER TABLE public.user_external_accounts
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS child_profile_id uuid REFERENCES public.child_profiles(id) ON DELETE CASCADE;

-- Drop old unique to recreate as partial uniques (allow multi-children sharing same auth user_id NULL)
ALTER TABLE public.user_external_accounts
  DROP CONSTRAINT IF EXISTS user_external_accounts_user_id_platform_key;

CREATE UNIQUE INDEX IF NOT EXISTS uea_user_platform_unique
  ON public.user_external_accounts(user_id, platform) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uea_child_platform_unique
  ON public.user_external_accounts(child_profile_id, platform) WHERE child_profile_id IS NOT NULL;

ALTER TABLE public.user_external_accounts
  DROP CONSTRAINT IF EXISTS uea_owner_xor;
ALTER TABLE public.user_external_accounts
  ADD CONSTRAINT uea_owner_xor CHECK (
    (user_id IS NOT NULL AND child_profile_id IS NULL)
    OR (user_id IS NULL AND child_profile_id IS NOT NULL)
  );

ALTER TABLE public.oauth_pkce_states
  ADD COLUMN IF NOT EXISTS child_profile_id uuid REFERENCES public.child_profiles(id) ON DELETE CASCADE;

-- 2. RLS for parents managing children's external accounts
DROP POLICY IF EXISTS "Parents manage child external accounts" ON public.user_external_accounts;
CREATE POLICY "Parents manage child external accounts"
ON public.user_external_accounts
FOR ALL
TO authenticated
USING (
  child_profile_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.child_profiles c
    WHERE c.id = user_external_accounts.child_profile_id AND c.parent_user_id = auth.uid()
  )
)
WITH CHECK (
  child_profile_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.child_profiles c
    WHERE c.id = user_external_accounts.child_profile_id AND c.parent_user_id = auth.uid()
  )
);

-- 3. Update convert_child_to_account to also transfer external account links
CREATE OR REPLACE FUNCTION public.convert_child_to_account(
  _child_id uuid,
  _email text,
  _username text,
  _password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_id uuid := auth.uid();
  _child RECORD;
  _new_user_id uuid;
BEGIN
  IF _parent_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _child FROM child_profiles WHERE id = _child_id AND parent_user_id = _parent_id;
  IF _child IS NULL THEN
    RETURN jsonb_build_object('error', 'child_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE lower(username) = lower(_username)) THEN
    RETURN jsonb_build_object('error', 'username_taken');
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = _email) THEN
    RETURN jsonb_build_object('error', 'email_taken');
  END IF;

  _new_user_id := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token
  ) VALUES (
    _new_user_id,
    '00000000-0000-0000-0000-000000000000',
    _email,
    crypt(_password, gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', _username, 'display_name', _child.display_name, 'city', _child.city, 'region_id', _child.region_id),
    now(),
    now(),
    '',
    ''
  );

  UPDATE profiles SET
    display_name = _child.display_name,
    username = _username,
    city = _child.city,
    region_id = _child.region_id,
    avatar_url = _child.avatar_url,
    points = _child.points,
    wins = _child.wins,
    birth_date = NULL
  WHERE user_id = _new_user_id;

  UPDATE tournament_results SET user_id = _new_user_id WHERE user_id = _child_id;
  UPDATE tournament_standings SET user_id = _new_user_id WHERE user_id = _child_id;
  UPDATE tournament_registrations SET child_profile_id = NULL, user_id = _new_user_id
  WHERE child_profile_id = _child_id;

  -- Transfer linked external accounts (Challonge/Challengermode)
  UPDATE public.user_external_accounts
  SET user_id = _new_user_id, child_profile_id = NULL
  WHERE child_profile_id = _child_id;

  DELETE FROM child_profiles WHERE id = _child_id;

  RETURN jsonb_build_object('success', true, 'new_user_id', _new_user_id);
END;
$$;

-- 4. Backfill helper for child profiles (mirrors link_external_account_backfill but for child_profile_id)
CREATE OR REPLACE FUNCTION public.link_external_account_backfill_child(
  _child_id uuid,
  _platform text,
  _external_username text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _norm text := lower(trim(_external_username));
  _registrations_updated int := 0;
  _standings_updated int := 0;
BEGIN
  -- Reassign tournament_registrations whose ghost user has same lowercase external username
  -- to the child profile (we use child_profile_id and clear user_id).
  UPDATE public.tournament_registrations r
  SET child_profile_id = _child_id, user_id = NULL
  FROM public.tournaments t, public.external_player_mappings m
  WHERE r.tournament_id = t.id
    AND COALESCE(t.external_source, '') ILIKE '%' || _platform || '%'
    AND m.platform = _platform
    AND lower(m.external_username) = _norm
    AND r.user_id::text = m.internal_user_id;
  GET DIAGNOSTICS _registrations_updated = ROW_COUNT;

  UPDATE public.external_player_mappings
  SET internal_user_id = _child_id::text
  WHERE platform = _platform AND lower(external_username) = _norm;

  RETURN jsonb_build_object(
    'registrations_updated', _registrations_updated,
    'standings_updated', _standings_updated
  );
END;
$$;
