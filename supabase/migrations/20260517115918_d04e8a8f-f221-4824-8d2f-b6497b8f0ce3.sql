UPDATE public.tournaments t
SET created_by = sub.user_id
FROM (
  SELECT cm.club_id, (array_agg(cm.user_id))[1] AS user_id, COUNT(*) AS n
  FROM public.club_members cm
  WHERE cm.role = 'leader'
  GROUP BY cm.club_id
  HAVING COUNT(*) = 1
) sub
WHERE t.club_id = sub.club_id
  AND t.created_by IS NULL;