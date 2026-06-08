
-- Prevent spam: only allow one pending club request per user
DROP POLICY IF EXISTS "Authenticated users can create requests" ON public.club_requests;

CREATE POLICY "Authenticated users can create requests"
ON public.club_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.club_requests cr
    WHERE cr.user_id = auth.uid()
    AND cr.status = 'pending'
  )
);
