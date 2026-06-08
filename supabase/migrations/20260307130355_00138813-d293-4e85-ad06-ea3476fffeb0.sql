
-- Remove duplicate triggers on deck_reports and market_reports
DROP TRIGGER IF EXISTS notify_on_deck_report ON public.deck_reports;
DROP TRIGGER IF EXISTS notify_on_market_report ON public.market_reports;
