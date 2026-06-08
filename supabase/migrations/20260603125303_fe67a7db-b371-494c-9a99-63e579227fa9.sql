
ALTER TABLE public.rpg_game_deck_beys
  ADD COLUMN IF NOT EXISTS ribs_id UUID REFERENCES public.collection_components(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ratchet_mode TEXT NOT NULL DEFAULT 'ratchet';

ALTER TABLE public.rpg_game_deck_beys
  DROP CONSTRAINT IF EXISTS rpg_game_deck_beys_series_check;
ALTER TABLE public.rpg_game_deck_beys
  ADD CONSTRAINT rpg_game_deck_beys_series_check
  CHECK (series IN ('BX','BX_INF','UX','CX','UX_INF','CX_INF'));

ALTER TABLE public.rpg_game_deck_beys
  DROP CONSTRAINT IF EXISTS rpg_game_deck_beys_ratchet_mode_check;
ALTER TABLE public.rpg_game_deck_beys
  ADD CONSTRAINT rpg_game_deck_beys_ratchet_mode_check
  CHECK (ratchet_mode IN ('ratchet','ribs'));
