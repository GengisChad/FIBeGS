ALTER TABLE public.tournaments
ADD COLUMN payment_method text DEFAULT NULL,
ADD COLUMN payment_link text DEFAULT NULL;