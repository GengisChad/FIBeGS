WITH desired(username, new_seed) AS (
  VALUES
    ('Zawardoo', 1),
    ('Leolinci', 2),
    ('Maverick994', 3),
    ('AragostaSorboleante', 4),
    ('Glace', 5),
    ('Lolloblade', 6),
    ('SAMURAI_X_18', 7),
    ('Lea9112', 8)
), resolved AS (
  SELECT p.user_id, desired.new_seed
  FROM desired
  JOIN public.profiles p ON p.username = desired.username
)
UPDATE public.tournament_standings ts
SET seed = resolved.new_seed
FROM resolved
WHERE ts.tournament_id = 'fbc02710-cdc9-4db1-9290-074403992a1f'::uuid
  AND ts.user_id = resolved.user_id;

WITH seeds AS (
  SELECT seed, user_id
  FROM public.tournament_standings
  WHERE tournament_id = 'fbc02710-cdc9-4db1-9290-074403992a1f'::uuid
), pairs(match_number, seed1, seed2) AS (
  VALUES (1,1,8),(2,4,5),(3,3,6),(4,2,7)
)
UPDATE public.tournament_matches tm
SET player1_id = s1.user_id,
    player2_id = s2.user_id,
    pairing_meta = COALESCE(tm.pairing_meta, '{}'::jsonb)
      || jsonb_build_object(
        'pairing', 'ibna_ui_seed_bracket_v1',
        'seed1', pairs.seed1,
        'seed2', pairs.seed2,
        'top_cut_size', 8,
        'repaired_at', now()
      )
FROM pairs
JOIN seeds s1 ON s1.seed = pairs.seed1
JOIN seeds s2 ON s2.seed = pairs.seed2
WHERE tm.tournament_id = 'fbc02710-cdc9-4db1-9290-074403992a1f'::uuid
  AND tm.phase = 'top_cut'
  AND tm.round = 1
  AND tm.match_number = pairs.match_number
  AND tm.status <> 'completed'
  AND tm.winner_id IS NULL;