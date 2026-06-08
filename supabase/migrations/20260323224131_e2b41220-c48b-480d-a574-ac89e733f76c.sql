
-- Club links table
CREATE TABLE public.club_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  target_club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  requested_by uuid NOT NULL,
  responded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_links_no_self CHECK (requester_club_id != target_club_id),
  UNIQUE (requester_club_id, target_club_id)
);

ALTER TABLE public.club_links ENABLE ROW LEVEL SECURITY;

-- SELECT: members of either club can see the link
CREATE POLICY "Members can view club links" ON public.club_links
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM club_members cm WHERE cm.user_id = auth.uid() AND (cm.club_id = requester_club_id OR cm.club_id = target_club_id))
  OR has_role(auth.uid(), 'admin')
);

-- INSERT: only leaders of requester club
CREATE POLICY "Leaders can request links" ON public.club_links
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND has_club_role(auth.uid(), requester_club_id, 'leader')
);

-- UPDATE: leaders of target club can accept/reject, leaders of requester can also update
CREATE POLICY "Leaders can update links" ON public.club_links
FOR UPDATE TO authenticated
USING (
  has_club_role(auth.uid(), target_club_id, 'leader')
  OR has_club_role(auth.uid(), requester_club_id, 'leader')
  OR has_role(auth.uid(), 'admin')
);

-- DELETE: leaders of either club can remove accepted links
CREATE POLICY "Leaders can delete links" ON public.club_links
FOR DELETE TO authenticated
USING (
  has_club_role(auth.uid(), requester_club_id, 'leader')
  OR has_club_role(auth.uid(), target_club_id, 'leader')
  OR has_role(auth.uid(), 'admin')
);

-- Helper function: check if two clubs are linked
CREATE OR REPLACE FUNCTION public.are_clubs_linked(_club_id_a uuid, _club_id_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_links
    WHERE status = 'accepted'
    AND (
      (requester_club_id = _club_id_a AND target_club_id = _club_id_b)
      OR (requester_club_id = _club_id_b AND target_club_id = _club_id_a)
    )
  );
$$;

-- Helper function: get all linked club ids for a given club
CREATE OR REPLACE FUNCTION public.get_linked_club_ids(_club_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE WHEN requester_club_id = _club_id THEN target_club_id ELSE requester_club_id END
  FROM public.club_links
  WHERE status = 'accepted'
  AND (requester_club_id = _club_id OR target_club_id = _club_id);
$$;

-- Helper: check if user is member of club or any linked club
CREATE OR REPLACE FUNCTION public.is_member_or_linked(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.user_id = _user_id
    AND (
      cm.club_id = _club_id
      OR cm.club_id IN (SELECT get_linked_club_ids(_club_id))
    )
  );
$$;

-- Helper: check if user is staff of club or any linked club
CREATE OR REPLACE FUNCTION public.is_staff_or_linked(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.user_id = _user_id
    AND cm.role IN ('leader', 'vice_leader', 'staff')
    AND (
      cm.club_id = _club_id
      OR cm.club_id IN (SELECT get_linked_club_ids(_club_id))
    )
  );
$$;

-- Now update RLS policies on order tables to support linked clubs

-- club_order_sessions: SELECT - add linked club members
DROP POLICY IF EXISTS "Club members can view sessions" ON public.club_order_sessions;
CREATE POLICY "Club members can view sessions" ON public.club_order_sessions
FOR SELECT TO authenticated
USING (
  is_member_or_linked(auth.uid(), club_id)
  OR has_role(auth.uid(), 'admin')
);

-- club_order_sessions: INSERT - staff of own or linked club
DROP POLICY IF EXISTS "Club staff can create sessions" ON public.club_order_sessions;
CREATE POLICY "Club staff can create sessions" ON public.club_order_sessions
FOR INSERT TO authenticated
WITH CHECK (
  is_club_staff(auth.uid(), club_id)
  OR has_role(auth.uid(), 'admin')
);

-- club_order_sessions: UPDATE - staff of own or linked club
DROP POLICY IF EXISTS "Club staff can update sessions" ON public.club_order_sessions;
CREATE POLICY "Club staff can update sessions" ON public.club_order_sessions
FOR UPDATE TO authenticated
USING (
  is_club_staff(auth.uid(), club_id)
  OR has_role(auth.uid(), 'admin')
);

-- club_order_sessions: DELETE - keep same (only own club staff)
DROP POLICY IF EXISTS "Club staff can delete sessions" ON public.club_order_sessions;
CREATE POLICY "Club staff can delete sessions" ON public.club_order_sessions
FOR DELETE TO authenticated
USING (
  is_club_staff(auth.uid(), club_id)
  OR has_role(auth.uid(), 'admin')
);

-- club_order_products: SELECT - members of own or linked club
DROP POLICY IF EXISTS "Club members can view order products" ON public.club_order_products;
CREATE POLICY "Club members can view order products" ON public.club_order_products
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM club_order_sessions s
    WHERE s.id = club_order_products.session_id
    AND (is_member_or_linked(auth.uid(), s.club_id) OR has_role(auth.uid(), 'admin'))
  )
);

-- club_order_products: INSERT - staff of own or linked club
DROP POLICY IF EXISTS "Club staff can add order products" ON public.club_order_products;
CREATE POLICY "Club staff can add order products" ON public.club_order_products
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM club_order_sessions s
    WHERE s.id = club_order_products.session_id
    AND (is_staff_or_linked(auth.uid(), s.club_id) OR has_role(auth.uid(), 'admin'))
  )
);

-- club_order_products: UPDATE - staff of own or linked club
DROP POLICY IF EXISTS "Club staff can update order products" ON public.club_order_products;
CREATE POLICY "Club staff can update order products" ON public.club_order_products
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM club_order_sessions s
    WHERE s.id = club_order_products.session_id
    AND (is_staff_or_linked(auth.uid(), s.club_id) OR has_role(auth.uid(), 'admin'))
  )
);

-- club_order_products: DELETE - staff of own or linked club
DROP POLICY IF EXISTS "Club staff can delete order products" ON public.club_order_products;
CREATE POLICY "Club staff can delete order products" ON public.club_order_products
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM club_order_sessions s
    WHERE s.id = club_order_products.session_id
    AND (is_staff_or_linked(auth.uid(), s.club_id) OR has_role(auth.uid(), 'admin'))
  )
);

-- club_order_reservations: INSERT - members of own or linked club
DROP POLICY IF EXISTS "Members can create reservations" ON public.club_order_reservations;
CREATE POLICY "Members can create reservations" ON public.club_order_reservations
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM club_order_products p
    JOIN club_order_sessions s ON s.id = p.session_id
    WHERE p.id = club_order_reservations.order_product_id
    AND s.is_open = true
    AND is_member_or_linked(auth.uid(), s.club_id)
  )
);

-- club_order_reservations: SELECT - own or staff of club/linked
DROP POLICY IF EXISTS "Members can view own reservations" ON public.club_order_reservations;
CREATE POLICY "Members can view reservations" ON public.club_order_reservations
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM club_order_products p
    JOIN club_order_sessions s ON s.id = p.session_id
    WHERE p.id = club_order_reservations.order_product_id
    AND (is_staff_or_linked(auth.uid(), s.club_id) OR has_role(auth.uid(), 'admin'))
  )
);

-- club_order_reservations: UPDATE - own or staff
DROP POLICY IF EXISTS "Members and staff can update reservations" ON public.club_order_reservations;
CREATE POLICY "Members and staff can update reservations" ON public.club_order_reservations
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM club_order_products p
    JOIN club_order_sessions s ON s.id = p.session_id
    WHERE p.id = club_order_reservations.order_product_id
    AND (is_staff_or_linked(auth.uid(), s.club_id) OR has_role(auth.uid(), 'admin'))
  )
);

-- club_order_reservations: DELETE - own or staff
DROP POLICY IF EXISTS "Members and staff can delete reservations" ON public.club_order_reservations;
CREATE POLICY "Members and staff can delete reservations" ON public.club_order_reservations
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM club_order_products p
    JOIN club_order_sessions s ON s.id = p.session_id
    WHERE p.id = club_order_reservations.order_product_id
    AND (is_staff_or_linked(auth.uid(), s.club_id) OR has_role(auth.uid(), 'admin'))
  )
);

-- Trigger to auto-update updated_at
CREATE TRIGGER set_club_links_updated_at
  BEFORE UPDATE ON public.club_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
