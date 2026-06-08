
-- Add custom scoring fields for Normal tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS custom_swiss_win_points integer DEFAULT NULL;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS custom_top_win_points integer DEFAULT NULL;

-- Create club_follows table for follow system
CREATE TABLE IF NOT EXISTS public.club_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, club_id)
);

ALTER TABLE public.club_follows ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can manage their own follows
CREATE POLICY "Users can view own follows" ON public.club_follows
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follows" ON public.club_follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own follows" ON public.club_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Public read for follow counts
CREATE POLICY "Anyone can count follows" ON public.club_follows
  FOR SELECT TO anon
  USING (true);
