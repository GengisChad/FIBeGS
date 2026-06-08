CREATE OR REPLACE FUNCTION public.upsert_club_member_contact(
  p_member_id uuid,
  p_phone text,
  p_city text DEFAULT NULL,
  p_update_city boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member public.club_members%ROWTYPE;
  v_is_self boolean;
  v_can_manage boolean;
  v_phone text;
BEGIN
  SELECT * INTO v_member
  FROM public.club_members
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  v_is_self := auth.uid() = v_member.user_id;
  v_can_manage := public.is_club_staff(auth.uid(), v_member.club_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role);

  IF NOT (v_is_self OR v_can_manage) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_phone := NULLIF(trim(COALESCE(p_phone, '')), '');

  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  INSERT INTO public.club_member_phones (club_member_id, club_id, user_id, phone)
  VALUES (v_member.id, v_member.club_id, v_member.user_id, v_phone)
  ON CONFLICT (club_member_id)
  DO UPDATE SET
    phone = EXCLUDED.phone,
    updated_at = now();

  IF p_update_city AND v_can_manage THEN
    UPDATE public.club_members
    SET city = NULLIF(trim(COALESCE(p_city, '')), '')
    WHERE id = v_member.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_club_member(
  p_club_id uuid,
  p_user_id uuid,
  p_phone text,
  p_role public.club_role DEFAULT 'member'::public.club_role,
  p_city text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_role public.club_role := 'member'::public.club_role;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role, city)
  VALUES (p_club_id, p_user_id, v_role, NULLIF(trim(COALESCE(p_city, '')), ''))
  RETURNING id INTO v_member_id;

  PERFORM public.upsert_club_member_contact(v_member_id, p_phone, NULL, false);

  RETURN v_member_id;
END;
$$;