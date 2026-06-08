
-- Feedback table
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update feedback (mark as read)
CREATE POLICY "Admins can update feedback" ON public.feedback
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback" ON public.feedback
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for feedback attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-attachments', 'feedback-attachments', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload feedback attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-attachments');

CREATE POLICY "Anyone can view feedback attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-attachments');

CREATE POLICY "Admins can delete feedback attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feedback-attachments' AND has_role(auth.uid(), 'admin'::app_role));
