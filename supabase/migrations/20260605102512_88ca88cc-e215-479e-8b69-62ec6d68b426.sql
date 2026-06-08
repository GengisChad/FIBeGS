-- =========================================================
-- BETA ELO SYSTEM (isolated tables, prefix beta_elo_*)
-- =========================================================

-- ---------- TIERS ----------
CREATE TABLE public.beta_elo_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  min_rating integer NOT NULL,
  max_rating integer, -- null = open ended
  color_hex text NOT NULL,
  glow_hex text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.beta_elo_tiers TO anon, authenticated;
GRANT ALL ON public.beta_elo_tiers TO service_role;

ALTER TABLE public.beta_elo_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beta_elo_tiers readable by all"
  ON public.beta_elo_tiers FOR SELECT
  USING (true);

INSERT INTO public.beta_elo_tiers (key, name, min_rating, max_rating, color_hex, glow_hex, sort_order) VALUES
  ('rookie',   'Rookie',        0,    999,  '#94a3b8', '#cbd5e1', 1),
  ('bronze',   'Bronze',        1000, 1199, '#b87333', '#e8a875', 2),
  ('silver',   'Silver',        1200, 1399, '#c0c0c0', '#e8e8e8', 3),
  ('gold',     'Gold',          1400, 1599, '#d4af37', '#ffd966', 4),
  ('platinum', 'Platinum',      1600, 1799, '#5fc6c9', '#a8e8ea', 5),
  ('diamond',  'Diamond',       1800, 1999, '#7dd3fc', '#bae6fd', 6),
  ('master',   'Master Blader', 2000, NULL, '#ff2d95', '#ff7ab8', 7);

-- ---------- RATINGS ----------
CREATE TABLE public.beta_elo_ratings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 1000,
  peak_rating integer NOT NULL DEFAULT 1000,
  matches_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  tier_key text NOT NULL DEFAULT 'bronze',
  last_match_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.beta_elo_ratings TO anon, authenticated;
GRANT ALL ON public.beta_elo_ratings TO service_role;

ALTER TABLE public.beta_elo_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beta_elo_ratings readable by all"
  ON public.beta_elo_ratings FOR SELECT
  USING (true);

-- ---------- MATCH LOG ----------
CREATE TABLE public.beta_elo_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_match_id uuid NOT NULL,
  tournament_id uuid NOT NULL,
  player_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  result text NOT NULL CHECK (result IN ('win','loss','draw')),
  rating_before integer NOT NULL,
  rating_after integer NOT NULL,
  opponent_rating_before integer NOT NULL,
  delta integer NOT NULL,
  played_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_match_id, player_id)
);

CREATE INDEX beta_elo_matches_player_idx ON public.beta_elo_matches (player_id, played_at DESC);
CREATE INDEX beta_elo_matches_tournament_idx ON public.beta_elo_matches (tournament_id);

GRANT SELECT ON public.beta_elo_matches TO anon, authenticated;
GRANT ALL ON public.beta_elo_matches TO service_role;

ALTER TABLE public.beta_elo_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beta_elo_matches readable by all"
  ON public.beta_elo_matches FOR SELECT
  USING (true);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.beta_elo_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER beta_elo_ratings_updated_at
  BEFORE UPDATE ON public.beta_elo_ratings
  FOR EACH ROW EXECUTE FUNCTION public.beta_elo_touch_updated_at();

-- ---------- TIER LOOKUP ----------
CREATE OR REPLACE FUNCTION public.beta_elo_tier_for(_rating integer)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT key FROM public.beta_elo_tiers
  WHERE _rating >= min_rating AND (max_rating IS NULL OR _rating <= max_rating)
  ORDER BY sort_order DESC
  LIMIT 1;
$$;

-- ---------- PROCESS SINGLE MATCH ----------
-- Idempotent: skips if already processed for both players
CREATE OR REPLACE FUNCTION public.beta_elo_process_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  t record;
  r1 integer; r2 integer;
  exp1 numeric; exp2 numeric;
  s1 numeric; s2 numeric;
  k constant integer := 32;
  new1 integer; new2 integer;
  res1 text; res2 text;
  played timestamptz;
BEGIN
  SELECT tm.*, tr.is_ranked, tr.is_active, COALESCE(tr.event_date, tm.updated_at) AS ev
  INTO m
  FROM public.tournament_matches tm
  JOIN public.tournaments tr ON tr.id = tm.tournament_id
  WHERE tm.id = _match_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT COALESCE(m.is_ranked, false) THEN RETURN; END IF;
  IF m.status IS DISTINCT FROM 'completed' THEN RETURN; END IF;
  IF m.player1_id IS NULL OR m.player2_id IS NULL THEN RETURN; END IF;
  IF m.player1_id = m.player2_id THEN RETURN; END IF;

  -- skip if already processed
  IF EXISTS (SELECT 1 FROM public.beta_elo_matches
             WHERE source_match_id = _match_id AND player_id = m.player1_id) THEN
    RETURN;
  END IF;

  played := COALESCE(m.ev, m.updated_at, now());

  -- get/seed ratings
  INSERT INTO public.beta_elo_ratings (user_id) VALUES (m.player1_id)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.beta_elo_ratings (user_id) VALUES (m.player2_id)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT rating INTO r1 FROM public.beta_elo_ratings WHERE user_id = m.player1_id;
  SELECT rating INTO r2 FROM public.beta_elo_ratings WHERE user_id = m.player2_id;

  exp1 := 1.0 / (1.0 + power(10.0, (r2 - r1) / 400.0));
  exp2 := 1.0 - exp1;

  IF m.winner_id = m.player1_id THEN
    s1 := 1; s2 := 0; res1 := 'win'; res2 := 'loss';
  ELSIF m.winner_id = m.player2_id THEN
    s1 := 0; s2 := 1; res1 := 'loss'; res2 := 'win';
  ELSE
    s1 := 0.5; s2 := 0.5; res1 := 'draw'; res2 := 'draw';
  END IF;

  new1 := r1 + round(k * (s1 - exp1));
  new2 := r2 + round(k * (s2 - exp2));

  INSERT INTO public.beta_elo_matches
    (source_match_id, tournament_id, player_id, opponent_id, result,
     rating_before, rating_after, opponent_rating_before, delta, played_at)
  VALUES
    (_match_id, m.tournament_id, m.player1_id, m.player2_id, res1,
     r1, new1, r2, new1 - r1, played),
    (_match_id, m.tournament_id, m.player2_id, m.player1_id, res2,
     r2, new2, r1, new2 - r2, played);

  UPDATE public.beta_elo_ratings SET
    rating = new1,
    peak_rating = GREATEST(peak_rating, new1),
    matches_played = matches_played + 1,
    wins   = wins   + CASE WHEN res1='win'  THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN res1='loss' THEN 1 ELSE 0 END,
    draws  = draws  + CASE WHEN res1='draw' THEN 1 ELSE 0 END,
    tier_key = public.beta_elo_tier_for(new1),
    last_match_at = played
  WHERE user_id = m.player1_id;

  UPDATE public.beta_elo_ratings SET
    rating = new2,
    peak_rating = GREATEST(peak_rating, new2),
    matches_played = matches_played + 1,
    wins   = wins   + CASE WHEN res2='win'  THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN res2='loss' THEN 1 ELSE 0 END,
    draws  = draws  + CASE WHEN res2='draw' THEN 1 ELSE 0 END,
    tier_key = public.beta_elo_tier_for(new2),
    last_match_at = played
  WHERE user_id = m.player2_id;
END;
$$;

-- ---------- BACKFILL ----------
CREATE OR REPLACE FUNCTION public.beta_elo_backfill()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  n integer := 0;
BEGIN
  -- Wipe to recompute deterministically
  DELETE FROM public.beta_elo_matches;
  DELETE FROM public.beta_elo_ratings;

  FOR rec IN
    SELECT tm.id
    FROM public.tournament_matches tm
    JOIN public.tournaments tr ON tr.id = tm.tournament_id
    WHERE COALESCE(tr.is_ranked, false) = true
      AND tm.status = 'completed'
      AND tm.player1_id IS NOT NULL
      AND tm.player2_id IS NOT NULL
      AND tm.player1_id <> tm.player2_id
    ORDER BY COALESCE(tr.event_date, tm.updated_at) ASC, tm.round ASC NULLS LAST, tm.match_number ASC NULLS LAST
  LOOP
    PERFORM public.beta_elo_process_match(rec.id);
    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

-- ---------- AUTO TRIGGER ON MATCH COMPLETION ----------
CREATE OR REPLACE FUNCTION public.beta_elo_on_match_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND NEW.player1_id IS NOT NULL
     AND NEW.player2_id IS NOT NULL THEN
    PERFORM public.beta_elo_process_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER beta_elo_after_match_change
  AFTER INSERT OR UPDATE OF status, winner_id ON public.tournament_matches
  FOR EACH ROW EXECUTE FUNCTION public.beta_elo_on_match_change();
