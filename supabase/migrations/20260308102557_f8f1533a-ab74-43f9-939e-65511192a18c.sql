
-- Rankings: profiles sorted by points
CREATE INDEX IF NOT EXISTS idx_profiles_points_desc ON public.profiles (points DESC NULLS LAST);

-- Profile lookups by username
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));

-- Profile lookups by user_id (most common join)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- Tournament registrations: frequently filtered by tournament_id + status
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament_status ON public.tournament_registrations (tournament_id, status);

-- Tournament matches: filtered by tournament_id
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON public.tournament_matches (tournament_id);

-- Tournament standings: filtered by tournament_id, sorted by points/resistance
CREATE INDEX IF NOT EXISTS idx_tournament_standings_tournament_points ON public.tournament_standings (tournament_id, points DESC, resistance DESC);

-- Tournament results: used for ranking calculation
CREATE INDEX IF NOT EXISTS idx_tournament_results_user_id ON public.tournament_results (user_id);

-- User collection: filtered by user_id
CREATE INDEX IF NOT EXISTS idx_user_collection_user_id ON public.user_collection (user_id);

-- Collection components: filtered by category, sorted by sort_order
CREATE INDEX IF NOT EXISTS idx_collection_components_category_sort ON public.collection_components (category_id, sort_order);

-- Collection variants: filtered by component_id
CREATE INDEX IF NOT EXISTS idx_collection_variants_component_id ON public.collection_component_variants (component_id);

-- Municipalities: filtered by region_id (for rankings region filter)
CREATE INDEX IF NOT EXISTS idx_municipalities_region_id ON public.municipalities (region_id);

-- Ranking snapshots: filtered by season_id, sorted by rank
CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_season_rank ON public.ranking_snapshots (season_id, final_rank);

-- Forum posts: sorted by created_at, filtered by category
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON public.forum_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON public.forum_posts (category);

-- Forum replies: filtered by post_id
CREATE INDEX IF NOT EXISTS idx_forum_replies_post_id ON public.forum_replies (post_id);

-- Club members: filtered by club_id and user_id
CREATE INDEX IF NOT EXISTS idx_club_members_club_user ON public.club_members (club_id, user_id);

-- Notifications: filtered by user_id, sorted by created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- User roles: filtered by user_id
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);

-- Market listings: sorted by created_at
CREATE INDEX IF NOT EXISTS idx_market_listings_created ON public.market_listings (created_at DESC);
