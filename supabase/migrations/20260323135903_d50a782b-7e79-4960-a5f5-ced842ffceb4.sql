
-- 1. Add birth_date to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- 2. Disable the push notification cron job
SELECT cron.unschedule('batch-push-notifications');

-- 3. Update check_username_available to also check child_profiles
CREATE OR REPLACE FUNCTION public.check_username_available(_username text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_profile RECORD;
  _is_ghost boolean := false;
BEGIN
  -- Check child profiles first
  IF EXISTS (
    SELECT 1 FROM child_profiles WHERE lower(display_name) = lower(_username)
  ) THEN
    RETURN jsonb_build_object('available', false, 'is_ghost', false, 'reason', 'child_profile');
  END IF;

  SELECT p.user_id, p.username INTO _existing_profile
  FROM profiles p
  WHERE lower(p.username) = lower(_username)
  LIMIT 1;

  IF _existing_profile IS NULL THEN
    RETURN jsonb_build_object('available', true, 'is_ghost', false);
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = _existing_profile.user_id
  ) INTO _is_ghost;

  IF _is_ghost THEN
    RETURN jsonb_build_object('available', true, 'is_ghost', true);
  ELSE
    RETURN jsonb_build_object('available', false, 'is_ghost', false);
  END IF;
END;
$$;

-- 4. Create function to convert child profile to standalone account
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
  _new_user RECORD;
BEGIN
  IF _parent_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the child belongs to this parent
  SELECT * INTO _child FROM child_profiles WHERE id = _child_id AND parent_user_id = _parent_id;
  IF _child IS NULL THEN
    RETURN jsonb_build_object('error', 'child_not_found');
  END IF;

  -- Check username availability (exclude the child's own display_name)
  IF EXISTS (
    SELECT 1 FROM profiles WHERE lower(username) = lower(_username)
  ) THEN
    RETURN jsonb_build_object('error', 'username_taken');
  END IF;

  -- Check email not already used
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE email = _email
  ) THEN
    RETURN jsonb_build_object('error', 'email_taken');
  END IF;

  -- Create the new auth user
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

  -- The handle_new_user trigger will create a profile, but we need to update it
  -- Wait for trigger, then update with child's data
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

  -- Transfer tournament results
  UPDATE tournament_results SET user_id = _new_user_id WHERE user_id = _child_id;

  -- Transfer tournament standings
  UPDATE tournament_standings SET user_id = _new_user_id WHERE user_id = _child_id;

  -- Transfer tournament registrations
  UPDATE tournament_registrations SET child_profile_id = NULL, user_id = _new_user_id
  WHERE child_profile_id = _child_id;

  -- Delete the child profile
  DELETE FROM child_profiles WHERE id = _child_id;

  RETURN jsonb_build_object('success', true, 'new_user_id', _new_user_id);
END;
$$;

-- 5. Ensure all remaining pending push notifications are marked as sent
UPDATE notifications SET push_sent = true WHERE push_sent = false;

-- 6. Update ALL notification triggers to always set push_sent = true (no push at all)
CREATE OR REPLACE FUNCTION public.notify_badge_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _badge_name text;
BEGIN
  SELECT name INTO _badge_name FROM badges WHERE id = NEW.badge_id;
  INSERT INTO notifications (user_id, type, title, message, link, push_sent)
  VALUES (
    NEW.user_id, 'badge_earned', 'Nuovo badge ottenuto!',
    'Hai ottenuto il badge "' || COALESCE(_badge_name, 'Sconosciuto') || '"',
    '/profile', true
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_deck_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _deck_owner uuid;
  _deck_name text;
  _liker_name text;
BEGIN
  SELECT user_id, name INTO _deck_owner, _deck_name FROM decks WHERE id = NEW.deck_id;
  IF _deck_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _liker_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
  INSERT INTO notifications (user_id, type, title, message, link, push_sent)
  VALUES (_deck_owner, 'deck_like', 'Nuovo like al tuo deck', _liker_name || ' ha messo like a "' || _deck_name || '"', '/decks', true);
  RETURN NEW;
END;
$function$;
