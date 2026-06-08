-- Templates
CREATE TABLE public.event_feedback_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('tournament','event','championship')),
  name TEXT NOT NULL DEFAULT 'Questionario feedback',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_feedback_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates readable by authenticated"
ON public.event_feedback_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Templates managed by staff/admin insert"
ON public.event_feedback_templates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Templates managed by staff/admin update"
ON public.event_feedback_templates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Templates managed by staff/admin delete"
ON public.event_feedback_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE TRIGGER trg_event_feedback_templates_updated
BEFORE UPDATE ON public.event_feedback_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Responses
CREATE TABLE public.event_feedback_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('tournament','event','championship')),
  target_id UUID NOT NULL,
  template_id UUID REFERENCES public.event_feedback_templates(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX idx_event_feedback_responses_target ON public.event_feedback_responses(target_type, target_id);
CREATE INDEX idx_event_feedback_responses_user ON public.event_feedback_responses(user_id);

ALTER TABLE public.event_feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feedback"
ON public.event_feedback_responses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own feedback"
ON public.event_feedback_responses FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff/admin delete feedback"
ON public.event_feedback_responses FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Seed default templates
INSERT INTO public.event_feedback_templates (scope, name, steps) VALUES
('tournament', 'Feedback torneo', '[
  {"title":"Organizzazione","description":"Com''è stata gestita la giornata?","questions":[
    {"id":"org_rating","type":"rating","label":"Voto generale all''organizzazione","required":true},
    {"id":"punctuality","type":"rating","label":"Puntualità nei tempi","required":true}
  ]},
  {"title":"Location e staff","description":"","questions":[
    {"id":"location_rating","type":"rating","label":"Location","required":true},
    {"id":"staff_rating","type":"rating","label":"Cortesia dello staff","required":true}
  ]},
  {"title":"Commenti","description":"","questions":[
    {"id":"comments","type":"text","label":"Suggerimenti o commenti","required":false}
  ]}
]'::jsonb),
('event', 'Feedback evento', '[
  {"title":"Esperienza","description":"","questions":[
    {"id":"exp_rating","type":"rating","label":"Voto generale all''evento","required":true}
  ]},
  {"title":"Commenti","description":"","questions":[
    {"id":"comments","type":"text","label":"Suggerimenti o commenti","required":false}
  ]}
]'::jsonb),
('championship', 'Feedback campionato', '[
  {"title":"Andamento","description":"","questions":[
    {"id":"overall_rating","type":"rating","label":"Voto generale al campionato","required":true}
  ]},
  {"title":"Commenti","description":"","questions":[
    {"id":"comments","type":"text","label":"Suggerimenti o commenti","required":false}
  ]}
]'::jsonb);