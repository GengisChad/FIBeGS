
-- Server-side profanity filter function
-- Uses the same normalization logic as the client-side filter
CREATE OR REPLACE FUNCTION public.normalize_for_profanity(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text;
  ch text;
  mapped text;
  i integer;
BEGIN
  result := lower(input_text);
  -- Strip HTML tags
  result := regexp_replace(result, '<[^>]+>', ' ', 'g');
  
  mapped := '';
  FOR i IN 1..char_length(result) LOOP
    ch := substring(result FROM i FOR 1);
    -- Character substitution map
    CASE ch
      WHEN '0' THEN mapped := mapped || 'o';
      WHEN '1' THEN mapped := mapped || 'i';
      WHEN '2' THEN mapped := mapped || 'z';
      WHEN '3' THEN mapped := mapped || 'e';
      WHEN '4' THEN mapped := mapped || 'a';
      WHEN '5' THEN mapped := mapped || 's';
      WHEN '6' THEN mapped := mapped || 'g';
      WHEN '7' THEN mapped := mapped || 't';
      WHEN '8' THEN mapped := mapped || 'b';
      WHEN '9' THEN mapped := mapped || 'g';
      WHEN '@' THEN mapped := mapped || 'a';
      WHEN '$' THEN mapped := mapped || 's';
      WHEN '!' THEN mapped := mapped || 'i';
      WHEN '|' THEN mapped := mapped || 'i';
      WHEN 'à','á','â','ã','ä' THEN mapped := mapped || 'a';
      WHEN 'è','é','ê','ë' THEN mapped := mapped || 'e';
      WHEN 'ì','í','î','ï' THEN mapped := mapped || 'i';
      WHEN 'ò','ó','ô','õ','ö' THEN mapped := mapped || 'o';
      WHEN 'ù','ú','û','ü' THEN mapped := mapped || 'u';
      WHEN 'ñ' THEN mapped := mapped || 'n';
      WHEN 'ç' THEN mapped := mapped || 'c';
      ELSE
        IF ch ~ '[a-z]' THEN
          mapped := mapped || ch;
        END IF;
    END CASE;
  END LOOP;
  
  RETURN mapped;
END;
$$;

-- Profanity check function
CREATE OR REPLACE FUNCTION public.contains_profanity(input_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text;
  reversed text;
  bad_words text[] := ARRAY[
    'cazzo','minchia','coglione','coglioni','stronzo','stronza','stronzi','stronze',
    'merda','merde','merdoso','merdosa','merdaccia',
    'vaffanculo','fanculo','affanculo',
    'puttana','puttane','puttaniere','puttanata','puttanate',
    'troia','troie','troione','troiata','troiate',
    'figliodiputtana','figlidiputtana',
    'culattone','culattoni',
    'cazzata','cazzate','cazzaro','cazzone','cazzoni',
    'cornuto','cornuta','cornuti',
    'bastardo','bastarda','bastardi','bastarde',
    'fottiti','fottere','fottuto','fottuta','fottuti','fottute',
    'pompino','pompini','pompinara',
    'inculare','inculata','inculato',
    'zoccola','zoccole','baldracca','baldracche',
    'mignotta','mignotte',
    'mongoloide','mongoloidi',
    'frocio','froci','frocetto',
    'ricchione','ricchioni',
    'porcodio','porcoddio','porcoiddio',
    'diocane','diobestia','dioboia','dioladro','dioporco','diomaiale',
    'diomerda','diocristo','diosanto',
    'madonnacane','madonnaputtana','madonnatroia','madonnaladra',
    'madonnamaiale','madonnaporco','madonnaporca',
    'cristaccio','cristoporco','cristocane',
    'porcamadonna','porcatroia','porcaeva',
    'porcaputtana',
    'pezzodimmerda','pezzodimerda',
    'testadicazzo','testadicicazzo',
    'rottodinculo','rottoinculo',
    'diopentito','dioinfame',
    'oddiocane','oddioporco'
  ];
  word text;
  norm_word text;
BEGIN
  normalized := normalize_for_profanity(input_text);
  reversed := reverse(normalized);
  
  FOREACH word IN ARRAY bad_words LOOP
    norm_word := normalize_for_profanity(word);
    IF position(norm_word IN normalized) > 0 THEN
      RETURN true;
    END IF;
    IF position(norm_word IN reversed) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;

-- Validation trigger function for profanity
CREATE OR REPLACE FUNCTION public.validate_no_profanity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  fields_to_check text[];
  field_name text;
  field_value text;
BEGIN
  -- Determine which fields to check based on the table
  CASE TG_TABLE_NAME
    WHEN 'forum_posts' THEN fields_to_check := ARRAY['title', 'content'];
    WHEN 'forum_replies' THEN fields_to_check := ARRAY['content'];
    WHEN 'decks' THEN fields_to_check := ARRAY['name', 'description'];
    WHEN 'market_listings' THEN fields_to_check := ARRAY['product_name'];
    WHEN 'profiles' THEN fields_to_check := ARRAY['display_name', 'bio', 'username'];
    ELSE fields_to_check := ARRAY[]::text[];
  END CASE;

  FOREACH field_name IN ARRAY fields_to_check LOOP
    EXECUTE format('SELECT ($1).%I::text', field_name) INTO field_value USING NEW;
    IF field_value IS NOT NULL AND contains_profanity(field_value) THEN
      RAISE EXCEPTION 'Il testo contiene linguaggio inappropriato. Per favore, mantieni un tono rispettoso.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Apply triggers
CREATE TRIGGER check_profanity_forum_posts
  BEFORE INSERT OR UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION validate_no_profanity();

CREATE TRIGGER check_profanity_forum_replies
  BEFORE INSERT OR UPDATE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION validate_no_profanity();

CREATE TRIGGER check_profanity_decks
  BEFORE INSERT OR UPDATE ON public.decks
  FOR EACH ROW EXECUTE FUNCTION validate_no_profanity();

CREATE TRIGGER check_profanity_market_listings
  BEFORE INSERT OR UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION validate_no_profanity();

CREATE TRIGGER check_profanity_profiles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION validate_no_profanity();
