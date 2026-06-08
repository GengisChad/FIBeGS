
-- Create child_profiles table for virtual child profiles managed by parents
CREATE TABLE public.child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  display_name text NOT NULL,
  city text,
  region_id uuid REFERENCES public.regions(id),
  avatar_url text,
  points integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Child profiles viewable by everyone"
  ON public.child_profiles FOR SELECT
  USING (true);

CREATE POLICY "Parents can insert their own children"
  ON public.child_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = parent_user_id
    AND has_role(auth.uid(), 'parent'::app_role)
    AND (SELECT count(*) FROM public.child_profiles WHERE parent_user_id = auth.uid()) < 3
  );

CREATE POLICY "Parents can update their own children"
  ON public.child_profiles FOR UPDATE
  USING (auth.uid() = parent_user_id AND has_role(auth.uid(), 'parent'::app_role));

CREATE POLICY "Parents can delete their own children"
  ON public.child_profiles FOR DELETE
  USING (auth.uid() = parent_user_id AND has_role(auth.uid(), 'parent'::app_role));

CREATE POLICY "Admins can manage all child profiles"
  ON public.child_profiles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add child_profile_id to tournament_registrations for child registrations
ALTER TABLE public.tournament_registrations
  ADD COLUMN child_profile_id uuid REFERENCES public.child_profiles(id) ON DELETE CASCADE;
