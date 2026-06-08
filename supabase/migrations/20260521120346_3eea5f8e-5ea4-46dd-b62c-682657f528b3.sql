DO $$
DECLARE
  r RECORD;
  res jsonb;
BEGIN
  FOR r IN
    WITH ghosts AS (
      SELECT p.user_id AS ghost_user_id
      FROM profiles p
      WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
    ),
    real_users AS (
      SELECT p.user_id AS real_user_id, p.username, p.display_name
      FROM profiles p
      WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
    ),
    mapped_ghosts AS (
      SELECT DISTINCT
        CASE
          WHEN m.platform ILIKE 'challengermode%' THEN 'challengermode'
          WHEN m.platform ILIKE 'challonge%'      THEN 'challonge'
          ELSE m.platform
        END AS platform,
        m.external_username,
        m.internal_user_id::uuid AS ghost_user_id
      FROM external_player_mappings m
      WHERE m.internal_user_id IS NOT NULL
    ),
    candidates AS (
      SELECT mg.platform, mg.external_username, ru.real_user_id,
             COUNT(*) OVER (PARTITION BY lower(mg.external_username), mg.platform) AS real_matches
      FROM mapped_ghosts mg
      JOIN ghosts g ON g.ghost_user_id = mg.ghost_user_id
      JOIN real_users ru
        ON lower(ru.username) = lower(mg.external_username)
    )
    SELECT DISTINCT platform, external_username, real_user_id
    FROM candidates
    WHERE real_matches = 1
      AND NOT EXISTS (
        SELECT 1 FROM user_external_accounts uea
        WHERE uea.user_id = candidates.real_user_id
          AND ((candidates.platform = 'challengermode' AND uea.platform = 'challengermode')
            OR (candidates.platform = 'challonge'      AND uea.platform = 'challonge'))
          AND lower(uea.external_username) <> lower(candidates.external_username)
      )
  LOOP
    BEGIN
      res := public.link_external_account_backfill(r.real_user_id, r.platform, r.external_username);
      RAISE NOTICE 'Backfill % (%) -> %: %', r.external_username, r.platform, r.real_user_id, res;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill FAILED for % (%) -> %: %', r.external_username, r.platform, r.real_user_id, SQLERRM;
    END;
  END LOOP;
END $$;