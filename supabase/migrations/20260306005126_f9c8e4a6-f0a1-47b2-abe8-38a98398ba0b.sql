
-- Table for market listing likes
CREATE TABLE public.market_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

-- Enable RLS
ALTER TABLE public.market_likes ENABLE ROW LEVEL SECURITY;

-- Everyone can see likes (for counting)
CREATE POLICY "Likes viewable by everyone"
  ON public.market_likes FOR SELECT
  USING (true);

-- Authenticated users can like
CREATE POLICY "Users can insert their own likes"
  ON public.market_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own likes
CREATE POLICY "Users can delete their own likes"
  ON public.market_likes FOR DELETE
  USING (auth.uid() = user_id);
