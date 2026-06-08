-- Allow users invited to a club request to view the request details
CREATE POLICY "Invited users can view requests they're invited to"
ON public.club_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_request_invites cri
    WHERE cri.request_id = club_requests.id
      AND cri.user_id = auth.uid()
  )
);