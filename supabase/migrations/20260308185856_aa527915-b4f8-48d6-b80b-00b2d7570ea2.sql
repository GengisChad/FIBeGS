
-- Step 1: Create tables first
CREATE TABLE public.championships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  rules_text text,
  banner_url text,
  logo_url text,
  primary_color text DEFAULT '#FFD700',
  secondary_color text DEFAULT '#1a1a2e',
  is_active boolean NOT NULL DEFAULT true,
  club_required boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.championship_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (championship_id, user_id)
);

CREATE TABLE public.championship_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text NOT NULL,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Step 2: Enable RLS
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_sponsors ENABLE ROW LEVEL SECURITY;

-- Step 3: Policies
CREATE POLICY "Championships viewable by everyone" ON public.championships FOR SELECT USING (true);
CREATE POLICY "Admins can manage championships" ON public.championships FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Sponsors can update assigned championships" ON public.championships FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'sponsor') AND EXISTS (SELECT 1 FROM public.championship_managers cm WHERE cm.championship_id = championships.id AND cm.user_id = auth.uid()));

CREATE POLICY "Admins can manage championship managers" ON public.championship_managers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Championship managers viewable by authenticated" ON public.championship_managers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Championship sponsors viewable by everyone" ON public.championship_sponsors FOR SELECT USING (true);
CREATE POLICY "Admins can manage championship sponsors" ON public.championship_sponsors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Step 4: Add championship_id to tournaments
ALTER TABLE public.tournaments ADD COLUMN championship_id uuid REFERENCES public.championships(id) ON DELETE SET NULL;

-- Step 5: Trigger for updated_at
CREATE TRIGGER update_championships_updated_at BEFORE UPDATE ON public.championships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
