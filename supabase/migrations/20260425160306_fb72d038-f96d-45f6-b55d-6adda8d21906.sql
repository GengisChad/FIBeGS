ALTER TABLE public.imported_tournaments_staging
  DROP CONSTRAINT IF EXISTS imported_tournaments_staging_source_platform_check;

ALTER TABLE public.imported_tournaments_staging
  ADD CONSTRAINT imported_tournaments_staging_source_platform_check
  CHECK (source_platform IN ('challonge', 'challengermode', 'challengermode_api', 'manual', 'other'));