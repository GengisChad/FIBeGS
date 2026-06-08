-- RPG Roguelike BETA tables

CREATE TABLE public.rpg_profiles (
  user_id UUID PRIMARY KEY,
  avatar_key TEXT NOT NULL DEFAULT 'hero_default',
  currency INTEGER NOT NULL DEFAULT 0,
  gacha_points INTEGER NOT NULL DEFAULT 0,
  unlocked_level INTEGER NOT NULL DEFAULT 1,
  selected_deck JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpg_profiles TO authenticated;
GRANT ALL ON public.rpg_profiles TO service_role;

ALTER TABLE public.rpg_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpg_profiles owner read" ON public.rpg_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "rpg_profiles owner insert" ON public.rpg_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rpg_profiles owner update" ON public.rpg_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rpg_profiles owner delete" ON public.rpg_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.rpg_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_key TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpg_inventory TO authenticated;
GRANT ALL ON public.rpg_inventory TO service_role;

ALTER TABLE public.rpg_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpg_inventory owner all" ON public.rpg_inventory
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.rpg_runs (
  user_id UUID PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpg_runs TO authenticated;
GRANT ALL ON public.rpg_runs TO service_role;

ALTER TABLE public.rpg_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpg_runs owner all" ON public.rpg_runs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER rpg_profiles_updated_at
  BEFORE UPDATE ON public.rpg_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();