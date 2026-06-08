CREATE OR REPLACE FUNCTION public.normalize_tournament_bye_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  solo_player uuid;
BEGIN
  IF NEW.player1_id IS NULL AND NEW.player2_id IS NULL THEN
    NEW.winner_id := NULL;
    IF NEW.status = 'completed' THEN
      NEW.status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.player1_id IS NULL) <> (NEW.player2_id IS NULL) THEN
    solo_player := COALESCE(NEW.player1_id, NEW.player2_id);

    -- Keep a single-player match canonical: real player always in player1, BYE/null in player2.
    NEW.player1_id := solo_player;
    NEW.player2_id := NULL;

    -- Swiss and pre-top-cut BYEs are real auto-wins. For bracket slots, only complete
    -- when a winner/status was explicitly assigned, so empty waiting slots remain pending.
    IF NEW.phase IN ('swiss', 'pre_top_cut')
       OR NEW.status = 'completed'
       OR NEW.winner_id = solo_player THEN
      NEW.winner_id := solo_player;
      NEW.status := 'completed';
      NEW.player1_score := GREATEST(COALESCE(NEW.player1_score, 0), 4);
      NEW.player2_score := COALESCE(NEW.player2_score, 0);
    ELSE
      NEW.winner_id := NULL;
      NEW.status := COALESCE(NEW.status, 'pending');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_tournament_bye_match_before_write ON public.tournament_matches;
CREATE TRIGGER normalize_tournament_bye_match_before_write
BEFORE INSERT OR UPDATE OF player1_id, player2_id, winner_id, status, player1_score, player2_score, phase
ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.normalize_tournament_bye_match();

UPDATE public.tournament_matches tm
SET
  player1_id = COALESCE(tm.player1_id, tm.player2_id),
  player2_id = NULL,
  winner_id = COALESCE(tm.winner_id, tm.player1_id, tm.player2_id),
  status = 'completed',
  player1_score = GREATEST(COALESCE(tm.player1_score, 0), 4),
  player2_score = COALESCE(tm.player2_score, 0)
FROM public.tournaments t
WHERE t.id = tm.tournament_id
  AND t.status NOT IN ('completed', 'cancelled')
  AND ((tm.player1_id IS NULL) <> (tm.player2_id IS NULL))
  AND (
    tm.phase IN ('swiss', 'pre_top_cut')
    OR tm.status = 'completed'
    OR tm.winner_id = COALESCE(tm.player1_id, tm.player2_id)
  );