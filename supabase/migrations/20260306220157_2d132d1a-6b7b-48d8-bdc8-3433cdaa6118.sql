
-- Create trigger for market like notifications
CREATE TRIGGER on_market_like_notify
  AFTER INSERT ON public.market_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_market_like();
