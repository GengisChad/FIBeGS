-- Clean broken external imports to allow fresh re-import with corrected logic
DELETE FROM tournament_results
WHERE tournament_id IN (
  SELECT id FROM tournaments
  WHERE is_external = true
    AND external_source = 'challengermode'
    AND (title ILIKE 'UMBRIA%' OR title ILIKE 'CAMPANIA%')
);

DELETE FROM pending_tournament_results
WHERE tournament_id IN (
  SELECT id FROM tournaments
  WHERE is_external = true
    AND external_source = 'challengermode'
    AND (title ILIKE 'UMBRIA%' OR title ILIKE 'CAMPANIA%')
);

DELETE FROM tournaments
WHERE is_external = true
  AND external_source = 'challengermode'
  AND (title ILIKE 'UMBRIA%' OR title ILIKE 'CAMPANIA%');

SELECT recalculate_all_rankings();