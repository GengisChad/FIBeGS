INSERT INTO public.notifications (user_id, type, title, message, link)
SELECT 
  cri.user_id,
  'club_invite',
  'Invito Club',
  'Sei stato invitato a far parte del nuovo club "' || cr.club_name || '" come membro fondatore.',
  '/clubs'
FROM public.club_request_invites cri
JOIN public.club_requests cr ON cr.id = cri.request_id
WHERE cri.status = 'pending'
  AND cr.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = cri.user_id
      AND n.type = 'club_invite'
      AND n.message LIKE '%' || cr.club_name || '%'
      AND n.created_at > now() - interval '7 days'
  );