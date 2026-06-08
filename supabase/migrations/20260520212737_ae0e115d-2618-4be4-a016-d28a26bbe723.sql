
-- Allow private chats between teammates as well as friends
CREATE OR REPLACE FUNCTION public.are_teammates(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members ta
    JOIN public.team_members tb ON ta.team_id = tb.team_id
    WHERE ta.user_id = _a AND tb.user_id = _b AND _a <> _b
  );
$$;

DROP POLICY IF EXISTS "private_chats_insert_friends" ON public.private_chats;
CREATE POLICY "private_chats_insert_allowed" ON public.private_chats
FOR INSERT
WITH CHECK (
  (auth.uid() = user_a OR auth.uid() = user_b)
  AND (public.are_friends(user_a, user_b) OR public.are_teammates(user_a, user_b))
);

-- Messages insert: also allow if teammates (relaxes the friends-only check inherited from prior policy)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.private_messages'::regclass AND polcmd = 'a' LOOP
    EXECUTE format('DROP POLICY %I ON public.private_messages', pol.polname);
  END LOOP;
END$$;

CREATE POLICY "private_messages_insert" ON public.private_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.private_chats c
    WHERE c.id = chat_id
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
      AND (public.are_friends(c.user_a, c.user_b) OR public.are_teammates(c.user_a, c.user_b))
  )
);
