
CREATE OR REPLACE FUNCTION public.finalize_tournament_points(_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  total_participants INTEGER;
  base_award INTEGER;
  scale_factor NUMERIC;
  final_award INTEGER;
  active_bfl INTEGER;
BEGIN
  -- Authorization check
  IF NOT (has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = _tournament_id
    AND t.club_id IS NOT NULL AND is_club_staff(auth.uid(), t.club_id)
  )) THEN
    RAISE EXCEPTION 'Unauthorized: only admins and tournament staff can finalize points';
  END IF;

  SELECT COUNT(*) INTO total_participants
  FROM tournament_standings
  WHERE tournament_id = _tournament_id AND dropped = false;

  scale_factor := 1.0 + GREATEST(0, (total_participants - 8)::numeric / 200.0);

  SELECT bfl INTO active_bfl FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  FOR rec IN
    SELECT ts.user_id,
           ROW_NUMBER() OVER (ORDER BY ts.points DESC, ts.resistance DESC) as placement
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false
  LOOP
    CASE
      WHEN rec.placement = 1 THEN base_award := 100;
      WHEN rec.placement = 2 THEN base_award := 75;
      WHEN rec.placement <= 4 THEN base_award := 50;
      WHEN rec.placement <= 8 THEN base_award := 30;
      WHEN rec.placement <= 16 THEN base_award := 15;
      ELSE base_award := 5;
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

  UPDATE profiles p
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id,
           SUM(tr.scaled_points) as total,
           COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
    FROM (
      SELECT user_id, scaled_points, placement,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY scaled_points DESC) as rn
      FROM tournament_results
    ) tr
    WHERE tr.rn <= active_bfl
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_rankings(_bfl integer DEFAULT 10)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only admins can recalculate rankings';
  END IF;

  UPDATE profiles SET points = 0, wins = 0, updated_at = now();

  UPDATE profiles p
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id,
           SUM(tr.scaled_points) as total,
           COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
    FROM (
      SELECT user_id, scaled_points, placement,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY scaled_points DESC) as rn
      FROM tournament_results
    ) tr
    WHERE tr.rn <= _bfl
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;
END;
$function$;
