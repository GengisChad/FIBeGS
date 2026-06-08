
-- Drop the duplicate trigger that causes double-counting
DROP TRIGGER IF EXISTS on_forum_reply_count ON public.forum_replies;

-- Fix existing wrong counts by recalculating from actual data
UPDATE public.forum_posts
SET replies_count = (
  SELECT COUNT(*) FROM public.forum_replies WHERE post_id = forum_posts.id
);
