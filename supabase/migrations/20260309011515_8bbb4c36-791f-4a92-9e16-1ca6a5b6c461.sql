-- Create separate table for club member phone numbers (PII)
CREATE TABLE IF NOT EXISTS public.club_member_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_member_id uuid NOT NULL UNIQUE REFERENCES public.club_members(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_member_phones_club_id ON public.club_member_phones (club_id);
CREATE INDEX IF NOT EXISTS idx_club_member_phones_user_id ON public.club_member_phones (user_id);

ALTER TABLE public.club_member_phones ENABLE ROW LEVEL SECURITY;

-- Timestamp helper (safe to replace)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_club_member_phones_updated_at ON public.club_member_phones;
CREATE TRIGGER update_club_member_phones_updated_at
BEFORE UPDATE ON public.club_member_phones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies for phone numbers
DROP POLICY IF EXISTS "Users can view own club phone" ON public.club_member_phones;
CREATE POLICY "Users can view own club phone"
ON public.club_member_phones
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Club staff can view club phones" ON public.club_member_phones;
CREATE POLICY "Club staff can view club phones"
ON public.club_member_phones
FOR SELECT
USING (public.is_club_staff(auth.uid(), club_id));

DROP POLICY IF EXISTS "Admins can view all club phones" ON public.club_member_phones;
CREATE POLICY "Admins can view all club phones"
ON public.club_member_phones
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can upsert own club phone" ON public.club_member_phones;
CREATE POLICY "Users can upsert own club phone"
ON public.club_member_phones
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own club phone" ON public.club_member_phones;
CREATE POLICY "Users can update own club phone"
ON public.club_member_phones
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own club phone" ON public.club_member_phones;
CREATE POLICY "Users can delete own club phone"
ON public.club_member_phones
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to prevent phone from being stored in club_members (so club_members can be publicly readable)
CREATE OR REPLACE FUNCTION public.upsert_club_member_phone_from_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.club_member_phones (club_member_id, club_id, user_id, phone)
  VALUES (NEW.id, NEW.club_id, NEW.user_id, NEW.phone)
  ON CONFLICT (club_member_id)
  DO UPDATE SET
    club_id = EXCLUDED.club_id,
    user_id = EXCLUDED.user_id,
    phone = EXCLUDED.phone,
    updated_at = now();

  NEW.phone = NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_club_member_phone ON public.club_members;
CREATE TRIGGER trg_sync_club_member_phone
BEFORE INSERT OR UPDATE OF phone ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.upsert_club_member_phone_from_members();

-- Restore member list visibility (no phone is stored on club_members anymore)
DROP POLICY IF EXISTS "Anon can view club members basic info" ON public.club_members;
DROP POLICY IF EXISTS "Authenticated can view club members" ON public.club_members;
DROP POLICY IF EXISTS "Club members are viewable by everyone" ON public.club_members;
CREATE POLICY "Club members are viewable by everyone"
ON public.club_members
FOR SELECT
USING (true);

-- Update staff RPC to read phone numbers from the new table
CREATE OR REPLACE FUNCTION public.get_club_members_with_phone(_club_id uuid)
RETURNS TABLE(
  id uuid,
  club_id uuid,
  user_id uuid,
  role public.club_role,
  joined_at timestamp with time zone,
  city text,
  phone text,
  last_tournament_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    cm.id,
    cm.club_id,
    cm.user_id,
    cm.role,
    cm.joined_at,
    cm.city,
    cmp.phone,
    cm.last_tournament_at
  FROM public.club_members cm
  LEFT JOIN public.club_member_phones cmp
    ON cmp.club_member_id = cm.id
  WHERE cm.club_id = _club_id
    AND (
      public.is_club_staff(auth.uid(), _club_id)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  ORDER BY cm.role;
$$;