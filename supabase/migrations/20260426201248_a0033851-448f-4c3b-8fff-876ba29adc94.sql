DELETE FROM profiles
WHERE user_id IN (
  SELECT p.user_id FROM profiles p
  WHERE display_name LIKE '[BOT]%'
    AND NOT EXISTS (
      SELECT 1 FROM tournament_registrations tr
      JOIN tournaments t ON t.id = tr.tournament_id
      WHERE tr.user_id = p.user_id AND t.status NOT IN ('completed','cancelled')
    )
  ORDER BY created_at DESC
  LIMIT 5
);

SELECT COUNT(*) FILTER (WHERE display_name LIKE '[BOT]%') AS total_bots FROM profiles;