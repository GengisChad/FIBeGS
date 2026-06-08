
CREATE POLICY "Public can view media_categories" ON public.media_categories FOR SELECT TO anon USING (true);
CREATE POLICY "Public can view media_series" ON public.media_series FOR SELECT TO anon USING (true);
CREATE POLICY "Public can view media_seasons" ON public.media_seasons FOR SELECT TO anon USING (true);
CREATE POLICY "Public can view media_episodes" ON public.media_episodes FOR SELECT TO anon USING (true);
CREATE POLICY "Public can view media_chapters" ON public.media_chapters FOR SELECT TO anon USING (true);
