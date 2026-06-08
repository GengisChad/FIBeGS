-- Storia delle chiavi di cifratura E2E per ogni utente.
-- Permette di decifrare anche messaggi vecchi cifrati con coppie precedenti,
-- in modo che ogni dispositivo loggato possa leggere TUTTI i messaggi.
CREATE TABLE IF NOT EXISTS public.user_chat_key_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, public_key)
);

CREATE INDEX IF NOT EXISTS idx_user_chat_key_history_user
  ON public.user_chat_key_history (user_id, created_at DESC);

ALTER TABLE public.user_chat_key_history ENABLE ROW LEVEL SECURITY;

-- L'utente può leggere SOLO la propria storia chiavi.
CREATE POLICY "Users can read own key history"
  ON public.user_chat_key_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- L'utente può inserire nuove coppie nella propria storia.
CREATE POLICY "Users can insert own key history"
  ON public.user_chat_key_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Nessuno può modificare o eliminare la storia chiavi (write-once).
-- Backfill: salva la coppia corrente di ogni utente nella storia.
INSERT INTO public.user_chat_key_history (user_id, public_key, private_key)
SELECT user_id, public_key, private_key
FROM public.user_chat_keys
WHERE public_key IS NOT NULL AND private_key IS NOT NULL
ON CONFLICT (user_id, public_key) DO NOTHING;