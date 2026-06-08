
-- Prevent regular users from self-promoting their tournament registration to "ready" or escalating status.
-- Only the registration owner can update their own row, but only safe fields. Privileged fields
-- (is_ready, status) can ONLY be changed by club staff or admins.

CREATE OR REPLACE FUNCTION public.guard_tournament_registration_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_is_staff_or_admin boolean := false;
BEGIN
  -- Allow service role / no auth context
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT club_id INTO v_club_id FROM public.tournaments WHERE id = NEW.tournament_id;

  v_is_staff_or_admin := has_role(auth.uid(), 'admin'::app_role)
    OR (v_club_id IS NOT NULL AND is_club_staff(auth.uid(), v_club_id));

  IF v_is_staff_or_admin THEN
    RETURN NEW;
  END IF;

  -- Non-staff users cannot toggle is_ready
  IF COALESCE(NEW.is_ready, false) IS DISTINCT FROM COALESCE(OLD.is_ready, false) THEN
    RAISE EXCEPTION 'Only club staff or admins can change is_ready';
  END IF;

  -- Non-staff users cannot promote themselves to "confirmed" (can only stay or downgrade to "cancelled" / "waitlist")
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
      RAISE EXCEPTION 'Only club staff or admins can confirm a registration';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tournament_registration_update ON public.tournament_registrations;
CREATE TRIGGER guard_tournament_registration_update
BEFORE UPDATE ON public.tournament_registrations
FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_registration_update();


-- Same guard for tournament_teams: team creators can edit team_name etc., but not is_ready
CREATE OR REPLACE FUNCTION public.guard_tournament_team_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_is_staff_or_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT club_id INTO v_club_id FROM public.tournaments WHERE id = NEW.tournament_id;

  v_is_staff_or_admin := has_role(auth.uid(), 'admin'::app_role)
    OR (v_club_id IS NOT NULL AND is_club_staff(auth.uid(), v_club_id));

  IF v_is_staff_or_admin THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_ready, false) IS DISTINCT FROM COALESCE(OLD.is_ready, false) THEN
    RAISE EXCEPTION 'Only club staff or admins can change is_ready';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tournament_team_update ON public.tournament_teams;
CREATE TRIGGER guard_tournament_team_update
BEFORE UPDATE ON public.tournament_teams
FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_team_update();

-- Reset stale is_ready=true for ongoing/upcoming tournaments where the player was confirmed
-- without staff approval (defensive cleanup so future check-in is clean).
-- Only resets registrations whose tournaments are not yet started/completed.
UPDATE public.tournament_registrations r
SET is_ready = false
FROM public.tournaments t
WHERE r.tournament_id = t.id
  AND t.status = 'pending'
  AND r.is_ready = true
  AND t.check_in_enabled = true
  AND t.event_date >= (now() - interval '1 day');
