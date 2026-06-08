DO $$
DECLARE
  r record;
  m text[];
  d int; mo int; y int;
  new_date date;
  fallback_year int;
BEGIN
  FOR r IN
    SELECT id, title, event_date FROM tournaments WHERE is_external = true
  LOOP
    -- Try DD[/.-]MM[/.-]YYYY first
    m := regexp_match(r.title, '(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})');
    IF m IS NOT NULL THEN
      d := m[1]::int; mo := m[2]::int; y := m[3]::int;
      IF y < 100 THEN y := 2000 + y; END IF;
    ELSE
      -- DD[/.-]MM only — use current event_date year as fallback (should be ranking season year)
      m := regexp_match(r.title, '(\d{1,2})[\/.\-](\d{1,2})(?!\d)');
      IF m IS NULL THEN CONTINUE; END IF;
      d := m[1]::int; mo := m[2]::int;
      fallback_year := COALESCE(EXTRACT(YEAR FROM r.event_date)::int, EXTRACT(YEAR FROM now())::int);
      y := fallback_year;
    END IF;

    IF d < 1 OR d > 31 OR mo < 1 OR mo > 12 OR y < 2000 OR y > 2100 THEN CONTINUE; END IF;

    BEGIN
      new_date := make_date(y, mo, d);
    EXCEPTION WHEN OTHERS THEN CONTINUE;
    END;

    UPDATE tournaments
    SET event_date = (new_date::timestamp AT TIME ZONE 'UTC')
    WHERE id = r.id;
  END LOOP;
END $$;

-- Recompute rankings now that event dates reflect real tournament dates
DO $$
DECLARE _b int := 10; _me boolean := false; _mb int := 2;
BEGIN
  SELECT COALESCE(bfl, 10), COALESCE(monthly_bfl_enabled, false), COALESCE(monthly_bfl, 2)
    INTO _b, _me, _mb
  FROM ranking_seasons WHERE is_active = true LIMIT 1;
  PERFORM public.recalculate_all_rankings(_b, _me, _mb);
END $$;