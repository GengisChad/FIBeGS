-- ============================================================
-- 1) FIX SPAREGGI: pulisci match orfani per tornei con tiebreaker_depth=0
-- ============================================================

-- Cancella match di spareggio (tiebreaker phase) quando tiebreaker_depth = 0 o NULL
DELETE FROM public.tournament_matches tm
USING public.tournaments t
WHERE tm.tournament_id = t.id
  AND tm.phase = 'tiebreaker'
  AND COALESCE(t.tiebreaker_depth, 0) = 0;

-- Cancella i match 3°/4° posto (top_cut match_number=2 nell'ultimo round)
-- per tornei con tiebreaker_depth < 4
WITH final_rounds AS (
  SELECT tournament_id, MAX(round) AS final_round
  FROM public.tournament_matches
  WHERE phase IN ('top_cut', 'u12_top_cut')
  GROUP BY tournament_id, phase
)
DELETE FROM public.tournament_matches tm
USING public.tournaments t, final_rounds fr
WHERE tm.tournament_id = t.id
  AND tm.tournament_id = fr.tournament_id
  AND tm.phase IN ('top_cut', 'u12_top_cut')
  AND tm.match_number = 2
  AND tm.round = fr.final_round
  AND COALESCE(t.tiebreaker_depth, 0) < 4
  AND tm.status = 'pending'
  AND tm.winner_id IS NULL;

-- Cancella i pre_top_cut quando tiebreaker_depth = 0
DELETE FROM public.tournament_matches tm
USING public.tournaments t
WHERE tm.tournament_id = t.id
  AND tm.phase = 'pre_top_cut'
  AND COALESCE(t.tiebreaker_depth, 0) = 0
  AND tm.status = 'pending'
  AND tm.winner_id IS NULL;

-- Trigger di safety: blocca insert di match di spareggio se il torneo ha tiebreaker_depth=0
CREATE OR REPLACE FUNCTION public.guard_tiebreaker_match_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_depth integer;
  v_final_round integer;
BEGIN
  SELECT COALESCE(tiebreaker_depth, 0) INTO v_depth
  FROM public.tournaments WHERE id = NEW.tournament_id;

  -- Block tiebreaker phase entirely when depth = 0
  IF NEW.phase = 'tiebreaker' AND v_depth = 0 THEN
    RAISE EXCEPTION 'Cannot create tiebreaker matches: tournament has tiebreaker_depth = 0';
  END IF;

  -- Block 3rd/4th place match (top_cut match_number=2 in final round) when depth < 4
  IF NEW.phase IN ('top_cut', 'u12_top_cut') AND NEW.match_number = 2 AND v_depth < 4 THEN
    SELECT MAX(round) INTO v_final_round
    FROM public.tournament_matches
    WHERE tournament_id = NEW.tournament_id AND phase = NEW.phase;
    IF v_final_round IS NOT NULL AND NEW.round = v_final_round THEN
      RAISE EXCEPTION 'Cannot create 3rd/4th place match: tournament tiebreaker_depth < 4';
    END IF;
  END IF;

  -- Block pre_top_cut when depth = 0
  IF NEW.phase = 'pre_top_cut' AND v_depth = 0 THEN
    RAISE EXCEPTION 'Cannot create pre_top_cut playoff matches: tournament has tiebreaker_depth = 0';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tiebreaker_match_insert_trg ON public.tournament_matches;
CREATE TRIGGER guard_tiebreaker_match_insert_trg
BEFORE INSERT ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.guard_tiebreaker_match_insert();

-- ============================================================
-- 2) IMPORTER STAGING: tabella per tornei in stand-by di importazione
-- ============================================================

CREATE TABLE IF NOT EXISTS public.imported_tournaments_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID NOT NULL,
  source_platform TEXT NOT NULL CHECK (source_platform IN ('challonge', 'challengermode')),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Editable tournament metadata
  title TEXT NOT NULL,
  description TEXT,
  city TEXT,
  location TEXT,
  event_date TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  format TEXT,
  is_ranked BOOLEAN NOT NULL DEFAULT true,
  -- Editable participants/matches/standings stored as JSON
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  standings JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Workflow status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
  sent_tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  send_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imported_staging_status ON public.imported_tournaments_staging(status);
CREATE INDEX IF NOT EXISTS idx_imported_staging_imported_by ON public.imported_tournaments_staging(imported_by);

ALTER TABLE public.imported_tournaments_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can view all staging"
ON public.imported_tournaments_staging FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins and staff can insert staging"
ON public.imported_tournaments_staging FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins and staff can update staging"
ON public.imported_tournaments_staging FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins and staff can delete staging"
ON public.imported_tournaments_staging FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Auto-update updated_at
CREATE TRIGGER update_imported_staging_updated_at
BEFORE UPDATE ON public.imported_tournaments_staging
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();