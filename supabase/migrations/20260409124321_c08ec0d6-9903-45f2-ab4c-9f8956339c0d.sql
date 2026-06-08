
-- Function to update club_members.last_tournament_at when tournament results are inserted
CREATE OR REPLACE FUNCTION public.update_member_last_tournament()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_date timestamptz;
BEGIN
  -- Get the event_date of the tournament
  SELECT t.event_date INTO _event_date
  FROM tournaments t
  WHERE t.id = NEW.tournament_id;

  IF _event_date IS NULL THEN
    _event_date := now();
  END IF;

  -- Update club_members for this user only if the new date is more recent
  UPDATE club_members
  SET last_tournament_at = _event_date
  WHERE user_id = NEW.user_id
    AND (last_tournament_at IS NULL OR last_tournament_at < _event_date);

  RETURN NEW;
END;
$$;

-- Create trigger on tournament_results
DROP TRIGGER IF EXISTS trg_update_member_last_tournament ON tournament_results;
CREATE TRIGGER trg_update_member_last_tournament
AFTER INSERT ON tournament_results
FOR EACH ROW
EXECUTE FUNCTION public.update_member_last_tournament();

-- Backfill: update last_tournament_at for all existing club members based on their latest tournament result
UPDATE club_members cm
SET last_tournament_at = sub.max_date
FROM (
  SELECT tr.user_id, MAX(t.event_date) AS max_date
  FROM tournament_results tr
  JOIN tournaments t ON t.id = tr.tournament_id
  GROUP BY tr.user_id
) sub
WHERE cm.user_id = sub.user_id
  AND (cm.last_tournament_at IS NULL OR cm.last_tournament_at < sub.max_date);
