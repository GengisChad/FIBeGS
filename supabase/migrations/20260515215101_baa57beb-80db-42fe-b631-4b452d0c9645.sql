DELETE FROM public.tournaments
WHERE is_external = true
  AND external_source IN ('challengermode', 'challengermode_api');

UPDATE public.imported_tournaments_staging
SET status = 'draft', send_error = NULL, sent_tournament_id = NULL
WHERE status IN ('sent', 'failed')
  AND source_platform IN ('challengermode', 'challengermode_api');