INSERT INTO tournament_registrations (tournament_id, user_id, status, registered_at)
SELECT t.id, tr.user_id, 'confirmed', t.event_date
FROM tournaments t
JOIN tournament_results tr ON tr.tournament_id = t.id
WHERE t.is_external = true
  AND tr.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tournament_registrations r
    WHERE r.tournament_id = t.id AND r.user_id = tr.user_id
  );