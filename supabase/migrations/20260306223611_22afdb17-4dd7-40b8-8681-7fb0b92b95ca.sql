CREATE POLICY "Admins can delete any notification"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any notification"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));