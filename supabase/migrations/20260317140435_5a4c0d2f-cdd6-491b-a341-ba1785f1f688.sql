
-- Performance indexes for high-traffic queries

-- Notifications: user lookup (already filtered by user_id in every query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON public.notifications (user_id, is_read, created_at DESC);

-- Profiles: points ranking (homepage leaderboard)
CREATE INDEX IF NOT EXISTS idx_profiles_points_ranking 
  ON public.profiles (points DESC) 
  WHERE points > 0;

-- Child profiles: points ranking
CREATE INDEX IF NOT EXISTS idx_child_profiles_points_ranking 
  ON public.child_profiles (points DESC) 
  WHERE points > 0;

-- Tournaments: upcoming events listing
CREATE INDEX IF NOT EXISTS idx_tournaments_event_date 
  ON public.tournaments (event_date DESC, status);

-- Forum posts: latest posts for homepage
CREATE INDEX IF NOT EXISTS idx_forum_posts_created 
  ON public.forum_posts (created_at DESC);

-- Market listings: active listings
CREATE INDEX IF NOT EXISTS idx_market_listings_created 
  ON public.market_listings (created_at DESC);

-- Club members: user club lookup
CREATE INDEX IF NOT EXISTS idx_club_members_user 
  ON public.club_members (user_id, club_id);

-- Push subscriptions: user lookup for batch push
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
  ON public.push_subscriptions (user_id);

-- Tournament registrations: count queries
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament_status 
  ON public.tournament_registrations (tournament_id, status);
