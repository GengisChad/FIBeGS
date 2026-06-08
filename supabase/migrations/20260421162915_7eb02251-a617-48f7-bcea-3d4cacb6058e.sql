-- ============================================
-- 1. WARN / TIME-OUT / BAN TABLES
-- ============================================

-- Sezioni in cui si possono accumulare warn
CREATE TYPE public.warn_section AS ENUM ('forum', 'market', 'decks', 'tournaments', 'profile');

-- Tabella warns
CREATE TABLE public.user_warns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  section public.warn_section NOT NULL,
  reason text NOT NULL,
  issued_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_warns_user_section ON public.user_warns (user_id, section) WHERE is_active = true;
ALTER TABLE public.user_warns ENABLE ROW LEVEL SECURITY;

-- Tabella time-outs
CREATE TABLE public.user_timeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  issued_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_timeouts_active ON public.user_timeouts (user_id, expires_at) WHERE revoked_at IS NULL;
ALTER TABLE public.user_timeouts ENABLE ROW LEVEL SECURITY;

-- Tabella bans
CREATE TABLE public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  issued_by uuid NOT NULL,
  expires_at timestamptz, -- NULL = permanente
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_bans_active ON public.user_bans (user_id, expires_at) WHERE revoked_at IS NULL;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_user_timed_out(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_timeouts
    WHERE user_id = _user_id
      AND revoked_at IS NULL
      AND expires_at > now()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE user_id = _user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_user_timed_out(_user_id) OR public.is_user_banned(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.count_active_warns(_user_id uuid, _section public.warn_section)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.user_warns
  WHERE user_id = _user_id AND section = _section AND is_active = true
$$;

-- ============================================
-- 3. RLS POLICIES on moderation tables
-- ============================================

-- user_warns
CREATE POLICY "Users can view their own warns"
  ON public.user_warns FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Staff can view all warns"
  ON public.user_warns FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff can insert warns"
  ON public.user_warns FOR INSERT
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff')) AND issued_by = auth.uid());
CREATE POLICY "Staff can update warns"
  ON public.user_warns FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins can delete warns"
  ON public.user_warns FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- user_timeouts
CREATE POLICY "Users can view their own timeouts"
  ON public.user_timeouts FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Staff can view all timeouts"
  ON public.user_timeouts FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff can insert timeouts"
  ON public.user_timeouts FOR INSERT
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff')) AND issued_by = auth.uid());
CREATE POLICY "Staff can update timeouts"
  ON public.user_timeouts FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff'));

-- user_bans
CREATE POLICY "Users can view their own bans"
  ON public.user_bans FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Staff can view all bans"
  ON public.user_bans FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff can insert bans"
  ON public.user_bans FOR INSERT
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff')) AND issued_by = auth.uid());
CREATE POLICY "Staff can update bans"
  ON public.user_bans FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff'));

-- ============================================
-- 4. BLOCK WRITES FOR TIMED-OUT / BANNED USERS
-- Wrap existing INSERT policies so they also require NOT is_user_blocked(auth.uid())
-- ============================================

-- forum_posts
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.forum_posts;
CREATE POLICY "Authenticated users can create posts"
  ON public.forum_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- forum_replies
DROP POLICY IF EXISTS "Authenticated users can create replies" ON public.forum_replies;
CREATE POLICY "Authenticated users can create replies"
  ON public.forum_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- forum_post_likes
DROP POLICY IF EXISTS "Users can like posts" ON public.forum_post_likes;
CREATE POLICY "Users can like posts"
  ON public.forum_post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- forum_reply_likes
DROP POLICY IF EXISTS "Users can like replies" ON public.forum_reply_likes;
CREATE POLICY "Users can like replies"
  ON public.forum_reply_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- market_listings
DROP POLICY IF EXISTS "Users can create listings" ON public.market_listings;
CREATE POLICY "Users can create listings"
  ON public.market_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- market_messages
DROP POLICY IF EXISTS "Users send messages in their chats" ON public.market_messages;
CREATE POLICY "Users send messages in their chats"
  ON public.market_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_user_blocked(auth.uid())
    AND EXISTS (SELECT 1 FROM public.market_chats c WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
  );

-- market_wanted
DROP POLICY IF EXISTS "Users can create wanted" ON public.market_wanted;
CREATE POLICY "Users can create wanted"
  ON public.market_wanted FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- decks
DROP POLICY IF EXISTS "Users can create their own decks" ON public.decks;
CREATE POLICY "Users can create their own decks"
  ON public.decks FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- deck_likes
DROP POLICY IF EXISTS "Users can like decks" ON public.deck_likes;
CREATE POLICY "Users can like decks"
  ON public.deck_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- deck_reports / forum_reports / market_reports
DROP POLICY IF EXISTS "Users can report decks" ON public.deck_reports;
CREATE POLICY "Users can report decks"
  ON public.deck_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id AND NOT public.is_user_blocked(auth.uid()));
DROP POLICY IF EXISTS "Users can create reports" ON public.forum_reports;
CREATE POLICY "Users can create reports"
  ON public.forum_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id AND NOT public.is_user_blocked(auth.uid()));
DROP POLICY IF EXISTS "Users can create reports" ON public.market_reports;
CREATE POLICY "Users can create reports"
  ON public.market_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id AND NOT public.is_user_blocked(auth.uid()));

-- feedback (allow even when blocked? — keep blocked: only reading)
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;
CREATE POLICY "Users can create feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- tournament_registrations
DROP POLICY IF EXISTS "Users can register themselves" ON public.tournament_registrations;
CREATE POLICY "Users can register themselves"
  ON public.tournament_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));

-- ============================================
-- 5. STAFF DELETE POLICY ON DECKS
-- ============================================
DROP POLICY IF EXISTS "Staff can delete any deck" ON public.decks;
CREATE POLICY "Staff can delete any deck"
  ON public.decks FOR DELETE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'staff'));

-- ============================================
-- 6. PARENT ROLE: allow re-request after rejection
-- Admin can already insert into user_roles via existing policies, no change needed.
-- ============================================
-- (No schema change required: handlers in app code will allow inserting a new request when latest is 'rejected'.)
