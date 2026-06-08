CREATE OR REPLACE FUNCTION public.normalize_tournament_bye_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  solo_player uuid;
  should_complete boolean;
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
    should_complete := NEW.phase IN ('swiss', 'pre_top_cut')
      OR NEW.status = 'completed'
      OR NEW.winner_id = solo_player;

    IF should_complete THEN
      -- Completed BYEs are canonical: real player in player1, BYE/null in player2.
      NEW.player1_id := solo_player;
      NEW.player2_id := NULL;
      NEW.winner_id := solo_player;
      NEW.status := 'completed';
      NEW.player1_score := GREATEST(COALESCE(NEW.player1_score, 0), 4);
      NEW.player2_score := COALESCE(NEW.player2_score, 0);
    ELSE
      -- Pending bracket slots must keep their original side; no auto winner.
      NEW.winner_id := NULL;
      NEW.status := COALESCE(NEW.status, 'pending');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;