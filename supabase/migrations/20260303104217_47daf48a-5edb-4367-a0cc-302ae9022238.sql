
-- Ranking seasons table
CREATE TABLE public.ranking_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.ranking_seasons ENABLE ROW LEVEL SECURITY;

-- Everyone can view seasons
CREATE POLICY "Seasons are viewable by everyone" ON public.ranking_seasons
  FOR SELECT TO authenticated, anon USING (true);

-- Only admins can manage seasons
CREATE POLICY "Admins can insert seasons" ON public.ranking_seasons
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update seasons" ON public.ranking_seasons
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete seasons" ON public.ranking_seasons
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Season snapshots for archived rankings
CREATE TABLE public.ranking_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.ranking_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  city text,
  region_id uuid REFERENCES public.regions(id),
  points integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  final_rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Snapshots are viewable by everyone" ON public.ranking_snapshots
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admins can insert snapshots" ON public.ranking_snapshots
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add region_id to profiles for region filtering
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES public.regions(id);
