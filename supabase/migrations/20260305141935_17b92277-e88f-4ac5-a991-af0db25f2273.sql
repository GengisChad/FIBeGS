
-- Storage bucket for referee test media
INSERT INTO storage.buckets (id, name, public) VALUES ('referee-test', 'referee-test', true);

CREATE POLICY "Anyone can view referee test files" ON storage.objects FOR SELECT USING (bucket_id = 'referee-test');
CREATE POLICY "Admins can upload referee test files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'referee-test' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update referee test files" ON storage.objects FOR UPDATE USING (bucket_id = 'referee-test' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete referee test files" ON storage.objects FOR DELETE USING (bucket_id = 'referee-test' AND has_role(auth.uid(), 'admin'::app_role));

-- Settings table (single row)
CREATE TABLE public.referee_test_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text,
  description text DEFAULT '',
  test_intro text DEFAULT '',
  button1_text text DEFAULT '',
  button1_url text DEFAULT '',
  button2_text text DEFAULT '',
  button2_url text DEFAULT '',
  pass_percentage integer DEFAULT 80,
  cooldown_days integer DEFAULT 7,
  badge_id uuid REFERENCES public.badges(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.referee_test_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings viewable by everyone" ON public.referee_test_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update referee settings" ON public.referee_test_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert referee settings" ON public.referee_test_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.referee_test_settings (description, test_intro) VALUES ('', '');

-- Questions table
CREATE TABLE public.referee_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  media_url text,
  media_type text DEFAULT 'image',
  is_multiple_choice boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referee_test_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions viewable by authenticated" ON public.referee_test_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert questions" ON public.referee_test_questions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update questions" ON public.referee_test_questions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete questions" ON public.referee_test_questions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Answers table
CREATE TABLE public.referee_test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.referee_test_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  is_correct boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referee_test_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Answers viewable by authenticated" ON public.referee_test_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert answers" ON public.referee_test_answers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update answers" ON public.referee_test_answers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete answers" ON public.referee_test_answers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Attempts table
CREATE TABLE public.referee_test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  passed boolean DEFAULT false,
  attempted_at timestamptz DEFAULT now()
);

ALTER TABLE public.referee_test_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own attempts" ON public.referee_test_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON public.referee_test_attempts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Server-side grading function
CREATE OR REPLACE FUNCTION public.submit_referee_test(_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _score integer := 0;
  _total integer;
  _pass_pct integer;
  _cooldown integer;
  _badge_id uuid;
  _last_failed timestamptz;
  _passed boolean;
  _entry jsonb;
  _qid uuid;
  _correct_ids uuid[];
  _submitted_ids uuid[];
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.pass_percentage, s.cooldown_days, s.badge_id 
  INTO _pass_pct, _cooldown, _badge_id
  FROM referee_test_settings s LIMIT 1;
  
  _pass_pct := COALESCE(_pass_pct, 80);
  _cooldown := COALESCE(_cooldown, 7);

  IF EXISTS (SELECT 1 FROM referee_test_attempts WHERE user_id = _user_id AND passed = true) THEN
    RETURN jsonb_build_object('error', 'already_passed');
  END IF;

  SELECT MAX(attempted_at) INTO _last_failed 
  FROM referee_test_attempts WHERE user_id = _user_id AND passed = false;
  
  IF _last_failed IS NOT NULL AND _last_failed + make_interval(days => _cooldown) > now() THEN
    RETURN jsonb_build_object('error', 'cooldown', 'retry_at', _last_failed + make_interval(days => _cooldown));
  END IF;

  SELECT COUNT(*) INTO _total FROM referee_test_questions;
  
  IF _total = 0 THEN
    RETURN jsonb_build_object('error', 'no_questions');
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_answers)
  LOOP
    _qid := (_entry->>'question_id')::uuid;
    
    SELECT array_agg(a.id ORDER BY a.id) INTO _correct_ids 
    FROM referee_test_answers a WHERE a.question_id = _qid AND a.is_correct = true;
    
    SELECT array_agg(val::uuid ORDER BY val::uuid) INTO _submitted_ids
    FROM jsonb_array_elements_text(_entry->'answer_ids') AS val;
    
    IF _correct_ids IS NOT NULL AND _submitted_ids IS NOT NULL AND _correct_ids = _submitted_ids THEN
      _score := _score + 1;
    END IF;
  END LOOP;

  _passed := (_score::numeric / _total::numeric * 100) >= _pass_pct;

  INSERT INTO referee_test_attempts (user_id, score, total_questions, passed)
  VALUES (_user_id, _score, _total, _passed);

  IF _passed AND _badge_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = _user_id AND badge_id = _badge_id) THEN
      INSERT INTO user_badges (user_id, badge_id, assigned_by) VALUES (_user_id, _badge_id, _user_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'score', _score, 
    'total', _total, 
    'passed', _passed, 
    'percentage', ROUND(_score::numeric / _total::numeric * 100)
  );
END;
$$;
