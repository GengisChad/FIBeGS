-- Fix 1: Add missing FK constraints with ON DELETE CASCADE
ALTER TABLE public.tournament_standings ADD CONSTRAINT fk_standings_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tournament_results ADD CONSTRAINT fk_results_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.market_listings ADD CONSTRAINT fk_listings_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.market_reports ADD CONSTRAINT fk_reports_user FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_collection ADD CONSTRAINT fk_collection_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ranking_snapshots ADD CONSTRAINT fk_snapshots_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix 2: Replace overly permissive push_subscriptions RLS policy
DROP POLICY "Club staff can view subscriptions" ON public.push_subscriptions;

CREATE POLICY "Staff can view tournament participant subscriptions"
ON public.push_subscriptions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tournament_registrations tr
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tr.user_id = push_subscriptions.user_id
    AND t.club_id IS NOT NULL
    AND is_club_staff(auth.uid(), t.club_id)
  )
  OR has_role(auth.uid(), 'admin')
);