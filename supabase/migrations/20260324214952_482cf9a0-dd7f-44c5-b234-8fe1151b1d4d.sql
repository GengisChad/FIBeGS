-- Estende la policy di update dei match: con scoring_policy = 'staff_referees_players'
-- possono aggiornare i match tutti i partecipanti confermati del torneo,
-- non solo i due giocatori del match o gli arbitri certificati.

DROP POLICY IF EXISTS "Players and referees can update matches per scoring policy" ON public.tournament_matches;

CREATE POLICY "Players and referees can update matches per scoring policy"
ON public.tournament_matches
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_matches.tournament_id
      AND (
        (
          t.scoring_policy = 'staff_and_referees'
          AND EXISTS (
            SELECT 1
            FROM public.user_badges ub
            WHERE ub.user_id = auth.uid()
              AND ub.badge_id = ANY (ARRAY[
                'e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1'::uuid,
                'bf309168-a73c-451b-88a9-f56c18a4315f'::uuid
              ])
          )
        )
        OR (
          t.scoring_policy = 'staff_referees_players'
          AND (
            EXISTS (
              SELECT 1
              FROM public.tournament_registrations tr
              WHERE tr.tournament_id = tournament_matches.tournament_id
                AND tr.user_id = auth.uid()
                AND tr.status IN ('confirmed', 'pending')
            )
            OR EXISTS (
              SELECT 1
              FROM public.user_badges ub
              WHERE ub.user_id = auth.uid()
                AND ub.badge_id = ANY (ARRAY[
                  'e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1'::uuid,
                  'bf309168-a73c-451b-88a9-f56c18a4315f'::uuid
                ])
            )
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_matches.tournament_id
      AND (
        (
          t.scoring_policy = 'staff_and_referees'
          AND EXISTS (
            SELECT 1
            FROM public.user_badges ub
            WHERE ub.user_id = auth.uid()
              AND ub.badge_id = ANY (ARRAY[
                'e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1'::uuid,
                'bf309168-a73c-451b-88a9-f56c18a4315f'::uuid
              ])
          )
        )
        OR (
          t.scoring_policy = 'staff_referees_players'
          AND (
            EXISTS (
              SELECT 1
              FROM public.tournament_registrations tr
              WHERE tr.tournament_id = tournament_matches.tournament_id
                AND tr.user_id = auth.uid()
                AND tr.status IN ('confirmed', 'pending')
            )
            OR EXISTS (
              SELECT 1
              FROM public.user_badges ub
              WHERE ub.user_id = auth.uid()
                AND ub.badge_id = ANY (ARRAY[
                  'e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1'::uuid,
                  'bf309168-a73c-451b-88a9-f56c18a4315f'::uuid
                ])
            )
          )
        )
      )
  )
);