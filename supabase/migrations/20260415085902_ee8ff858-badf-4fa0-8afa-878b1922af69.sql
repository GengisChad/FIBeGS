
-- Create private profiles table for sensitive data
CREATE TABLE public.profiles_private (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date date,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own private profile"
  ON public.profiles_private FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own private profile"
  ON public.profiles_private FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own private profile"
  ON public.profiles_private FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all private profiles"
  ON public.profiles_private FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all private profiles"
  ON public.profiles_private FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Migrate existing birth_date data (only for valid auth users)
INSERT INTO public.profiles_private (user_id, birth_date)
SELECT p.user_id, p.birth_date 
FROM public.profiles p
INNER JOIN auth.users au ON au.id = p.user_id
WHERE p.birth_date IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET birth_date = EXCLUDED.birth_date;

-- Populate email from auth.users
INSERT INTO public.profiles_private (user_id, email)
SELECT au.id, au.email FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles_private pp WHERE pp.user_id = au.id);

-- Update email for existing rows that have null email
UPDATE public.profiles_private pp
SET email = au.email
FROM auth.users au
WHERE pp.user_id = au.id AND pp.email IS NULL;

-- Drop birth_date from public profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS birth_date;

-- Remove auth-only SELECT restriction (keep the "everyone" policy)
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;

-- Trigger to auto-create profiles_private on signup
CREATE OR REPLACE FUNCTION public.handle_profiles_private_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles_private (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_private
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_profiles_private_creation();
