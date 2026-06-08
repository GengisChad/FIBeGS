
-- Add 'staff' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- Allow admins to delete any tournament
CREATE POLICY "Admins can delete any tournament"
ON public.tournaments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any tournament
CREATE POLICY "Admins can update any tournament"
ON public.tournaments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all user_roles
CREATE POLICY "Admins can view all user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert user_roles
CREATE POLICY "Admins can insert user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update user_roles
CREATE POLICY "Admins can update user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete user_roles
CREATE POLICY "Admins can delete user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all profiles (already public, but ensure)
-- Allow admins to view all tournament_registrations (already public)

-- Allow admins to delete any tournament_registration
CREATE POLICY "Admins can delete any registration"
ON public.tournament_registrations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
