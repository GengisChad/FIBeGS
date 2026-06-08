
CREATE POLICY "Players and referees can update matches per scoring policy"
ON public.tournament_matches
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_matches.tournament_id
    AND (
      (t.scoring_policy = 'staff_and_referees' AND EXISTS (
        SELECT 1 FROM user_badges ub
        WHERE ub.user_id = auth.uid()
        AND ub.badge_id IN ('e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1', 'bf309168-a73c-451b-88a9-f56c18a4315f')
      ))
      OR
      (t.scoring_policy = 'staff_referees_players' AND (
        auth.uid() = tournament_matches.player1_id
        OR auth.uid() = tournament_matches.player2_id
        OR EXISTS (
          SELECT 1 FROM user_badges ub
          WHERE ub.user_id = auth.uid()
          AND ub.badge_id IN ('e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1', 'bf309168-a73c-451b-88a9-f56c18a4315f')
        )
      ))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_matches.tournament_id
    AND (
      (t.scoring_policy = 'staff_and_referees' AND EXISTS (
        SELECT 1 FROM user_badges ub
        WHERE ub.user_id = auth.uid()
        AND ub.badge_id IN ('e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1', 'bf309168-a73c-451b-88a9-f56c18a4315f')
      ))
      OR
      (t.scoring_policy = 'staff_referees_players' AND (
        auth.uid() = tournament_matches.player1_id
        OR auth.uid() = tournament_matches.player2_id
        OR EXISTS (
          SELECT 1 FROM user_badges ub
          WHERE ub.user_id = auth.uid()
          AND ub.badge_id IN ('e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1', 'bf309168-a73c-451b-88a9-f56c18a4315f')
        )
      ))
    )
  )
);
