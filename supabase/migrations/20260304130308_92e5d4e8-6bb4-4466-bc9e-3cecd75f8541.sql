
-- Add banner_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;

-- Create badges table
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon_url text,
  color text NOT NULL DEFAULT '#FFD700',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges viewable by everyone" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Admins can insert badges" ON public.badges FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update badges" ON public.badges FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete badges" ON public.badges FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create user_badges table
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges viewable by everyone" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Admins can insert user badges" ON public.user_badges FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete user badges" ON public.user_badges FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for profile banners
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-banners', 'profile-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile-banners
CREATE POLICY "Anyone can view banners" ON storage.objects FOR SELECT USING (bucket_id = 'profile-banners');
CREATE POLICY "Users can upload own banner" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own banner" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own banner" ON storage.objects FOR DELETE USING (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text);
