-- Fix is_club_staff to include vice_leader role
CREATE OR REPLACE FUNCTION public.is_club_staff(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = _user_id
    AND club_id = _club_id
    AND role IN ('leader', 'vice_leader', 'staff')
  )
$$;