
CREATE OR REPLACE FUNCTION public.finalize_tournament_points(_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  total_participants INTEGER;
  base_award INTEGER;
  scale_factor NUMERIC;
  final_award INTEGER;
  active_bfl INTEGER;
  _championship_id uuid;
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

  -- Gentler multiplier: log-based scaling
  scale_factor := 1.0 + GREATEST(0, ln(GREATEST(total_participants, 1)::numeric / 8.0)) * 0.15;

  SELECT bfl INTO active_bfl FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  FOR rec IN
    SELECT ts.user_id,
           ROW_NUMBER() OVER (ORDER BY ts.points DESC, ts.resistance DESC) as placement
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false
  LOOP
    -- Per-placement scoring: smooth curve, no ties
    CASE
      WHEN rec.placement = 1  THEN base_award := 100;
      WHEN rec.placement = 2  THEN base_award := 85;
      WHEN rec.placement = 3  THEN base_award := 70;
      WHEN rec.placement = 4  THEN base_award := 60;
      WHEN rec.placement = 5  THEN base_award := 52;
      WHEN rec.placement = 6  THEN base_award := 46;
      WHEN rec.placement = 7  THEN base_award := 40;
      WHEN rec.placement = 8  THEN base_award := 35;
      WHEN rec.placement = 9  THEN base_award := 30;
      WHEN rec.placement = 10 THEN base_award := 26;
      WHEN rec.placement = 11 THEN base_award := 23;
      WHEN rec.placement = 12 THEN base_award := 20;
      WHEN rec.placement = 13 THEN base_award := 18;
      WHEN rec.placement = 14 THEN base_award := 16;
      WHEN rec.placement = 15 THEN base_award := 14;
      WHEN rec.placement = 16 THEN base_award := 12;
      WHEN rec.placement <= 24 THEN base_award := 8;
      WHEN rec.placement <= 32 THEN base_award := 5;
      ELSE base_award := 3;
    END CASE;

    final_award := ROUND(base_award * scale_factor);

    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    VALUES (_tournament_id, rec.user_id, rec.placement::integer, total_participants, base_award, final_award)
    ON CONFLICT (tournament_id, user_id) DO UPDATE
      SET placement = EXCLUDED.placement,
          participants_count = EXCLUDED.participants_count,
          base_points = EXCLUDED.base_points,
          scaled_points = EXCLUDED.scaled_points;
  END LOOP;

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
