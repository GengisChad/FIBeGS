-- Add auto_publish_at column to tournaments
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS auto_publish_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_tournaments_auto_publish_at 
ON public.tournaments(auto_publish_at) 
WHERE is_hidden = true AND auto_publish_at IS NOT NULL;

-- Function to auto-publish hidden tournaments whose auto_publish_at has passed
CREATE OR REPLACE FUNCTION public.auto_publish_hidden_tournaments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tournaments
  SET is_hidden = false,
      auto_publish_at = NULL,
      updated_at = now()
  WHERE is_hidden = true
    AND auto_publish_at IS NOT NULL
    AND auto_publish_at <= now();
END;
$$;

-- Schedule the function via pg_cron (every minute)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('auto-publish-tournaments');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'auto-publish-tournaments',
      '* * * * *',
      $cron$SELECT public.auto_publish_hidden_tournaments();$cron$
    );
  END IF;
END $$;