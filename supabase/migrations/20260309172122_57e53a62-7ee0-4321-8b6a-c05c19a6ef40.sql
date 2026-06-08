
-- Security definer function to count children without triggering RLS
CREATE OR REPLACE FUNCTION public.count_children(_parent_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.child_profiles WHERE parent_user_id = _parent_id;
$$;

-- Drop and recreate the INSERT policy using the function
DROP POLICY IF EXISTS "Parents can insert their own children" ON public.child_profiles;

CREATE POLICY "Parents can insert their own children"
ON public.child_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = parent_user_id
  AND has_role(auth.uid(), 'parent'::app_role)
  AND count_children(auth.uid()) < 3
);
