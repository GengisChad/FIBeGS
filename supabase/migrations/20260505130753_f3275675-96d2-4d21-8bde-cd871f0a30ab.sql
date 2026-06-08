
ALTER TABLE public.faq_supporters
  ADD COLUMN IF NOT EXISTS kofi_message_id text,
  ADD COLUMN IF NOT EXISTS kofi_amount numeric,
  ADD COLUMN IF NOT EXISTS kofi_email text;

CREATE UNIQUE INDEX IF NOT EXISTS faq_supporters_kofi_message_id_key
  ON public.faq_supporters (kofi_message_id)
  WHERE kofi_message_id IS NOT NULL;
