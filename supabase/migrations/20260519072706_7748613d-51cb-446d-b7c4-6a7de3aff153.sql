CREATE TABLE public.user_chat_keys (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_chat_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat key"
  ON public.user_chat_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat key"
  ON public.user_chat_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat key"
  ON public.user_chat_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_chat_keys_updated_at
  BEFORE UPDATE ON public.user_chat_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();