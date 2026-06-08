CREATE POLICY "Admins can delete any post"
ON public.forum_posts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any post"
ON public.forum_posts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));