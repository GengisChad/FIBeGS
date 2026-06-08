
-- Forum post likes table
CREATE TABLE public.forum_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.forum_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum post likes viewable by everyone" ON public.forum_post_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own post likes" ON public.forum_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own post likes" ON public.forum_post_likes FOR DELETE USING (auth.uid() = user_id);

-- Forum reply likes table
CREATE TABLE public.forum_reply_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id uuid NOT NULL REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reply_id, user_id)
);

ALTER TABLE public.forum_reply_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum reply likes viewable by everyone" ON public.forum_reply_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reply likes" ON public.forum_reply_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reply likes" ON public.forum_reply_likes FOR DELETE USING (auth.uid() = user_id);
