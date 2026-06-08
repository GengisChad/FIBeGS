CREATE TABLE IF NOT EXISTS public.tournament_round_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  round integer NOT NULL,
  phase text NOT NULL DEFAULT 'swiss',
  group_number integer,
  matches_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_tournament_round_snapshots_tid
  ON public.tournament_round_snapshots(tournament_id, created_at DESC);

ALTER TABLE public.tournament_round_snapshots ENABLE ROW LEVEL SECURITY;

-- Only admins/staff can read or write snapshots
CREATE POLICY "Admins can view snapshots"
  ON public.tournament_round_snapshots
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can insert snapshots"
  ON public.tournament_round_snapshots
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can delete snapshots"
  ON public.tournament_round_snapshots
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));