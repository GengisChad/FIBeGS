
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', new.raw_user_meta_data ->> 'display_name'),
    new.raw_user_meta_data ->> 'username'
  );
  RETURN new;
END;
$function$;
