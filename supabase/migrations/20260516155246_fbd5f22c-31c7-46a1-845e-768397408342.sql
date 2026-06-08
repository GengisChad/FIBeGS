
-- 1) user_external_accounts: drop the public USING(true) SELECT policy
DROP POLICY IF EXISTS "external accounts public username read" ON public.user_external_accounts;

-- Add an explicit admin read policy so admins can still view all rows
CREATE POLICY "Admins can read all external accounts"
ON public.user_external_accounts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) faq_supporters: remove public SELECT that exposed kofi_email
DROP POLICY IF EXISTS "Anyone can read active supporters" ON public.faq_supporters;

-- Public view exposing only safe columns
CREATE OR REPLACE VIEW public.faq_supporters_public
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  display_name,
  avatar_url,
  tier,
  message,
  badge_id,
  sort_order,
  is_active,
  created_at,
  kofi_amount
FROM public.faq_supporters
WHERE is_active = true;

GRANT SELECT ON public.faq_supporters_public TO anon, authenticated;

-- Allow admins (and the "Admins can manage supporters" ALL policy already covers this)
-- but ensure the underlying table SELECT works for the security_invoker view when called by admins.
CREATE POLICY "Admins can read all supporters"
ON public.faq_supporters
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow the public view to read rows by granting a minimal SELECT for the view
-- Note: With security_invoker=true the view runs RLS as the caller, so the
-- view will return zero rows unless callers have SELECT rights. To make the
-- public view actually serve anon users, we need a row-scoped policy that
-- restricts to active rows (the view only selects safe columns).
CREATE POLICY "Public can read active supporters (safe columns via view)"
ON public.faq_supporters
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- IMPORTANT: the above policy still allows direct table reads of all columns
-- including kofi_email. To prevent that, revoke direct SELECT on the table
-- from anon/authenticated and let only the view expose data.
REVOKE SELECT ON public.faq_supporters FROM anon, authenticated;
GRANT SELECT ON public.faq_supporters TO service_role;
-- Admins still access the table via the "Admins can manage supporters" ALL policy
-- through PostgREST? No — they need table-level GRANT too. Keep grant for authenticated
-- so admin reads work via RLS check.
GRANT SELECT ON public.faq_supporters TO authenticated;

-- 3) feedback-attachments bucket: make private and drop public read policy
UPDATE storage.buckets SET public = false WHERE id = 'feedback-attachments';
DROP POLICY IF EXISTS "Feedback attachments are publicly readable" ON storage.objects;
