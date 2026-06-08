
CREATE TABLE IF NOT EXISTS public.tournament_streaming_settings (
  tournament_id UUID PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  highlighted_match_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_streaming_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read streaming settings"
ON public.tournament_streaming_settings
FOR SELECT
USING (true);

CREATE POLICY "Staff can insert streaming settings"
ON public.tournament_streaming_settings
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.tournaments t
    LEFT JOIN public.club_members cm
      ON cm.club_id = t.club_id AND cm.user_id = auth.uid()
    WHERE t.id = tournament_id
      AND (
        t.created_by = auth.uid()
        OR cm.role IN ('leader','vice_leader','staff')
      )
  )
);

CREATE POLICY "Staff can update streaming settings"
ON public.tournament_streaming_settings
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.tournaments t
    LEFT JOIN public.club_members cm
      ON cm.club_id = t.club_id AND cm.user_id = auth.uid()
    WHERE t.id = tournament_id
      AND (
        t.created_by = auth.uid()
        OR cm.role IN ('leader','vice_leader','staff')
      )
  )
);

CREATE POLICY "Admins can delete streaming settings"
ON public.tournament_streaming_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_streaming_settings_updated_at
BEFORE UPDATE ON public.tournament_streaming_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tournament_streaming_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_streaming_settings;
