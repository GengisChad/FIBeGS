-- Fix duplicate badge notifications: keep only one trigger on user_badges
DROP TRIGGER IF EXISTS on_badge_earned_notify ON public.user_badges;
DROP TRIGGER IF EXISTS on_badge_earned ON public.user_badges;

CREATE TRIGGER on_badge_earned
AFTER INSERT ON public.user_badges
FOR EACH ROW
EXECUTE FUNCTION public.notify_badge_earned();

-- Optional cleanup: remove already duplicated badge notifications keeping one row
WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, type, title, message, created_at
      ORDER BY id
    ) AS rn
  FROM public.notifications
  WHERE type = 'badge_earned'
)
DELETE FROM public.notifications n
USING ranked_duplicates d
WHERE n.id = d.id
  AND d.rn > 1;