
-- Add external tournament fields
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS external_source text;

-- Create external player mappings table (persistent mapping for reuse)
CREATE TABLE public.external_player_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL, -- 'challonge' or 'challengermode'
  external_username text NOT NULL,
  internal_user_id text, -- can be profile user_id or child_profile id
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, external_username)
);

-- RLS
ALTER TABLE public.external_player_mappings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage mappings
CREATE POLICY "Admins can manage external_player_mappings"
  ON public.external_player_mappings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
