-- Send a test notification to any user
CREATE OR REPLACE FUNCTION public.admin_debug_send_notification(
  _target_user_id uuid,
  _type text,
  _title text,
  _message text,
  _link text DEFAULT NULL,
  _push boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, push_eligible)
  VALUES (
    _target_user_id,
    _type,
    '[TEST] ' || _title,
    _message,
    _link,
    COALESCE(_push, true)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$;

-- Create a fake club request + invite so the invite banner appears for the target user
CREATE OR REPLACE FUNCTION public.admin_debug_create_club_invite(_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _request_id uuid;
  _invite_id uuid;
  _admin_id uuid := auth.uid();
BEGIN
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Create test request from the admin
  INSERT INTO public.club_requests (
    user_id, club_name, description, city, status
  ) VALUES (
    _admin_id,
    '[TEST] Club di Debug',
    '[TEST] Richiesta creata dall''admin per testare il banner di invito. Cancellabile dalla tab Debug.',
    'Test City',
    'pending'
  ) RETURNING id INTO _request_id;

  -- Create pending invite for target user
  INSERT INTO public.club_request_invites (request_id, user_id, status)
  VALUES (_request_id, _target_user_id, 'pending')
  RETURNING id INTO _invite_id;

  -- Also send a notification with push
  INSERT INTO public.notifications (user_id, type, title, message, link, push_eligible)
  VALUES (
    _target_user_id,
    'club_invite',
    '[TEST] Invito Club',
    'Sei stato invitato a far parte del club "[TEST] Club di Debug" come membro fondatore.',
    '/clubs',
    true
  );

  RETURN jsonb_build_object(
    'request_id', _request_id,
    'invite_id', _invite_id
  );
END;
$function$;

-- Cleanup all test data created via the debug tab
CREATE OR REPLACE FUNCTION public.admin_debug_cleanup_tests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _notif_count int;
  _request_count int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Delete test notifications (prefix [TEST] in title)
  DELETE FROM public.notifications WHERE title LIKE '[TEST]%';
  GET DIAGNOSTICS _notif_count = ROW_COUNT;

  -- Delete test club requests + cascading invites
  DELETE FROM public.club_request_invites
  WHERE request_id IN (SELECT id FROM public.club_requests WHERE club_name LIKE '[TEST]%');

  DELETE FROM public.club_requests WHERE club_name LIKE '[TEST]%';
  GET DIAGNOSTICS _request_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'notifications_deleted', _notif_count,
    'club_requests_deleted', _request_count
  );
END;
$function$;