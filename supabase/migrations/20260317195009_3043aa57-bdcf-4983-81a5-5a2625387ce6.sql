
-- Contact requests table
CREATE TABLE public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contact requests"
  ON public.contact_requests FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Admins can manage contact requests"
  ON public.contact_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view contact requests"
  ON public.contact_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

-- Staff members table
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  roles text[] NOT NULL DEFAULT '{}',
  title text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active staff members"
  ON public.staff_members FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage staff members"
  ON public.staff_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
