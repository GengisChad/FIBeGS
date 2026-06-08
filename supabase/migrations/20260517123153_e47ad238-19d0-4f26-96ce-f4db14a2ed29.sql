
-- Set winner's score to 4 for all matches in rounds 1-3
UPDATE tournament_matches
SET player1_score = CASE WHEN winner_id = player1_id THEN 4 ELSE player1_score END,
    player2_score = CASE WHEN winner_id = player2_id THEN 4 ELSE player2_score END
WHERE tournament_id = '80da8556-a292-44df-a0d2-8dbfd1458dcf'
  AND round IN (1,2,3)
  AND winner_id IS NOT NULL;

-- Set winner's score to 4 for BYE matches in rounds 4-7
UPDATE tournament_matches
SET player1_score = CASE WHEN player2_id IS NULL AND winner_id = player1_id THEN 4 ELSE player1_score END,
    player2_score = CASE WHEN player1_id IS NULL AND winner_id = player2_id THEN 4 ELSE player2_score END
WHERE tournament_id = '80da8556-a292-44df-a0d2-8dbfd1458dcf'
  AND round IN (4,5,6,7)
  AND (player1_id IS NULL OR player2_id IS NULL)
  AND winner_id IS NOT NULL;
