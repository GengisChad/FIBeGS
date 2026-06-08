
-- Allow admins to delete clubs
CREATE POLICY "Admins can delete clubs"
ON public.clubs FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
