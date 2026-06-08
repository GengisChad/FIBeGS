WITH ui_seeds(seed, user_id) AS (
  VALUES
    (1, 'f457f1f9-95c7-4d13-88f3-c0cd89633ba5'::uuid),
    (2, '087dc226-fe30-42b8-a96c-0b3ad91b9d80'::uuid),
    (3, '8b9ea02b-0899-4071-af77-c51e323830ef'::uuid),
    (4, '5e2d8b7c-111f-45ce-b901-fbd714a70536'::uuid),
    (5, '328c9085-b306-4b1c-94d7-0024746f0d69'::uuid),
    (6, '94d07a39-339e-4d6f-83df-c8bbf5439adb'::uuid),
    (7, '6dabd8c4-e603-42fb-b59f-5f154eedefd4'::uuid),
    (8, '78aecb33-bf96-4af0-b9a3-fa6a4b66921b'::uuid)
), bracket(match_number, seed1, seed2) AS (
  VALUES (1,1,8),(2,4,5),(3,3,6),(4,2,7)
)
UPDATE public.tournament_matches tm
SET player1_id = p1.user_id,
    player2_id = p2.user_id,
    pairing_meta = COALESCE(tm.pairing_meta, '{}'::jsonb)
      || jsonb_build_object(
        'pairing', 'ibna_ui_seed_manual_final',
        'seed1', bracket.seed1,
        'seed2', bracket.seed2,
        'top_cut_size', 8,
        'repaired_at', now()
      )
FROM bracket
JOIN ui_seeds p1 ON p1.seed = bracket.seed1
JOIN ui_seeds p2 ON p2.seed = bracket.seed2
WHERE tm.tournament_id = 'fbc02710-cdc9-4db1-9290-074403992a1f'::uuid
  AND tm.phase = 'top_cut'
  AND tm.round = 1
  AND tm.match_number = bracket.match_number
  AND tm.status <> 'completed'
  AND tm.winner_id IS NULL;