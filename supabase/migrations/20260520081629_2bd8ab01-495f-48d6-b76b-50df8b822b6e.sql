
-- ============ TEAMS ============
CREATE TYPE public.team_role AS ENUM ('owner', 'member');
CREATE TYPE public.team_invite_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  city TEXT,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_region ON public.teams(region_id);
CREATE INDEX idx_teams_created_by ON public.teams(created_by);

CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE,
  role public.team_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);

CREATE TABLE public.team_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL,
  invited_by UUID NOT NULL,
  status public.team_invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (team_id, invited_user_id)
);
CREATE INDEX idx_team_invites_user ON public.team_invites(invited_user_id);
CREATE INDEX idx_team_invites_team ON public.team_invites(team_id);

-- ============ ENABLE RLS ============
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_team(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id LIMIT 1
$$;

-- ============ RLS POLICIES ============
-- teams: visibili a tutti gli autenticati; insert da chiunque (diventa owner via trigger); update/delete solo owner
CREATE POLICY "teams_select_all" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_insert_self" ON public.teams FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "teams_update_owner" ON public.teams FOR UPDATE TO authenticated USING (public.is_team_owner(auth.uid(), id));
CREATE POLICY "teams_delete_owner" ON public.teams FOR DELETE TO authenticated USING (public.is_team_owner(auth.uid(), id));

-- team_members: visibili a tutti; insert restricted (handled via trigger / accept invite); delete: self leave or owner kicks
CREATE POLICY "team_members_select_all" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members_insert_self_or_owner" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_team_owner(auth.uid(), team_id));
CREATE POLICY "team_members_delete_self_or_owner" ON public.team_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_team_owner(auth.uid(), team_id));

-- team_invites: 
-- select: il destinatario, l'invitante, e i membri della squadra
CREATE POLICY "team_invites_select" ON public.team_invites FOR SELECT TO authenticated
  USING (
    invited_user_id = auth.uid()
    OR invited_by = auth.uid()
    OR public.is_team_member(auth.uid(), team_id)
  );
-- insert: solo owner della squadra
CREATE POLICY "team_invites_insert_owner" ON public.team_invites FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_owner(auth.uid(), team_id)
    AND invited_by = auth.uid()
    AND invited_user_id <> auth.uid()
  );
-- update: solo destinatario (accept/decline)
CREATE POLICY "team_invites_update_self" ON public.team_invites FOR UPDATE TO authenticated
  USING (invited_user_id = auth.uid())
  WITH CHECK (invited_user_id = auth.uid());
-- delete: owner della squadra può annullare un invito pending
CREATE POLICY "team_invites_delete_owner" ON public.team_invites FOR DELETE TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id));

-- ============ TRIGGERS ============
-- 1) on team creation, auto add creator as owner
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_team
AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- 2) when an invite is set to accepted, insert team_member and notify owner
CREATE OR REPLACE FUNCTION public.handle_team_invite_response()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_name TEXT;
  invited_name TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- ensure user isn't already in another team
    IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = NEW.invited_user_id) THEN
      RAISE EXCEPTION 'Utente già membro di una squadra';
    END IF;

    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (NEW.team_id, NEW.invited_user_id, 'member')
    ON CONFLICT DO NOTHING;

    NEW.responded_at := now();

    SELECT name INTO team_name FROM public.teams WHERE id = NEW.team_id;
    SELECT COALESCE(display_name, username, 'Un giocatore') INTO invited_name
      FROM public.profiles WHERE user_id = NEW.invited_user_id;

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.invited_by, 'team_invite_accepted', 'Invito accettato',
            invited_name || ' ha accettato l''invito in ' || COALESCE(team_name, 'squadra'),
            '/');
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    NEW.responded_at := now();
    SELECT name INTO team_name FROM public.teams WHERE id = NEW.team_id;
    SELECT COALESCE(display_name, username, 'Un giocatore') INTO invited_name
      FROM public.profiles WHERE user_id = NEW.invited_user_id;

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.invited_by, 'team_invite_declined', 'Invito rifiutato',
            invited_name || ' ha rifiutato l''invito in ' || COALESCE(team_name, 'squadra'),
            '/');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_team_invite_response
BEFORE UPDATE ON public.team_invites
FOR EACH ROW EXECUTE FUNCTION public.handle_team_invite_response();

-- 3) when invite is created, notify recipient
CREATE OR REPLACE FUNCTION public.handle_new_team_invite()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_name TEXT;
BEGIN
  SELECT name INTO team_name FROM public.teams WHERE id = NEW.team_id;
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (NEW.invited_user_id, 'team_invite', 'Invito in squadra',
          'Sei stato invitato a unirti alla squadra "' || COALESCE(team_name, '') || '"',
          '/');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_team_invite
AFTER INSERT ON public.team_invites
FOR EACH ROW EXECUTE FUNCTION public.handle_new_team_invite();

-- updated_at trigger on teams
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "team_logos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');
CREATE POLICY "team_logos_authenticated_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "team_logos_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'team-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "team_logos_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'team-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
