
-- FAQ Contact categories (admin-editable)
CREATE TABLE public.faq_contact_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  email text,
  icon text DEFAULT 'Mail',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.faq_contact_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active contact categories"
  ON public.faq_contact_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage contact categories"
  ON public.faq_contact_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- FAQ Supporters / Donors
CREATE TABLE public.faq_supporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  display_name text NOT NULL,
  avatar_url text,
  tier text DEFAULT 'supporter',
  message text,
  badge_id uuid REFERENCES public.badges(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.faq_supporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active supporters"
  ON public.faq_supporters FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage supporters"
  ON public.faq_supporters FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- FAQ History timeline entries
CREATE TABLE public.faq_history_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer,
  title text NOT NULL,
  description text,
  image_url text,
  generation text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.faq_history_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read history entries"
  ON public.faq_history_entries FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage history entries"
  ON public.faq_history_entries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: auto-assign badge when supporter with user_id and badge_id is created
CREATE OR REPLACE FUNCTION public.sync_supporter_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- On INSERT or UPDATE: assign badge if user_id and badge_id are set
  IF NEW.user_id IS NOT NULL AND NEW.badge_id IS NOT NULL AND NEW.is_active = true THEN
    INSERT INTO user_badges (user_id, badge_id, assigned_by)
    VALUES (NEW.user_id, NEW.badge_id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- On UPDATE: remove old badge if badge_id changed or supporter deactivated
  IF TG_OP = 'UPDATE' THEN
    IF OLD.badge_id IS NOT NULL AND OLD.user_id IS NOT NULL AND
       (OLD.badge_id IS DISTINCT FROM NEW.badge_id OR NEW.is_active = false) THEN
      DELETE FROM user_badges WHERE user_id = OLD.user_id AND badge_id = OLD.badge_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_supporter_badge
  AFTER INSERT OR UPDATE ON public.faq_supporters
  FOR EACH ROW EXECUTE FUNCTION public.sync_supporter_badge();

-- Remove badge on supporter delete
CREATE OR REPLACE FUNCTION public.remove_supporter_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND OLD.badge_id IS NOT NULL THEN
    DELETE FROM user_badges WHERE user_id = OLD.user_id AND badge_id = OLD.badge_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_remove_supporter_badge
  AFTER DELETE ON public.faq_supporters
  FOR EACH ROW EXECUTE FUNCTION public.remove_supporter_badge();
