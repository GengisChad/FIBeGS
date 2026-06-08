
DROP TRIGGER IF EXISTS check_profanity_forum_posts ON public.forum_posts;
DROP TRIGGER IF EXISTS check_profanity_forum_replies ON public.forum_replies;
DROP TRIGGER IF EXISTS check_profanity_decks ON public.decks;
DROP TRIGGER IF EXISTS check_profanity_market_listings ON public.market_listings;
DROP TRIGGER IF EXISTS check_profanity_profiles ON public.profiles;
DROP FUNCTION IF EXISTS public.validate_no_profanity();
DROP FUNCTION IF EXISTS public.contains_profanity(text);
DROP FUNCTION IF EXISTS public.normalize_for_profanity(text);
