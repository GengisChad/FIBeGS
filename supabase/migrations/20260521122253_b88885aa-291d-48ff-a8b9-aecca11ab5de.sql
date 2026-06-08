
-- Helper: allow private chat between a club_request requester and admins / regional referents of that region
CREATE OR REPLACE FUNCTION public.can_chat_via_club_request(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_requests cr
    WHERE
      -- one of the two users is the requester
      (cr.user_id = _a OR cr.user_id = _b)
      AND (
        -- the other is admin
        public.has_role(CASE WHEN cr.user_id = _a THEN _b ELSE _a END, 'admin'::app_role)
        OR
        -- the other is an active regional referent of the request's region
        EXISTS (
          SELECT 1 FROM public.regional_referents rr
          WHERE rr.region_id = cr.region_id
            AND rr.is_active = true
            AND rr.user_id = CASE WHEN cr.user_id = _a THEN _b ELSE _a END
        )
      )
  );
$$;

DROP POLICY IF EXISTS "private_chats_insert_allowed" ON public.private_chats;
CREATE POLICY "private_chats_insert_allowed" ON public.private_chats
FOR INSERT
WITH CHECK (
  (auth.uid() = user_a OR auth.uid() = user_b)
  AND (
    public.are_friends(user_a, user_b)
    OR public.are_teammates(user_a, user_b)
    OR public.can_chat_via_club_request(user_a, user_b)
  )
);

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
      AND (
        public.are_friends(c.user_a, c.user_b)
        OR public.are_teammates(c.user_a, c.user_b)
        OR public.can_chat_via_club_request(c.user_a, c.user_b)
      )
  )
);
