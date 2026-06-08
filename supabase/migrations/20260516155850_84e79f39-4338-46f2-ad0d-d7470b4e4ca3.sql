UPDATE public.tournaments
SET status = 'swiss',
    format = 'swiss_top_cut',
    swiss_rounds = 7,
    top_cut_size = 32,
    is_active = true,
    updated_at = now()
WHERE id = '80da8556-a292-44df-a0d2-8dbfd1458dcf';