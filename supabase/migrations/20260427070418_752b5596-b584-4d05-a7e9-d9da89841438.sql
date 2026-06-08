-- Ripristina i trigger di auto-promozione waitlist (erano stati droppati per errore)
-- La funzione auto_promote_waitlist() salta già i tornei a pagamento (entry_fee > 0)
-- e quelli con has_waitlist=false, quindi è sicura.

DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_delete ON public.tournament_registrations;
DROP TRIGGER IF EXISTS trg_auto_promote_waitlist_update ON public.tournament_registrations;

CREATE TRIGGER trg_auto_promote_waitlist_delete
AFTER DELETE ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_waitlist();

CREATE TRIGGER trg_auto_promote_waitlist_update
AFTER UPDATE OF status ON public.tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_waitlist();