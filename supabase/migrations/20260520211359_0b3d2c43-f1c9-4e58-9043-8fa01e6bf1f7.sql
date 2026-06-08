CREATE OR REPLACE FUNCTION public.transfer_team_leadership(_team_id uuid, _new_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_team_owner(_caller, _team_id) THEN
    RAISE EXCEPTION 'Only the team owner can transfer leadership';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _new_owner) THEN
    RAISE EXCEPTION 'Target user is not a member of this team';
  END IF;
  IF _new_owner = _caller THEN
    RETURN;
  END IF;
  UPDATE public.team_members SET role = 'member' WHERE team_id = _team_id AND user_id = _caller;
  UPDATE public.team_members SET role = 'owner'  WHERE team_id = _team_id AND user_id = _new_owner;
  UPDATE public.teams SET created_by = _new_owner WHERE id = _team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_team_leadership(uuid, uuid) TO authenticated;