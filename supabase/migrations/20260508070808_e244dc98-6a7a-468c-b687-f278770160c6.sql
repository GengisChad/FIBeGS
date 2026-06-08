-- PKCE / state storage for OAuth flows (used by link-external-account)
CREATE TABLE IF NOT EXISTS public.oauth_pkce_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  code_verifier TEXT,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes')
);

ALTER TABLE public.oauth_pkce_states ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no public policies needed; SR bypasses RLS)
CREATE POLICY "no_public_access_oauth_pkce"
  ON public.oauth_pkce_states FOR ALL
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_oauth_pkce_expires ON public.oauth_pkce_states(expires_at);

-- Admin: set both players of a match (emergency editor)
CREATE OR REPLACE FUNCTION public.admin_set_match_players(
  _match_id uuid,
  _player1_id uuid,
  _player2_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  UPDATE public.tournament_matches
     SET player1_id = _player1_id,
         player2_id = _player2_id,
         winner_id = NULL,
         player1_score = NULL,
         player2_score = NULL,
         status = 'pending',
         updated_at = now()
   WHERE id = _match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_match_players(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_match_players(uuid, uuid, uuid) TO authenticated;