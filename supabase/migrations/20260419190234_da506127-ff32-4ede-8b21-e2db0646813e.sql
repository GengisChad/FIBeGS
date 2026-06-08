-- Riapertura del torneo "Quasar Prime Tournament IBNA" (ea73f82f-1ab1-4455-b72d-62ee9a3c37b6)
-- per consentire l'inserimento del match 3°/4° posto mancante.

UPDATE public.tournaments
SET status = 'top_cut'
WHERE id = 'ea73f82f-1ab1-4455-b72d-62ee9a3c37b6';

-- Inserisco il match 3°/4° già popolato con i due semifinalisti perdenti
-- (35a038cc = perdente SF1 / match_number 1; a919ba4b = perdente SF2 / match_number 2)
INSERT INTO public.tournament_matches
  (tournament_id, round, phase, match_number, player1_id, player2_id, status, player1_score, player2_score)
VALUES
  ('ea73f82f-1ab1-4455-b72d-62ee9a3c37b6', 3, 'top_cut', 2,
   '35a038cc-fc6c-4484-b77b-dba6b6f45588',
   'a919ba4b-0b5b-46f0-a4f3-4e0ac63bf490',
   'pending', 0, 0);