
ALTER TABLE public.club_venues
  ADD COLUMN IF NOT EXISTS is_shop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_logo_url text,
  ADD COLUMN IF NOT EXISTS shop_phone text,
  ADD COLUMN IF NOT EXISTS shop_email text,
  ADD COLUMN IF NOT EXISTS shop_website text,
  ADD COLUMN IF NOT EXISTS shop_description text,
  ADD COLUMN IF NOT EXISTS shop_instagram text,
  ADD COLUMN IF NOT EXISTS shop_facebook text,
  ADD COLUMN IF NOT EXISTS shop_tiktok text,
  ADD COLUMN IF NOT EXISTS shop_whatsapp text,
  ADD COLUMN IF NOT EXISTS shop_hours jsonb;

CREATE TABLE IF NOT EXISTS public.club_free_play_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.club_venues(id) ON DELETE CASCADE,
  title text,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  valid_from date,
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (day_of_week BETWEEN 0 AND 6),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_cfp_schedules_club ON public.club_free_play_schedules(club_id);
CREATE INDEX IF NOT EXISTS idx_cfp_schedules_venue ON public.club_free_play_schedules(venue_id);

CREATE TABLE IF NOT EXISTS public.club_free_play_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.club_free_play_schedules(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  exception_type text NOT NULL,
  start_time time,
  end_time time,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (exception_type IN ('cancel','override','add'))
);
CREATE INDEX IF NOT EXISTS idx_cfp_exceptions_schedule ON public.club_free_play_exceptions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_cfp_exceptions_date ON public.club_free_play_exceptions(exception_date);

DROP TRIGGER IF EXISTS trg_cfp_schedules_updated_at ON public.club_free_play_schedules;
CREATE TRIGGER trg_cfp_schedules_updated_at
  BEFORE UPDATE ON public.club_free_play_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_club_member(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = _club_id AND user_id = _user_id
  );
$$;

ALTER TABLE public.club_free_play_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view free play schedules" ON public.club_free_play_schedules;
CREATE POLICY "Members can view free play schedules"
  ON public.club_free_play_schedules FOR SELECT
  USING (
    public.is_club_member(auth.uid(), club_id)
    OR public.is_club_staff(auth.uid(), club_id)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Staff can insert free play schedules" ON public.club_free_play_schedules;
CREATE POLICY "Staff can insert free play schedules"
  ON public.club_free_play_schedules FOR INSERT
  WITH CHECK (
    public.is_club_staff(auth.uid(), club_id)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Staff can update free play schedules" ON public.club_free_play_schedules;
CREATE POLICY "Staff can update free play schedules"
  ON public.club_free_play_schedules FOR UPDATE
  USING (
    public.is_club_staff(auth.uid(), club_id)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Staff can delete free play schedules" ON public.club_free_play_schedules;
CREATE POLICY "Staff can delete free play schedules"
  ON public.club_free_play_schedules FOR DELETE
  USING (
    public.is_club_staff(auth.uid(), club_id)
    OR public.has_role(auth.uid(), 'admin')
  );

ALTER TABLE public.club_free_play_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view free play exceptions" ON public.club_free_play_exceptions;
CREATE POLICY "Members can view free play exceptions"
  ON public.club_free_play_exceptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_free_play_schedules s
      WHERE s.id = schedule_id
        AND (
          public.is_club_member(auth.uid(), s.club_id)
          OR public.is_club_staff(auth.uid(), s.club_id)
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Staff can insert free play exceptions" ON public.club_free_play_exceptions;
CREATE POLICY "Staff can insert free play exceptions"
  ON public.club_free_play_exceptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_free_play_schedules s
      WHERE s.id = schedule_id
        AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Staff can update free play exceptions" ON public.club_free_play_exceptions;
CREATE POLICY "Staff can update free play exceptions"
  ON public.club_free_play_exceptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_free_play_schedules s
      WHERE s.id = schedule_id
        AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Staff can delete free play exceptions" ON public.club_free_play_exceptions;
CREATE POLICY "Staff can delete free play exceptions"
  ON public.club_free_play_exceptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_free_play_schedules s
      WHERE s.id = schedule_id
        AND (public.is_club_staff(auth.uid(), s.club_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );
