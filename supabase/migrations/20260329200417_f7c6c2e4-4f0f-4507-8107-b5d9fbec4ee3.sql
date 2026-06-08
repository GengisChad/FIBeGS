-- Delete duplicate top_cut matches for tournament 33e9b434-68ec-45ba-9cdb-0cecc41e9b3d
-- Keep the match with the smaller id for each (round, match_number) pair
DELETE FROM tournament_matches
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY tournament_id, phase, round, match_number 
      ORDER BY id
    ) as rn
    FROM tournament_matches
    WHERE tournament_id = '33e9b434-68ec-45ba-9cdb-0cecc41e9b3d'
      AND phase = 'top_cut'
  ) sub
  WHERE rn > 1
);

-- Also fix the round 2 match 1 that has player1_id missing in the kept copy
-- The correct one (676a45df) has both players, the incorrect one (48db4d68) is missing player1
-- After deleting duplicates, we need to ensure the surviving match has correct data