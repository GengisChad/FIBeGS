
-- Add status to feedback table
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

-- Create feedback_replies table for chat
CREATE TABLE public.feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_staff boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;

-- Users can see replies on their own feedback
CREATE POLICY "Users can view replies on own feedback"
  ON public.feedback_replies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  );

-- Users can insert replies on their own feedback
CREATE POLICY "Users can reply to own feedback"
  ON public.feedback_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'moderator'::app_role)
    )
  );

-- Staff can insert replies
CREATE POLICY "Staff can reply to feedback"
  ON public.feedback_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'moderator'::app_role)
    )
  );

-- Allow users to update their own feedback status
CREATE POLICY "Users can update own feedback status"
  ON public.feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
