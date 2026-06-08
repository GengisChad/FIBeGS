-- Fix club_member_phones INSERT policy
DROP POLICY IF EXISTS "Users can insert their own phone" ON public.club_member_phones;
CREATE POLICY "Authed users can insert their own phone"
  ON public.club_member_phones FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix club_follows: remove anon SELECT
DROP POLICY IF EXISTS "Anyone can view club follows" ON public.club_follows;
DROP POLICY IF EXISTS "Club follows are viewable by everyone" ON public.club_follows;

-- Fix profiles INSERT
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Authed users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix feedback-attachments storage
DROP POLICY IF EXISTS "Authenticated users can upload feedback attachments" ON storage.objects;
CREATE POLICY "Scoped feedback attachment uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);