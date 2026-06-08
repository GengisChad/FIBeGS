CREATE OR REPLACE FUNCTION public.recalculate_user_points_on_result_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  active_bfl INTEGER;
BEGIN
  SELECT bfl INTO active_bfl FROM ranking_seasons WHERE is_active = true LIMIT 1;
  IF active_bfl IS NULL THEN active_bfl := 10; END IF;

  IF EXISTS (SELECT 1 FROM child_profiles WHERE id = OLD.user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM tournament_results WHERE user_id = OLD.user_id) THEN
      UPDATE child_profiles SET points = 0, wins = 0, updated_at = now() WHERE id = OLD.user_id;
    ELSE
      UPDATE child_profiles cp
      SET points = COALESCE(sub.total, 0),
          wins = COALESCE(sub.win_count, 0),
          updated_at = now()
      FROM (
        SELECT tr.user_id,
               SUM(tr.scaled_points) as total,
               COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
        FROM (
          SELECT user_id, scaled_points, placement,
                 ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY scaled_points DESC) as rn
          FROM tournament_results
          WHERE user_id = OLD.user_id
        ) tr
        WHERE tr.rn <= active_bfl
        GROUP BY tr.user_id
      ) sub
      WHERE cp.id = sub.user_id;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM tournament_results WHERE user_id = OLD.user_id) THEN
      UPDATE profiles SET points = 0, wins = 0, updated_at = now() WHERE user_id = OLD.user_id;
    ELSE
      UPDATE profiles p
      SET points = COALESCE(sub.total, 0),
          wins = COALESCE(sub.win_count, 0),
          updated_at = now()
      FROM (
        SELECT tr.user_id,
               SUM(tr.scaled_points) as total,
               COUNT(*) FILTER (WHERE tr.placement = 1) as win_count
        FROM (
          SELECT user_id, scaled_points, placement,
                 ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY scaled_points DESC) as rn
          FROM tournament_results
          WHERE user_id = OLD.user_id
        ) tr
        WHERE tr.rn <= active_bfl
        GROUP BY tr.user_id
      ) sub
      WHERE p.user_id = sub.user_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$function$;