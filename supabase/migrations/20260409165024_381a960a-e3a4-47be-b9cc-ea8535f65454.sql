-- Enable realtime for announcements
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

-- Ensure authenticated users can read announcements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'announcements' AND policyname = 'Authenticated users can read announcements'
  ) THEN
    CREATE POLICY "Authenticated users can read announcements"
      ON public.announcements
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;