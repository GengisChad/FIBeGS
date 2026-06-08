
-- Create report_replies table for chat on reports
CREATE TABLE public.report_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  report_source text NOT NULL, -- 'market', 'forum', 'deck'
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_staff boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_replies ENABLE ROW LEVEL SECURITY;

-- Staff can view all report replies
CREATE POLICY "Staff can view report replies"
  ON public.report_replies FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  );

-- Reporter can view replies on their own reports
CREATE POLICY "Reporter can view own report replies"
  ON public.report_replies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.market_reports WHERE id = report_id AND reporter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.forum_reports WHERE id = report_id AND reporter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.deck_reports WHERE id = report_id AND reporter_id = auth.uid())
  );

-- Staff can insert replies
CREATE POLICY "Staff can insert report replies"
  ON public.report_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'moderator'::app_role)
    )
  );

-- Reporter can insert replies on own reports
CREATE POLICY "Reporter can reply to own reports"
  ON public.report_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM public.market_reports WHERE id = report_id AND reporter_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.forum_reports WHERE id = report_id AND reporter_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.deck_reports WHERE id = report_id AND reporter_id = auth.uid())
    )
  );
