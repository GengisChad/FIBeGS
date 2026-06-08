-- Allow request owners to delete their own pending club requests
CREATE POLICY "Users can delete their own pending club requests"
ON public.club_requests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending');

-- Allow request owners to delete invites attached to their own request
CREATE POLICY "Request owners can delete invites of their request"
ON public.club_request_invites
FOR DELETE
TO authenticated
USING (public.is_club_request_creator(request_id, auth.uid()));