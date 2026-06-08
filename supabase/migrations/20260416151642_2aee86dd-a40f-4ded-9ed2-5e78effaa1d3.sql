
-- Trigger function: when an invite is updated, check if all invites for that request are accepted
CREATE OR REPLACE FUNCTION public.check_club_request_invites_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request_id UUID;
  _total_invites INT;
  _accepted_invites INT;
  _club_name TEXT;
  _requester_id UUID;
  _admin_user RECORD;
BEGIN
  _request_id := NEW.request_id;
  
  -- Only proceed if invite was just accepted
  IF NEW.status != 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Count total and accepted invites
  SELECT COUNT(*) INTO _total_invites FROM club_request_invites WHERE request_id = _request_id;
  SELECT COUNT(*) INTO _accepted_invites FROM club_request_invites WHERE request_id = _request_id AND status = 'accepted';

  -- Need at least 7 accepted invites
  IF _accepted_invites < 7 THEN
    RETURN NEW;
  END IF;

  -- Check no pending invites remain (all must be accepted)
  IF _accepted_invites < _total_invites THEN
    -- There are still pending or rejected invites
    -- Only proceed if we have exactly 7+ accepted (ignore rejected ones)
    DECLARE
      _pending INT;
    BEGIN
      SELECT COUNT(*) INTO _pending FROM club_request_invites WHERE request_id = _request_id AND status = 'pending';
      IF _pending > 0 THEN
        RETURN NEW; -- Still waiting on some
      END IF;
    END;
  END IF;

  -- All conditions met: notify staff
  SELECT club_name, user_id INTO _club_name, _requester_id
  FROM club_requests WHERE id = _request_id;

  -- Create notification for all admin/staff users
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT ur.user_id, 'club_request_ready', 'Richiesta Club Pronta',
    'Tutti i membri hanno accettato l''invito per il club "' || _club_name || '". Pronta per approvazione.',
    '/admin'
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'staff');

  RETURN NEW;
END;
$$;

-- Trigger on invite updates
DROP TRIGGER IF EXISTS trg_check_club_invites ON club_request_invites;
CREATE TRIGGER trg_check_club_invites
AFTER UPDATE ON club_request_invites
FOR EACH ROW
EXECUTE FUNCTION check_club_request_invites_complete();

-- Function to approve a club request: create club, move members
CREATE OR REPLACE FUNCTION public.approve_club_request_and_transfer(_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req RECORD;
  _club_id UUID;
  _member RECORD;
BEGIN
  -- Get request details
  SELECT * INTO _req FROM club_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club request not found';
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
    -- Remove from existing club first
    DELETE FROM club_members WHERE user_id = _member.user_id;
    -- Add to new club
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
$$;

-- Staff can view all invites
CREATE POLICY "Staff can view all invites"
ON public.club_request_invites FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'staff')
  )
);
