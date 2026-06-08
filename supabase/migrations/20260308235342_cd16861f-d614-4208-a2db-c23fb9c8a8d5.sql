-- Resolve linter issue: avoid SECURITY DEFINER view behavior
ALTER VIEW public.club_members_public SET (security_invoker = true);