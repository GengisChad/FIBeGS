CREATE OR REPLACE FUNCTION public.can_chat_by_staff_scope(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_a, 'admin'::app_role)
    OR public.has_role(_b, 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.regional_referents rr
      JOIN public.profiles p ON p.user_id = _b
      WHERE rr.user_id = _a
        AND rr.is_active = true
        AND rr.region_id = p.region_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.regional_referents rr
      JOIN public.profiles p ON p.user_id = _a
      WHERE rr.user_id = _b
        AND rr.is_active = true
        AND rr.region_id = p.region_id
    );
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_rankings(_bfl integer DEFAULT 10, _monthly_bfl_enabled boolean DEFAULT false, _monthly_bfl integer DEFAULT 2)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _season_start date;
  _season_end date;
  _effective_month date;
  _months_elapsed integer := 1;
  _monthly_cap integer := 0;
BEGIN
  SELECT start_date, end_date INTO _season_start, _season_end
  FROM public.ranking_seasons WHERE is_active = true LIMIT 1;

  UPDATE public.profiles
    SET points = 0, wins = 0, points_monthly = 0, wins_monthly = 0, updated_at = now()
    WHERE true;
  UPDATE public.child_profiles
    SET points = 0, wins = 0, points_monthly = 0, wins_monthly = 0, updated_at = now()
    WHERE true;

  DROP TABLE IF EXISTS _elig_results;
  CREATE TEMP TABLE _elig_results ON COMMIT DROP AS
  SELECT tr2.user_id, COALESCE(tr2.scaled_points, tr2.base_points, 0) AS ranking_points, tr2.placement, t.event_date::date AS event_date
  FROM public.tournament_results tr2
  JOIN public.tournaments t ON t.id = tr2.tournament_id
  WHERE t.championship_id IS NULL
    AND t.is_ranked = true
    AND (_season_start IS NULL OR t.event_date::date >= _season_start)
    AND (_season_end IS NULL OR t.event_date::date <= _season_end);

  UPDATE public.profiles p
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id,
           SUM(tr.ranking_points)::integer AS total,
           COUNT(*) FILTER (WHERE tr.placement = 1)::integer AS win_count
    FROM (
      SELECT er.user_id, er.ranking_points, er.placement,
             ROW_NUMBER() OVER (PARTITION BY er.user_id ORDER BY er.ranking_points DESC, er.event_date DESC) AS rn
      FROM _elig_results er
      WHERE NOT EXISTS (SELECT 1 FROM public.child_profiles cp WHERE cp.id = er.user_id)
    ) tr
    WHERE tr.rn <= GREATEST(_bfl, 1)
    GROUP BY tr.user_id
  ) sub
  WHERE p.user_id = sub.user_id;

  UPDATE public.child_profiles cp
  SET points = COALESCE(sub.total, 0),
      wins = COALESCE(sub.win_count, 0),
      updated_at = now()
  FROM (
    SELECT tr.user_id AS child_id,
           SUM(tr.ranking_points)::integer AS total,
           COUNT(*) FILTER (WHERE tr.placement = 1)::integer AS win_count
    FROM (
      SELECT er.user_id, er.ranking_points, er.placement,
             ROW_NUMBER() OVER (PARTITION BY er.user_id ORDER BY er.ranking_points DESC, er.event_date DESC) AS rn
      FROM _elig_results er
      WHERE EXISTS (SELECT 1 FROM public.child_profiles c WHERE c.id = er.user_id)
    ) tr
    WHERE tr.rn <= GREATEST(_bfl, 1)
    GROUP BY tr.user_id
  ) sub
  WHERE cp.id = sub.child_id;

  IF _monthly_bfl_enabled THEN
    _effective_month := LEAST(date_trunc('month', COALESCE(_season_end, CURRENT_DATE))::date, date_trunc('month', CURRENT_DATE)::date);
    IF _season_start IS NOT NULL THEN
      _months_elapsed := GREATEST(1, ((EXTRACT(YEAR FROM _effective_month)::integer - EXTRACT(YEAR FROM date_trunc('month', _season_start))::integer) * 12 + (EXTRACT(MONTH FROM _effective_month)::integer - EXTRACT(MONTH FROM date_trunc('month', _season_start))::integer) + 1));
    END IF;
    _monthly_cap := LEAST(GREATEST(_bfl, 1), GREATEST(_monthly_bfl, 1) * _months_elapsed);

    UPDATE public.profiles p
    SET points_monthly = COALESCE(sub.total, 0),
        wins_monthly = COALESCE(sub.win_count, 0),
        updated_at = now()
    FROM (
      SELECT tr.user_id,
             SUM(tr.ranking_points)::integer AS total,
             COUNT(*) FILTER (WHERE tr.placement = 1)::integer AS win_count
      FROM (
        SELECT er.user_id, er.ranking_points, er.placement,
               ROW_NUMBER() OVER (PARTITION BY er.user_id ORDER BY er.ranking_points DESC, er.event_date DESC) AS rn
        FROM _elig_results er
        WHERE er.event_date <= COALESCE(_season_end, CURRENT_DATE)
      ) tr
      WHERE tr.rn <= _monthly_cap
      GROUP BY tr.user_id
    ) sub
    WHERE p.user_id = sub.user_id
      AND NOT EXISTS (SELECT 1 FROM public.child_profiles cp WHERE cp.id = sub.user_id);

    UPDATE public.child_profiles cp
    SET points_monthly = COALESCE(sub.total, 0),
        wins_monthly = COALESCE(sub.win_count, 0),
        updated_at = now()
    FROM (
      SELECT tr.user_id,
             SUM(tr.ranking_points)::integer AS total,
             COUNT(*) FILTER (WHERE tr.placement = 1)::integer AS win_count
      FROM (
        SELECT er.user_id, er.ranking_points, er.placement,
               ROW_NUMBER() OVER (PARTITION BY er.user_id ORDER BY er.ranking_points DESC, er.event_date DESC) AS rn
        FROM _elig_results er
        WHERE er.event_date <= COALESCE(_season_end, CURRENT_DATE)
      ) tr
      WHERE tr.rn <= _monthly_cap
      GROUP BY tr.user_id
    ) sub
    WHERE cp.id = sub.user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_user_points(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bfl int;
  _monthly_bfl_enabled boolean;
  _monthly_bfl int;
  _season_start date;
  _season_end date;
  _effective_month date;
  _months_elapsed int := 1;
  _monthly_cap int := 0;
  _is_child boolean;
BEGIN
  SELECT COALESCE(bfl,10), COALESCE(monthly_bfl_enabled,false), COALESCE(monthly_bfl,2), start_date, end_date
    INTO _bfl, _monthly_bfl_enabled, _monthly_bfl, _season_start, _season_end
  FROM public.ranking_seasons WHERE is_active = true LIMIT 1;
  IF _bfl IS NULL THEN _bfl := 10; END IF;

  _is_child := EXISTS (SELECT 1 FROM public.child_profiles WHERE id = _user_id);

  DROP TABLE IF EXISTS _u_elig;
  CREATE TEMP TABLE _u_elig ON COMMIT DROP AS
  SELECT COALESCE(tr.scaled_points, tr.base_points, 0) AS ranking_points, tr.placement, t.event_date::date AS event_date
  FROM public.tournament_results tr
  JOIN public.tournaments t ON t.id = tr.tournament_id
  WHERE tr.user_id = _user_id
    AND t.championship_id IS NULL
    AND t.is_ranked = true
    AND (_season_start IS NULL OR t.event_date::date >= _season_start)
    AND (_season_end IS NULL OR t.event_date::date <= _season_end);

  IF _is_child THEN
    UPDATE public.child_profiles cp
       SET points = COALESCE(sub.total,0), wins = COALESCE(sub.win_count,0), updated_at = now()
      FROM (
        SELECT SUM(ranking_points)::integer AS total, COUNT(*) FILTER (WHERE placement = 1)::integer AS win_count
          FROM (
            SELECT ranking_points, placement, ROW_NUMBER() OVER (ORDER BY ranking_points DESC, event_date DESC) AS rn
              FROM _u_elig
          ) x
         WHERE rn <= GREATEST(_bfl, 1)
      ) sub
     WHERE cp.id = _user_id;
  ELSE
    UPDATE public.profiles p
       SET points = COALESCE(sub.total,0), wins = COALESCE(sub.win_count,0), updated_at = now()
      FROM (
        SELECT SUM(ranking_points)::integer AS total, COUNT(*) FILTER (WHERE placement = 1)::integer AS win_count
          FROM (
            SELECT ranking_points, placement, ROW_NUMBER() OVER (ORDER BY ranking_points DESC, event_date DESC) AS rn
              FROM _u_elig
          ) x
         WHERE rn <= GREATEST(_bfl, 1)
      ) sub
     WHERE p.user_id = _user_id;
  END IF;

  IF _monthly_bfl_enabled THEN
    _effective_month := LEAST(date_trunc('month', COALESCE(_season_end, CURRENT_DATE))::date, date_trunc('month', CURRENT_DATE)::date);
    IF _season_start IS NOT NULL THEN
      _months_elapsed := GREATEST(1, ((EXTRACT(YEAR FROM _effective_month)::integer - EXTRACT(YEAR FROM date_trunc('month', _season_start))::integer) * 12 + (EXTRACT(MONTH FROM _effective_month)::integer - EXTRACT(MONTH FROM date_trunc('month', _season_start))::integer) + 1));
    END IF;
    _monthly_cap := LEAST(GREATEST(_bfl, 1), GREATEST(_monthly_bfl, 1) * _months_elapsed);

    IF _is_child THEN
      UPDATE public.child_profiles cp
        SET points_monthly = COALESCE(sub.total,0), wins_monthly = COALESCE(sub.win_count,0), updated_at = now()
        FROM (
          SELECT SUM(ranking_points)::integer AS total, COUNT(*) FILTER (WHERE placement=1)::integer AS win_count
            FROM (
              SELECT ranking_points, placement, ROW_NUMBER() OVER (ORDER BY ranking_points DESC, event_date DESC) AS rn
                FROM _u_elig
               WHERE event_date <= COALESCE(_season_end, CURRENT_DATE)
            ) x
           WHERE rn <= _monthly_cap
        ) sub
       WHERE cp.id = _user_id;
    ELSE
      UPDATE public.profiles p
        SET points_monthly = COALESCE(sub.total,0), wins_monthly = COALESCE(sub.win_count,0), updated_at = now()
        FROM (
          SELECT SUM(ranking_points)::integer AS total, COUNT(*) FILTER (WHERE placement=1)::integer AS win_count
            FROM (
              SELECT ranking_points, placement, ROW_NUMBER() OVER (ORDER BY ranking_points DESC, event_date DESC) AS rn
                FROM _u_elig
               WHERE event_date <= COALESCE(_season_end, CURRENT_DATE)
            ) x
           WHERE rn <= _monthly_cap
        ) sub
       WHERE p.user_id = _user_id;
    END IF;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "private_chats_insert_allowed" ON public.private_chats;
CREATE POLICY "private_chats_insert_allowed" ON public.private_chats
FOR INSERT
WITH CHECK (
  (auth.uid() = user_a OR auth.uid() = user_b)
  AND (
    public.are_friends(user_a, user_b)
    OR public.are_teammates(user_a, user_b)
    OR public.can_chat_via_club_request(user_a, user_b)
    OR public.can_chat_by_staff_scope(user_a, user_b)
  )
);

DROP POLICY IF EXISTS "private_messages_insert" ON public.private_messages;
CREATE POLICY "private_messages_insert" ON public.private_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.private_chats c
    WHERE c.id = chat_id
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
      AND (
        public.are_friends(c.user_a, c.user_b)
        OR public.are_teammates(c.user_a, c.user_b)
        OR public.can_chat_via_club_request(c.user_a, c.user_b)
        OR public.can_chat_by_staff_scope(c.user_a, c.user_b)
      )
  )
);

SELECT public.recalculate_all_rankings(
  COALESCE((SELECT bfl FROM public.ranking_seasons WHERE is_active = true LIMIT 1), 10),
  COALESCE((SELECT monthly_bfl_enabled FROM public.ranking_seasons WHERE is_active = true LIMIT 1), false),
  COALESCE((SELECT monthly_bfl FROM public.ranking_seasons WHERE is_active = true LIMIT 1), 2)
);