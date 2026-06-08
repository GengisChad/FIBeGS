
-- =========================================================
-- Judge Training Courses
-- =========================================================

CREATE TABLE IF NOT EXISTS public.judge_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_image_url text,
  is_published boolean NOT NULL DEFAULT false,
  required_for_test boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.judge_course_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.judge_courses(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  step_type text NOT NULL CHECK (step_type IN ('paragraph','subparagraph','image','video','quiz')),
  title text,
  content_html text,
  media_url text,
  quiz jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS judge_course_steps_course_idx ON public.judge_course_steps(course_id, position);

CREATE TABLE IF NOT EXISTS public.judge_course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.judge_courses(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.judge_course_quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  step_id uuid NOT NULL REFERENCES public.judge_course_steps(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.judge_courses(id) ON DELETE CASCADE,
  selected_index integer,
  is_correct boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_id)
);

-- updated_at triggers (reuse existing helper)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_updated_at') THEN
    CREATE FUNCTION public.set_updated_at() RETURNS trigger
      LANGUAGE plpgsql AS $f$ BEGIN NEW.updated_at = now(); RETURN NEW; END $f$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_judge_courses_updated ON public.judge_courses;
CREATE TRIGGER trg_judge_courses_updated BEFORE UPDATE ON public.judge_courses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_judge_course_steps_updated ON public.judge_course_steps;
CREATE TRIGGER trg_judge_course_steps_updated BEFORE UPDATE ON public.judge_course_steps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_judge_course_progress_updated ON public.judge_course_progress;
CREATE TRIGGER trg_judge_course_progress_updated BEFORE UPDATE ON public.judge_course_progress
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_judge_course_quiz_answers_updated ON public.judge_course_quiz_answers;
CREATE TRIGGER trg_judge_course_quiz_answers_updated BEFORE UPDATE ON public.judge_course_quiz_answers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.judge_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_course_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_course_quiz_answers ENABLE ROW LEVEL SECURITY;

-- Courses: public read of published, admin manages
DROP POLICY IF EXISTS "judge_courses_read_published" ON public.judge_courses;
CREATE POLICY "judge_courses_read_published" ON public.judge_courses
FOR SELECT USING (is_published = true OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "judge_courses_admin_all" ON public.judge_courses;
CREATE POLICY "judge_courses_admin_all" ON public.judge_courses
FOR ALL USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Steps: read if parent course readable; admin manages
DROP POLICY IF EXISTS "judge_course_steps_read" ON public.judge_course_steps;
CREATE POLICY "judge_course_steps_read" ON public.judge_course_steps
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.judge_courses c WHERE c.id = course_id AND (c.is_published OR public.has_role(auth.uid(),'admin')))
);

DROP POLICY IF EXISTS "judge_course_steps_admin_all" ON public.judge_course_steps;
CREATE POLICY "judge_course_steps_admin_all" ON public.judge_course_steps
FOR ALL USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Progress: own rows, admins read all
DROP POLICY IF EXISTS "judge_course_progress_self" ON public.judge_course_progress;
CREATE POLICY "judge_course_progress_self" ON public.judge_course_progress
FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Quiz answers: own rows, admins read all
DROP POLICY IF EXISTS "judge_course_quiz_answers_self" ON public.judge_course_quiz_answers;
CREATE POLICY "judge_course_quiz_answers_self" ON public.judge_course_quiz_answers
FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Storage bucket for course media
INSERT INTO storage.buckets (id, name, public)
VALUES ('judge-course-media', 'judge-course-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "judge_course_media_public_read" ON storage.objects;
CREATE POLICY "judge_course_media_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'judge-course-media');

DROP POLICY IF EXISTS "judge_course_media_admin_write" ON storage.objects;
CREATE POLICY "judge_course_media_admin_write" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'judge-course-media' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "judge_course_media_admin_update" ON storage.objects;
CREATE POLICY "judge_course_media_admin_update" ON storage.objects
FOR UPDATE USING (bucket_id = 'judge-course-media' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "judge_course_media_admin_delete" ON storage.objects;
CREATE POLICY "judge_course_media_admin_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'judge-course-media' AND public.has_role(auth.uid(),'admin'));

-- Helper: did user complete every required course?
CREATE OR REPLACE FUNCTION public.judge_course_required_passed(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.judge_courses c
    WHERE c.required_for_test = true AND c.is_published = true
      AND NOT EXISTS (
        SELECT 1 FROM public.judge_course_progress p
        WHERE p.course_id = c.id AND p.user_id = _user_id AND p.completed = true
      )
  )
$$;

-- =========================================================
-- Reconcile imported tournaments after external account link
-- =========================================================
-- For each tournament where the freshly-linked user newly owns matches /
-- standings (handled by link_external_account_backfill), re-run point
-- finalization so national / BFL ranking reflects their wins.
CREATE OR REPLACE FUNCTION public.reconcile_imported_account_points(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  _tids uuid[];
  _t uuid;
  _count int := 0;
BEGIN
  SELECT array_agg(DISTINCT tid) INTO _tids FROM (
    SELECT tournament_id AS tid FROM public.tournament_matches
      WHERE player1_id = _user_id OR player2_id = _user_id OR winner_id = _user_id
    UNION
    SELECT tournament_id AS tid FROM public.tournament_standings WHERE user_id = _user_id
    UNION
    SELECT tournament_id AS tid FROM public.tournament_registrations WHERE user_id = _user_id
  ) s;

  IF _tids IS NULL THEN
    RETURN jsonb_build_object('tournaments', 0);
  END IF;

  FOREACH _t IN ARRAY _tids LOOP
    BEGIN
      PERFORM public.finalize_tournament_points(_t);
      _count := _count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- skip tournaments where the caller (service role) cannot finalize
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('tournaments', _count);
END;
$$;
