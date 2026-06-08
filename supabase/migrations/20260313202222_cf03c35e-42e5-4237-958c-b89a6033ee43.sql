
-- Table to hold tournament results for players not yet registered
CREATE TABLE public.pending_tournament_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  external_username text NOT NULL,
  platform text NOT NULL,
  placement integer NOT NULL,
  participants_count integer NOT NULL,
  base_points integer NOT NULL DEFAULT 0,
  scaled_points integer NOT NULL DEFAULT 0,
  region_id uuid REFERENCES public.regions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pending results"
  ON public.pending_tournament_results FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function: when a profile is created, check if username matches pending results
CREATE OR REPLACE FUNCTION public.claim_pending_tournament_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending RECORD;
  _region uuid;
BEGIN
  -- Only process if the new profile has a username
  IF NEW.username IS NULL OR NEW.username = '' THEN
    RETURN NEW;
  END IF;

  -- Find all pending results matching this username (case-insensitive)
  FOR pending IN
    SELECT * FROM pending_tournament_results
    WHERE lower(external_username) = lower(NEW.username)
  LOOP
    -- Insert into tournament_results
    INSERT INTO tournament_results (tournament_id, user_id, placement, participants_count, base_points, scaled_points)
    VALUES (pending.tournament_id, NEW.user_id, pending.placement, pending.participants_count, pending.base_points, pending.scaled_points)
    ON CONFLICT DO NOTHING;

    -- Track region from first pending result
    IF _region IS NULL AND pending.region_id IS NOT NULL THEN
      _region := pending.region_id;
    END IF;

    -- Delete the claimed pending result
    DELETE FROM pending_tournament_results WHERE id = pending.id;

    -- Update external_player_mappings to link this user
    UPDATE external_player_mappings
    SET internal_user_id = NEW.user_id::text, updated_at = now()
    WHERE lower(external_username) = lower(pending.external_username)
      AND platform = pending.platform;
  END LOOP;

  -- Apply region to profile if found and profile has no region
  IF _region IS NOT NULL AND NEW.region_id IS NULL THEN
    NEW.region_id := _region;
  END IF;

  -- Recalculate rankings if any results were claimed
  IF FOUND THEN
    PERFORM recalculate_all_rankings();
  END IF;

  RETURN NEW;
END;
$$;

-- Use BEFORE INSERT so we can modify NEW.region_id
CREATE TRIGGER trg_claim_pending_results
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.claim_pending_tournament_results();
