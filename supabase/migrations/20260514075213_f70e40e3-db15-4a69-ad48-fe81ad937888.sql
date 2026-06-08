
CREATE TABLE IF NOT EXISTS public.rules_section_visibility (
  section_key TEXT PRIMARY KEY,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rules_section_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rules visibility" ON public.rules_section_visibility;
CREATE POLICY "Anyone can read rules visibility"
  ON public.rules_section_visibility FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage rules visibility" ON public.rules_section_visibility;
CREATE POLICY "Admins manage rules visibility"
  ON public.rules_section_visibility FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.rules_section_visibility (section_key, is_visible, position) VALUES
  ('gameplay_rules', true, 10),
  ('ranked_3d_models', true, 20),
  ('judge_courses', true, 30),
  ('referee_test_card', true, 40),
  ('community_guidelines', true, 50)
ON CONFLICT (section_key) DO NOTHING;
