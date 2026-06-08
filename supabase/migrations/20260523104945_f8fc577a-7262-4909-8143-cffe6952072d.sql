-- Add category to judge_courses (judge | club_leader)
ALTER TABLE public.judge_courses
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'judge';

ALTER TABLE public.judge_courses DROP CONSTRAINT IF EXISTS judge_courses_category_chk;
ALTER TABLE public.judge_courses
  ADD CONSTRAINT judge_courses_category_chk CHECK (category IN ('judge','club_leader'));

-- Category-aware required-passed function
CREATE OR REPLACE FUNCTION public.judge_course_category_passed(_user_id uuid, _category text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.judge_courses c
    WHERE c.required_for_test = true
      AND c.is_published = true
      AND c.category = _category
      AND NOT EXISTS (
        SELECT 1 FROM public.judge_course_progress p
        WHERE p.course_id = c.id AND p.user_id = _user_id AND p.completed = true
      )
  ) AND EXISTS (
    SELECT 1 FROM public.judge_courses c
    WHERE c.required_for_test = true AND c.is_published = true AND c.category = _category
  )
$$;

-- Auto-award badges when a test is passed
CREATE OR REPLACE FUNCTION public.award_test_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  bname text;
  bid uuid;
BEGIN
  IF NEW.passed = true THEN
    bname := CASE NEW.test_type
      WHEN 'referee' THEN 'Judge'
      WHEN 'head_judge' THEN 'Head Judge'
      WHEN 'club_leader' THEN 'Club Leader'
      ELSE NULL END;
    IF bname IS NOT NULL THEN
      SELECT id INTO bid FROM public.badges WHERE name = bname LIMIT 1;
      IF bid IS NOT NULL THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (NEW.user_id, bid)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_test_badge ON public.referee_test_attempts;
CREATE TRIGGER trg_award_test_badge
AFTER INSERT OR UPDATE ON public.referee_test_attempts
FOR EACH ROW EXECUTE FUNCTION public.award_test_badge();

-- Backfill badges for users who already passed
INSERT INTO public.user_badges (user_id, badge_id)
SELECT DISTINCT a.user_id, b.id
FROM public.referee_test_attempts a
JOIN public.badges b ON b.name = CASE a.test_type
  WHEN 'referee' THEN 'Judge'
  WHEN 'head_judge' THEN 'Head Judge'
  WHEN 'club_leader' THEN 'Club Leader' END
WHERE a.passed = true AND a.test_type IN ('referee','head_judge','club_leader')
ON CONFLICT (user_id, badge_id) DO NOTHING;