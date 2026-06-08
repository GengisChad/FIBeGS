
ALTER TABLE public.rpg_game_deck_beys
  ADD COLUMN lock_chip_id UUID REFERENCES public.collection_components(id) ON DELETE SET NULL,
  ADD COLUMN ux_infinity_id UUID REFERENCES public.collection_components(id) ON DELETE SET NULL,
  ADD COLUMN cx_infinity_id UUID REFERENCES public.collection_components(id) ON DELETE SET NULL;
