
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function to auto-send push notifications
CREATE OR REPLACE FUNCTION public.trigger_auto_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_role_key text;
BEGIN
  -- Get config from environment via current_setting
  _supabase_url := rtrim(current_setting('app.settings.supabase_url', true), '/');
  _service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings not available, try direct config
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    RETURN NEW;
  END IF;

  -- Call the edge function asynchronously via pg_net
  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/auto-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'link', NEW.link
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS trg_auto_push_notification ON public.notifications;
CREATE TRIGGER trg_auto_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_push_notification();
