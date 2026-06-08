-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  points INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can view profiles
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'display_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update trigger to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create tournaments table
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  registration_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  max_participants INTEGER DEFAULT 32,
  entry_fee DECIMAL(10,2) DEFAULT 0,
  prize_description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tournaments
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Everyone can view tournaments
CREATE POLICY "Tournaments are viewable by everyone" 
ON public.tournaments 
FOR SELECT 
USING (true);

-- Create tournament registrations table
CREATE TABLE public.tournament_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

-- Enable RLS on tournament_registrations
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;

-- Everyone can view registrations count
CREATE POLICY "Registration counts are viewable by everyone" 
ON public.tournament_registrations 
FOR SELECT 
USING (true);

-- Users can register themselves
CREATE POLICY "Users can register themselves" 
ON public.tournament_registrations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own registration
CREATE POLICY "Users can update their own registration" 
ON public.tournament_registrations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own registration
CREATE POLICY "Users can delete their own registration" 
ON public.tournament_registrations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create forum posts table
CREATE TABLE public.forum_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('strategia', 'tornei', 'generale', 'mercato', 'guide')),
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on forum_posts
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

-- Everyone can view posts
CREATE POLICY "Posts are viewable by everyone" 
ON public.forum_posts 
FOR SELECT 
USING (true);

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts" 
ON public.forum_posts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts" 
ON public.forum_posts 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts" 
ON public.forum_posts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create forum replies table
CREATE TABLE public.forum_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on forum_replies
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- Everyone can view replies
CREATE POLICY "Replies are viewable by everyone" 
ON public.forum_replies 
FOR SELECT 
USING (true);

-- Authenticated users can create replies
CREATE POLICY "Authenticated users can create replies" 
ON public.forum_replies 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own replies
CREATE POLICY "Users can update their own replies" 
ON public.forum_replies 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own replies
CREATE POLICY "Users can delete their own replies" 
ON public.forum_replies 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forum_replies_updated_at
  BEFORE UPDATE ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update replies count
CREATE OR REPLACE FUNCTION public.update_post_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts SET replies_count = replies_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_posts SET replies_count = replies_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_replies_count
  AFTER INSERT OR DELETE ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_replies_count();

-- Insert sample tournaments
INSERT INTO public.tournaments (title, description, location, city, event_date, registration_deadline, max_participants, prize_description) VALUES
('Campionato Nazionale 2025', 'Il più grande evento dell''anno per la community italiana di Beyblade', 'Palazzo dei Congressi', 'Milano', '2025-03-15 10:00:00+00', '2025-03-10 23:59:59+00', 64, 'Trofeo + Beyblade Limited Edition'),
('Torneo Regionale Lombardia', 'Qualificazioni regionali per il campionato nazionale', 'Centro Sportivo Comunale', 'Bergamo', '2025-02-08 14:00:00+00', '2025-02-05 23:59:59+00', 32, 'Medaglia + Accessori ufficiali'),
('Torneo Primaverile Roma', 'Torneo primaverile nella capitale', 'Spazio Eventi EUR', 'Roma', '2025-04-20 11:00:00+00', '2025-04-15 23:59:59+00', 48, 'Trofeo + Gift card'),
('Beyblade Summer Clash', 'Evento estivo con format speciale', 'Arena Beach', 'Rimini', '2025-07-12 16:00:00+00', '2025-07-08 23:59:59+00', 24, 'Starter Set Limited');