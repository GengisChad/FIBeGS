
-- 1) Add disband_at to teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS disband_at timestamptz;

-- 2) team_messages table (team chat)
CREATE TABLE IF NOT EXISTS public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX IF NOT EXISTS team_messages_team_id_created_at_idx ON public.team_messages(team_id, created_at);

ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_messages_select_members ON public.team_messages;
CREATE POLICY team_messages_select_members ON public.team_messages
FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

DROP POLICY IF EXISTS team_messages_insert_members ON public.team_messages;
CREATE POLICY team_messages_insert_members ON public.team_messages
FOR INSERT TO authenticated
WITH CHECK (public.is_team_member(auth.uid(), team_id) AND sender_id = auth.uid());

DROP POLICY IF EXISTS team_messages_update_own ON public.team_messages;
CREATE POLICY team_messages_update_own ON public.team_messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS team_messages_delete_own ON public.team_messages;
CREATE POLICY team_messages_delete_own ON public.team_messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER TABLE public.team_messages REPLICA IDENTITY FULL;

-- 3) Handle member removal: promote earliest joined member if owner leaves,
--    set disband_at if below max_members, delete team if empty.
CREATE OR REPLACE FUNCTION public.handle_team_member_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
  new_owner uuid;
  team_max int;
BEGIN
  SELECT count(*) INTO remaining FROM public.team_members WHERE team_id = OLD.team_id;
  IF remaining = 0 THEN
    DELETE FROM public.teams WHERE id = OLD.team_id;
    RETURN OLD;
  END IF;

  IF OLD.role = 'owner' THEN
    SELECT user_id INTO new_owner
    FROM public.team_members
    WHERE team_id = OLD.team_id
    ORDER BY joined_at ASC, user_id ASC
    LIMIT 1;
    IF new_owner IS NOT NULL THEN
      UPDATE public.team_members SET role = 'owner'
      WHERE team_id = OLD.team_id AND user_id = new_owner;
      UPDATE public.teams SET created_by = new_owner WHERE id = OLD.team_id;
    END IF;
  END IF;

  SELECT max_members INTO team_max FROM public.teams WHERE id = OLD.team_id;
  IF remaining < team_max THEN
    UPDATE public.teams
    SET disband_at = COALESCE(disband_at, now() + interval '7 days')
    WHERE id = OLD.team_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_member_removed ON public.team_members;
CREATE TRIGGER trg_team_member_removed
AFTER DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.handle_team_member_removed();

-- 4) When a new member joins, clear disband_at if team is back to full
CREATE OR REPLACE FUNCTION public.handle_team_member_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
  team_max int;
BEGIN
  SELECT count(*) INTO cnt FROM public.team_members WHERE team_id = NEW.team_id;
  SELECT max_members INTO team_max FROM public.teams WHERE id = NEW.team_id;
  IF cnt >= team_max THEN
    UPDATE public.teams SET disband_at = NULL WHERE id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_member_added ON public.team_members;
CREATE TRIGGER trg_team_member_added
AFTER INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.handle_team_member_added();

-- 5) Disband function callable by leader
CREATE OR REPLACE FUNCTION public.disband_team(_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_team_owner(auth.uid(), _team_id) THEN
    RAISE EXCEPTION 'Only the team leader can disband the team';
  END IF;
  DELETE FROM public.teams WHERE id = _team_id;
END;
$$;

-- 6) Cleanup expired teams (called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_teams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.teams WHERE disband_at IS NOT NULL AND disband_at < now();
END;
$$;

-- 7) Schedule daily cleanup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-expired-teams');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup-expired-teams', '0 * * * *', $cron$SELECT public.cleanup_expired_teams();$cron$);
  END IF;
END$$;
