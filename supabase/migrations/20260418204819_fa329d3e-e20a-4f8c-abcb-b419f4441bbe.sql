-- Replace the previous schedule with one that uses the project's anon key directly
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'auto-push-notification-every-minute';

SELECT cron.schedule(
  'auto-push-notification-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zhqxwcnnyqrlizlowtgd.supabase.co/functions/v1/auto-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocXh3Y25ueXFybGl6bG93dGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjE4ODAsImV4cCI6MjA5MTM5Nzg4MH0.r6YQZgfRIRSOGBiZCb7HvLR8cnpX3QXRlxR-owBdLO4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Trigger it once immediately to flush the backlog
SELECT net.http_post(
  url := 'https://zhqxwcnnyqrlizlowtgd.supabase.co/functions/v1/auto-push-notification',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocXh3Y25ueXFybGl6bG93dGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjE4ODAsImV4cCI6MjA5MTM5Nzg4MH0.r6YQZgfRIRSOGBiZCb7HvLR8cnpX3QXRlxR-owBdLO4"}'::jsonb,
  body := '{}'::jsonb
);