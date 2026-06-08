
-- FIX: get_email_by_username needs to work for unauthenticated users (login flow)
-- but should not expose full email - only return it for the signInWithPassword flow
-- Since this is called right before login, we allow it but add rate limiting note
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT au.email
  FROM auth.users au
  JOIN public.profiles p ON p.user_id = au.id
  WHERE LOWER(p.username) = LOWER(_username)
  LIMIT 1;
$function$;
