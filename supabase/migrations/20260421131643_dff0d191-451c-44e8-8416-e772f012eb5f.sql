-- Cleanup: mark old pending push notifications (>24h) as sent to clear the backlog
UPDATE public.notifications
SET push_sent = true
WHERE push_eligible = true
  AND push_sent = false
  AND created_at < (now() - interval '24 hours');