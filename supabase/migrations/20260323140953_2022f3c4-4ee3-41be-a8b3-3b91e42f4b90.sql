
-- Market wanted posts (ricerche prodotto)
CREATE TABLE public.market_wanted (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  condition text NOT NULL DEFAULT 'any',
  max_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_wanted ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view wanted posts" ON public.market_wanted
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own wanted posts" ON public.market_wanted
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wanted posts" ON public.market_wanted
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own wanted posts" ON public.market_wanted
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Market chats (conversations tied to listings or wanted posts)
CREATE TABLE public.market_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.market_listings(id) ON DELETE CASCADE,
  wanted_id uuid REFERENCES public.market_wanted(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_has_reference CHECK (listing_id IS NOT NULL OR wanted_id IS NOT NULL)
);

ALTER TABLE public.market_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view" ON public.market_chats
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Authenticated can create chats" ON public.market_chats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Participants can update" ON public.market_chats
  FOR UPDATE TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Market messages
CREATE TABLE public.market_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.market_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view messages" ON public.market_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.market_chats c WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
  );
CREATE POLICY "Chat participants can send messages" ON public.market_messages
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.market_chats c WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
  );
CREATE POLICY "Sender can update own messages" ON public.market_messages
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.market_chats c WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
  );

-- Indexes
CREATE INDEX idx_market_wanted_user ON public.market_wanted(user_id);
CREATE INDEX idx_market_wanted_created ON public.market_wanted(created_at DESC);
CREATE INDEX idx_market_chats_buyer ON public.market_chats(buyer_id);
CREATE INDEX idx_market_chats_seller ON public.market_chats(seller_id);
CREATE INDEX idx_market_chats_listing ON public.market_chats(listing_id);
CREATE INDEX idx_market_chats_wanted ON public.market_chats(wanted_id);
CREATE INDEX idx_market_messages_chat ON public.market_messages(chat_id, created_at);

-- Validation trigger for wanted posts
CREATE OR REPLACE FUNCTION public.validate_market_wanted()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF char_length(NEW.title) < 3 OR char_length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;
  IF NEW.max_price IS NOT NULL AND (NEW.max_price < 0 OR NEW.max_price > 99999) THEN
    RAISE EXCEPTION 'Max price must be between 0 and 99999';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_market_wanted BEFORE INSERT OR UPDATE ON public.market_wanted
  FOR EACH ROW EXECUTE FUNCTION public.validate_market_wanted();

-- Enable realtime for messages (for live chat)
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_messages;
