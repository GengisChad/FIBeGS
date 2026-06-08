
-- Allow club_request creators to insert notifications for their invited users
CREATE POLICY "Club request creators can notify invited users"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  type = 'club_invite'
  AND EXISTS (
    SELECT 1 FROM public.club_request_invites cri
    JOIN public.club_requests cr ON cr.id = cri.request_id
    WHERE cri.user_id = notifications.user_id
      AND cr.user_id = auth.uid()
  )
);

-- Update approval function to require 7 accepted invites (also for special requests)
CREATE OR REPLACE FUNCTION public.approve_club_request_and_transfer(_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _req RECORD;
  _club_id UUID;
  _member RECORD;
  _accepted_count INT;
BEGIN
  -- Get request details
  SELECT * INTO _req FROM club_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club request not found';
  END IF;

  -- Validate that at least 7 invitees accepted (applies also to special requests)
  SELECT COUNT(*) INTO _accepted_count
  FROM club_request_invites
  WHERE request_id = _request_id AND status = 'accepted';

  IF _accepted_count < 7 THEN
    RAISE EXCEPTION 'Servono almeno 7 inviti accettati per approvare il club (attualmente: %)', _accepted_count;
  END IF;

  -- Create the club
  INSERT INTO clubs (name, description, region_id, city, latitude, longitude, is_active)
  VALUES (_req.club_name, _req.description, _req.region_id, _req.city, _req.latitude, _req.longitude, true)
  RETURNING id INTO _club_id;

  -- Remove requester from any existing club
  DELETE FROM club_members WHERE user_id = _req.user_id;

  -- Add requester as leader
  INSERT INTO club_members (club_id, user_id, role)
  VALUES (_club_id, _req.user_id, 'leader');

  -- Add all accepted invite members
  FOR _member IN
    SELECT user_id FROM club_request_invites
    WHERE request_id = _request_id AND status = 'accepted'
  LOOP
    DELETE FROM club_members WHERE user_id = _member.user_id;
    INSERT INTO club_members (club_id, user_id, role)
    VALUES (_club_id, _member.user_id, 'member');
  END LOOP;

  -- Update request status
  UPDATE club_requests SET status = 'approved' WHERE id = _request_id;

  -- Notify all members
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT cri.user_id, 'club_approved', 'Club Approvato!',
    'Il club "' || _req.club_name || '" è stato approvato! Fai ora parte del club.',
    '/clubs/' || _club_id
  FROM club_request_invites cri
  WHERE cri.request_id = _request_id AND cri.status = 'accepted';

  -- Also notify requester
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (_req.user_id, 'club_approved', 'Club Approvato!',
    'Il tuo club "' || _req.club_name || '" è stato approvato!',
    '/clubs/' || _club_id);

  RETURN _club_id;
END;
$function$;
