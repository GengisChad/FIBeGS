UPDATE public.tournament_standings
SET seed = CASE id
  WHEN '514be7b4-5bdc-4dcb-99a2-89f49c733113'::uuid THEN 5
  WHEN '08ccfcfd-faa5-491b-a2bb-372004db8bf8'::uuid THEN 6
  WHEN 'e7ca1284-0dba-4f88-a0c5-8e890c765b1c'::uuid THEN 7
  WHEN '4bc77b3d-db6d-43cb-aa8a-56aa35efbe48'::uuid THEN 8
  ELSE seed
END
WHERE id IN (
  '514be7b4-5bdc-4dcb-99a2-89f49c733113'::uuid,
  '08ccfcfd-faa5-491b-a2bb-372004db8bf8'::uuid,
  'e7ca1284-0dba-4f88-a0c5-8e890c765b1c'::uuid,
  '4bc77b3d-db6d-43cb-aa8a-56aa35efbe48'::uuid
);

WITH pairs(match_number, player1_id, player2_id, seed1, seed2) AS (
  VALUES
    (1, 'f457f1f9-95c7-4d13-88f3-c0cd89633ba5'::uuid, '78aecb33-bf96-4af0-b9a3-fa6a4b66921b'::uuid, 1, 8),
    (2, '5e2d8b7c-111f-45ce-b901-fbd714a70536'::uuid, '328c9085-b306-4b1c-94d7-0024746f0d69'::uuid, 4, 5),
    (3, '8b9ea02b-0899-4071-af77-c51e323830ef'::uuid, '94d07a39-339e-4d6f-83df-c8bbf5439adb'::uuid, 3, 6),
    (4, '087dc226-fe30-42b8-a96c-0b3ad91b9d80'::uuid, '6dabd8c4-e603-42fb-b59f-5f154eedefd4'::uuid, 2, 7)
)
UPDATE public.tournament_matches tm
SET player1_id = pairs.player1_id,
    player2_id = pairs.player2_id,
    pairing_meta = COALESCE(tm.pairing_meta, '{}'::jsonb)
      || jsonb_build_object(
        'pairing', 'ibna_manual_ui_seed_fix_v2',
        'seed1', pairs.seed1,
        'seed2', pairs.seed2,
        'top_cut_size', 8,
        'repaired_at', now()
      )
FROM pairs
WHERE tm.tournament_id = 'fbc02710-cdc9-4db1-9290-074403992a1f'::uuid
  AND tm.phase = 'top_cut'
  AND tm.round = 1
  AND tm.match_number = pairs.match_number
  AND tm.status <> 'completed'
  AND tm.winner_id IS NULL;