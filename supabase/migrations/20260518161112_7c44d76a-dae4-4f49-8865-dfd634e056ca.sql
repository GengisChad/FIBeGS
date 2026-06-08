DO $$
DECLARE r record; cnt int := 0;
BEGIN
  FOR r IN SELECT id FROM tournaments WHERE is_external = true AND status = 'completed' LOOP
    BEGIN
      PERFORM public._sys_refinalize_no_rank(r.id);
      cnt := cnt + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'processed %', cnt;
END $$;