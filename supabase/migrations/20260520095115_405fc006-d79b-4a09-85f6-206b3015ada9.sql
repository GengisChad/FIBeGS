
DROP POLICY IF EXISTS club_messages_insert_members ON public.club_messages;
DROP POLICY IF EXISTS club_messages_select_members ON public.club_messages;

CREATE POLICY club_messages_select_members ON public.club_messages
FOR SELECT
USING (public.is_club_member(auth.uid(), club_id));

CREATE POLICY club_messages_insert_members ON public.club_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id AND public.is_club_member(auth.uid(), club_id));
