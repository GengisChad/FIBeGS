
-- Create a function that returns answers WITHOUT is_correct for non-admin users
CREATE OR REPLACE FUNCTION public.get_test_answers_safe()
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
  SELECT id, question_id, answer_text, sort_order::integer
  FROM public.referee_test_answers
  ORDER BY sort_order;
$$;
