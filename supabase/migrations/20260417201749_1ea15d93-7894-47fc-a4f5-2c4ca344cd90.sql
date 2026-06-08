-- Create credential help requests table
CREATE TABLE public.credential_help_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'apple_id_login',
  username TEXT NOT NULL,
  new_email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  matched_user_id UUID,
  handled_by UUID,
  handled_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credential_help_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_credential_help_requests_status ON public.credential_help_requests(status, created_at DESC);

ALTER TABLE public.credential_help_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can submit a request
CREATE POLICY "Anyone can submit credential help requests"
  ON public.credential_help_requests
  FOR INSERT
  WITH CHECK (true);

-- Only admin/staff can view
CREATE POLICY "Staff can view credential help requests"
  ON public.credential_help_requests
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Only admin/staff can update
CREATE POLICY "Staff can update credential help requests"
  ON public.credential_help_requests
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Only admin can delete
CREATE POLICY "Admin can delete credential help requests"
  ON public.credential_help_requests
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_credential_help_requests_updated_at
  BEFORE UPDATE ON public.credential_help_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();