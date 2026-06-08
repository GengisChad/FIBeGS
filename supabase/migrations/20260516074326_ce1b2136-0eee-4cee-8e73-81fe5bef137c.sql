
-- Helper: is the user a manager of the given championship?
CREATE OR REPLACE FUNCTION public.is_championship_manager(_user_id uuid, _championship_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.championship_managers
    WHERE championship_id = _championship_id
      AND user_id = _user_id
  )
$$;

-- Championships: replace sponsor-gated update policy with manager-based one
DROP POLICY IF EXISTS "Sponsors can update assigned championships" ON public.championships;

CREATE POLICY "Managers can update assigned championships"
ON public.championships
FOR UPDATE
USING (public.is_championship_manager(auth.uid(), id))
WITH CHECK (public.is_championship_manager(auth.uid(), id));

-- Tournaments: replace sponsor-gated policies with manager-based ones
DROP POLICY IF EXISTS "Championship managers can insert tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Championship managers can update tournaments" ON public.tournaments;

CREATE POLICY "Championship managers can insert tournaments"
ON public.tournaments
FOR INSERT
WITH CHECK (
  championship_id IS NOT NULL
  AND public.is_championship_manager(auth.uid(), championship_id)
);

CREATE POLICY "Championship managers can update tournaments"
ON public.tournaments
FOR UPDATE
USING (
  championship_id IS NOT NULL
  AND public.is_championship_manager(auth.uid(), championship_id)
)
WITH CHECK (
  championship_id IS NOT NULL
  AND public.is_championship_manager(auth.uid(), championship_id)
);

CREATE POLICY "Championship managers can delete tournaments"
ON public.tournaments
FOR DELETE
USING (
  championship_id IS NOT NULL
  AND public.is_championship_manager(auth.uid(), championship_id)
);

-- Championship sponsors: let managers manage them too (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='championship_sponsors') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Managers can manage championship sponsors" ON public.championship_sponsors';
    EXECUTE $p$CREATE POLICY "Managers can manage championship sponsors"
      ON public.championship_sponsors
      FOR ALL
      USING (public.is_championship_manager(auth.uid(), championship_id))
      WITH CHECK (public.is_championship_manager(auth.uid(), championship_id))$p$;
  END IF;
END$$;
