-- Table: per-tournament authorized referees
CREATE TABLE IF NOT EXISTS public.tournament_referees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_referees_tournament ON public.tournament_referees(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_referees_user ON public.tournament_referees(user_id);

ALTER TABLE public.tournament_referees ENABLE ROW LEVEL SECURITY;

-- Helper: is user staff of the organizing club of the tournament
CREATE OR REPLACE FUNCTION public.is_tournament_club_staff(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournaments t
    JOIN public.club_members cm ON cm.club_id = t.club_id
    WHERE t.id = _tournament_id
      AND cm.user_id = _user_id
      AND cm.role IN ('leader','vice_leader','staff')
  );
$$;

-- Helper: is user explicitly authorized referee for tournament
CREATE OR REPLACE FUNCTION public.is_tournament_referee(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_referees
    WHERE tournament_id = _tournament_id AND user_id = _user_id
  ) OR public.is_tournament_club_staff(_tournament_id, _user_id);
$$;

-- RLS
DROP POLICY IF EXISTS "Anyone can view tournament referees" ON public.tournament_referees;
CREATE POLICY "Anyone can view tournament referees"
ON public.tournament_referees FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Club staff can add tournament referees" ON public.tournament_referees;
CREATE POLICY "Club staff can add tournament referees"
ON public.tournament_referees FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tournament_club_staff(tournament_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Club staff can remove tournament referees" ON public.tournament_referees;
CREATE POLICY "Club staff can remove tournament referees"
ON public.tournament_referees FOR DELETE
TO authenticated
USING (
  public.is_tournament_club_staff(tournament_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Extend match update policy: include tournament-specific authorized referees
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
          AND (
            EXISTS (
              SELECT 1 FROM public.user_badges ub
              WHERE ub.user_id = auth.uid()
                AND ub.badge_id = ANY (ARRAY[
                  'e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1'::uuid,
                  'bf309168-a73c-451b-88a9-f56c18a4315f'::uuid
                ])
            )
            OR public.is_tournament_referee(t.id, auth.uid())
          )
        )
        OR (
          t.scoring_policy = 'staff_referees_players'
          AND (
            EXISTS (
              SELECT 1 FROM public.tournament_registrations tr
              WHERE tr.tournament_id = tournament_matches.tournament_id
                AND tr.user_id = auth.uid()
                AND tr.status IN ('confirmed', 'pending')
            )
            OR EXISTS (
              SELECT 1 FROM public.user_badges ub
              WHERE ub.user_id = auth.uid()
                AND ub.badge_id = ANY (ARRAY[
                  'e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1'::uuid,
                  'bf309168-a73c-451b-88a9-f56c18a4315f'::uuid
                ])
            )
            OR public.is_tournament_referee(t.id, auth.uid())
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
          AND (
            EXISTS (
              SELECT 1 FROM public.user_badges ub
              WHERE ub.user_id = auth.uid()
                AND ub.badge_id = ANY (ARRAY[
                  'e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1'::uuid,
                  'bf309168-a73c-451b-88a9-f56c18a4315f'::uuid
                ])
            )
            OR public.is_tournament_referee(t.id, auth.uid())
          )
        )
        OR (
          t.scoring_policy = 'staff_referees_players'
          AND (
            EXISTS (
              SELECT 1 FROM public.tournament_registrations tr
              WHERE tr.tournament_id = tournament_matches.tournament_id
                AND tr.user_id = auth.uid()
                AND tr.status IN ('confirmed', 'pending')
            )
            OR EXISTS (
              SELECT 1 FROM public.user_badges ub
              WHERE ub.user_id = auth.uid()
                AND ub.badge_id = ANY (ARRAY[
                  'e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1'::uuid,
                  'bf309168-a73c-451b-88a9-f56c18a4315f'::uuid
                ])
            )
            OR public.is_tournament_referee(t.id, auth.uid())
          )
        )
      )
  )
);