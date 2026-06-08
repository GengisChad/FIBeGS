
-- Deck likes table
CREATE TABLE public.deck_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deck_id, user_id)
);

ALTER TABLE public.deck_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deck likes viewable by everyone" ON public.deck_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON public.deck_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON public.deck_likes FOR DELETE USING (auth.uid() = user_id);

-- Deck reports table
CREATE TABLE public.deck_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deck_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create deck reports" ON public.deck_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view deck reports" ON public.deck_reports FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update deck reports" ON public.deck_reports FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete deck reports" ON public.deck_reports FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
