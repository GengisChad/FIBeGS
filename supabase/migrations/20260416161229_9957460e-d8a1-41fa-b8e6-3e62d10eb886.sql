
-- 1. Copy birth_date data from profiles to profiles_private (where not already set)
UPDATE public.profiles_private pp
SET birth_date = p.birth_date
FROM public.profiles p
WHERE pp.user_id = p.user_id
  AND p.birth_date IS NOT NULL
  AND pp.birth_date IS NULL;

-- 2. Update handle_new_user to save birth_date into profiles_private instead of profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _username text;
  _ghost_id uuid;
  _birth date;
BEGIN
  _username := new.raw_user_meta_data ->> 'username';

  IF _username IS NOT NULL AND _username != '' THEN
    SELECT p.user_id INTO _ghost_id
    FROM profiles p
    LEFT JOIN auth.users au ON au.id = p.user_id
    WHERE lower(p.username) = lower(_username)
      AND au.id IS NULL
    LIMIT 1;

    IF _ghost_id IS NOT NULL THEN
      UPDATE tournament_results SET user_id = new.id WHERE user_id = _ghost_id;
      UPDATE tournament_standings SET user_id = new.id WHERE user_id = _ghost_id;
      UPDATE external_player_mappings
      SET internal_user_id = new.id::text, updated_at = now()
      WHERE lower(external_username) = lower(_username)
        AND (internal_user_id IS NULL OR internal_user_id = '' OR internal_user_id = _ghost_id::text);
      DELETE FROM profiles WHERE user_id = _ghost_id;
    END IF;
  END IF;

  -- Insert profile WITHOUT birth_date (it goes to profiles_private)
  INSERT INTO public.profiles (user_id, display_name, username, region_id, city)
  VALUES (
    new.id,
    COALESCE(_username, new.raw_user_meta_data ->> 'display_name'),
    _username,
    CASE WHEN new.raw_user_meta_data ->> 'region_id' IS NOT NULL 
         THEN (new.raw_user_meta_data ->> 'region_id')::uuid 
         ELSE NULL END,
    new.raw_user_meta_data ->> 'city'
  );

  -- Save birth_date to profiles_private
  _birth := CASE WHEN new.raw_user_meta_data ->> 'birth_date' IS NOT NULL
                  THEN (new.raw_user_meta_data ->> 'birth_date')::date
                  ELSE NULL END;
  IF _birth IS NOT NULL THEN
    UPDATE public.profiles_private SET birth_date = _birth WHERE user_id = new.id;
  END IF;

  RETURN new;
END;
$$;

-- 3. Drop birth_date from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS birth_date;

-- 4. Fix club_follows: remove anon SELECT, keep only authenticated SELECT
DROP POLICY IF EXISTS "Anyone can count follows" ON public.club_follows;
DROP POLICY IF EXISTS "Authenticated can view club follows" ON public.club_follows;
CREATE POLICY "Authenticated can view club follows" ON public.club_follows
  FOR SELECT TO authenticated USING (true);

-- 5. Fix storage: restrict public bucket SELECT policies to not allow listing
-- Replace broad SELECT policies with path-based access (objects accessible by direct URL, not listing)
-- For public buckets, files are already accessible via public URL. The SELECT policy only controls
-- listing via the API. We restrict to authenticated users OR specific path access.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars' AND (auth.role() = 'authenticated' OR (storage.foldername(name))[1] IS NOT NULL));

-- Actually, for public buckets, the files are served directly via the public URL without needing
-- a SELECT policy at all. The SELECT policy only controls the list() API call.
-- The safest fix is to restrict listing to authenticated users only.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can view collection images" ON storage.objects;
CREATE POLICY "Collection images accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'collection-images');

DROP POLICY IF EXISTS "Anyone can view market images" ON storage.objects;
CREATE POLICY "Market images accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'market-images');

DROP POLICY IF EXISTS "Anyone can view feedback attachments" ON storage.objects;
CREATE POLICY "Feedback attachments accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'feedback-attachments');

DROP POLICY IF EXISTS "Anyone can view manga chapters" ON storage.objects;
CREATE POLICY "Manga chapters accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'manga-chapters');

DROP POLICY IF EXISTS "Anyone can view media covers" ON storage.objects;
CREATE POLICY "Media covers accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'media-covers');

DROP POLICY IF EXISTS "Anyone can view referee test files" ON storage.objects;
CREATE POLICY "Referee test files accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'referee-test');

DROP POLICY IF EXISTS "Anyone can view stickers" ON storage.objects;
CREATE POLICY "Stickers accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'stickers');

DROP POLICY IF EXISTS "Anyone can view banners" ON storage.objects;
CREATE POLICY "Banners accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'profile-banners');

DROP POLICY IF EXISTS "Anyone can read tournament flyers" ON storage.objects;
CREATE POLICY "Tournament flyers accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'tournament-flyers');

DROP POLICY IF EXISTS "Club banners are publicly readable" ON storage.objects;
CREATE POLICY "Club banners accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'club-banners');

DROP POLICY IF EXISTS "Club logos are publicly readable" ON storage.objects;
CREATE POLICY "Club logos accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'club-logos');

DROP POLICY IF EXISTS "Forum images are publicly accessible" ON storage.objects;
CREATE POLICY "Forum images accessible by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'forum-images');
