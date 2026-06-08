
-- Add favorite_deck_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorite_deck_id uuid REFERENCES public.decks(id) ON DELETE SET NULL;

-- Create parent_role_requests table
CREATE TABLE IF NOT EXISTS public.parent_role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_notes text,
  UNIQUE(user_id, status)
);

ALTER TABLE public.parent_role_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own requests" ON public.parent_role_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own requests" ON public.parent_role_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests" ON public.parent_role_requests
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update requests" ON public.parent_role_requests
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete requests" ON public.parent_role_requests
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Trigger: notify admins/staff/mod on any report (deck_reports, market_reports)
CREATE OR REPLACE FUNCTION public.notify_report_to_staff()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _staff_id uuid;
  _report_type text;
  _link text;
BEGIN
  IF TG_TABLE_NAME = 'deck_reports' THEN
    _report_type := 'deck';
    _link := '/decks';
  ELSIF TG_TABLE_NAME = 'market_reports' THEN
    _report_type := 'annuncio';
    _link := '/market';
  ELSE
    _report_type := 'contenuto';
    _link := '/admin';
  END IF;

  FOR _staff_id IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'staff', 'moderator')
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      _staff_id,
      'report',
      '⚠️ Nuova segnalazione',
      'È stata ricevuta una segnalazione su un ' || _report_type || '. Controlla la sezione segnalazioni.',
      _link
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_deck_report
  AFTER INSERT ON public.deck_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_to_staff();

CREATE TRIGGER notify_on_market_report
  AFTER INSERT ON public.market_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_to_staff();
