
ALTER TABLE public.rpg_game_deck_beys
  ADD COLUMN IF NOT EXISTS series TEXT NOT NULL DEFAULT 'BX',
  ADD COLUMN IF NOT EXISTS cx_assist_id UUID REFERENCES public.collection_components(id) ON DELETE SET NULL;

ALTER TABLE public.rpg_game_deck_beys
  DROP CONSTRAINT IF EXISTS rpg_game_deck_beys_series_check;
ALTER TABLE public.rpg_game_deck_beys
  ADD CONSTRAINT rpg_game_deck_beys_series_check
  CHECK (series IN ('BX','UX','CX','UX_INF','CX_INF'));
