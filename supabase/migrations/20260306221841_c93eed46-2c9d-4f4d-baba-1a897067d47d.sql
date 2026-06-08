-- Drop and recreate all triggers to ensure they exist
DROP TRIGGER IF EXISTS on_market_like_notify ON public.market_likes;
DROP TRIGGER IF EXISTS on_badge_earned_notify ON public.user_badges;
DROP TRIGGER IF EXISTS on_club_tournament_notify ON public.tournaments;
DROP TRIGGER IF EXISTS on_deck_report_notify ON public.deck_reports;
DROP TRIGGER IF EXISTS on_market_report_notify ON public.market_reports;
DROP TRIGGER IF EXISTS on_forum_reply_count ON public.forum_replies;
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
DROP TRIGGER IF EXISTS on_market_listing_updated ON public.market_listings;

CREATE TRIGGER on_market_like_notify
  AFTER INSERT ON public.market_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_market_like();

CREATE TRIGGER on_badge_earned_notify
  AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.notify_badge_earned();

CREATE TRIGGER on_club_tournament_notify
  AFTER INSERT ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.notify_club_tournament();

CREATE TRIGGER on_deck_report_notify
  AFTER INSERT ON public.deck_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_to_staff();

CREATE TRIGGER on_market_report_notify
  AFTER INSERT ON public.market_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_to_staff();

CREATE TRIGGER on_forum_reply_count
  AFTER INSERT OR DELETE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_post_replies_count();

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_market_listing_updated
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();