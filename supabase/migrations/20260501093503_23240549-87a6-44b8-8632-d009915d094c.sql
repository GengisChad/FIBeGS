-- =====================================================================
-- 1. Chat closure system: per-user "closed" state. When BOTH users close
--    the chat (or last referent + last leader for request channels), the
--    chat and all its messages are physically deleted.
--    A new message from any participant resets all close flags so the chat
--    reappears for the other party.
-- =====================================================================

-- Market chat closures
CREATE TABLE IF NOT EXISTS public.market_chat_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.market_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mcc_chat ON public.market_chat_closures(chat_id);
ALTER TABLE public.market_chat_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants manage own closure" ON public.market_chat_closures
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.market_chats c
      WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.market_chats c
      WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

CREATE POLICY "Participants view closures" ON public.market_chat_closures
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.market_chats c
      WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- Trigger: when both buyer and seller have closed -> delete the chat
CREATE OR REPLACE FUNCTION public.market_chat_check_full_closure()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _buyer UUID; _seller UUID; _count INT;
BEGIN
  SELECT buyer_id, seller_id INTO _buyer, _seller FROM market_chats WHERE id = NEW.chat_id;
  IF _buyer IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO _count FROM market_chat_closures
   WHERE chat_id = NEW.chat_id AND user_id IN (_buyer, _seller);
  IF _count >= 2 THEN
    DELETE FROM market_chats WHERE id = NEW.chat_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_market_chat_close ON public.market_chat_closures;
CREATE TRIGGER trg_market_chat_close
  AFTER INSERT ON public.market_chat_closures
  FOR EACH ROW EXECUTE FUNCTION public.market_chat_check_full_closure();

-- Trigger: new message clears closures (chat reopens for the other party)
CREATE OR REPLACE FUNCTION public.market_message_reopens_chat()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM market_chat_closures WHERE chat_id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_market_msg_reopen ON public.market_messages;
CREATE TRIGGER trg_market_msg_reopen
  AFTER INSERT ON public.market_messages
  FOR EACH ROW EXECUTE FUNCTION public.market_message_reopens_chat();

-- =====================================================================
-- 2. Regional channel closure (only 'request' channels can be closed,
--    NEVER the persistent 'region' group chat)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.regional_channel_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.regional_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rcc_channel ON public.regional_channel_closures(channel_id);
ALTER TABLE public.regional_channel_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own closure" ON public.regional_channel_closures
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() AND is_channel_member(auth.uid(), channel_id)
  )
  WITH CHECK (
    user_id = auth.uid() AND is_channel_member(auth.uid(), channel_id)
  );

CREATE POLICY "Members view closures" ON public.regional_channel_closures
  FOR SELECT TO authenticated
  USING (is_channel_member(auth.uid(), channel_id));

-- Block closures on persistent region-group channels
CREATE OR REPLACE FUNCTION public.regional_closure_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctype TEXT;
BEGIN
  SELECT channel_type INTO _ctype FROM regional_channels WHERE id = NEW.channel_id;
  IF _ctype = 'region' THEN
    RAISE EXCEPTION 'La chat regionale di gruppo non puo essere chiusa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regional_closure_guard ON public.regional_channel_closures;
CREATE TRIGGER trg_regional_closure_guard
  BEFORE INSERT ON public.regional_channel_closures
  FOR EACH ROW EXECUTE FUNCTION public.regional_closure_guard();

-- When all current members of a request channel have closed -> delete channel
CREATE OR REPLACE FUNCTION public.regional_channel_check_full_closure()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _members INT; _closed INT;
BEGIN
  SELECT count(*) INTO _members FROM regional_channel_members WHERE channel_id = NEW.channel_id;
  SELECT count(*) INTO _closed
    FROM regional_channel_closures cc
    JOIN regional_channel_members m ON m.channel_id = cc.channel_id AND m.user_id = cc.user_id
    WHERE cc.channel_id = NEW.channel_id;
  IF _members > 0 AND _closed >= _members THEN
    DELETE FROM regional_channels WHERE id = NEW.channel_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regional_close ON public.regional_channel_closures;
CREATE TRIGGER trg_regional_close
  AFTER INSERT ON public.regional_channel_closures
  FOR EACH ROW EXECUTE FUNCTION public.regional_channel_check_full_closure();

-- New message in a request channel reopens it for everyone
CREATE OR REPLACE FUNCTION public.regional_message_reopens_channel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctype TEXT;
BEGIN
  SELECT channel_type INTO _ctype FROM regional_channels WHERE id = NEW.channel_id;
  IF _ctype <> 'region' THEN
    DELETE FROM regional_channel_closures WHERE channel_id = NEW.channel_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regional_msg_reopen ON public.regional_messages;
CREATE TRIGGER trg_regional_msg_reopen
  AFTER INSERT ON public.regional_messages
  FOR EACH ROW EXECUTE FUNCTION public.regional_message_reopens_channel();

-- =====================================================================
-- 3. Allow regional referents to start a 1:1 channel with ANY player of
--    their region (search-by-username use case).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.referent_open_direct_channel(_target_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _region_id uuid;
  _player_region_id uuid;
  _ch_id uuid;
  _title text;
  _player_name text;
BEGIN
  -- Caller must be a regional referent for the target player's region.
  SELECT region_id INTO _player_region_id FROM profiles WHERE user_id = _target_user_id;
  IF _player_region_id IS NULL THEN
    RAISE EXCEPTION 'Il giocatore non ha una regione impostata';
  END IF;

  IF NOT is_regional_referent(auth.uid(), _player_region_id) THEN
    RAISE EXCEPTION 'Non sei referente per la regione di questo giocatore';
  END IF;

  _region_id := _player_region_id;

  -- Reuse an existing direct channel if any
  SELECT c.id INTO _ch_id
  FROM regional_channels c
  WHERE c.region_id = _region_id
    AND c.channel_type = 'request'
    AND c.club_request_id IS NULL
    AND EXISTS (SELECT 1 FROM regional_channel_members m WHERE m.channel_id = c.id AND m.user_id = _target_user_id)
    AND EXISTS (SELECT 1 FROM regional_channel_members m WHERE m.channel_id = c.id AND m.user_id = auth.uid())
  LIMIT 1;

  IF _ch_id IS NOT NULL THEN
    -- If chat had been closed, allow the referent re-opening it by clearing closures
    DELETE FROM regional_channel_closures WHERE channel_id = _ch_id;
    RETURN _ch_id;
  END IF;

  SELECT COALESCE(display_name, username, 'Giocatore') INTO _player_name
  FROM profiles WHERE user_id = _target_user_id;

  INSERT INTO regional_channels (region_id, channel_type, club_request_id, title)
  VALUES (_region_id, 'request', NULL, 'Chat con ' || COALESCE(_player_name, 'giocatore'))
  RETURNING id INTO _ch_id;

  INSERT INTO regional_channel_members (channel_id, user_id, role)
  VALUES (_ch_id, auth.uid(), 'referent')
  ON CONFLICT DO NOTHING;
  INSERT INTO regional_channel_members (channel_id, user_id, role)
  VALUES (_ch_id, _target_user_id, 'requester')
  ON CONFLICT DO NOTHING;

  RETURN _ch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.referent_open_direct_channel(uuid) TO authenticated;

-- =====================================================================
-- 4. Realtime for closures so UI refreshes
-- =====================================================================
ALTER TABLE public.market_chat_closures REPLICA IDENTITY FULL;
ALTER TABLE public.regional_channel_closures REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.market_chat_closures;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.regional_channel_closures;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;