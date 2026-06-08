
-- Table for club request invitations
CREATE TABLE public.club_request_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.club_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

ALTER TABLE public.club_request_invites ENABLE ROW LEVEL SECURITY;

-- Users can see invites addressed to them
CREATE POLICY "Users can view their own invites"
ON public.club_request_invites FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Request creator can see all invites for their request
CREATE POLICY "Request creator can view request invites"
ON public.club_request_invites FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_requests cr
    WHERE cr.id = request_id AND cr.user_id = auth.uid()
  )
);

-- Request creator can insert invites for their own requests
CREATE POLICY "Request creator can create invites"
ON public.club_request_invites FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_requests cr
    WHERE cr.id = request_id AND cr.user_id = auth.uid()
  )
);

-- Invited users can update their own invite status
CREATE POLICY "Invited users can update their invite"
ON public.club_request_invites FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_club_request_invites_updated_at
BEFORE UPDATE ON public.club_request_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
