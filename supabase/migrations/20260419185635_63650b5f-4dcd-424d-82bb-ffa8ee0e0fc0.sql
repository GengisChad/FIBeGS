-- Riparazione match 3°/4° posto per torneo Ranked BattleLeague (37db7c6c)
-- Propagazione dei perdenti delle semifinali al match 3°/4°
UPDATE public.tournament_matches
SET player1_id = '50e4e4cc-73f9-476a-9181-9fccc70289bf',  -- perdente SF1 (match_number 1)
    player2_id = '0d21ea2e-5dbb-42f3-bd1c-9cf296c20302'   -- perdente SF2 (match_number 2)
WHERE id = '13953bc8-704e-4cd9-8c31-3b0aece54256';