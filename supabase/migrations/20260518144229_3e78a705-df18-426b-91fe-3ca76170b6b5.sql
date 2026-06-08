
DO $$
DECLARE
  _real uuid := '568eb384-4903-4f86-832f-53a92c6c1450';
  _ghosts uuid[] := ARRAY[
    '47532de5-95dc-48f4-bb69-14cc3c6bc53d',
    '6f3f38a2-88bf-4c82-b524-bc9eb438bfa4',
    'ef2aafb2-defc-4318-95f4-56dc47fdaf9d',
    '10df91ef-06f0-4c70-8ac4-485e7d1935e1',
    '7e6acd6d-74ed-4b9e-8a56-c4f0efd9a64f',
    '73444cf9-800b-40f9-9abc-b43388259e72'
  ]::uuid[];
BEGIN
  UPDATE public.tournament_registrations SET user_id = _real WHERE user_id = ANY(_ghosts);
  UPDATE public.tournament_matches SET player1_id = _real WHERE player1_id = ANY(_ghosts);
  UPDATE public.tournament_matches SET player2_id = _real WHERE player2_id = ANY(_ghosts);
  UPDATE public.tournament_matches SET winner_id = _real WHERE winner_id = ANY(_ghosts);
  UPDATE public.tournament_standings SET user_id = _real WHERE user_id = ANY(_ghosts);
  UPDATE public.external_player_mappings SET internal_user_id = _real::text WHERE internal_user_id::uuid = ANY(_ghosts);
  DELETE FROM public.profiles WHERE user_id = ANY(_ghosts);
END $$;
