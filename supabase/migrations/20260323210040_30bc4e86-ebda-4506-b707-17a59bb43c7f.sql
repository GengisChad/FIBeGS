
-- Clean up existing duplicate market reports (keep the earliest one)
DELETE FROM public.market_reports WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY reporter_id, listing_id ORDER BY created_at ASC) as rn
    FROM public.market_reports WHERE status != 'dismissed'
  ) sub WHERE rn > 1
);

-- Clean up existing duplicate deck reports
DELETE FROM public.deck_reports WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY reporter_id, deck_id ORDER BY created_at ASC) as rn
    FROM public.deck_reports WHERE status != 'dismissed'
  ) sub WHERE rn > 1
);

-- Clean up existing duplicate forum reports (post)
DELETE FROM public.forum_reports WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY reporter_id, post_id ORDER BY created_at ASC) as rn
    FROM public.forum_reports WHERE post_id IS NOT NULL AND status != 'dismissed'
  ) sub WHERE rn > 1
);

-- Clean up existing duplicate forum reports (reply)
DELETE FROM public.forum_reports WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY reporter_id, reply_id ORDER BY created_at ASC) as rn
    FROM public.forum_reports WHERE reply_id IS NOT NULL AND status != 'dismissed'
  ) sub WHERE rn > 1
);

-- Now create unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_unique_post
ON public.forum_reports (reporter_id, post_id)
WHERE post_id IS NOT NULL AND status != 'dismissed';

CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_unique_reply
ON public.forum_reports (reporter_id, reply_id)
WHERE reply_id IS NOT NULL AND status != 'dismissed';

CREATE UNIQUE INDEX IF NOT EXISTS market_reports_unique_listing
ON public.market_reports (reporter_id, listing_id)
WHERE status != 'dismissed';

CREATE UNIQUE INDEX IF NOT EXISTS deck_reports_unique_deck
ON public.deck_reports (reporter_id, deck_id)
WHERE status != 'dismissed';
