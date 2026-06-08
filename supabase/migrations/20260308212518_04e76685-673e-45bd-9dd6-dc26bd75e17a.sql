
-- ============================================================
-- PERFORMANCE INDEXES: Optimize the most frequently queried columns
-- ============================================================

-- Tournament registrations: heavily queried by tournament_id + status, and by user_id
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament_status 
ON public.tournament_registrations (tournament_id, status);

CREATE INDEX IF NOT EXISTS idx_tournament_registrations_user_id 
ON public.tournament_registrations (user_id);

-- Tournament results: queried by (tournament_id, user_id) for upserts and by user_id for rankings
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_results_tournament_user 
ON public.tournament_results (tournament_id, user_id);

-- Tournaments: filtered by status + is_active constantly, and by championship_id
CREATE INDEX IF NOT EXISTS idx_tournaments_status_active 
ON public.tournaments (status, is_active);

CREATE INDEX IF NOT EXISTS idx_tournaments_championship_id 
ON public.tournaments (championship_id) WHERE championship_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_club_id 
ON public.tournaments (club_id) WHERE club_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_event_date 
ON public.tournaments (event_date);

-- Championship sponsors: queried by championship_id
CREATE INDEX IF NOT EXISTS idx_championship_sponsors_championship 
ON public.championship_sponsors (championship_id);

-- Championship managers: queried in RLS policies (critical for performance)
CREATE INDEX IF NOT EXISTS idx_championship_managers_championship_user 
ON public.championship_managers (championship_id, user_id);

-- Forum post likes: queried by user_id + post_id
CREATE INDEX IF NOT EXISTS idx_forum_post_likes_user_post 
ON public.forum_post_likes (user_id, post_id);

-- Forum reply likes: queried by user_id + reply_id
CREATE INDEX IF NOT EXISTS idx_forum_reply_likes_user_reply 
ON public.forum_reply_likes (user_id, reply_id);

-- Market likes: queried by user_id + listing_id
CREATE INDEX IF NOT EXISTS idx_market_likes_user_listing 
ON public.market_likes (user_id, listing_id);

-- Deck likes: queried by user_id + deck_id
CREATE INDEX IF NOT EXISTS idx_deck_likes_user_deck 
ON public.deck_likes (user_id, deck_id);

-- Profiles: queried by city for map, by region_id for regional rankings
CREATE INDEX IF NOT EXISTS idx_profiles_city 
ON public.profiles (city) WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_region_id 
ON public.profiles (region_id) WHERE region_id IS NOT NULL;

-- User roles: RLS security definer function queries this heavily
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON public.user_roles (user_id, role);

-- Club members: RLS policies check club_id + user_id + role
CREATE INDEX IF NOT EXISTS idx_club_members_club_user_role 
ON public.club_members (club_id, user_id, role);

-- Notifications: queried by user_id ordered by created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_desc 
ON public.notifications (user_id, created_at DESC);

-- Child profiles: queried by parent_user_id
CREATE INDEX IF NOT EXISTS idx_child_profiles_parent 
ON public.child_profiles (parent_user_id);

-- User collection: queried by user_id for collection page
CREATE INDEX IF NOT EXISTS idx_user_collection_user_component 
ON public.user_collection (user_id, component_id);

-- Forum posts: queried by user_id for profile pages
CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id 
ON public.forum_posts (user_id);

-- Market listings: queried by user_id
CREATE INDEX IF NOT EXISTS idx_market_listings_user_id 
ON public.market_listings (user_id);

-- Deck beyblade components: queried by deck_beyblade_id
CREATE INDEX IF NOT EXISTS idx_deck_beyblade_components_beyblade 
ON public.deck_beyblade_components (deck_beyblade_id);

-- Deck beyblades: queried by deck_id
CREATE INDEX IF NOT EXISTS idx_deck_beyblades_deck_id 
ON public.deck_beyblades (deck_id);

-- Decks: queried by user_id
CREATE INDEX IF NOT EXISTS idx_decks_user_id 
ON public.decks (user_id);

-- Push subscriptions: queried by user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON public.push_subscriptions (user_id);

-- User badges: queried by user_id
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id 
ON public.user_badges (user_id);

-- Collection component stats: queried by component_id
CREATE INDEX IF NOT EXISTS idx_collection_stats_component 
ON public.collection_component_stats (component_id);

-- Collection component links: queried by parent_component_id
CREATE INDEX IF NOT EXISTS idx_collection_links_parent 
ON public.collection_component_links (parent_component_id);

-- Variant links: queried by parent_variant_id
CREATE INDEX IF NOT EXISTS idx_variant_links_parent 
ON public.collection_variant_links (parent_variant_id);
