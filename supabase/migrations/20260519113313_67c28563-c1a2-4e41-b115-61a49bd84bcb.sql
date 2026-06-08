CREATE OR REPLACE FUNCTION public.get_chat_public_key_history(_user_id uuid)
RETURNS TABLE(public_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT key_value AS public_key
  FROM (
    SELECT p.public_key AS key_value, 0 AS sort_order, now() AS key_created_at
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND p.public_key IS NOT NULL
      AND auth.uid() IS NOT NULL

    UNION ALL

    SELECT h.public_key AS key_value, 1 AS sort_order, h.created_at AS key_created_at
    FROM public.user_chat_key_history h
    WHERE h.user_id = _user_id
      AND h.public_key IS NOT NULL
      AND auth.uid() IS NOT NULL
  ) keys
  WHERE key_value IS NOT NULL
  ORDER BY public_key;
$$;