
-- 1. Delete tournament_results for all external CAMPANIA/UMBRIA tournaments
DELETE FROM tournament_results 
WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE is_external = true AND (title LIKE 'CAMPANIA%' OR title LIKE 'UMBRIA%')
);

-- 2. Delete pending_tournament_results
DELETE FROM pending_tournament_results 
WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE is_external = true AND (title LIKE 'CAMPANIA%' OR title LIKE 'UMBRIA%')
);

-- 3. Delete the external tournaments
DELETE FROM tournaments 
WHERE is_external = true AND (title LIKE 'CAMPANIA%' OR title LIKE 'UMBRIA%');

-- 4. Delete ghost profiles (profiles with no auth.users entry and non-bot/guest)
DELETE FROM profiles 
WHERE user_id NOT IN (SELECT id FROM auth.users)
  AND (username IS NOT NULL AND username != '')
  AND (display_name IS NULL OR (display_name NOT LIKE '[BOT]%' AND display_name NOT LIKE '[Guest]%'));

-- 5. Clear external_player_mappings for challengermode
DELETE FROM external_player_mappings WHERE platform = 'challengermode';

-- 6. Recalculate rankings
SELECT recalculate_all_rankings();
