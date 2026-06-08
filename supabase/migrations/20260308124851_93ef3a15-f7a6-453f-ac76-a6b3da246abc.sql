
-- Add team_mode to tournaments (may already exist from partial run)
DO $$ BEGIN
  ALTER TABLE public.tournaments ADD COLUMN team_mode text NOT NULL DEFAULT 'solo';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create tournament_teams table
CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  is_ready boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create tournament_team_members table
CREATE TABLE IF NOT EXISTS public.tournament_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  child_profile_id uuid REFERENCES public.child_profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Function to enforce one team per user per tournament
CREATE OR REPLACE FUNCTION public.check_unique_user_per_tournament()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $func$
DECLARE
  _tournament_id uuid;
BEGIN
  SELECT tournament_id INTO _tournament_id FROM tournament_teams WHERE id = NEW.team_id;
  
  IF EXISTS (
    SELECT 1 FROM tournament_team_members ttm
    JOIN tournament_teams tt ON tt.id = ttm.team_id
    WHERE tt.tournament_id = _tournament_id
    AND ttm.user_id = NEW.user_id
    AND ttm.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'User is already in a team for this tournament';
  END IF;
  
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_unique_user_per_tournament
  BEFORE INSERT OR UPDATE ON public.tournament_team_members
  FOR EACH ROW EXECUTE FUNCTION public.check_unique_user_per_tournament();

-- RLS for tournament_teams
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams viewable by everyone" ON public.tournament_teams FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create teams" ON public.tournament_teams FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team creators can update their teams" ON public.tournament_teams FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Team creators can delete their teams" ON public.tournament_teams FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "Admins can manage all teams" ON public.tournament_teams FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can manage teams" ON public.tournament_teams FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tournaments t 
    WHERE t.id = tournament_teams.tournament_id 
    AND t.club_id IS NOT NULL 
    AND is_club_staff(auth.uid(), t.club_id)
  )
);

-- RLS for tournament_team_members
ALTER TABLE public.tournament_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members viewable by everyone" ON public.tournament_team_members FOR SELECT USING (true);
CREATE POLICY "Team creators can manage members" ON public.tournament_team_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tournament_teams tt WHERE tt.id = team_id AND tt.created_by = auth.uid())
);
CREATE POLICY "Team creators can delete members" ON public.tournament_team_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM tournament_teams tt WHERE tt.id = team_id AND tt.created_by = auth.uid())
);
CREATE POLICY "Admins can manage all team members" ON public.tournament_team_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Club staff can manage team members" ON public.tournament_team_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournament_teams tt 
    JOIN tournaments t ON t.id = tt.tournament_id 
    WHERE tt.id = team_id 
    AND t.club_id IS NOT NULL 
    AND is_club_staff(auth.uid(), t.club_id)
  )
);
