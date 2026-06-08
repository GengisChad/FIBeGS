
CREATE TABLE public.championship_referees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (championship_id, user_id)
);

CREATE INDEX idx_championship_referees_championship ON public.championship_referees(championship_id);
CREATE INDEX idx_championship_referees_user ON public.championship_referees(user_id);

ALTER TABLE public.championship_referees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Championship referees viewable by everyone"
ON public.championship_referees
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage championship referees"
ON public.championship_referees
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage championship referees while active"
ON public.championship_referees
FOR ALL
USING (
  public.is_championship_manager(auth.uid(), championship_id)
  AND EXISTS (SELECT 1 FROM public.championships c WHERE c.id = championship_id AND c.is_active = true)
)
WITH CHECK (
  public.is_championship_manager(auth.uid(), championship_id)
  AND EXISTS (SELECT 1 FROM public.championships c WHERE c.id = championship_id AND c.is_active = true)
);

-- Helper to check at runtime whether a user is a championship referee
CREATE OR REPLACE FUNCTION public.is_championship_referee(_user_id uuid, _championship_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.championship_referees
    WHERE championship_id = _championship_id AND user_id = _user_id
  )
$$;
