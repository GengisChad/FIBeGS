
-- Fix security: notify_mention must use auth.uid() as mentioner, not accept it as parameter
CREATE OR REPLACE FUNCTION public.notify_mention(_mentioner_id uuid, _mentioned_username text, _post_id uuid, _context text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mentioned_user_id uuid;
  _mentioner_name text;
  _real_caller uuid := auth.uid();
BEGIN
  -- SECURITY: ignore _mentioner_id parameter, always use the real caller
  IF _real_caller IS NULL THEN RETURN; END IF;

  SELECT user_id INTO _mentioned_user_id
  FROM profiles WHERE LOWER(username) = LOWER(_mentioned_username) LIMIT 1;

  IF _mentioned_user_id IS NULL OR _mentioned_user_id = _real_caller THEN RETURN; END IF;

  -- Prevent duplicate: skip if same mention notification exists within 5 minutes
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = _mentioned_user_id
      AND type = 'mention'
      AND link = '/forum/' || _post_id
      AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  -- Verify the post actually exists
  IF NOT EXISTS (SELECT 1 FROM forum_posts WHERE id = _post_id) THEN RETURN; END IF;

  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _mentioner_name
  FROM profiles WHERE user_id = _real_caller LIMIT 1;

  INSERT INTO notifications (user_id, type, title, message, link, push_sent)
  VALUES (
    _mentioned_user_id,
    'mention',
    'Sei stato menzionato!',
    _mentioner_name || ' ti ha menzionato in ' || _context,
    '/forum/' || _post_id,
    true
  );
END;
$$;
