
-- Add BFL setting to ranking_seasons
ALTER TABLE public.ranking_seasons ADD COLUMN bfl integer NOT NULL DEFAULT 10;

-- Tournament results: stores each player's result per tournament
CREATE TABLE public.tournament_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  placement integer NOT NULL,
  participants_count integer NOT NULL DEFAULT 0,
  base_points integer NOT NULL DEFAULT 0,
  scaled_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Results viewable by everyone" ON public.tournament_results
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admins can insert results" ON public.tournament_results
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can insert results" ON public.tournament_results
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_results.tournament_id
      AND t.club_id IS NOT NULL
      AND is_club_staff(auth.uid(), t.club_id)
    )
  );

CREATE POLICY "Admins can delete results" ON public.tournament_results
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Replace finalize_tournament_points to use tournament_results with scaling
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
  -- Count participants
  SELECT COUNT(*) INTO total_participants
  FROM tournament_standings
  WHERE tournament_id = _tournament_id AND dropped = false;

  -- Scale factor: base 1.0 + slight bonus for larger tournaments
  -- 8 players = 1.0x, 16 = ~1.1x, 32 = ~1.2x, 64 = ~1.3x
  scale_factor := 1.0 + GREATEST(0, (total_participants - 8)::numeric / 200.0);

  -- Get active BFL
  SELECT bfl INTO active_bfl FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  -- Loop through standings
  FOR rec IN
    SELECT ts.user_id,
           ROW_NUMBER() OVER (ORDER BY ts.points DESC, ts.resistance DESC) as placement
    FROM tournament_standings ts
    WHERE ts.tournament_id = _tournament_id AND ts.dropped = false
  LOOP
    -- Base points by placement
    CASE
      WHEN rec.placement = 1 THEN base_award := 100;
      WHEN rec.placement = 2 THEN base_award := 75;
      WHEN rec.placement <= 4 THEN base_award := 50;
      WHEN rec.placement <= 8 THEN base_award := 30;
      WHEN rec.placement <= 16 THEN base_award := 15;
      ELSE base_award := 5;
    END CASE;

    final_award := ROUND(base_award * scale_factor);

    -- Store individual result
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    VALUES (_tournament_id, rec.user_id, rec.placement::integer, total_participants, base_award, final_award)
    ON CONFLICT (tournament_id, user_id) DO UPDATE
      SET placement = EXCLUDED.placement,
          participants_count = EXCLUDED.participants_count,
          base_points = EXCLUDED.base_points,
          scaled_points = EXCLUDED.scaled_points;
  END LOOP;

  -- Recalculate profile points from best BFL results for ALL players who have results
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

-- Function to recalculate all rankings (for admin manual recalc)
CREATE OR REPLACE FUNCTION public.recalculate_all_rankings(_bfl integer DEFAULT 10)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Reset all profiles first
  UPDATE profiles SET points = 0, wins = 0, updated_at = now();

  -- Recalculate from tournament_results using BFL
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
