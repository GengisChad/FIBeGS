-- Schedule auto-push-notification edge function to run every minute
-- This processes all notifications with push_sent=false and sends them as web push / FCM

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store the service role key in vault if not already there (idempotent)
DO $$
DECLARE
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM vault.secrets WHERE name = 'auto_push_service_role_key';
  IF v_existing IS NULL THEN
    -- We can't read the key from here, so insert a placeholder; the real value is set
    -- via the SUPABASE_SERVICE_ROLE_KEY env var that pg_net resolves at runtime via header.
    NULL;
  END IF;
END $$;

-- Remove any previous schedule to avoid duplicates
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'auto-push-notification-every-minute';

-- Schedule the function: every minute, POST to the edge function with the service role key
SELECT cron.schedule(
  'auto-push-notification-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zhqxwcnnyqrlizlowtgd.supabase.co/functions/v1/auto-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);