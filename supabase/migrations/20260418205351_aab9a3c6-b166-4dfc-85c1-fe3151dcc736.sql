-- Stop the per-minute auto-push cron job to avoid backend overload
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'auto-push-notification-every-minute';