-- =====================================================================
-- 1. FIX: finalize_tournament_points referenced non-existent app_settings
-- =====================================================================
CREATE OR REPLACE FUNCTION public.finalize_tournament_points(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  total_participants INTEGER;
  active_bfl INTEGER;
  _championship_id uuid;
  _total_tc_rounds INTEGER;
  _has_top_cut BOOLEAN;
  _season_start date;
  _is_ranked BOOLEAN;
  _custom_swiss INTEGER;
  _custom_top INTEGER;
  PARTICIPATION_BONUS INTEGER := 2;
  POINTS_PER_WIN INTEGER := 4;
  _swiss_pts INTEGER;
  _top_pts INTEGER;
  _setting_val TEXT;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = _tournament_id
    AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)
  )) THEN
    RAISE EXCEPTION 'Unauthorized: only admins and tournament staff can finalize points';
  END IF;

  SELECT championship_id, is_ranked, custom_swiss_win_points, custom_top_win_points
    INTO _championship_id, _is_ranked, _custom_swiss, _custom_top
    FROM tournaments WHERE id = _tournament_id;

  -- Read global competitive defaults from site_settings (was: app_settings, which doesn't exist)
  BEGIN
    SELECT value INTO _setting_val FROM site_settings WHERE key = 'competitive_participation_bonus';
    IF _setting_val IS NOT NULL AND _setting_val ~ '^\d+$' THEN
      PARTICIPATION_BONUS := _setting_val::int;
    END IF;
    SELECT value INTO _setting_val FROM site_settings WHERE key = 'competitive_points_per_win';
    IF _setting_val IS NOT NULL AND _setting_val ~ '^\d+$' THEN
      POINTS_PER_WIN := _setting_val::int;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- keep defaults on any error
    PARTICIPATION_BONUS := 2;
    POINTS_PER_WIN := 4;
  END;

  _swiss_pts := CASE WHEN NOT _is_ranked AND _custom_swiss IS NOT NULL THEN _custom_swiss ELSE POINTS_PER_WIN END;
  _top_pts := CASE WHEN NOT _is_ranked AND _custom_top IS NOT NULL THEN _custom_top ELSE POINTS_PER_WIN END;

  SELECT COUNT(*) INTO total_participants
  FROM tournament_standings
  WHERE tournament_id = _tournament_id AND dropped = false;

  SELECT bfl, start_date INTO active_bfl, _season_start FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  SELECT EXISTS(
    SELECT 1 FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut'
  ) INTO _has_top_cut;

  DELETE FROM tournament_results WHERE tournament_id = _tournament_id;

  IF _has_top_cut THEN
    SELECT COALESCE(MAX(round), 0) INTO _total_tc_rounds
    FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut';

    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, tm.winner_id, 1, total_participants, 0, 0
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
      AND tm.round = _total_tc_rounds AND tm.match_number = 1
      AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
    LIMIT 1;

    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id,
           CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END,
           2, total_participants, 0, 0
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
      AND tm.round = _total_tc_rounds AND tm.match_number = 1
      AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
    LIMIT 1;

    FOR rec IN
      SELECT r AS tc_round,
             CASE WHEN (_total_tc_rounds - r) = 1 THEN 3
               ELSE POWER(2, _total_tc_rounds - r)::int + 1
             END AS placement_start
      FROM generate_series(_total_tc_rounds - 1, 1, -1) r
    LOOP
      INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
      SELECT _tournament_id, loser_id,
             rec.placement_start + (row_number() OVER (ORDER BY tb_placement ASC NULLS LAST, swiss_points DESC, swiss_resistance DESC))::int - 1,
             total_participants, 0, 0
      FROM (
        SELECT
          CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END AS loser_id,
          (SELECT CASE
            WHEN EXISTS (
              SELECT 1 FROM tournament_matches tb
              WHERE tb.tournament_id = _tournament_id AND tb.phase = 'tiebreaker' AND tb.status = 'completed'
                AND tb.winner_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
            ) THEN 0
            WHEN EXISTS (
              SELECT 1 FROM tournament_matches tb
              WHERE tb.tournament_id = _tournament_id AND tb.phase = 'tiebreaker' AND tb.status = 'completed'
                AND tb.winner_id IS NOT NULL
                AND (
                  tb.player1_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
                  OR tb.player2_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
                )
            ) THEN 1
            ELSE NULL END) AS tb_placement,
          COALESCE((SELECT ts.points FROM tournament_standings ts
                    WHERE ts.tournament_id = _tournament_id
                      AND ts.user_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
          ), 0) AS swiss_points,
          COALESCE((SELECT ts.opponent_match_win_pct FROM tournament_standings ts
                    WHERE ts.tournament_id = _tournament_id
                      AND ts.user_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
          ), 0) AS swiss_resistance
        FROM tournament_matches tm
        WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
          AND tm.round = rec.tc_round
          AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
          AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
          -- Exclude 3rd-place playoff match (final round, match 2)
          AND NOT (rec.tc_round = _total_tc_rounds AND tm.match_number = 2)
      ) sub;
    END LOOP;

    -- Players eliminated before top-cut (Swiss only) get placement after top-cut bucket
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           POWER(2, _total_tc_rounds)::int + (row_number() OVER (ORDER BY ts.points DESC, ts.opponent_match_win_pct DESC)),
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id
      AND ts.dropped = false
      AND ts.user_id NOT IN (
        SELECT user_id FROM tournament_results WHERE tournament_id = _tournament_id
      );
  ELSE
    -- Swiss-only tournament: placement by standings
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           row_number() OVER (ORDER BY ts.points DESC, ts.opponent_match_win_pct DESC, ts.opponent_opponent_match_win_pct DESC),
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false;
  END IF;

  -- Compute base & scaled points
  UPDATE tournament_results tr
  SET base_points = sub.base_points,
      scaled_points = sub.scaled_points
  FROM (
    SELECT tr2.user_id,
           PARTICIPATION_BONUS
             + (COALESCE((SELECT COUNT(*) FROM tournament_matches m
                          WHERE m.tournament_id = _tournament_id
                            AND m.phase = 'swiss'
                            AND m.winner_id = tr2.user_id), 0) * _swiss_pts)
             + (COALESCE((SELECT COUNT(*) FROM tournament_matches m
                          WHERE m.tournament_id = _tournament_id
                            AND m.phase = 'top_cut'
                            AND m.winner_id = tr2.user_id
                            -- 3rd-place match excluded from points
                            AND NOT (m.round = _total_tc_rounds AND m.match_number = 2)
                          ), 0) * _top_pts)
             AS base_points,
           CASE WHEN _is_ranked THEN
             ROUND(
               (PARTICIPATION_BONUS
                 + (COALESCE((SELECT COUNT(*) FROM tournament_matches m
                              WHERE m.tournament_id = _tournament_id
                                AND m.phase = 'swiss'
                                AND m.winner_id = tr2.user_id), 0) * _swiss_pts)
                 + (COALESCE((SELECT COUNT(*) FROM tournament_matches m
                              WHERE m.tournament_id = _tournament_id
                                AND m.phase = 'top_cut'
                                AND m.winner_id = tr2.user_id
                                AND NOT (m.round = _total_tc_rounds AND m.match_number = 2)
                              ), 0) * _top_pts)
               ) * (1 + (LEAST(total_participants, 64)::numeric - 1) / 63 * 0.5)
             )::int
           ELSE 0 END AS scaled_points
    FROM tournament_results tr2
    WHERE tr2.tournament_id = _tournament_id
  ) sub
  WHERE tr.tournament_id = _tournament_id AND tr.user_id = sub.user_id;
END;
$function$;

-- =====================================================================
-- 2. Regional Referent role + table
-- =====================================================================
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'regional_referent';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.regional_referents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  public_email TEXT,
  public_phone TEXT,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_regional_referents_region ON public.regional_referents(region_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_regional_referents_user ON public.regional_referents(user_id);

ALTER TABLE public.regional_referents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active regional referents"
  ON public.regional_referents FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage regional referents"
  ON public.regional_referents FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Referents can update own contacts"
  ON public.regional_referents FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND is_active = true);

CREATE TRIGGER trg_regional_referents_updated_at
  BEFORE UPDATE ON public.regional_referents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: is user a referent for a given region
CREATE OR REPLACE FUNCTION public.is_regional_referent(_user_id uuid, _region_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM regional_referents
    WHERE user_id = _user_id AND region_id = _region_id AND is_active = true
  );
$$;

-- Auto-grant role when added, revoke when removed/deactivated
CREATE OR REPLACE FUNCTION public.sync_regional_referent_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_active = true THEN
    INSERT INTO user_roles (user_id, role) VALUES (NEW.user_id, 'regional_referent')
    ON CONFLICT DO NOTHING;
  ELSIF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.is_active = false) THEN
    -- only remove role if no other active region remains for this user
    IF NOT EXISTS (
      SELECT 1 FROM regional_referents
      WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
        AND is_active = true
        AND id <> COALESCE(NEW.id, OLD.id)
    ) THEN
      DELETE FROM user_roles
      WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
        AND role = 'regional_referent';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_regional_referents_role_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.regional_referents
  FOR EACH ROW EXECUTE FUNCTION public.sync_regional_referent_role();

-- =====================================================================
-- 3. Regional chat: channels + members + messages
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.regional_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('region', 'request')),
  club_request_id UUID REFERENCES public.club_requests(id) ON DELETE CASCADE,
  title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One persistent region channel per region
  CONSTRAINT uniq_region_channel UNIQUE (region_id, channel_type, club_request_id)
);

CREATE INDEX IF NOT EXISTS idx_regional_channels_region ON public.regional_channels(region_id);
CREATE INDEX IF NOT EXISTS idx_regional_channels_request ON public.regional_channels(club_request_id);

CREATE TABLE IF NOT EXISTS public.regional_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.regional_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'referent', 'requester', 'leader')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rcm_channel ON public.regional_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_rcm_user ON public.regional_channel_members(user_id);

CREATE TABLE IF NOT EXISTS public.regional_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.regional_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_regional_messages_channel ON public.regional_messages(channel_id, created_at DESC);

ALTER TABLE public.regional_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is user member of channel
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM regional_channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  );
$$;

-- Channels
CREATE POLICY "Members and admins read channels"
  ON public.regional_channels FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    OR is_channel_member(auth.uid(), id)
    OR is_regional_referent(auth.uid(), region_id)
  );

CREATE POLICY "Admins or referents create channels"
  ON public.regional_channels FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR is_regional_referent(auth.uid(), region_id)
  );

CREATE POLICY "Admins or referents update channels"
  ON public.regional_channels FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR is_regional_referent(auth.uid(), region_id));

-- Members
CREATE POLICY "Read channel members if member"
  ON public.regional_channel_members FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    OR is_channel_member(auth.uid(), channel_id)
    OR EXISTS (
      SELECT 1 FROM regional_channels c
      WHERE c.id = channel_id AND is_regional_referent(auth.uid(), c.region_id)
    )
  );

CREATE POLICY "Admins or referents add members"
  ON public.regional_channel_members FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM regional_channels c
      WHERE c.id = channel_id AND is_regional_referent(auth.uid(), c.region_id)
    )
  );

CREATE POLICY "Admins or self remove members"
  ON public.regional_channel_members FOR DELETE
  USING (
    has_role(auth.uid(), 'admin')
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM regional_channels c
      WHERE c.id = channel_id AND is_regional_referent(auth.uid(), c.region_id)
    )
  );

CREATE POLICY "Self update last_read"
  ON public.regional_channel_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Messages
CREATE POLICY "Members read messages"
  ON public.regional_messages FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    OR is_channel_member(auth.uid(), channel_id)
    OR EXISTS (
      SELECT 1 FROM regional_channels c
      WHERE c.id = channel_id AND is_regional_referent(auth.uid(), c.region_id)
    )
  );

CREATE POLICY "Members send messages"
  ON public.regional_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND (
      has_role(auth.uid(), 'admin')
      OR is_channel_member(auth.uid(), channel_id)
      OR EXISTS (
        SELECT 1 FROM regional_channels c
        WHERE c.id = channel_id AND is_regional_referent(auth.uid(), c.region_id)
      )
    )
  );

CREATE POLICY "Sender or admin delete messages"
  ON public.regional_messages FOR DELETE
  USING (sender_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Sender update own messages"
  ON public.regional_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Auto-create region channel + add referents on referent assignment
CREATE OR REPLACE FUNCTION public.ensure_region_channel(_region_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ch_id uuid;
  _region_name text;
BEGIN
  SELECT id INTO _ch_id FROM regional_channels
  WHERE region_id = _region_id AND channel_type = 'region' AND club_request_id IS NULL
  LIMIT 1;
  IF _ch_id IS NULL THEN
    SELECT name INTO _region_name FROM regions WHERE id = _region_id;
    INSERT INTO regional_channels (region_id, channel_type, title)
    VALUES (_region_id, 'region', 'Chat regionale ' || COALESCE(_region_name, ''))
    RETURNING id INTO _ch_id;
  END IF;
  RETURN _ch_id;
END;
$$;

-- When a referent is added: ensure region channel + add referent + add all confirmed leaders of the region
CREATE OR REPLACE FUNCTION public.on_referent_added_populate_channel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ch_id uuid;
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;
  _ch_id := ensure_region_channel(NEW.region_id);
  INSERT INTO regional_channel_members (channel_id, user_id, role)
  VALUES (_ch_id, NEW.user_id, 'referent')
  ON CONFLICT DO NOTHING;
  -- Add all current leaders of clubs in this region
  INSERT INTO regional_channel_members (channel_id, user_id, role)
  SELECT _ch_id, cm.user_id, 'leader'
  FROM club_members cm
  JOIN clubs c ON c.id = cm.club_id
  WHERE c.region_id = NEW.region_id
    AND cm.role = 'leader'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_referent_added_channel
  AFTER INSERT OR UPDATE ON public.regional_referents
  FOR EACH ROW EXECUTE FUNCTION public.on_referent_added_populate_channel();

-- When a club_request is created: open a 'request' channel, add requester + region referents
CREATE OR REPLACE FUNCTION public.on_club_request_created_open_chat()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ch_id uuid;
BEGIN
  IF NEW.region_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO regional_channels (region_id, channel_type, club_request_id, title)
  VALUES (NEW.region_id, 'request', NEW.id, 'Richiesta: ' || NEW.club_name)
  ON CONFLICT (region_id, channel_type, club_request_id) DO NOTHING
  RETURNING id INTO _ch_id;

  IF _ch_id IS NULL THEN
    SELECT id INTO _ch_id FROM regional_channels
    WHERE club_request_id = NEW.id LIMIT 1;
  END IF;

  INSERT INTO regional_channel_members (channel_id, user_id, role)
  VALUES (_ch_id, NEW.user_id, 'requester')
  ON CONFLICT DO NOTHING;

  INSERT INTO regional_channel_members (channel_id, user_id, role)
  SELECT _ch_id, rr.user_id, 'referent'
  FROM regional_referents rr
  WHERE rr.region_id = NEW.region_id AND rr.is_active = true
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_club_request_open_chat
  AFTER INSERT ON public.club_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_club_request_created_open_chat();

-- When a club_request is approved: add the requester (now club leader) to region channel
CREATE OR REPLACE FUNCTION public.on_club_request_approved_join_region()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ch_id uuid;
BEGIN
  IF NEW.status = 'approved' AND COALESCE(OLD.status, '') <> 'approved' AND NEW.region_id IS NOT NULL THEN
    _ch_id := ensure_region_channel(NEW.region_id);
    INSERT INTO regional_channel_members (channel_id, user_id, role)
    VALUES (_ch_id, NEW.user_id, 'leader')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_club_request_approved_join_region
  AFTER UPDATE ON public.club_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_club_request_approved_join_region();

CREATE TRIGGER trg_regional_channels_updated_at
  BEFORE UPDATE ON public.regional_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bump channel updated_at on new message (for sorting)
CREATE OR REPLACE FUNCTION public.bump_channel_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE regional_channels SET updated_at = now() WHERE id = NEW.channel_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_channel_on_message
  AFTER INSERT ON public.regional_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_channel_on_message();

-- Realtime
ALTER TABLE public.regional_messages REPLICA IDENTITY FULL;
ALTER TABLE public.regional_channels REPLICA IDENTITY FULL;
ALTER TABLE public.regional_channel_members REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.regional_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.regional_channels;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.regional_channel_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: create region channels for existing referents and join existing leaders
DO $$
DECLARE r RECORD; _ch uuid;
BEGIN
  FOR r IN SELECT DISTINCT region_id FROM regional_referents WHERE is_active = true LOOP
    _ch := ensure_region_channel(r.region_id);
    INSERT INTO regional_channel_members (channel_id, user_id, role)
    SELECT _ch, rr.user_id, 'referent'
    FROM regional_referents rr WHERE rr.region_id = r.region_id AND rr.is_active = true
    ON CONFLICT DO NOTHING;
    INSERT INTO regional_channel_members (channel_id, user_id, role)
    SELECT _ch, cm.user_id, 'leader'
    FROM club_members cm JOIN clubs c ON c.id = cm.club_id
    WHERE c.region_id = r.region_id AND cm.role = 'leader'
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- =====================================================================
-- 4. Sub-tournaments inside Events
-- =====================================================================
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_parent_event ON public.tournaments(parent_event_id) WHERE parent_event_id IS NOT NULL;
