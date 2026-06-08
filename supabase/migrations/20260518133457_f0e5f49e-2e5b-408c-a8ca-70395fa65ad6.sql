-- Retroactively promote waitlist entries for tournaments that have free spots.
-- Mirrors auto_promote_waitlist logic.
DO $$
DECLARE
  t RECORD;
  has_pending BOOLEAN;
  occupied_statuses TEXT[];
  target_status TEXT;
  occupied INT;
  next_id UUID;
BEGIN
  FOR t IN
    SELECT id, max_participants, COALESCE(entry_fee,0) AS entry_fee
    FROM public.tournaments
    WHERE has_waitlist = true
      AND status NOT IN ('completed','cancelled')
  LOOP
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM public.tournament_registrations
        WHERE tournament_id = t.id AND status = 'pending_payment'
      ) INTO has_pending;

      IF t.entry_fee > 0 OR has_pending THEN
        occupied_statuses := ARRAY['confirmed','pending_payment'];
        target_status := 'pending_payment';
      ELSE
        occupied_statuses := ARRAY['confirmed'];
        target_status := 'confirmed';
      END IF;

      SELECT COUNT(*) INTO occupied
      FROM public.tournament_registrations
      WHERE tournament_id = t.id AND status = ANY(occupied_statuses);

      EXIT WHEN occupied >= t.max_participants;

      SELECT id INTO next_id
      FROM public.tournament_registrations
      WHERE tournament_id = t.id AND status = 'waitlist'
      ORDER BY registered_at ASC
      LIMIT 1;

      EXIT WHEN next_id IS NULL;

      UPDATE public.tournament_registrations
      SET status = target_status, is_ready = false
      WHERE id = next_id;
    END LOOP;
  END LOOP;
END $$;