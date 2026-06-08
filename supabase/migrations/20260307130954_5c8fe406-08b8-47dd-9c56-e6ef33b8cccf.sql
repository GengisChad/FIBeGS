
-- Update notify_report_to_staff to link to admin reports tab instead of content section
CREATE OR REPLACE FUNCTION public.notify_report_to_staff()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _staff_id uuid;
  _report_type text;
  _link text;
BEGIN
  IF TG_TABLE_NAME = 'deck_reports' THEN
    _report_type := 'deck';
  ELSIF TG_TABLE_NAME = 'market_reports' THEN
    _report_type := 'annuncio';
  ELSIF TG_TABLE_NAME = 'forum_reports' THEN
    _report_type := 'post/commento del forum';
  ELSE
    _report_type := 'contenuto';
  END IF;

  _link := '/admin?tab=reports';

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
$function$;
