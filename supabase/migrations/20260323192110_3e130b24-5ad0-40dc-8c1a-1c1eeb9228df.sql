
-- Fix: Replace authenticated contact_requests INSERT policy to avoid WITH CHECK (true)
DROP POLICY IF EXISTS "Authenticated users can insert contact requests" ON public.contact_requests;

CREATE POLICY "Authenticated users can insert contact requests"
ON public.contact_requests
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT COUNT(*) FROM public.contact_requests 
   WHERE created_at > now() - interval '1 hour') < 100
);
