
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_key text;

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_ordered CHECK (user_a < user_b),
  CONSTRAINT friendships_unique UNIQUE (user_a, user_b)
);
CREATE INDEX IF NOT EXISTS idx_friendships_a ON public.friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON public.friendships(user_b);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friendships_select_own" ON public.friendships;
CREATE POLICY "friendships_select_own" ON public.friendships FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
DROP POLICY IF EXISTS "friendships_insert_own" ON public.friendships;
CREATE POLICY "friendships_insert_own" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = requested_by AND (auth.uid() = user_a OR auth.uid() = user_b) AND status = 'pending');
DROP POLICY IF EXISTS "friendships_update_recipient" ON public.friendships;
CREATE POLICY "friendships_update_recipient" ON public.friendships FOR UPDATE USING ((auth.uid() = user_a OR auth.uid() = user_b) AND auth.uid() <> requested_by);
DROP POLICY IF EXISTS "friendships_delete_own" ON public.friendships;
CREATE POLICY "friendships_delete_own" ON public.friendships FOR DELETE USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.friendships WHERE status = 'accepted' AND user_a = LEAST(_a, _b) AND user_b = GREATEST(_a, _b));
$$;

CREATE TABLE IF NOT EXISTS public.private_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  last_message_at timestamptz,
  closed_by_a boolean NOT NULL DEFAULT false,
  closed_by_b boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_chats_ordered CHECK (user_a < user_b),
  CONSTRAINT private_chats_unique UNIQUE (user_a, user_b)
);
ALTER TABLE public.private_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "private_chats_select" ON public.private_chats;
CREATE POLICY "private_chats_select" ON public.private_chats FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
DROP POLICY IF EXISTS "private_chats_insert_friends" ON public.private_chats;
CREATE POLICY "private_chats_insert_friends" ON public.private_chats FOR INSERT WITH CHECK ((auth.uid() = user_a OR auth.uid() = user_b) AND public.are_friends(user_a, user_b));
DROP POLICY IF EXISTS "private_chats_update_self" ON public.private_chats;
CREATE POLICY "private_chats_update_self" ON public.private_chats FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TABLE IF NOT EXISTS public.private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.private_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content_encrypted text NOT NULL,
  nonce text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pmsg_chat ON public.private_messages(chat_id, created_at DESC);
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_chat_participant(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.private_chats WHERE id = _chat_id AND (user_a = _user_id OR user_b = _user_id));
$$;

DROP POLICY IF EXISTS "private_messages_select" ON public.private_messages;
CREATE POLICY "private_messages_select" ON public.private_messages FOR SELECT USING (public.is_chat_participant(chat_id, auth.uid()));
DROP POLICY IF EXISTS "private_messages_insert" ON public.private_messages;
CREATE POLICY "private_messages_insert" ON public.private_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND public.is_chat_participant(chat_id, auth.uid())
  AND EXISTS (SELECT 1 FROM public.private_chats c WHERE c.id = chat_id AND public.are_friends(c.user_a, c.user_b))
);
DROP POLICY IF EXISTS "private_messages_update_read" ON public.private_messages;
CREATE POLICY "private_messages_update_read" ON public.private_messages FOR UPDATE USING (public.is_chat_participant(chat_id, auth.uid()));
DROP POLICY IF EXISTS "private_messages_admin_delete" ON public.private_messages;
CREATE POLICY "private_messages_admin_delete" ON public.private_messages FOR DELETE USING (public.is_chat_participant(chat_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.private_message_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.private_chats
  SET last_message_at = NEW.created_at,
      closed_by_a = CASE WHEN user_a = NEW.sender_id THEN closed_by_a ELSE false END,
      closed_by_b = CASE WHEN user_b = NEW.sender_id THEN closed_by_b ELSE false END
  WHERE id = NEW.chat_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_private_message_after_insert ON public.private_messages;
CREATE TRIGGER trg_private_message_after_insert AFTER INSERT ON public.private_messages FOR EACH ROW EXECUTE FUNCTION public.private_message_after_insert();

CREATE OR REPLACE FUNCTION public.private_chat_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.closed_by_a AND NEW.closed_by_b THEN DELETE FROM public.private_chats WHERE id = NEW.id; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_private_chat_after_update ON public.private_chats;
CREATE TRIGGER trg_private_chat_after_update AFTER UPDATE ON public.private_chats FOR EACH ROW EXECUTE FUNCTION public.private_chat_after_update();

CREATE TABLE IF NOT EXISTS public.club_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_messages ON public.club_messages(club_id, created_at DESC);
ALTER TABLE public.club_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_messages_select_members" ON public.club_messages;
CREATE POLICY "club_messages_select_members" ON public.club_messages FOR SELECT USING (public.is_club_member(club_id, auth.uid()));
DROP POLICY IF EXISTS "club_messages_insert_members" ON public.club_messages;
CREATE POLICY "club_messages_insert_members" ON public.club_messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND public.is_club_member(club_id, auth.uid()));
DROP POLICY IF EXISTS "club_messages_delete_own_or_admin" ON public.club_messages;
CREATE POLICY "club_messages_delete_own_or_admin" ON public.club_messages FOR DELETE USING (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.global_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_global_messages_created ON public.global_messages(created_at DESC);
ALTER TABLE public.global_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = _user_id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
      OR EXISTS (SELECT 1 FROM public.user_timeouts WHERE user_id = _user_id AND revoked_at IS NULL AND expires_at > now());
$$;

DROP POLICY IF EXISTS "global_messages_select_auth" ON public.global_messages;
CREATE POLICY "global_messages_select_auth" ON public.global_messages FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "global_messages_insert_clean" ON public.global_messages;
CREATE POLICY "global_messages_insert_clean" ON public.global_messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND NOT public.is_user_blocked(auth.uid()));
DROP POLICY IF EXISTS "global_messages_delete_own_or_admin" ON public.global_messages;
CREATE POLICY "global_messages_delete_own_or_admin" ON public.global_messages FOR DELETE USING (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.notify_private_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ua uuid; _ub uuid; _recipient uuid; _sender_name text;
BEGIN
  SELECT user_a, user_b INTO _ua, _ub FROM public.private_chats WHERE id = NEW.chat_id;
  _recipient := CASE WHEN _ua = NEW.sender_id THEN _ub ELSE _ua END;
  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _sender_name FROM public.profiles WHERE user_id = NEW.sender_id LIMIT 1;
  INSERT INTO public.notifications (user_id, type, title, message, link, push_eligible)
  VALUES (_recipient, 'private_message', 'Nuovo messaggio da ' || COALESCE(_sender_name, 'un amico'), '🔒 Messaggio cifrato',
          '/?chat=' || NEW.chat_id::text || '&kind=private', true);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_private_message ON public.private_messages;
CREATE TRIGGER trg_notify_private_message AFTER INSERT ON public.private_messages FOR EACH ROW EXECUTE FUNCTION public.notify_private_message();

CREATE OR REPLACE FUNCTION public.notify_friendship_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _recipient uuid; _other_name text; _other uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    _recipient := CASE WHEN NEW.requested_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END;
    SELECT COALESCE(display_name, username, 'Un giocatore') INTO _other_name FROM public.profiles WHERE user_id = NEW.requested_by LIMIT 1;
    INSERT INTO public.notifications (user_id, type, title, message, link, push_eligible)
    VALUES (_recipient, 'friend_request', 'Richiesta di amicizia', _other_name || ' vuole essere tuo amico', '/?chat=friends', true);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    _recipient := NEW.requested_by;
    _other := CASE WHEN NEW.requested_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END;
    SELECT COALESCE(display_name, username, 'Un giocatore') INTO _other_name FROM public.profiles WHERE user_id = _other LIMIT 1;
    INSERT INTO public.notifications (user_id, type, title, message, link, push_eligible)
    VALUES (_recipient, 'friend_accepted', 'Amicizia accettata', _other_name || ' ha accettato la tua richiesta', '/?chat=friends', true);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_friendship_change ON public.friendships;
CREATE TRIGGER trg_notify_friendship_change AFTER INSERT OR UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.notify_friendship_change();

CREATE OR REPLACE FUNCTION public.notify_club_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender_name text; _club_name text;
BEGIN
  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _sender_name FROM public.profiles WHERE user_id = NEW.sender_id LIMIT 1;
  SELECT name INTO _club_name FROM public.clubs WHERE id = NEW.club_id LIMIT 1;
  INSERT INTO public.notifications (user_id, type, title, message, link, push_eligible)
  SELECT cm.user_id, 'club_message',
         COALESCE(_club_name, 'Club') || ' • ' || _sender_name,
         LEFT(NEW.content, 80),
         '/?chat=' || NEW.club_id::text || '&kind=club',
         true
  FROM public.club_members cm
  WHERE cm.club_id = NEW.club_id AND cm.user_id <> NEW.sender_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_club_message ON public.club_messages;
CREATE TRIGGER trg_notify_club_message AFTER INSERT ON public.club_messages FOR EACH ROW EXECUTE FUNCTION public.notify_club_message();

CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.private_messages WHERE created_at < now() - interval '60 days';
  DELETE FROM public.club_messages WHERE created_at < now() - interval '60 days';
  DELETE FROM public.global_messages WHERE created_at < now() - interval '60 days';
  DELETE FROM public.regional_messages WHERE created_at < now() - interval '60 days';
  DELETE FROM public.private_chats c
  WHERE NOT EXISTS (SELECT 1 FROM public.private_messages m WHERE m.chat_id = c.id)
    AND (c.last_message_at IS NULL OR c.last_message_at < now() - interval '60 days');
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN PERFORM cron.unschedule('cleanup_old_chat_messages_daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cleanup_old_chat_messages_daily', '15 3 * * *', $$SELECT public.cleanup_old_chat_messages();$$);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.club_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.global_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
