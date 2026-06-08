
-- 1. Add parent_reply_id for nested replies
ALTER TABLE public.forum_replies ADD COLUMN IF NOT EXISTS parent_reply_id uuid REFERENCES public.forum_replies(id) ON DELETE CASCADE;

-- 2. Trigger: notify post author when someone likes their post
CREATE OR REPLACE FUNCTION public.notify_forum_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _post_owner uuid;
  _post_title text;
  _liker_name text;
BEGIN
  SELECT user_id, title INTO _post_owner, _post_title
  FROM forum_posts WHERE id = NEW.post_id;

  IF _post_owner IS NULL OR _post_owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _liker_name
  FROM profiles WHERE user_id = NEW.user_id LIMIT 1;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    _post_owner,
    'forum_like',
    'Nuovo like al tuo post',
    _liker_name || ' ha messo like a "' || LEFT(_post_title, 50) || '"',
    '/forum/' || NEW.post_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_forum_post_like
AFTER INSERT ON public.forum_post_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_forum_post_like();

-- 3. Trigger: notify reply author when someone likes their reply
CREATE OR REPLACE FUNCTION public.notify_forum_reply_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _reply_owner uuid;
  _reply_content text;
  _post_id uuid;
  _liker_name text;
BEGIN
  SELECT user_id, content, post_id INTO _reply_owner, _reply_content, _post_id
  FROM forum_replies WHERE id = NEW.reply_id;

  IF _reply_owner IS NULL OR _reply_owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _liker_name
  FROM profiles WHERE user_id = NEW.user_id LIMIT 1;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    _reply_owner,
    'forum_like',
    'Nuovo like al tuo commento',
    _liker_name || ' ha messo like al tuo commento: "' || LEFT(_reply_content, 50) || '"',
    '/forum/' || _post_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_forum_reply_like
AFTER INSERT ON public.forum_reply_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_forum_reply_like();

-- 4. Trigger: notify post author when someone replies + notify parent reply author for nested replies
CREATE OR REPLACE FUNCTION public.notify_forum_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _post_owner uuid;
  _post_title text;
  _replier_name text;
  _parent_reply_owner uuid;
BEGIN
  SELECT user_id, title INTO _post_owner, _post_title
  FROM forum_posts WHERE id = NEW.post_id;

  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _replier_name
  FROM profiles WHERE user_id = NEW.user_id LIMIT 1;

  -- Notify post author (if not self)
  IF _post_owner IS NOT NULL AND _post_owner != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      _post_owner,
      'forum_reply',
      'Nuova risposta al tuo post',
      _replier_name || ' ha risposto a "' || LEFT(_post_title, 50) || '"',
      '/forum/' || NEW.post_id
    );
  END IF;

  -- If nested reply, notify parent reply author
  IF NEW.parent_reply_id IS NOT NULL THEN
    SELECT user_id INTO _parent_reply_owner
    FROM forum_replies WHERE id = NEW.parent_reply_id;

    IF _parent_reply_owner IS NOT NULL 
       AND _parent_reply_owner != NEW.user_id 
       AND _parent_reply_owner != COALESCE(_post_owner, '00000000-0000-0000-0000-000000000000') THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        _parent_reply_owner,
        'forum_reply',
        'Nuova risposta al tuo commento',
        _replier_name || ' ha risposto al tuo commento',
        '/forum/' || NEW.post_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_forum_reply
AFTER INSERT ON public.forum_replies
FOR EACH ROW EXECUTE FUNCTION public.notify_forum_reply();

-- 5. Function to handle @mention notifications (called from edge function or client)
CREATE OR REPLACE FUNCTION public.notify_mention(_mentioner_id uuid, _mentioned_username text, _post_id uuid, _context text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mentioned_user_id uuid;
  _mentioner_name text;
BEGIN
  SELECT user_id INTO _mentioned_user_id
  FROM profiles WHERE LOWER(username) = LOWER(_mentioned_username) LIMIT 1;

  IF _mentioned_user_id IS NULL OR _mentioned_user_id = _mentioner_id THEN RETURN; END IF;

  SELECT COALESCE(display_name, username, 'Qualcuno') INTO _mentioner_name
  FROM profiles WHERE user_id = _mentioner_id LIMIT 1;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    _mentioned_user_id,
    'mention',
    'Sei stato menzionato!',
    _mentioner_name || ' ti ha menzionato in ' || _context,
    '/forum/' || _post_id
  );
END;
$$;
