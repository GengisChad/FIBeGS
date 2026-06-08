INSERT INTO public.changelog_entries (title, description, category, scope, created_by, created_at) VALUES
-- 13 aprile
('Sicurezza policy telefoni e profili', 'Migliorate le policy di accesso per numeri di telefono dei membri club e creazione profili.', 'fix', 'admin', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-13 12:00:00+00'),

-- 14 aprile
('Unione account utenti', 'Gli admin possono ora unire due account utente preservando i dati scelti (nome, username, avatar, città, regione).', 'new', 'admin', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-14 11:20:00+00'),

-- 15 aprile
('Protezione dati privati profilo', 'Data di nascita ed email spostate in una tabella privata separata, accessibile solo al proprietario del profilo.', 'update', 'user', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-15 09:00:00+00'),

-- 16 aprile mattina
('Apertura programmata iscrizioni torneo', 'Gli organizzatori possono impostare una data e ora di apertura delle iscrizioni: prima di quella data il torneo è visibile ma le iscrizioni sono bloccate.', 'new', 'user', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-16 07:00:00+00'),

('Iscrizione club semplificata', 'Quando entri in un club, numero di telefono e dati membro vengono salvati in un''unica operazione, evitando errori parziali.', 'fix', 'user', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-16 07:30:00+00'),

-- 16 aprile pomeriggio
('Inviti per richiesta club', 'Le richieste di apertura club ora supportano l''invito di altri utenti come membri fondatori: la richiesta viene processata solo quando tutti accettano.', 'new', 'user', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-16 15:15:00+00'),

('Notifica admin completamento inviti', 'Gli admin ricevono una notifica automatica quando tutti gli invitati di una richiesta club hanno accettato.', 'new', 'admin', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-16 15:20:00+00'),

('Bucket feedback privato', 'Gli allegati ai feedback non sono più accessibili pubblicamente: solo lo staff può visualizzarli.', 'fix', 'admin', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-16 16:55:00+00'),

('Card code rimosso da profili pubblici', 'Il codice tessera (card code) non è più esposto nelle viste pubbliche dei profili e non viene più trasmesso alle pagine pubbliche.', 'fix', 'user', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-16 16:58:00+00'),

('Visibilità profili figli nei tornei', 'I profili figli iscritti a un torneo sono ora visibili anche ai non loggati (solo nome e avatar), risolvendo il "Figlio" come placeholder.', 'fix', 'user', '123a147a-be70-45a1-bfc3-54f779afd00b', '2026-04-16 17:55:00+00');