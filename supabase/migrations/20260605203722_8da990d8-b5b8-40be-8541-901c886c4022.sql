-- Floor tier so ratings below the lowest tier still resolve
CREATE OR REPLACE FUNCTION public.beta_elo_tier_for(_rating integer)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT key FROM public.beta_elo_tiers
       WHERE _rating >= min_rating AND (max_rating IS NULL OR _rating <= max_rating)
       ORDER BY sort_order DESC LIMIT 1),
    (SELECT key FROM public.beta_elo_tiers ORDER BY sort_order ASC LIMIT 1)
  );
$function$;

CREATE OR REPLACE FUNCTION public.beta_elo_process_match(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  r1 integer; r2 integer;
  mp1 integer; mp2 integer;
  k1 integer; k2 integer;
  exp1 numeric; exp2 numeric;
  s1 numeric; s2 numeric;
  new1 integer; new2 integer;
  res1 text; res2 text;
  played timestamptz;
BEGIN
  SELECT tm.*, tr.is_ranked, COALESCE(tr.event_date, tm.updated_at) AS ev
  INTO m
  FROM public.tournament_matches tm
  JOIN public.tournaments tr ON tr.id = tm.tournament_id
  WHERE tm.id = _match_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT COALESCE(m.is_ranked, false) THEN RETURN; END IF;
  IF m.status IS DISTINCT FROM 'completed' THEN RETURN; END IF;
  IF m.player1_id IS NULL OR m.player2_id IS NULL THEN RETURN; END IF;
  IF m.player1_id = m.player2_id THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.beta_elo_matches
             WHERE source_match_id = _match_id AND player_id = m.player1_id) THEN
    RETURN;
  END IF;

  played := COALESCE(m.ev, m.updated_at, now());

  INSERT INTO public.beta_elo_ratings (user_id) VALUES (m.player1_id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.beta_elo_ratings (user_id) VALUES (m.player2_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT rating, matches_played INTO r1, mp1 FROM public.beta_elo_ratings WHERE user_id = m.player1_id;
  SELECT rating, matches_played INTO r2, mp2 FROM public.beta_elo_ratings WHERE user_id = m.player2_id;

  k1 := CASE WHEN mp1 < 30 THEN 40 WHEN r1 >= 2400 THEN 16 WHEN r1 >= 2000 THEN 24 ELSE 32 END;
  k2 := CASE WHEN mp2 < 30 THEN 40 WHEN r2 >= 2400 THEN 16 WHEN r2 >= 2000 THEN 24 ELSE 32 END;

  exp1 := 1.0 / (1.0 + power(10.0, (r2 - r1) / 400.0));
  exp2 := 1.0 - exp1;

  IF m.winner_id = m.player1_id THEN
    s1 := 1; s2 := 0; res1 := 'win'; res2 := 'loss';
  ELSIF m.winner_id = m.player2_id THEN
    s1 := 0; s2 := 1; res1 := 'loss'; res2 := 'win';
  ELSE
    s1 := 0.5; s2 := 0.5; res1 := 'draw'; res2 := 'draw';
  END IF;

  new1 := r1 + round(k1 * (s1 - exp1));
  new2 := r2 + round(k2 * (s2 - exp2));

  INSERT INTO public.beta_elo_matches
    (source_match_id, tournament_id, player_id, opponent_id, result,
     rating_before, rating_after, opponent_rating_before, delta, played_at)
  VALUES
    (_match_id, m.tournament_id, m.player1_id, m.player2_id, res1, r1, new1, r2, new1 - r1, played),
    (_match_id, m.tournament_id, m.player2_id, m.player1_id, res2, r2, new2, r1, new2 - r2, played);

  UPDATE public.beta_elo_ratings SET
    rating = new1, peak_rating = GREATEST(peak_rating, new1), matches_played = matches_played + 1,
    wins = wins + CASE WHEN res1='win' THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN res1='loss' THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN res1='draw' THEN 1 ELSE 0 END,
    tier_key = public.beta_elo_tier_for(new1), last_match_at = played
  WHERE user_id = m.player1_id;

  UPDATE public.beta_elo_ratings SET
    rating = new2, peak_rating = GREATEST(peak_rating, new2), matches_played = matches_played + 1,
    wins = wins + CASE WHEN res2='win' THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN res2='loss' THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN res2='draw' THEN 1 ELSE 0 END,
    tier_key = public.beta_elo_tier_for(new2), last_match_at = played
  WHERE user_id = m.player2_id;
END;
$function$;

DROP TRIGGER IF EXISTS trg_beta_elo_on_match_change ON public.tournament_matches;
CREATE TRIGGER trg_beta_elo_on_match_change
AFTER INSERT OR UPDATE OF status, winner_id, player1_id, player2_id
ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.beta_elo_on_match_change();

SELECT public.beta_elo_backfill();