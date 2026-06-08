
-- Media categories (e.g. "Anime", "Manga")
CREATE TABLE public.media_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'anime', -- 'anime' or 'manga'
  cover_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Media series (e.g. "Beyblade X", "Beyblade Burst")
CREATE TABLE public.media_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.media_categories(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  cover_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Media seasons (e.g. "Stagione 1")
CREATE TABLE public.media_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid REFERENCES public.media_series(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Media episodes (anime)
CREATE TABLE public.media_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES public.media_seasons(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  episode_number int NOT NULL DEFAULT 1,
  video_url text,
  is_youtube boolean NOT NULL DEFAULT false,
  platform text, -- 'youtube', 'crunchyroll', etc.
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Manga chapters
CREATE TABLE public.media_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES public.media_seasons(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  chapter_number int NOT NULL DEFAULT 1,
  pdf_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_chapters ENABLE ROW LEVEL SECURITY;

-- Read policies: authenticated users only
CREATE POLICY "Authenticated users can view media_categories" ON public.media_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view media_series" ON public.media_series FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view media_seasons" ON public.media_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view media_episodes" ON public.media_episodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view media_chapters" ON public.media_chapters FOR SELECT TO authenticated USING (true);

-- Admin write policies
CREATE POLICY "Admins can manage media_categories" ON public.media_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage media_series" ON public.media_series FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage media_seasons" ON public.media_seasons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage media_episodes" ON public.media_episodes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage media_chapters" ON public.media_chapters FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for manga PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('manga-chapters', 'manga-chapters', true);

-- Storage policies for manga-chapters bucket
CREATE POLICY "Anyone can view manga chapters" ON storage.objects FOR SELECT USING (bucket_id = 'manga-chapters');
CREATE POLICY "Admins can upload manga chapters" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'manga-chapters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete manga chapters" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'manga-chapters' AND public.has_role(auth.uid(), 'admin'));
