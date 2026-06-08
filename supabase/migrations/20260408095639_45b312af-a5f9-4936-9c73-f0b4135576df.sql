
-- =====================================================
-- 1. REMOVE DUPLICATE user_roles SELECT POLICY
-- =====================================================
DROP POLICY IF EXISTS "User roles viewable by owner" ON public.user_roles;

-- =====================================================
-- 2. REMOVE REDUNDANT child_profiles SELECT POLICY
-- Staff are always club members, so "Club members can view" already covers them
-- =====================================================
DROP POLICY IF EXISTS "Club staff can view children of club members" ON public.child_profiles;

-- =====================================================
-- 3. INDEX for club_links (used by get_linked_club_ids, are_clubs_linked)
-- These functions are called by is_member_or_linked/is_staff_or_linked
-- which appear in many RLS policies for club orders
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_club_links_accepted_clubs 
  ON public.club_links (requester_club_id, target_club_id) 
  WHERE status = 'accepted';

-- =====================================================
-- 4. STORAGE BUCKET FILE SIZE LIMITS
-- Prevent storage abuse - no limits currently set on 12/13 buckets
-- =====================================================
UPDATE storage.buckets SET file_size_limit = 2097152 WHERE name = 'avatars' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE name = 'club-banners' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE name = 'club-logos' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE name = 'collection-images' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE name = 'feedback-attachments' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE name = 'forum-images' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 10485760 WHERE name = 'manga-chapters' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE name = 'market-images' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE name = 'media-covers' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 2097152 WHERE name = 'profile-banners' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 2097152 WHERE name = 'referee-test' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 1048576 WHERE name = 'stickers' AND file_size_limit IS NULL;

-- =====================================================
-- 5. CLEANUP OLD READ NOTIFICATIONS (free ~1.5MB)
-- =====================================================
DELETE FROM public.notifications 
WHERE is_read = true AND created_at < now() - interval '7 days';
