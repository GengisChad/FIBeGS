
-- Create decks table
CREATE TABLE public.decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create deck_beyblades table (each deck has up to 3 beyblades)
CREATE TABLE public.deck_beyblades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  position integer NOT NULL,
  blade_type text NOT NULL,
  ratchet_type text,
  UNIQUE(deck_id, position)
);

-- Create deck_beyblade_components table
CREATE TABLE public.deck_beyblade_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_beyblade_id uuid NOT NULL REFERENCES public.deck_beyblades(id) ON DELETE CASCADE,
  component_type text NOT NULL,
  component_id uuid NOT NULL REFERENCES public.collection_components(id),
  variant_id uuid REFERENCES public.collection_component_variants(id)
);

-- Create tournament_deck_selections table
CREATE TABLE public.tournament_deck_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  deck_id uuid NOT NULL REFERENCES public.decks(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

-- Enable RLS
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_beyblades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_beyblade_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_deck_selections ENABLE ROW LEVEL SECURITY;

-- Decks RLS
CREATE POLICY "Decks viewable by everyone" ON public.decks FOR SELECT USING (true);
CREATE POLICY "Users can create their own decks" ON public.decks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own decks" ON public.decks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own decks" ON public.decks FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all decks" ON public.decks FOR ALL USING (has_role(auth.uid(), 'admin'));

-- deck_beyblades RLS
CREATE POLICY "Deck beyblades viewable by everyone" ON public.deck_beyblades FOR SELECT USING (true);
CREATE POLICY "Users can insert their deck beyblades" ON public.deck_beyblades FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.decks WHERE id = deck_id AND user_id = auth.uid()));
CREATE POLICY "Users can update their deck beyblades" ON public.deck_beyblades FOR UPDATE USING (EXISTS (SELECT 1 FROM public.decks WHERE id = deck_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete their deck beyblades" ON public.deck_beyblades FOR DELETE USING (EXISTS (SELECT 1 FROM public.decks WHERE id = deck_id AND user_id = auth.uid()));

-- deck_beyblade_components RLS
CREATE POLICY "Deck components viewable by everyone" ON public.deck_beyblade_components FOR SELECT USING (true);
CREATE POLICY "Users can insert their deck components" ON public.deck_beyblade_components FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.deck_beyblades db JOIN public.decks d ON d.id = db.deck_id WHERE db.id = deck_beyblade_id AND d.user_id = auth.uid()));
CREATE POLICY "Users can update their deck components" ON public.deck_beyblade_components FOR UPDATE USING (EXISTS (SELECT 1 FROM public.deck_beyblades db JOIN public.decks d ON d.id = db.deck_id WHERE db.id = deck_beyblade_id AND d.user_id = auth.uid()));
CREATE POLICY "Users can delete their deck components" ON public.deck_beyblade_components FOR DELETE USING (EXISTS (SELECT 1 FROM public.deck_beyblades db JOIN public.decks d ON d.id = db.deck_id WHERE db.id = deck_beyblade_id AND d.user_id = auth.uid()));

-- tournament_deck_selections RLS
CREATE POLICY "Tournament decks viewable conditionally" ON public.tournament_deck_selections FOR SELECT USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.status = 'completed')
  OR EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id))
);
CREATE POLICY "Users can insert their tournament deck" ON public.tournament_deck_selections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their tournament deck" ON public.tournament_deck_selections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their tournament deck" ON public.tournament_deck_selections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all tournament decks" ON public.tournament_deck_selections FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Club staff can manage tournament decks" ON public.tournament_deck_selections FOR ALL USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)));
