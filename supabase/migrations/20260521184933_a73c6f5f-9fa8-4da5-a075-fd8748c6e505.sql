
-- =========== user_passkeys ===========
CREATE TABLE public.user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] DEFAULT '{}',
  device_name text,
  device_os text,
  device_fingerprint text,
  aaguid text,
  backup_eligible boolean DEFAULT false,
  backup_state boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX idx_user_passkeys_user ON public.user_passkeys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_passkeys_fingerprint ON public.user_passkeys(device_fingerprint) WHERE revoked_at IS NULL;

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own passkeys"
ON public.user_passkeys FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users revoke own passkeys"
ON public.user_passkeys FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all passkeys"
ON public.user_passkeys FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage all passkeys"
ON public.user_passkeys FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========== device_fingerprints ===========
CREATE TABLE public.device_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_hash text NOT NULL UNIQUE,
  first_user_id uuid,
  seen_user_ids uuid[] NOT NULL DEFAULT '{}',
  signup_attempts int NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  platform text
);
CREATE INDEX idx_device_fingerprints_first_user ON public.device_fingerprints(first_user_id);

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view fingerprints"
ON public.device_fingerprints FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage fingerprints"
ON public.device_fingerprints FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========== passkey_challenges ===========
CREATE TABLE public.passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge text NOT NULL,
  user_id uuid,
  type text NOT NULL CHECK (type IN ('register','authenticate')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_passkey_challenges_challenge ON public.passkey_challenges(challenge);
CREATE INDEX idx_passkey_challenges_expires ON public.passkey_challenges(expires_at);

ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;
-- No public policies: only service role accesses this table.

-- =========== device_fingerprint_whitelist ===========
CREATE TABLE public.device_fingerprint_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_hash text NOT NULL,
  user_id uuid NOT NULL,
  reason text,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fingerprint_hash, user_id)
);

ALTER TABLE public.device_fingerprint_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whitelist"
ON public.device_fingerprint_whitelist FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========== helper functions ===========
CREATE OR REPLACE FUNCTION public.user_has_active_passkey(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_passkeys
    WHERE user_id = _user_id AND revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_passkey_challenges()
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.passkey_challenges WHERE expires_at < now();
$$;
