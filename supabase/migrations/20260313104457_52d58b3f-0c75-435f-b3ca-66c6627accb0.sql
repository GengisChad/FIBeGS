
-- Add test_type column to referee_test_questions
ALTER TABLE public.referee_test_questions 
ADD COLUMN IF NOT EXISTS test_type text NOT NULL DEFAULT 'referee';

-- Add test_type column to referee_test_attempts
ALTER TABLE public.referee_test_attempts 
ADD COLUMN IF NOT EXISTS test_type text NOT NULL DEFAULT 'referee';

-- Add test_type column to referee_test_settings
ALTER TABLE public.referee_test_settings 
ADD COLUMN IF NOT EXISTS test_type text NOT NULL DEFAULT 'referee';

-- Add unique constraint on test_type for settings (one row per test type)
ALTER TABLE public.referee_test_settings 
ADD CONSTRAINT referee_test_settings_test_type_unique UNIQUE (test_type);

-- Insert head_judge settings row
INSERT INTO public.referee_test_settings (test_type, description, pass_percentage, cooldown_days)
VALUES ('head_judge', 'Test per diventare Head Judge IBNA.', 80, 7)
ON CONFLICT (test_type) DO NOTHING;

-- Update get_test_answers_safe to accept test_type parameter
CREATE OR REPLACE FUNCTION public.get_test_answers_safe(_test_type text DEFAULT 'referee')
RETURNS TABLE (
  id uuid,
  question_id uuid,
  answer_text text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.question_id, a.answer_text, a.sort_order::integer
  FROM public.referee_test_answers a
  JOIN public.referee_test_questions q ON q.id = a.question_id
  WHERE q.test_type = _test_type
  ORDER BY a.sort_order;
$$;

-- Update submit_referee_test to accept test_type parameter
CREATE OR REPLACE FUNCTION public.submit_referee_test(_answers jsonb, _test_type text DEFAULT 'referee')
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

  -- For head_judge test, verify user has 100% on referee test
  IF _test_type = 'head_judge' THEN
    IF NOT EXISTS (
      SELECT 1 FROM referee_test_attempts 
      WHERE user_id = _user_id AND test_type = 'referee' AND passed = true AND score = total_questions
    ) THEN
      RETURN jsonb_build_object('error', 'not_eligible');
    END IF;
  END IF;

  SELECT s.pass_percentage, s.cooldown_days, s.badge_id 
  INTO _pass_pct, _cooldown, _badge_id
  FROM referee_test_settings s WHERE s.test_type = _test_type LIMIT 1;
  
  _pass_pct := COALESCE(_pass_pct, 80);
  _cooldown := COALESCE(_cooldown, 7);

  IF EXISTS (SELECT 1 FROM referee_test_attempts WHERE user_id = _user_id AND test_type = _test_type AND passed = true) THEN
    RETURN jsonb_build_object('error', 'already_passed');
  END IF;

  SELECT MAX(attempted_at) INTO _last_failed 
  FROM referee_test_attempts WHERE user_id = _user_id AND test_type = _test_type AND passed = false;
  
  IF _last_failed IS NOT NULL AND _last_failed + make_interval(days => _cooldown) > now() THEN
    RETURN jsonb_build_object('error', 'cooldown', 'retry_at', _last_failed + make_interval(days => _cooldown));
  END IF;

  SELECT COUNT(*) INTO _total FROM referee_test_questions WHERE test_type = _test_type;
  
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

  INSERT INTO referee_test_attempts (user_id, score, total_questions, passed, test_type)
  VALUES (_user_id, _score, _total, _passed, _test_type);

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
