
-- 1) Add push_pending flag to notifications for batch processing
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent boolean NOT NULL DEFAULT false;

-- 2) Create index for efficient batch processing
CREATE INDEX IF NOT EXISTS idx_notifications_push_pending 
  ON public.notifications (push_sent, created_at) 
  WHERE push_sent = false;

-- 3) Remove the per-row trigger (too expensive at scale)
DROP TRIGGER IF EXISTS trg_auto_push_notification ON public.notifications;
DROP FUNCTION IF EXISTS public.trigger_auto_push_notification();
