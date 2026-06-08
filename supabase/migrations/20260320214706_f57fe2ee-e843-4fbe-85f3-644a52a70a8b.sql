
-- ═══ Achievements & Missions System ═══

-- Achievements (permanent milestones)
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon_url text,
  badge_id uuid REFERENCES public.badges(id) ON DELETE SET NULL,
  bonus_points integer NOT NULL DEFAULT 0,
  condition_type text NOT NULL,
  condition_value integer NOT NULL DEFAULT 1,
  condition_meta jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Missions (time-limited weekly/monthly)
CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon_url text,
  badge_id uuid REFERENCES public.badges(id) ON DELETE SET NULL,
  bonus_points integer NOT NULL DEFAULT 0,
  condition_type text NOT NULL,
  condition_value integer NOT NULL DEFAULT 1,
  condition_meta jsonb NOT NULL DEFAULT '{}',
  period text NOT NULL DEFAULT 'weekly',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User achievement completions
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- User mission progress
CREATE TABLE public.user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mission_id)
);

-- ═══ RLS ═══
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- Achievements: anyone reads, admin manages
CREATE POLICY "Anyone can read achievements" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Admins insert achievements" ON public.achievements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update achievements" ON public.achievements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete achievements" ON public.achievements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Missions: anyone reads, admin manages
CREATE POLICY "Anyone can read missions" ON public.missions FOR SELECT USING (true);
CREATE POLICY "Admins insert missions" ON public.missions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update missions" ON public.missions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete missions" ON public.missions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User achievements: anyone can read (for public profiles), authenticated insert own
CREATE POLICY "Anyone can read user achievements" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "Users insert own achievements" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- User missions: own read/insert/update
CREATE POLICY "Users read own missions" ON public.user_missions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own missions" ON public.user_missions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own missions" ON public.user_missions FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ═══ Indexes ═══
CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX idx_user_missions_user ON public.user_missions(user_id);
CREATE INDEX idx_missions_active_dates ON public.missions(is_active, starts_at, ends_at);

-- ═══ RPC: Get achievement progress for a user ═══
CREATE OR REPLACE FUNCTION public.get_achievement_progress(_user_id uuid)
RETURNS TABLE(achievement_id uuid, current_progress integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  prog integer;
BEGIN
  -- Uncompleted achievements
  FOR rec IN
    SELECT a.id, a.condition_type, a.condition_value, a.condition_meta
    FROM achievements a
    WHERE a.is_active = true
      AND a.id NOT IN (SELECT ua.achievement_id FROM user_achievements ua WHERE ua.user_id = _user_id)
  LOOP
    prog := 0;
    CASE rec.condition_type
      WHEN 'tournament_count' THEN
        SELECT COUNT(DISTINCT tr.tournament_id) INTO prog FROM tournament_results tr WHERE tr.user_id = _user_id;
      WHEN 'tournament_wins' THEN
        SELECT COUNT(*) INTO prog FROM tournament_results tr WHERE tr.user_id = _user_id AND tr.placement = 1;
      WHEN 'match_wins' THEN
        SELECT COUNT(*) INTO prog FROM tournament_matches tm
        WHERE tm.status = 'completed' AND tm.winner_id = _user_id;
      WHEN 'top_placement' THEN
        SELECT COUNT(*) INTO prog FROM tournament_results tr
        WHERE tr.user_id = _user_id AND tr.placement <= COALESCE((rec.condition_meta->>'max_placement')::int, 3);
      WHEN 'forum_posts' THEN
        SELECT COUNT(*) INTO prog FROM forum_posts fp WHERE fp.user_id = _user_id;
      WHEN 'forum_likes_received' THEN
        SELECT COUNT(*) INTO prog FROM forum_post_likes fpl
        JOIN forum_posts fp ON fp.id = fpl.post_id WHERE fp.user_id = _user_id;
      WHEN 'decks_created' THEN
        SELECT COUNT(*) INTO prog FROM decks d WHERE d.user_id = _user_id;
      WHEN 'collection_count' THEN
        SELECT COALESCE(jsonb_array_length(ucd.items), 0) INTO prog
        FROM user_collection_data ucd WHERE ucd.user_id = _user_id;
      ELSE
        prog := 0;
    END CASE;
    achievement_id := rec.id;
    current_progress := LEAST(prog, rec.condition_value);
    RETURN NEXT;
  END LOOP;

  -- Completed achievements: return max progress
  FOR rec IN
    SELECT a.id, a.condition_value FROM achievements a
    WHERE a.is_active = true
      AND a.id IN (SELECT ua.achievement_id FROM user_achievements ua WHERE ua.user_id = _user_id)
  LOOP
    achievement_id := rec.id;
    current_progress := rec.condition_value;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ═══ RPC: Get mission progress for a user ═══
CREATE OR REPLACE FUNCTION public.get_mission_progress(_user_id uuid)
RETURNS TABLE(mission_id uuid, current_progress integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  prog integer;
BEGIN
  FOR rec IN
    SELECT m.id, m.condition_type, m.condition_value, m.condition_meta, m.starts_at, m.ends_at
    FROM missions m
    WHERE m.is_active = true AND now() BETWEEN m.starts_at AND m.ends_at
      AND m.id NOT IN (SELECT um.mission_id FROM user_missions um WHERE um.user_id = _user_id AND um.completed_at IS NOT NULL)
  LOOP
    prog := 0;
    CASE rec.condition_type
      WHEN 'tournament_count' THEN
        SELECT COUNT(DISTINCT tr.tournament_id) INTO prog FROM tournament_results tr
        JOIN tournaments t ON t.id = tr.tournament_id
        WHERE tr.user_id = _user_id AND t.date >= rec.starts_at AND t.date <= rec.ends_at;
      WHEN 'tournament_wins' THEN
        SELECT COUNT(*) INTO prog FROM tournament_results tr
        JOIN tournaments t ON t.id = tr.tournament_id
        WHERE tr.user_id = _user_id AND tr.placement = 1 AND t.date >= rec.starts_at AND t.date <= rec.ends_at;
      WHEN 'match_wins' THEN
        SELECT COUNT(*) INTO prog FROM tournament_matches tm
        WHERE tm.status = 'completed' AND tm.winner_id = _user_id
          AND tm.updated_at >= rec.starts_at AND tm.updated_at <= rec.ends_at;
      WHEN 'top_placement' THEN
        SELECT COUNT(*) INTO prog FROM tournament_results tr
        JOIN tournaments t ON t.id = tr.tournament_id
        WHERE tr.user_id = _user_id AND tr.placement <= COALESCE((rec.condition_meta->>'max_placement')::int, 3)
          AND t.date >= rec.starts_at AND t.date <= rec.ends_at;
      WHEN 'forum_posts' THEN
        SELECT COUNT(*) INTO prog FROM forum_posts fp
        WHERE fp.user_id = _user_id AND fp.created_at >= rec.starts_at AND fp.created_at <= rec.ends_at;
      WHEN 'forum_likes_received' THEN
        SELECT COUNT(*) INTO prog FROM forum_post_likes fpl
        JOIN forum_posts fp ON fp.id = fpl.post_id
        WHERE fp.user_id = _user_id AND fpl.created_at >= rec.starts_at AND fpl.created_at <= rec.ends_at;
      WHEN 'decks_created' THEN
        SELECT COUNT(*) INTO prog FROM decks d
        WHERE d.user_id = _user_id AND d.created_at >= rec.starts_at AND d.created_at <= rec.ends_at;
      ELSE
        prog := 0;
    END CASE;
    mission_id := rec.id;
    current_progress := LEAST(prog, rec.condition_value);
    RETURN NEXT;
  END LOOP;

  -- Completed missions
  FOR rec IN
    SELECT m.id, m.condition_value FROM missions m
    WHERE m.is_active = true AND now() BETWEEN m.starts_at AND m.ends_at
      AND m.id IN (SELECT um.mission_id FROM user_missions um WHERE um.user_id = _user_id AND um.completed_at IS NOT NULL)
  LOOP
    mission_id := rec.id;
    current_progress := rec.condition_value;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ═══ RPC: Claim achievement ═══
CREATE OR REPLACE FUNCTION public.claim_achievement(_achievement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _ach RECORD;
  _prog integer;
  _progress_row RECORD;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _ach FROM achievements WHERE id = _achievement_id AND is_active = true;
  IF _ach IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF EXISTS (SELECT 1 FROM user_achievements WHERE user_id = _user_id AND achievement_id = _achievement_id) THEN
    RETURN jsonb_build_object('error', 'already_claimed');
  END IF;

  -- Check progress
  SELECT current_progress INTO _prog FROM get_achievement_progress(_user_id) WHERE achievement_id = _achievement_id;
  IF _prog IS NULL OR _prog < _ach.condition_value THEN
    RETURN jsonb_build_object('error', 'not_completed', 'progress', COALESCE(_prog, 0), 'required', _ach.condition_value);
  END IF;

  -- Claim
  INSERT INTO user_achievements (user_id, achievement_id) VALUES (_user_id, _achievement_id);

  -- Award badge
  IF _ach.badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id, assigned_by) VALUES (_user_id, _ach.badge_id, _user_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Award bonus points
  IF _ach.bonus_points > 0 THEN
    UPDATE profiles SET points = COALESCE(points, 0) + _ach.bonus_points, updated_at = now() WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'badge_awarded', _ach.badge_id IS NOT NULL, 'points_awarded', _ach.bonus_points);
END;
$$;

-- ═══ RPC: Claim mission ═══
CREATE OR REPLACE FUNCTION public.claim_mission(_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _mis RECORD;
  _prog integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _mis FROM missions WHERE id = _mission_id AND is_active = true AND now() BETWEEN starts_at AND ends_at;
  IF _mis IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF EXISTS (SELECT 1 FROM user_missions WHERE user_id = _user_id AND mission_id = _mission_id AND completed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'already_claimed');
  END IF;

  SELECT current_progress INTO _prog FROM get_mission_progress(_user_id) WHERE mission_id = _mission_id;
  IF _prog IS NULL OR _prog < _mis.condition_value THEN
    RETURN jsonb_build_object('error', 'not_completed', 'progress', COALESCE(_prog, 0), 'required', _mis.condition_value);
  END IF;

  INSERT INTO user_missions (user_id, mission_id, progress, completed_at)
  VALUES (_user_id, _mission_id, _mis.condition_value, now())
  ON CONFLICT (user_id, mission_id) DO UPDATE SET progress = _mis.condition_value, completed_at = now();

  IF _mis.badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id, assigned_by) VALUES (_user_id, _mis.badge_id, _user_id) ON CONFLICT DO NOTHING;
  END IF;

  IF _mis.bonus_points > 0 THEN
    UPDATE profiles SET points = COALESCE(points, 0) + _mis.bonus_points, updated_at = now() WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'badge_awarded', _mis.badge_id IS NOT NULL, 'points_awarded', _mis.bonus_points);
END;
$$;

-- ═══ Updated finalize_tournament_points with new multiplier ═══
CREATE OR REPLACE FUNCTION public.finalize_tournament_points(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  total_participants INTEGER;
  base_award INTEGER;
  scale_factor NUMERIC;
  final_award INTEGER;
  active_bfl INTEGER;
  _championship_id uuid;
  _top_cut_size INTEGER;
  _total_tc_rounds INTEGER;
  _has_top_cut BOOLEAN;
  _has_tiebreakers BOOLEAN;
  placement_counter INTEGER := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = _tournament_id
    AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)
  )) THEN
    RAISE EXCEPTION 'Unauthorized: only admins and tournament staff can finalize points';
  END IF;

  SELECT championship_id INTO _championship_id FROM tournaments WHERE id = _tournament_id;

  SELECT COUNT(*) INTO total_participants
  FROM tournament_standings
  WHERE tournament_id = _tournament_id AND dropped = false;

  -- NEW MULTIPLIER: logarithmic curve from 1.00x (16 players) to 1.64x (128 players)
  scale_factor := GREATEST(1.0, LEAST(1.64,
    1.0 + 0.64 * ln(GREATEST(total_participants, 16)::numeric / 16.0) / ln(8.0)
  ));

  SELECT bfl INTO active_bfl FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  SELECT EXISTS(
    SELECT 1 FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut'
  ) INTO _has_top_cut;

  SELECT EXISTS(
    SELECT 1 FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'tiebreaker'
  ) INTO _has_tiebreakers;

  DELETE FROM tournament_results WHERE tournament_id = _tournament_id;

  IF _has_top_cut THEN
    SELECT COALESCE(MAX(round), 0) INTO _total_tc_rounds
    FROM tournament_matches WHERE tournament_id = _tournament_id AND phase = 'top_cut';

    -- 1) WINNER
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, tm.winner_id, 1, total_participants, 100, ROUND(100 * scale_factor)
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
      AND tm.round = _total_tc_rounds AND tm.match_number = 1
      AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
    LIMIT 1;

    -- 2) FINALIST
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id,
           CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END,
           2, total_participants, 85, ROUND(85 * scale_factor)
    FROM tournament_matches tm
    WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
      AND tm.round = _total_tc_rounds AND tm.match_number = 1
      AND tm.status = 'completed' AND tm.winner_id IS NOT NULL
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
    LIMIT 1;

    -- 3) Losers of each earlier round
    placement_counter := 2;
    FOR rec IN
      SELECT r as tc_round,
             CASE WHEN (_total_tc_rounds - r) = 1 THEN 3
               ELSE POWER(2, _total_tc_rounds - r)::int + 1
             END as placement_start
      FROM generate_series(_total_tc_rounds - 1, 1, -1) r
    LOOP
      INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
      SELECT _tournament_id, loser_id,
             rec.placement_start + (row_number() OVER (ORDER BY tb_placement ASC NULLS LAST, swiss_points DESC, swiss_resistance DESC))::int - 1,
             total_participants, 0, 0
      FROM (
        SELECT
          CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END as loser_id,
          (SELECT CASE
            WHEN EXISTS (SELECT 1 FROM tournament_matches tb WHERE tb.tournament_id = _tournament_id AND tb.phase = 'tiebreaker' AND tb.status = 'completed'
              AND tb.winner_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END) THEN 0
            WHEN EXISTS (SELECT 1 FROM tournament_matches tb WHERE tb.tournament_id = _tournament_id AND tb.phase = 'tiebreaker' AND tb.status = 'completed'
              AND tb.winner_id IS NOT NULL
              AND (tb.player1_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
                OR tb.player2_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END)
              AND tb.winner_id != CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END) THEN 2
            ELSE 1 END) as tb_placement,
          COALESCE(ts.points, 0) as swiss_points,
          COALESCE(ts.resistance, 0) as swiss_resistance
        FROM tournament_matches tm
        LEFT JOIN tournament_standings ts ON ts.tournament_id = _tournament_id
          AND ts.user_id = CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END
        WHERE tm.tournament_id = _tournament_id AND tm.phase = 'top_cut'
          AND tm.round = rec.tc_round AND tm.status = 'completed'
          AND tm.winner_id IS NOT NULL AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
          AND CASE WHEN tm.player1_id = tm.winner_id THEN tm.player2_id ELSE tm.player1_id END NOT IN (
            SELECT tr.user_id FROM tournament_results tr WHERE tr.tournament_id = _tournament_id
          )
      ) losers;
    END LOOP;

    -- 4) Non-top-cut players
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           (SELECT COUNT(*) FROM tournament_results WHERE tournament_id = _tournament_id)
           + (row_number() OVER (ORDER BY ts.points DESC, ts.resistance DESC))::int,
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false
      AND ts.user_id NOT IN (SELECT tr.user_id FROM tournament_results tr WHERE tr.tournament_id = _tournament_id);

  ELSE
    -- No top cut: Swiss standings
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    SELECT _tournament_id, ts.user_id,
           (row_number() OVER (ORDER BY ts.points DESC, ts.resistance DESC))::int,
           total_participants, 0, 0
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false;
  END IF;

  -- Set base_points based on placement
  UPDATE tournament_results SET
    base_points = CASE
      WHEN placement = 1  THEN 100
      WHEN placement = 2  THEN 85
      WHEN placement = 3  THEN 70
      WHEN placement = 4  THEN 60
      WHEN placement = 5  THEN 52
      WHEN placement = 6  THEN 46
      WHEN placement = 7  THEN 40
      WHEN placement = 8  THEN 35
      WHEN placement = 9  THEN 30
      WHEN placement = 10 THEN 26
      WHEN placement = 11 THEN 23
      WHEN placement = 12 THEN 20
      WHEN placement = 13 THEN 18
      WHEN placement = 14 THEN 16
      WHEN placement = 15 THEN 14
      WHEN placement = 16 THEN 12
      WHEN placement <= 24 THEN 8
      WHEN placement <= 32 THEN 5
      ELSE 3
    END
  WHERE tournament_id = _tournament_id;

  -- Calculate per-player scaled_points with round/match bonus multiplier
  UPDATE tournament_results tr SET
    scaled_points = ROUND(
      tr.base_points * scale_factor * (
        1.0
        + COALESCE(mc.swiss_rounds, 0) * 0.02
        + COALESCE(mc.topcut_matches, 0) * 0.05
      )
    )
  FROM (
    SELECT uid,
           COUNT(*) FILTER (WHERE phase = 'swiss') as swiss_rounds,
           COUNT(*) FILTER (WHERE phase IN ('top_cut', 'tiebreaker')) as topcut_matches
    FROM (
      SELECT player1_id as uid, phase FROM tournament_matches
      WHERE tournament_id = _tournament_id AND status = 'completed' AND player1_id IS NOT NULL
      UNION ALL
      SELECT player2_id as uid, phase FROM tournament_matches
      WHERE tournament_id = _tournament_id AND status = 'completed' AND player2_id IS NOT NULL
    ) x
    GROUP BY uid
  ) mc
  WHERE tr.tournament_id = _tournament_id AND tr.user_id = mc.uid;

  -- Handle players with no matches (shouldn't happen but safety)
  UPDATE tournament_results SET
    scaled_points = ROUND(base_points * scale_factor)
  WHERE tournament_id = _tournament_id AND scaled_points = 0 AND base_points > 0;

  IF _championship_id IS NOT NULL THEN
    RETURN;
  END IF;

  -- Update regular profiles
  UPDATE profiles p
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id,
           SUM(tr.scaled_points) as total,
           COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
    FROM (
      SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
             ROW_NUMBER() OVER (PARTITION BY tr2.user_id ORDER BY tr2.scaled_points DESC) as rn
      FROM tournament_results tr2
      JOIN tournaments t ON t.id = tr2.tournament_id
      WHERE t.championship_id IS NULL
    ) tr
    WHERE tr.rn <= active_bfl
    AND NOT EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = tr.user_id)
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;

  -- Update child profiles
  UPDATE child_profiles cp
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id as child_id,
           SUM(tr.scaled_points) as total,
           COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
    FROM (
      SELECT tr2.user_id, tr2.scaled_points, tr2.placement,
             ROW_NUMBER() OVER (PARTITION BY tr2.user_id ORDER BY tr2.scaled_points DESC) as rn
      FROM tournament_results tr2
      JOIN tournaments t ON t.id = tr2.tournament_id
      WHERE t.championship_id IS NULL
    ) tr
    WHERE tr.rn <= active_bfl
    AND EXISTS (SELECT 1 FROM child_profiles c WHERE c.id = tr.user_id)
    GROUP BY tr.user_id
  ) sub
  WHERE cp.id = sub.child_id;
END;
$$;
