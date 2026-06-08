
-- Snapshot table
CREATE TABLE IF NOT EXISTS public.tournament_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID,
  tournament_data JSONB NOT NULL,
  matches JSONB NOT NULL,
  standings JSONB NOT NULL,
  registrations JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tournament_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tournament_snapshots_tournament_idx
  ON public.tournament_snapshots(tournament_id, created_at DESC);

DROP POLICY IF EXISTS "Admins manage tournament_snapshots" ON public.tournament_snapshots;
CREATE POLICY "Admins manage tournament_snapshots"
ON public.tournament_snapshots
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Prevent duplicate matches at the same coordinate (excluding intentional 3rd-place / tiebreaker rows where match_number can be reused)
-- Use a partial unique index on phase top_cut/swiss matches with match_number = 1 (and others) but allow special placements.
-- Simpler: enforce uniqueness for (tournament_id, phase, round, match_number) where status not 'tiebreaker' is tricky;
-- use a non-unique deduplication via trigger on insert.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_top_cut_match()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  IF NEW.phase = 'top_cut' THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.tournament_matches
    WHERE tournament_id = NEW.tournament_id
      AND phase = 'top_cut'
      AND round = NEW.round
      AND match_number = NEW.match_number;
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Duplicate top_cut match (round=%, match_number=%) for tournament %', NEW.round, NEW.match_number, NEW.tournament_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ SET search_path = public;

DROP TRIGGER IF EXISTS prevent_duplicate_top_cut_match_trg ON public.tournament_matches;
CREATE TRIGGER prevent_duplicate_top_cut_match_trg
BEFORE INSERT ON public.tournament_matches
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_top_cut_match();

-- Snapshot helpers
CREATE OR REPLACE FUNCTION public.create_tournament_snapshot(_tournament_id UUID, _reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap_id UUID;
  t_data JSONB;
  m_data JSONB;
  s_data JSONB;
  r_data JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create snapshots';
  END IF;

  SELECT to_jsonb(t.*) INTO t_data FROM public.tournaments t WHERE t.id = _tournament_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(m.*)), '[]'::jsonb) INTO m_data FROM public.tournament_matches m WHERE m.tournament_id = _tournament_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(s.*)), '[]'::jsonb) INTO s_data FROM public.tournament_standings s WHERE s.tournament_id = _tournament_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) INTO r_data FROM public.tournament_registrations r WHERE r.tournament_id = _tournament_id;

  INSERT INTO public.tournament_snapshots(tournament_id, reason, created_by, tournament_data, matches, standings, registrations)
  VALUES (_tournament_id, _reason, auth.uid(), COALESCE(t_data, '{}'::jsonb), m_data, s_data, r_data)
  RETURNING id INTO snap_id;

  -- Keep last 30 snapshots per tournament
  DELETE FROM public.tournament_snapshots
  WHERE tournament_id = _tournament_id
    AND id NOT IN (
      SELECT id FROM public.tournament_snapshots
      WHERE tournament_id = _tournament_id
      ORDER BY created_at DESC LIMIT 30
    );

  RETURN snap_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_tournament_snapshot(_snapshot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap RECORD;
  matches_restored INTEGER := 0;
  standings_restored INTEGER := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can restore snapshots';
  END IF;

  SELECT * INTO snap FROM public.tournament_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found';
  END IF;

  -- Take a safety snapshot before restoring
  PERFORM public.create_tournament_snapshot(snap.tournament_id, 'auto:before-restore-' || _snapshot_id::text);

  -- Wipe matches & standings, then restore from snapshot
  DELETE FROM public.tournament_matches WHERE tournament_id = snap.tournament_id;
  DELETE FROM public.tournament_standings WHERE tournament_id = snap.tournament_id;

  INSERT INTO public.tournament_matches
  SELECT * FROM jsonb_populate_recordset(NULL::public.tournament_matches, snap.matches);
  GET DIAGNOSTICS matches_restored = ROW_COUNT;

  INSERT INTO public.tournament_standings
  SELECT * FROM jsonb_populate_recordset(NULL::public.tournament_standings, snap.standings);
  GET DIAGNOSTICS standings_restored = ROW_COUNT;

  -- Restore tournament status fields (status, action_log)
  UPDATE public.tournaments
  SET status = COALESCE(snap.tournament_data->>'status', status),
      action_log = COALESCE(snap.tournament_data->'action_log', action_log)
  WHERE id = snap.tournament_id;

  RETURN jsonb_build_object('matches_restored', matches_restored, 'standings_restored', standings_restored);
END;
$$;
