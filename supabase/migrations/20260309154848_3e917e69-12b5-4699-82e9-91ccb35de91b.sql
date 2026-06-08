
-- Add vice_leader to club_role enum
ALTER TYPE public.club_role ADD VALUE IF NOT EXISTS 'vice_leader' AFTER 'staff';

-- Create Vice Club Leader badge
INSERT INTO public.badges (name, color, description)
VALUES ('Vice Club Leader', '#C0C0C0', 'Vice Leader di un club')
ON CONFLICT DO NOTHING;

-- Create trigger function to auto-assign/remove club role badges
CREATE OR REPLACE FUNCTION public.sync_club_role_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  leader_badge_id uuid;
  vice_leader_badge_id uuid;
BEGIN
  -- Get badge IDs
  SELECT id INTO leader_badge_id FROM badges WHERE name = 'Club Leader' LIMIT 1;
  SELECT id INTO vice_leader_badge_id FROM badges WHERE name = 'Vice Club Leader' LIMIT 1;

  -- Handle DELETE: remove badges
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'leader' AND leader_badge_id IS NOT NULL THEN
      DELETE FROM user_badges WHERE user_id = OLD.user_id AND badge_id = leader_badge_id;
    END IF;
    IF OLD.role = 'vice_leader' AND vice_leader_badge_id IS NOT NULL THEN
      DELETE FROM user_badges WHERE user_id = OLD.user_id AND badge_id = vice_leader_badge_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT or UPDATE
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role) THEN
    -- Remove old badges on UPDATE
    IF TG_OP = 'UPDATE' THEN
      IF OLD.role = 'leader' AND leader_badge_id IS NOT NULL THEN
        DELETE FROM user_badges WHERE user_id = OLD.user_id AND badge_id = leader_badge_id;
      END IF;
      IF OLD.role = 'vice_leader' AND vice_leader_badge_id IS NOT NULL THEN
        DELETE FROM user_badges WHERE user_id = OLD.user_id AND badge_id = vice_leader_badge_id;
      END IF;
    END IF;

    -- Assign new badge
    IF NEW.role = 'leader' AND leader_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (NEW.user_id, leader_badge_id)
      ON CONFLICT DO NOTHING;
    END IF;
    IF NEW.role = 'vice_leader' AND vice_leader_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (NEW.user_id, vice_leader_badge_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on club_members
DROP TRIGGER IF EXISTS trg_sync_club_role_badges ON public.club_members;
CREATE TRIGGER trg_sync_club_role_badges
  AFTER INSERT OR UPDATE OF role OR DELETE
  ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_club_role_badges();
