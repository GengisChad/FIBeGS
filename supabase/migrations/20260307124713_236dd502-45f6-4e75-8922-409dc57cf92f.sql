
CREATE TABLE public.ticket_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  ticket_type text NOT NULL, -- 'feedback' or 'report'
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticket_id, ticket_type)
);

ALTER TABLE public.ticket_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own read status"
ON public.ticket_read_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own read status"
ON public.ticket_read_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own read status"
ON public.ticket_read_status FOR UPDATE
USING (auth.uid() = user_id);
