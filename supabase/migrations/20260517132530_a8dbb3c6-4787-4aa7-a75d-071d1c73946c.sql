UPDATE public.tournament_matches
SET player1_score = CASE WHEN winner_id = player1_id THEN 4 ELSE 0 END,
    player2_score = CASE WHEN winner_id = player2_id THEN 4 ELSE 0 END
WHERE tournament_id = '80da8556-a292-44df-a0d2-8dbfd1458dcf'
  AND winner_id IS NOT NULL;