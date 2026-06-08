
-- Delete all tournament results linked to CAMPANIA external tournaments
DELETE FROM tournament_results 
WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE is_external = true AND title LIKE 'CAMPANIA%'
);

-- Delete all pending tournament results linked to CAMPANIA external tournaments
DELETE FROM pending_tournament_results 
WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE is_external = true AND title LIKE 'CAMPANIA%'
);

-- Delete all CAMPANIA external tournaments
DELETE FROM tournaments 
WHERE is_external = true AND title LIKE 'CAMPANIA%';

-- Recalculate rankings after cleanup
SELECT recalculate_all_rankings();
