INSERT INTO public.referee_test_settings (test_type, description, test_intro, button1_text, button1_url, button2_text, button2_url, pass_percentage, cooldown_days)
VALUES (
  'club_leader',
  E'Diventare Club Leader IBNA significa assumere un ruolo di riferimento per la propria community locale.\n- Conoscere il regolamento e le linee guida\n- Saper organizzare eventi e tornei\n- Rappresentare i valori IBNA',
  E'Test per ottenere la qualifica di Club Leader IBNA.\nRispondi correttamente almeno all''80% delle domande.',
  '', '', '', '',
  80, 7
)
ON CONFLICT DO NOTHING;