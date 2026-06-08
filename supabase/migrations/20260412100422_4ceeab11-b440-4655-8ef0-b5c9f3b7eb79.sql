
-- 1. Drop trigger first, then column
DROP TRIGGER IF EXISTS trg_sync_club_member_phone ON public.club_members;
ALTER TABLE public.club_members DROP COLUMN IF EXISTS phone;

-- 2. Fix profiles: remove anon read
DROP POLICY IF EXISTS "Profiles public read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles public read authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Authenticated can view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- 3. Fix feedback-attachments bucket
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname ILIKE '%feedback%'
    AND cmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Feedback attachments viewable by staff"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- 4. Fix contact_requests
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'contact_requests' AND schemaname = 'public'
    AND cmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contact_requests', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Only admin can view contact requests"
ON public.contact_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Fix battlepass_scores
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'battlepass_scores' AND schemaname = 'public'
    AND cmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.battlepass_scores', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can view battlepass scores"
ON public.battlepass_scores FOR SELECT TO authenticated
USING (true);

-- 6. Fix user_collection_data
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'user_collection_data' AND schemaname = 'public'
    AND cmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_collection_data', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can view collections"
ON public.user_collection_data FOR SELECT TO authenticated
USING (true);

-- 7. Fix tournament_registrations
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'tournament_registrations' AND schemaname = 'public'
    AND cmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tournament_registrations', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can view registrations"
ON public.tournament_registrations FOR SELECT TO authenticated
USING (true);

-- 8. Fix club_follows
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'club_follows' AND schemaname = 'public'
    AND cmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.club_follows', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can view club follows"
ON public.club_follows FOR SELECT TO authenticated
USING (true);
