
-- Table to store battlepass launch readings
CREATE TABLE public.battlepass_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  launch_speed integer NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add best_launch_speed to profiles
ALTER TABLE public.profiles ADD COLUMN best_launch_speed integer DEFAULT NULL;

-- Index for quick lookups
CREATE INDEX idx_battlepass_scores_user_id ON public.battlepass_scores(user_id);
CREATE INDEX idx_battlepass_scores_speed ON public.battlepass_scores(user_id, launch_speed DESC);

-- Enable RLS
ALTER TABLE public.battlepass_scores ENABLE ROW LEVEL SECURITY;

-- Everyone can view scores
CREATE POLICY "Battlepass scores viewable by everyone"
ON public.battlepass_scores FOR SELECT
USING (true);

-- Users can insert their own scores
CREATE POLICY "Users can insert their own scores"
ON public.battlepass_scores FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own scores
CREATE POLICY "Users can delete their own scores"
ON public.battlepass_scores FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can manage all scores
CREATE POLICY "Admins can manage all scores"
ON public.battlepass_scores FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
