
-- Notify invited user on new team invite
CREATE OR REPLACE FUNCTION public.notify_team_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_name TEXT;
  v_inviter_name TEXT;
BEGIN
  SELECT name INTO v_team_name FROM public.teams WHERE id = NEW.team_id;
  SELECT COALESCE(display_name, username, 'Un giocatore') INTO v_inviter_name
    FROM public.profiles WHERE user_id = NEW.invited_by;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    NEW.invited_user_id,
    'team_invite',
    'Invito in una squadra',
    v_inviter_name || ' ti ha invitato a unirti alla squadra "' || COALESCE(v_team_name, '') || '"',
    '/squadra'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_team_invite ON public.team_invites;
CREATE TRIGGER trg_notify_team_invite
AFTER INSERT ON public.team_invites
FOR EACH ROW
EXECUTE FUNCTION public.notify_team_invite();

-- Notify all members when team is fully confirmed (no more pending invites)
CREATE OR REPLACE FUNCTION public.notify_team_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending INT;
  v_team_name TEXT;
  v_member_id UUID;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_pending
  FROM public.team_invites
  WHERE team_id = NEW.team_id AND status = 'pending';

  IF v_pending > 0 THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_team_name FROM public.teams WHERE id = NEW.team_id;

  FOR v_member_id IN
    SELECT user_id FROM public.team_members WHERE team_id = NEW.team_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_member_id,
      'team_confirmed',
      'Squadra confermata!',
      'La squadra "' || COALESCE(v_team_name, '') || '" è stata confermata: tutti i membri hanno accettato.',
      '/squadra'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_team_confirmed ON public.team_invites;
CREATE TRIGGER trg_notify_team_confirmed
AFTER UPDATE ON public.team_invites
FOR EACH ROW
EXECUTE FUNCTION public.notify_team_confirmed();
