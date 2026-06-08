CREATE OR REPLACE FUNCTION public.admin_debug_create_club_request(_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _request_id uuid;
  _admin_id uuid := auth.uid();
BEGIN
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  INSERT INTO public.club_requests (
    user_id, club_name, description, city, status
  ) VALUES (
    _target_user_id,
    '[TEST] Richiesta Apertura Club',
    '[TEST] Richiesta di apertura club creata dall''admin per testare il banner. Cancellabile dalla tab Debug.',
    'Test City',
    'pending'
  ) RETURNING id INTO _request_id;

  RETURN jsonb_build_object('request_id', _request_id);
END;
$function$;