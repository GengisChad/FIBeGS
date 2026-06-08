
-- =============================================
-- OPTIMIZATION 1: Trim battlepass_scores
-- Keep only top 5 per user (best score already in profiles.best_launch_speed)
-- Reduces ~450 rows to ~20
-- =============================================

-- Delete all but top 5 scores per user
DELETE FROM public.battlepass_scores
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY launch_speed DESC) as rn
    FROM public.battlepass_scores
  ) ranked
  WHERE rn <= 5
);

-- Auto-trim trigger: keep max 5 scores per user
CREATE OR REPLACE FUNCTION public.trim_battlepass_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM battlepass_scores
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY launch_speed DESC) as rn
      FROM battlepass_scores WHERE user_id = NEW.user_id
    ) ranked WHERE rn > 5
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trim_battlepass_scores
AFTER INSERT ON public.battlepass_scores
FOR EACH ROW EXECUTE FUNCTION public.trim_battlepass_scores();

-- =============================================
-- OPTIMIZATION 2: Remove redundant indexes
-- =============================================

-- idx_club_members_club_user is covered by unique constraint club_members_club_id_user_id_key
DROP INDEX IF EXISTS public.idx_club_members_club_user;

-- idx_battlepass_scores_user_id is covered by idx_battlepass_scores_speed (user_id, launch_speed DESC)
DROP INDEX IF EXISTS public.idx_battlepass_scores_user_id;

-- idx_championship_managers_championship_user is covered by unique constraint championship_managers_championship_id_user_id_key
DROP INDEX IF EXISTS public.idx_championship_managers_championship_user;

-- idx_deck_likes_user_deck is covered by unique constraint deck_likes_deck_id_user_id_key (covers both directions)
DROP INDEX IF EXISTS public.idx_deck_likes_user_deck;

-- idx_forum_post_likes_user_post is covered by unique constraint forum_post_likes_post_id_user_id_key
DROP INDEX IF EXISTS public.idx_forum_post_likes_user_post;

-- idx_forum_reply_likes_user_reply covered by forum_reply_likes unique constraints
DROP INDEX IF EXISTS public.idx_forum_reply_likes_user_reply;

-- idx_market_likes_user_listing covered by market_likes unique constraints
DROP INDEX IF EXISTS public.idx_market_likes_user_listing;

-- =============================================
-- OPTIMIZATION 3: Enhanced notification cleanup
-- Also clean unread notifications older than 90 days
-- =============================================

-- Update the cron job to also clean unread notifications >90 days
SELECT cron.unschedule('cleanup-old-read-notifications');

SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 4 * * *',
  $$
    DELETE FROM public.notifications WHERE is_read = true AND created_at < now() - interval '30 days';
    DELETE FROM public.notifications WHERE created_at < now() - interval '90 days';
  $$
);
