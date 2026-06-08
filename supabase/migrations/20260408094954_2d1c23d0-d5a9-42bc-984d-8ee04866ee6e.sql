
-- 1. CRITICAL: user_roles composite index - eliminates 500K+ seq scans from has_role() in RLS
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles (user_id, role);

-- 2. deck_likes - 121K seq scans
CREATE INDEX IF NOT EXISTS idx_deck_likes_deck_id ON public.deck_likes (deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_likes_user_deck ON public.deck_likes (user_id, deck_id);

-- 3. tournaments - 106K seq scans
CREATE INDEX IF NOT EXISTS idx_tournaments_club_event ON public.tournaments (club_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_ranked_date ON public.tournaments (is_ranked, event_date DESC) WHERE is_ranked = true;

-- 4. ranking_seasons - 33K seq scans for 1 row
CREATE INDEX IF NOT EXISTS idx_ranking_seasons_active ON public.ranking_seasons (is_active) WHERE is_active = true;

-- 5. forum_posts - missing user_id index for RLS
CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON public.forum_posts (user_id);

-- 6. collection tables - high seq scans from catalog queries
CREATE INDEX IF NOT EXISTS idx_collection_components_category ON public.collection_components (category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_collection_variants_component ON public.collection_component_variants (component_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_collection_stats_component ON public.collection_component_stats (component_id, stat_order);

-- 7. Drop unused indexes to save storage/IOPS
DROP INDEX IF EXISTS public.idx_notifications_push_pending;
DROP INDEX IF EXISTS public.idx_user_roles_user_id;
DROP INDEX IF EXISTS public.idx_forum_posts_created;
DROP INDEX IF EXISTS public.idx_forum_posts_category;
DROP INDEX IF EXISTS public.idx_forum_replies_post_id;
DROP INDEX IF EXISTS public.idx_collection_links_parent;
DROP INDEX IF EXISTS public.idx_variant_links_parent;
DROP INDEX IF EXISTS public.idx_championship_sponsors_championship;
DROP INDEX IF EXISTS public.idx_market_wanted_user;
