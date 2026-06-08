
-- Validation trigger for forum_posts
CREATE OR REPLACE FUNCTION public.validate_forum_post()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF char_length(NEW.title) < 3 OR char_length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;
  IF char_length(NEW.content) < 10 OR char_length(NEW.content) > 50000 THEN
    RAISE EXCEPTION 'Content must be between 10 and 50000 characters';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_forum_post
  BEFORE INSERT OR UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.validate_forum_post();

-- Validation trigger for profiles
CREATE OR REPLACE FUNCTION public.validate_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.display_name IS NOT NULL AND (char_length(NEW.display_name) < 1 OR char_length(NEW.display_name) > 60) THEN
    RAISE EXCEPTION 'Display name must be between 1 and 60 characters';
  END IF;
  IF NEW.bio IS NOT NULL AND char_length(NEW.bio) > 500 THEN
    RAISE EXCEPTION 'Bio must be at most 500 characters';
  END IF;
  IF NEW.username IS NOT NULL AND (char_length(NEW.username) < 3 OR char_length(NEW.username) > 30) THEN
    RAISE EXCEPTION 'Username must be between 3 and 30 characters';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_profile
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile();

-- Validation trigger for market_listings
CREATE OR REPLACE FUNCTION public.validate_market_listing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF char_length(NEW.product_name) < 2 OR char_length(NEW.product_name) > 200 THEN
    RAISE EXCEPTION 'Product name must be between 2 and 200 characters';
  END IF;
  IF NEW.price IS NOT NULL AND (NEW.price < 0 OR NEW.price > 99999) THEN
    RAISE EXCEPTION 'Price must be between 0 and 99999';
  END IF;
  IF NEW.shipping_cost IS NOT NULL AND (NEW.shipping_cost < 0 OR NEW.shipping_cost > 999) THEN
    RAISE EXCEPTION 'Shipping cost must be between 0 and 999';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_market_listing
  BEFORE INSERT OR UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION public.validate_market_listing();

-- Validation trigger for tournaments
CREATE OR REPLACE FUNCTION public.validate_tournament()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF char_length(NEW.title) < 3 OR char_length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;
  IF char_length(NEW.location) < 3 OR char_length(NEW.location) > 300 THEN
    RAISE EXCEPTION 'Location must be between 3 and 300 characters';
  END IF;
  IF NEW.description IS NOT NULL AND char_length(NEW.description) > 5000 THEN
    RAISE EXCEPTION 'Description must be at most 5000 characters';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tournament
  BEFORE INSERT OR UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.validate_tournament();

-- Validation trigger for forum_replies
CREATE OR REPLACE FUNCTION public.validate_forum_reply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF char_length(NEW.content) < 1 OR char_length(NEW.content) > 10000 THEN
    RAISE EXCEPTION 'Reply content must be between 1 and 10000 characters';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_forum_reply
  BEFORE INSERT OR UPDATE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.validate_forum_reply();
