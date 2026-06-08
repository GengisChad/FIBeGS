CREATE OR REPLACE FUNCTION public.notify_private_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_recipient uuid;
  v_sender_name text;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocXh3Y25ueXFybGl6bG93dGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjE4ODAsImV4cCI6MjA5MTM5Nzg4MH0.r6YQZgfRIRSOGBiZCb7HvLR8cnpX3QXRlxR-owBdLO4';
  v_url text := 'https://zhqxwcnnyqrlizlowtgd.supabase.co/functions/v1/send-push-notification';
BEGIN
  SELECT CASE WHEN pc.user_a = NEW.sender_id THEN pc.user_b ELSE pc.user_a END
    INTO v_recipient
  FROM public.private_chats pc
  WHERE pc.id = NEW.chat_id
    AND (pc.user_a = NEW.sender_id OR pc.user_b = NEW.sender_id);

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'Qualcuno')
    INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, push_eligible, push_sent)
  VALUES (
    v_recipient,
    'private_message',
    COALESCE('Nuovo messaggio da ' || v_sender_name, 'Nuovo messaggio'),
    'Hai ricevuto un nuovo messaggio · apri la chat per leggerlo',
    '/?chat=' || NEW.chat_id::text || '&kind=private',
    true,
    false
  );

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'title', COALESCE('Nuovo messaggio da ' || v_sender_name, 'Nuovo messaggio'),
      'body', 'Hai ricevuto un nuovo messaggio',
      'data', jsonb_build_object(
        'type', 'private_message',
        'message_id', NEW.id::text,
        'chat_id', NEW.chat_id::text,
        'sender_id', NEW.sender_id::text,
        'link', '/?chat=' || NEW.chat_id::text || '&kind=private',
        'url', '/?chat=' || NEW.chat_id::text || '&kind=private'
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_private_message error: %', SQLERRM;
  RETURN NEW;
END;
$$;