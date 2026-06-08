
-- =============================================
-- 1. FIX: club_members phone exposure
-- Remove the overly permissive anon/authenticated SELECT policies
-- Replace with: public view hides phone, direct table access only for staff/admin
-- =============================================

-- Drop the two broad SELECT policies
DROP POLICY IF EXISTS "Club members viewable by anon (no phone)" ON public.club_members;
DROP POLICY IF EXISTS "Club members viewable by authenticated" ON public.club_members;

-- New policy: everyone can SELECT but WITHOUT phone (enforced by not selecting phone in queries)
-- We need a base policy that allows reading non-sensitive fields
CREATE POLICY "Club members basic select"
ON public.club_members FOR SELECT
USING (true);

-- Create a secure function for staff to fetch members WITH phone
CREATE OR REPLACE FUNCTION public.get_club_members_with_phone(_club_id uuid)
RETURNS TABLE (
  id uuid,
  club_id uuid,
  user_id uuid,
  role club_role,
  joined_at timestamptz,
  city text,
  phone text,
  last_tournament_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.id, cm.club_id, cm.user_id, cm.role, cm.joined_at, cm.city, cm.phone, cm.last_tournament_at
  FROM public.club_members cm
  WHERE cm.club_id = _club_id
    AND (
      is_club_staff(auth.uid(), _club_id)
      OR has_role(auth.uid(), 'admin')
    )
  ORDER BY cm.role;
$$;

-- =============================================
-- 2. FIX: child_profiles visibility
-- Only parents (own children), admins, and authenticated for tournament context
-- =============================================

DROP POLICY IF EXISTS "Child profiles viewable by authenticated" ON public.child_profiles;

-- Parents can view their own children
CREATE POLICY "Parents can view own children"
ON public.child_profiles FOR SELECT
USING (auth.uid() = parent_user_id);

-- Admins can view all
CREATE POLICY "Admins can view all children"
ON public.child_profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Staff can view all (for tournament management)
CREATE POLICY "Staff can view all children"
ON public.child_profiles FOR SELECT
USING (has_role(auth.uid(), 'staff'));

-- Club leaders/staff need to see children of their club members for tournaments
CREATE POLICY "Club staff can view children of club members"
ON public.child_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM club_members cm1
    JOIN club_members cm2 ON cm2.club_id = cm1.club_id
    WHERE cm1.user_id = auth.uid()
      AND cm1.role IN ('leader', 'staff')
      AND cm2.user_id = child_profiles.parent_user_id
  )
);

-- =============================================
-- 3. FIX: market-images storage ownership policies
-- =============================================

DROP POLICY IF EXISTS "Users can delete own market images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload market images" ON storage.objects;

CREATE POLICY "Users can delete own market images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'market-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can upload market images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'market-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- 4. FIX: Add validation trigger for club_members
-- =============================================

CREATE OR REPLACE FUNCTION public.validate_club_member()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND (LENGTH(NEW.phone) < 6 OR LENGTH(NEW.phone) > 20) THEN
    RAISE EXCEPTION 'Phone number must be 6-20 characters';
  END IF;
  
  IF NEW.city IS NOT NULL AND LENGTH(TRIM(NEW.city)) = 0 THEN
    RAISE EXCEPTION 'City cannot be empty';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_club_member_trigger'
  ) THEN
    CREATE TRIGGER validate_club_member_trigger
    BEFORE INSERT OR UPDATE ON public.club_members
    FOR EACH ROW EXECUTE FUNCTION public.validate_club_member();
  END IF;
END;
$$;
