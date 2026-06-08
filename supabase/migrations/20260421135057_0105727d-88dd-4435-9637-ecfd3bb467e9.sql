
-- Fix infinite recursion between club_requests and club_request_invites RLS policies
-- by using SECURITY DEFINER helper functions that bypass RLS

-- Helper 1: Check if a user is invited to a club request
CREATE OR REPLACE FUNCTION public.is_invited_to_club_request(_request_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_request_invites
    WHERE request_id = _request_id
      AND user_id = _user_id
  )
$$;

-- Helper 2: Check if a user is the creator of a given club request
CREATE OR REPLACE FUNCTION public.is_club_request_creator(_request_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_requests
    WHERE id = _request_id
      AND user_id = _user_id
  )
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Invited users can view requests they're invited to" ON public.club_requests;
DROP POLICY IF EXISTS "Request creator can view request invites" ON public.club_request_invites;
DROP POLICY IF EXISTS "Request creator can create invites" ON public.club_request_invites;

-- Recreate using security definer functions (no recursion)
CREATE POLICY "Invited users can view requests they're invited to"
ON public.club_requests
FOR SELECT
USING (public.is_invited_to_club_request(id, auth.uid()));

CREATE POLICY "Request creator can view request invites"
ON public.club_request_invites
FOR SELECT
USING (public.is_club_request_creator(request_id, auth.uid()));

CREATE POLICY "Request creator can create invites"
ON public.club_request_invites
FOR INSERT
WITH CHECK (public.is_club_request_creator(request_id, auth.uid()));
