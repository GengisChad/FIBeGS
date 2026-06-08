
-- Add edited_at columns
ALTER TABLE public.private_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.club_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.global_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Private: replace broad UPDATE with two policies: read_at by any participant; content edit only by sender
DROP POLICY IF EXISTS "private_messages_update_read" ON public.private_messages;
CREATE POLICY "private_messages_update_read" ON public.private_messages
  FOR UPDATE USING (public.is_chat_participant(chat_id, auth.uid()))
  WITH CHECK (public.is_chat_participant(chat_id, auth.uid()));

-- Sender can delete own private messages
DROP POLICY IF EXISTS "private_messages_delete_own" ON public.private_messages;
CREATE POLICY "private_messages_delete_own" ON public.private_messages
  FOR DELETE USING (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role));

-- Club messages: allow sender to update own
DROP POLICY IF EXISTS "club_messages_update_own" ON public.club_messages;
CREATE POLICY "club_messages_update_own" ON public.club_messages
  FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

-- Global messages: allow sender to update own
DROP POLICY IF EXISTS "global_messages_update_own" ON public.global_messages;
CREATE POLICY "global_messages_update_own" ON public.global_messages
  FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
