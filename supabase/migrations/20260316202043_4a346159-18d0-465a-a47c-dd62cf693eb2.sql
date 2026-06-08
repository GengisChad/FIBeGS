CREATE POLICY "Users can remove own parent role"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND role = 'parent'::app_role
);