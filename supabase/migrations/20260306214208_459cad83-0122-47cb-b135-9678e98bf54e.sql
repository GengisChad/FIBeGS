-- Fix cascade delete for tournament_deck_selections when tournament is deleted
ALTER TABLE public.tournament_deck_selections 
  DROP CONSTRAINT IF EXISTS tournament_deck_selections_tournament_id_fkey,
  ADD CONSTRAINT tournament_deck_selections_tournament_id_fkey 
    FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Also cascade delete for deck_id FK
ALTER TABLE public.tournament_deck_selections 
  DROP CONSTRAINT IF EXISTS tournament_deck_selections_deck_id_fkey,
  ADD CONSTRAINT tournament_deck_selections_deck_id_fkey 
    FOREIGN KEY (deck_id) REFERENCES public.decks(id) ON DELETE CASCADE;