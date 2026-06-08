
-- Add is_products_only flag to collection_categories
ALTER TABLE public.collection_categories ADD COLUMN is_products_only boolean NOT NULL DEFAULT false;

-- Club order sessions
CREATE TABLE public.club_order_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  deadline timestamptz,
  is_open boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_order_sessions ENABLE ROW LEVEL SECURITY;

-- Club order products (items in a session)
CREATE TABLE public.club_order_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.club_order_sessions(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.collection_components(id),
  price numeric NOT NULL DEFAULT 0,
  quantity_available int NOT NULL DEFAULT 0,
  is_shipped boolean NOT NULL DEFAULT false,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_order_products ENABLE ROW LEVEL SECURITY;

-- Club order reservations (member bookings)
CREATE TABLE public.club_order_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_product_id uuid NOT NULL REFERENCES public.club_order_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  is_paid boolean NOT NULL DEFAULT false,
  is_picked_up boolean NOT NULL DEFAULT false,
  is_cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_order_reservations ENABLE ROW LEVEL SECURITY;

-- RLS for club_order_sessions
-- Read: club members can see their club's sessions
CREATE POLICY "Club members can view sessions" ON public.club_order_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.club_members WHERE club_id = club_order_sessions.club_id AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Insert: club staff or admin
CREATE POLICY "Club staff can create sessions" ON public.club_order_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_club_staff(auth.uid(), club_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Update: club staff or admin
CREATE POLICY "Club staff can update sessions" ON public.club_order_sessions
  FOR UPDATE TO authenticated
  USING (
    public.is_club_staff(auth.uid(), club_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Delete: club staff or admin
CREATE POLICY "Club staff can delete sessions" ON public.club_order_sessions
  FOR DELETE TO authenticated
  USING (
    public.is_club_staff(auth.uid(), club_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- RLS for club_order_products
-- Read: club members via session
CREATE POLICY "Club members can view order products" ON public.club_order_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_order_sessions s
      JOIN public.club_members cm ON cm.club_id = s.club_id
      WHERE s.id = club_order_products.session_id AND cm.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Insert: club staff
CREATE POLICY "Club staff can add order products" ON public.club_order_products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_order_sessions s
      WHERE s.id = club_order_products.session_id
      AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Update: club staff
CREATE POLICY "Club staff can update order products" ON public.club_order_products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_order_sessions s
      WHERE s.id = club_order_products.session_id
      AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Delete: club staff
CREATE POLICY "Club staff can delete order products" ON public.club_order_products
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_order_sessions s
      WHERE s.id = club_order_products.session_id
      AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- RLS for club_order_reservations
-- Read: own or club staff
CREATE POLICY "Members can view own reservations" ON public.club_order_reservations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_order_products p
      JOIN public.club_order_sessions s ON s.id = p.session_id
      WHERE p.id = club_order_reservations.order_product_id
      AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Insert: club members (own)
CREATE POLICY "Members can create reservations" ON public.club_order_reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.club_order_products p
      JOIN public.club_order_sessions s ON s.id = p.session_id
      JOIN public.club_members cm ON cm.club_id = s.club_id
      WHERE p.id = club_order_reservations.order_product_id
      AND cm.user_id = auth.uid()
      AND s.is_open = true
    )
  );

-- Update: own or club staff
CREATE POLICY "Members and staff can update reservations" ON public.club_order_reservations
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_order_products p
      JOIN public.club_order_sessions s ON s.id = p.session_id
      WHERE p.id = club_order_reservations.order_product_id
      AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Delete: own (if not cancelled) or club staff
CREATE POLICY "Members and staff can delete reservations" ON public.club_order_reservations
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_order_products p
      JOIN public.club_order_sessions s ON s.id = p.session_id
      WHERE p.id = club_order_reservations.order_product_id
      AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );
