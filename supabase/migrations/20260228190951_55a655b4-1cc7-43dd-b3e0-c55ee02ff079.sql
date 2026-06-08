
-- Create regions table
CREATE TABLE public.regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regions are viewable by everyone"
ON public.regions FOR SELECT
USING (true);

-- Insert Italian regions
INSERT INTO public.regions (name, code) VALUES
  ('Piemonte', 'PIE'), ('Valle d''Aosta', 'VDA'), ('Lombardia', 'LOM'),
  ('Trentino-Alto Adige', 'TAA'), ('Veneto', 'VEN'), ('Friuli Venezia Giulia', 'FVG'),
  ('Liguria', 'LIG'), ('Emilia-Romagna', 'EMR'), ('Toscana', 'TOS'),
  ('Umbria', 'UMB'), ('Marche', 'MAR'), ('Lazio', 'LAZ'),
  ('Abruzzo', 'ABR'), ('Molise', 'MOL'), ('Campania', 'CAM'),
  ('Puglia', 'PUG'), ('Basilicata', 'BAS'), ('Calabria', 'CAL'),
  ('Sicilia', 'SIC'), ('Sardegna', 'SAR');

-- Create club_role enum
CREATE TYPE public.club_role AS ENUM ('leader', 'staff', 'member');

-- Create club_request_status enum
CREATE TYPE public.club_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create clubs table
CREATE TABLE public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  region_id UUID REFERENCES public.regions(id),
  city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clubs are viewable by everyone"
ON public.clubs FOR SELECT USING (true);

-- Create club_members table
CREATE TABLE public.club_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role club_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members are viewable by everyone"
ON public.club_members FOR SELECT USING (true);

CREATE POLICY "Users can join clubs"
ON public.club_members FOR INSERT
WITH CHECK (auth.uid() = user_id AND role = 'member');

CREATE POLICY "Leaders can manage members"
ON public.club_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_members.club_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'leader'
  )
);

CREATE POLICY "Leaders can remove members"
ON public.club_members FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_members.club_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'leader'
  )
);

-- Create club_requests table (requests to create a new club)
CREATE TABLE public.club_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_name TEXT NOT NULL,
  description TEXT,
  region_id UUID REFERENCES public.regions(id),
  city TEXT,
  status club_request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.club_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
ON public.club_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create requests"
ON public.club_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create security definer function for club role check
CREATE OR REPLACE FUNCTION public.has_club_role(_user_id UUID, _club_id UUID, _role club_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = _user_id
    AND club_id = _club_id
    AND role = _role
  )
$$;

-- Function to check if user is leader or staff
CREATE OR REPLACE FUNCTION public.is_club_staff(_user_id UUID, _club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = _user_id
    AND club_id = _club_id
    AND role IN ('leader', 'staff')
  )
$$;

-- Add club_id and region_id to tournaments
ALTER TABLE public.tournaments
ADD COLUMN club_id UUID REFERENCES public.clubs(id),
ADD COLUMN region_id UUID REFERENCES public.regions(id),
ADD COLUMN format TEXT DEFAULT 'swiss_top_cut',
ADD COLUMN top_cut_size INTEGER DEFAULT 8,
ADD COLUMN swiss_rounds INTEGER;

-- Allow club staff to create/manage tournaments
CREATE POLICY "Club staff can create tournaments"
ON public.tournaments FOR INSERT
WITH CHECK (
  club_id IS NOT NULL AND public.is_club_staff(auth.uid(), club_id)
);

CREATE POLICY "Club staff can update their tournaments"
ON public.tournaments FOR UPDATE
USING (
  club_id IS NOT NULL AND public.is_club_staff(auth.uid(), club_id)
);

CREATE POLICY "Club staff can delete their tournaments"
ON public.tournaments FOR DELETE
USING (
  club_id IS NOT NULL AND public.is_club_staff(auth.uid(), club_id)
);

-- Create app_role enum and user_roles table for site admins
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User roles viewable by owner"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Security definer for admin check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- Admin policies for club_requests
CREATE POLICY "Admins can view all requests"
ON public.club_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update requests"
ON public.club_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies for clubs management
CREATE POLICY "Admins can insert clubs"
ON public.clubs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clubs"
ON public.clubs FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can manage club members (e.g. set leaders)
CREATE POLICY "Admins can insert club members"
ON public.club_members FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on clubs
CREATE TRIGGER update_clubs_updated_at
BEFORE UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on club_requests
CREATE TRIGGER update_club_requests_updated_at
BEFORE UPDATE ON public.club_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
