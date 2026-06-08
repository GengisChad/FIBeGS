
-- Component admin settings (rarity + type)
CREATE TABLE public.rpg_component_settings (
  component_id UUID PRIMARY KEY REFERENCES public.collection_components(id) ON DELETE CASCADE,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  bey_type TEXT NOT NULL DEFAULT 'balance' CHECK (bey_type IN ('attack','defense','stamina','balance')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rpg_component_settings TO authenticated;
GRANT ALL ON public.rpg_component_settings TO service_role;

ALTER TABLE public.rpg_component_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read component settings"
ON public.rpg_component_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert component settings"
ON public.rpg_component_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update component settings"
ON public.rpg_component_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete component settings"
ON public.rpg_component_settings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.rpg_component_settings TO authenticated;

-- Player-owned components inventory
CREATE TABLE public.rpg_owned_components (
  user_id UUID NOT NULL,
  component_id UUID NOT NULL REFERENCES public.collection_components(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 0),
  obtained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, component_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpg_owned_components TO authenticated;
GRANT ALL ON public.rpg_owned_components TO service_role;

ALTER TABLE public.rpg_owned_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own components"
ON public.rpg_owned_components FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Game decks (RPG-only, not site decks)
CREATE TABLE public.rpg_game_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Deck principale',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpg_game_decks TO authenticated;
GRANT ALL ON public.rpg_game_decks TO service_role;

ALTER TABLE public.rpg_game_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own game decks"
ON public.rpg_game_decks FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_rpg_game_decks_user ON public.rpg_game_decks(user_id);

-- Bey within a game deck
CREATE TABLE public.rpg_game_deck_beys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.rpg_game_decks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
  blade_id UUID REFERENCES public.collection_components(id) ON DELETE SET NULL,
  ratchet_id UUID REFERENCES public.collection_components(id) ON DELETE SET NULL,
  bit_id UUID REFERENCES public.collection_components(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deck_id, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpg_game_deck_beys TO authenticated;
GRANT ALL ON public.rpg_game_deck_beys TO service_role;

ALTER TABLE public.rpg_game_deck_beys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage beys in their own decks"
ON public.rpg_game_deck_beys FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.rpg_game_decks d WHERE d.id = deck_id AND d.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.rpg_game_decks d WHERE d.id = deck_id AND d.user_id = auth.uid()));

CREATE INDEX idx_rpg_game_deck_beys_deck ON public.rpg_game_deck_beys(deck_id);

-- Updated_at triggers
CREATE TRIGGER trg_rpg_component_settings_updated
BEFORE UPDATE ON public.rpg_component_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_rpg_game_decks_updated
BEFORE UPDATE ON public.rpg_game_decks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
