
-- Allow championship managers (sponsors) to insert tournaments for their championships
CREATE POLICY "Championship managers can insert tournaments"
ON public.tournaments
FOR INSERT
TO authenticated
WITH CHECK (
  championship_id IS NOT NULL
  AND has_role(auth.uid(), 'sponsor'::app_role)
  AND EXISTS (
    SELECT 1 FROM championship_managers cm
    WHERE cm.championship_id = tournaments.championship_id
    AND cm.user_id = auth.uid()
  )
);

-- Allow championship managers to update their championship's tournaments
CREATE POLICY "Championship managers can update tournaments"
ON public.tournaments
FOR UPDATE
TO authenticated
USING (
  championship_id IS NOT NULL
  AND has_role(auth.uid(), 'sponsor'::app_role)
  AND EXISTS (
    SELECT 1 FROM championship_managers cm
    WHERE cm.championship_id = tournaments.championship_id
    AND cm.user_id = auth.uid()
  )
);

-- Allow sponsors to manage sponsors of their championships
CREATE POLICY "Championship managers can manage sponsors"
ON public.championship_sponsors
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'sponsor'::app_role)
  AND EXISTS (
    SELECT 1 FROM championship_managers cm
    WHERE cm.championship_id = championship_sponsors.championship_id
    AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'sponsor'::app_role)
  AND EXISTS (
    SELECT 1 FROM championship_managers cm
    WHERE cm.championship_id = championship_sponsors.championship_id
    AND cm.user_id = auth.uid()
  )
);
