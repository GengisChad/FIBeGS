
-- Restore original Round 1 matches for tournament 37db7c6c-1007-4cc0-b164-06674596d81f (Ranked BattleLeague)
-- Recovered manually from a screenshot provided by the organizer.

-- First, snapshot the current (incorrect) state for safety
INSERT INTO public.tournament_round_snapshots (tournament_id, round, phase, matches_data, created_by)
SELECT 
  '37db7c6c-1007-4cc0-b164-06674596d81f'::uuid,
  1,
  'swiss',
  COALESCE(jsonb_agg(to_jsonb(m.*)), '[]'::jsonb),
  NULL
FROM public.tournament_matches m
WHERE m.tournament_id='37db7c6c-1007-4cc0-b164-06674596d81f' AND m.round=1;

-- Delete current R1 matches
DELETE FROM public.tournament_matches 
WHERE tournament_id='37db7c6c-1007-4cc0-b164-06674596d81f' AND round=1;

-- Re-insert the original 9 matches with scores and winners
INSERT INTO public.tournament_matches 
  (tournament_id, round, phase, match_number, player1_id, player2_id, player1_score, player2_score, winner_id, status)
VALUES
  -- M1: Daipled vs BYE → Daipled wins
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 1, '6d1fe6e9-f499-49df-a1fa-ca694b6c1524', NULL, 0, 0, '6d1fe6e9-f499-49df-a1fa-ca694b6c1524', 'completed'),
  -- M2: Mudano 4 vs armaDio 0 → Mudano
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 2, 'b0f7c8e1-3385-47cb-b7f6-4cabdabb1b3d', '6c55b600-91f1-4fee-b9f6-fbfb13bdaa36', 4, 0, 'b0f7c8e1-3385-47cb-b7f6-4cabdabb1b3d', 'completed'),
  -- M3: BladerJ 5 vs Tasso(LeonKiryu) 1 → BladerJ
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 3, '32c1757d-fdcf-4b99-831d-13edec33b9e5', '4a7465db-38bd-4f92-984d-e45bc3887f58', 5, 1, '32c1757d-fdcf-4b99-831d-13edec33b9e5', 'completed'),
  -- M4: MattiAkab 3 vs Mimik 5 → Mimik
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 4, '82f74397-f45a-4957-935d-0dd05cb227d4', '9f5d4a63-578a-46d7-8c3a-34120f425e42', 3, 5, '9f5d4a63-578a-46d7-8c3a-34120f425e42', 'completed'),
  -- M5: fake 0 vs Lupoalby0 5 → Lupoalby0
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 5, 'f9689b52-e222-4699-9be2-756078667dd6', 'a10458f6-a5a7-4411-a622-08052969af6d', 0, 5, 'a10458f6-a5a7-4411-a622-08052969af6d', 'completed'),
  -- M6: UomoNabbo 6 vs Mhate 0 → UomoNabbo
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 6, 'a0a0c743-75a7-407c-bf4e-1eac953bd762', '07cefef6-c513-4dc1-97c2-134bad4a2f44', 6, 0, 'a0a0c743-75a7-407c-bf4e-1eac953bd762', 'completed'),
  -- M7: Manny88D_ 0 vs UOMOTIZIO 4 → UOMOTIZIO
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 7, '50e4e4cc-73f9-476a-9181-9fccc70289bf', '0d21ea2e-5dbb-42f3-bd1c-9cf296c20302', 0, 4, '0d21ea2e-5dbb-42f3-bd1c-9cf296c20302', 'completed'),
  -- M8: UOMODORIAN 4 vs HappyGilmoreblader 2 → UOMODORIAN
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 8, '0ca3d666-841f-493e-a356-d8bf00f762f8', '9b380785-3bb0-4e67-b7a7-88f2e03f78d1', 4, 2, '0ca3d666-841f-493e-a356-d8bf00f762f8', 'completed'),
  -- M9: IoExTeR(BladeBreakersClub) 0 vs kiwi 4 → kiwi
  ('37db7c6c-1007-4cc0-b164-06674596d81f', 1, 'swiss', 9, '8e7f4044-a8fa-4d41-995c-86534f492c8f', '01465c08-0293-423a-9c2f-d160d924ca11', 0, 4, '01465c08-0293-423a-9c2f-d160d924ca11', 'completed');
