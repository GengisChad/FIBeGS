CREATE OR REPLACE FUNCTION public.enforce_tournament_payment_registration_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tournament RECORD;
  v_occupied integer;
  v_has_payment boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT
    id,
    max_participants,
    COALESCE(entry_fee, 0) AS entry_fee,
    NULLIF(BTRIM(COALESCE(payment_method, '')), '') AS payment_method
  INTO v_tournament
  FROM public.tournaments
  WHERE id = NEW.tournament_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_has_payment := v_tournament.entry_fee > 0 OR v_tournament.payment_method IS NOT NULL;

  IF NOT v_has_payment THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_occupied
  FROM public.tournament_registrations
  WHERE tournament_id = NEW.tournament_id
    AND status IN ('confirmed', 'pending_payment')
    AND id IS DISTINCT FROM NEW.id;

  IF v_occupied < COALESCE(v_tournament.max_participants, 0) THEN
    NEW.status := 'pending_payment';
    NEW.is_ready := false;
    NEW.confirmed_by := NULL;
    NEW.confirmed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tournament_payment_registration_status ON public.tournament_registrations;
CREATE TRIGGER trg_enforce_tournament_payment_registration_status
BEFORE INSERT ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tournament_payment_registration_status();