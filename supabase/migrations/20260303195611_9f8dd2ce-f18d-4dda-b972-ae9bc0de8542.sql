-- Site settings table for admin-editable configuration
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings viewable by everyone" ON public.site_settings
FOR SELECT USING (true);

CREATE POLICY "Admins can update settings" ON public.site_settings
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert settings" ON public.site_settings
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with default regulation link
INSERT INTO public.site_settings (key, value) VALUES
('regulation_url', 'https://drive.google.com/file/d/1-jXEl6f13Il7cMFOenaneig2uErLfqly/view');