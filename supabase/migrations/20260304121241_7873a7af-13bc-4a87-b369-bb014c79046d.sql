
-- Reset last_seen_at to NULL for all profiles so only users with active heartbeat show as online
UPDATE public.profiles SET last_seen_at = NULL;

-- Change default to NULL instead of now()
ALTER TABLE public.profiles ALTER COLUMN last_seen_at SET DEFAULT NULL;

-- Create a security definer function to get admin/staff user_ids (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_staff_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'staff');
$$;
