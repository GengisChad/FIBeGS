DELETE FROM referee_test_answers WHERE question_id IN (SELECT id FROM referee_test_questions WHERE test_type='head_judge');
DELETE FROM referee_test_questions WHERE test_type='head_judge';
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[TRABOCCHETTO FISICO] Bey X oltre la linea, Hovering, cade in buca, fa Reverse accappottato girando SENSO OPPOSTO.','image',false,1) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Reverse non valido se gira in senso opposto. Over Finish.',true,1),
((SELECT id FROM q),'Reverse annulla sempre la caduta.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[CROSS BRAND] Blade Takara Tomy originale su Ratchet Hasbro con viti Triwing. Legale?','image',false,2) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Sì, Takara e Hasbro sono interoperabili 100%.',true,1),
((SELECT id FROM q),'No, Swap solo stesso brand.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[VAR TRIGGER] Ombre fuse e clack sincrono con tonfo. Parabola pulita. Mid-Air?','image',false,3) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Senza clack anticipato o parabola spezzata, lancio valido.',true,1),
((SELECT id FROM q),'Ombre fuse bastano per Mid-Air.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[TIEBREAKER] X: 4 Win, 1 Lose, 1 Bye (15pt). Y: 5 Win, 1 Lose (15pt). Chi passa Grado 3?','image',false,4) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Y. Il Grado 3 soppesa Win fisiche vere.',true,1),
((SELECT id FROM q),'Spareggiano a Buchholz, Win e Bye valgono uguale.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[COMPORTAMENTO] X scopre B con piombo e per rabbia spacca la cupola arena. Punito?','image',false,5) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'B subisce Drop Cheat. X subisce Game Loss per rottura.',true,1),
((SELECT id FROM q),'Solo truffatore (B).',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[SOFT BURST] Tre pezzi a sandwich, zoppica. X blocca con mani dicendo ''Fermo!''.','image',false,6) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'X subisce Game Loss Mani in Cupola. Gioco era vivo.',true,1),
((SELECT id FROM q),'Incassa 2 Punti Burst per pericolo.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[GHOST BOT] HJ mette 1 account fantasma per arrivare a 16 e sbloccare Punti Ranked.','image',false,7) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Annulla l''evento Ranked stralciando i punti per frode.',true,1),
((SELECT id FROM q),'Convalida per rispetto ai presenti.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[HARDWARE] Giocatore usa String Launcher vecchissimo generazione Metal Fusion moddato. Legale?','image',false,8) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'No. Solo hardware Gen 4 (X) permesso.',true,1),
((SELECT id FROM q),'Sì se lancia i Bey X bene.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[TAVOLO] Arbitro fa partire timer di 3 minuti. B arriva al minuto 3 e 15s. Suda e si scusa.','image',false,9) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Game Loss inderogabile. Timer scaduto.',true,1),
((SELECT id FROM q),'Graziato per Fairplay, 15s sono pochi.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[ARENA] Un giocatore preme con le cosce contro lo stadio durante il tiro piegando la plastica.','image',false,10) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Richiamo/Fallo Esterno. L''arena non va compressa col corpo.',true,1),
((SELECT id FROM q),'Posizione tattica permessa.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[LANCIO] B lancia inclinato di 45 gradi, il bey atterra e schizza subito fuori da solo. Fallo?','image',false,11) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Nessun Fallo di lancio, ma subisce Own Finish (Self K.O.).',true,1),
((SELECT id FROM q),'Fallo per lancio illegale obliquo.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[ISPEZIONE] Blade originale ma lucidata a specchio tramite paste abrasive meccaniche togliendo vernici opache originali.','image',false,12) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Lama alterata (Cheat o Mod). Rimozione materiale vieta l''uso.',true,1),
((SELECT id FROM q),'Concesso, peso invariato.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[FINISH] Bey Y esplode (Burst) ma i pezzi ricadono tutti e tre nel buco centrale Xtreme. Punti per X?','image',false,13) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Burst Finish (2 Pt) perché esploso primariamente. L''evento Burst chiude tutto.',true,1),
((SELECT id FROM q),'Xtreme Finish (3 Pt) perché i pezzi cadono nel buco massimo.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[VAR] Si sente Clack isolato a mezz''aria, le trottole non sfiorano l''arena ma la Parabola resta fluida. Mid Air?','image',false,14) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Sì. Il suono sfalsato metallico palese è il trigger re assoluto del vuoto.',true,1),
((SELECT id FROM q),'No, se la parabola non devia è vivo.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[RIPETIZIONE] Dopo un Doppio Fallo contemporaneo e Reset, al rilancio entrambi cadono da soli in Own Finish. Punteggio?','image',false,15) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Zero punti, Draw. Ripetizione a oltranza senza punizione per doppio Own simultaneo.',true,1),
((SELECT id FROM q),'-1 a entrambi, la partita finisce in negativo.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[POSTURA] A si alza sulle punte dei piedi al ''Pronti'' alzando il lanciatore a 30cm.','image',false,16) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Fallo Tecnico (Tetto 20cm superato).',true,1),
((SELECT id FROM q),'Valido se è alto di statura.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[SPAREGGIO] Parità in Top 8, tempo agli sgoccioli. Palazzetto chiude.','image',false,17) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Si applicano i Tiebreaker algoritmici dal G1 al G4. Zero eccezioni.',true,1),
((SELECT id FROM q),'Sudden Death a 1 punto veloce autorizzata da HJ.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[DECK] Cestino un bey a terra e si spacca la plastica. Ne voglio usare un altro fuori deck.','image',false,18) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Game Loss se i 3 bey validati al Check non sono agibili. Niente riserve esterne.',true,1),
((SELECT id FROM q),'Si prende dal deck box di riserva.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[SCONTRI] A spara fortissimo, la trottola aggancia Xtreme Dash e schizza verso l''alto colpendo il soffitto e cadendo fuori.','image',false,19) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Over Finish. Il cielo fuori dai bordi è out of bounds.',true,1),
((SELECT id FROM q),'Annullato per rischio cose. Re-do.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[DECK] B mostra il deck con stessi 3 Beyblade del torneo precedente uguali.','image',false,20) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Lecito se passano il Check. Niente vieta il riuso identico.',true,1),
((SELECT id FROM q),'Vietato copiare il deck.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[BUCHHOLZ] 4 giocatori a 12pt, due hanno BFL =48, due BFL=44.','image',false,21) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'I 48 passano. BFL = grado 1 (somma punti avversari).',true,1),
((SELECT id FROM q),'I 44 passano per Difficoltà inversa.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[CHEAT FISICO] Smonti driver e trovi viti aggiuntive nascoste per appesantire perno.','image',false,22) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Espulsione dal torneo per Cheat conclamato (Drop Total + Ban Edizione).',true,1),
((SELECT id FROM q),'Squalifica solo Match in corso.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[ORARIO] Tappa Ranked ufficiale parte alle 11:00. Iniziamo per ritardi alle 11:20.','image',false,23) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Va comunicato in chat IBNA il ritardo e iniziamo immediatamente, evitando di rosicchiare turni.',true,1),
((SELECT id FROM q),'Si annulla tutto, slittamento a 7 giorni.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[FAIRPLAY] B vince ma è arrogante. A pretende che la vittoria gli venga negata per atteggiamento.','image',false,24) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'B vince. Eventuale Sanzione comportamentale verbale separata, ma il risultato sportivo si rispetta.',true,1),
((SELECT id FROM q),'A vince per default per civiltà.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[BURST PROFONDO] Bey X esplode in 3 pezzi. La testa (Blade) finisce per inerzia in Tasca Xtreme. Burst o Xtreme?','image',false,25) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Burst Finish puro (2 Punti). L''esplosione blocca tutti i finish successivi.',true,1),
((SELECT id FROM q),'Cumulativo: 2pt Burst + 3pt Xtreme = 5pt.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[STADIO] Stadio gen 1 con tasche storte. C'' è offerta stadi nuovi nei magazzini IBNA.','image',false,26) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Sostituzione obbligatoria. Stadio danneggiato/asimmetrico vieta validità match Ranked.',true,1),
((SELECT id FROM q),'Si gioca con quello, è regolamentare di base.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[TECNICO] A urla intimidatorio prima del lancio per ''psicare'' B.','image',false,27) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Richiamo per Condotta Antisportiva. Reset turno di lancio.',true,1),
((SELECT id FROM q),'Permesso, è solo carica agonistica.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[MATEMATICA] Round Svizzero 16 giocatori. Quanti turni di Swiss prima della Top?','image',false,28) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'4 turni (log2 16 = 4). Standard IBNA.',true,1),
((SELECT id FROM q),'3 turni di Swiss, top 8 immediata.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[GREY ZONE] A fa Reverse perfetto ma colpisce un pezzo di B già caduto fuori, finendo lui pure fuori.','image',false,29) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Reverse Annullato per intervento corpo estraneo. Ripetizione del Round (No Contest interno).',true,1),
((SELECT id FROM q),'Reverse valido perché ha toccato un pezzo Y.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[NUOVO HARDWARE] B ha un Bey scolorito e usurato sui denti driver. A reclama: ''Quello slitta troppo''.','image',false,30) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'HJ valuta usura: se la performance/grip è alterata significativamente, pezzo escluso (Worn Out Rule).',true,1),
((SELECT id FROM q),'Sempre legale finché muove qualcosa.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[VISIONE] Casi VAR ambigui. Il HJ vede male su uno schermo piccolo, il pubblico vede tutto bene grande.','image',false,31) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Decisione finale unicamente del HJ sulla base di ciò che riesce a vedere. Mai delegare al pubblico.',true,1),
((SELECT id FROM q),'Si fa votare il pubblico.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[STRUMENTI] B vuole usare bilancia di precisione personale per pesare suoi bey al Check-In, dicendo HJ ''spannometrico''.','image',false,32) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Vietato. Strumenti di Check sono solo dell''Organizzazione IBNA per parità di misurazione.',true,1),
((SELECT id FROM q),'Permesso se più preciso.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[STALLO] 3 minuti scaduti, Sudden Death, le due trottole girano per altri 4 minuti di Sudden Death senza toccarsi mai.','image',false,33) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Si entra in Sudden Death loop infinito finché c''è un vincitore di Round, da regolamento.',true,1),
((SELECT id FROM q),'Si tira moneta per chi vince.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[ECONOMIA] Tappa con 15 iscritti, BFL si attiva al 16.','image',false,34) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Soglia 16 mancata. Punti Ranked invalidi (Tappa Amichevole), salvo correttivo Manuale.',true,1),
((SELECT id FROM q),'Punti normali a tutti.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[CASISTICA TIME OUT] B esce a fumare nel mezzo di un match (timer girante).','image',false,35) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Game Loss appena scade timer del match. Non c''è pausa fumo libera.',true,1),
((SELECT id FROM q),'Tollerata pausa breve.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[QUIRK FISICO] Bey gira da fermo verticale per troppo tempo (Bey Wheeling estremo).','image',false,36) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Bey Wheeling lecito. Si conta vivo finché non cade fuori o non sleep out.',true,1),
((SELECT id FROM q),'Stoppato manualmente.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[TRABOCCHETTO TOP CUT] In Top 8, B fa Drop volontario (rifiuto a giocare) per non far perdere tempo a parità.','image',false,37) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Vietato Drop in Top, si gioca. Drop = Match Loss e Ammonizione per Mancato Rispetto Top.',true,1),
((SELECT id FROM q),'Drop ammesso per fairplay.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[GHOST PLAYER] Un giocatore non si presenta a un match in Swiss (Bye involontario).','image',false,38) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Avversario vince a tavolino dopo 5 minuti scaduti dal richiamo (No Show).',true,1),
((SELECT id FROM q),'Si ripete match più tardi.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[CHEAT SUBLIMINALE] Giocatore poggia smartphone su tavolo per cronometrare i suoi lanci avversario, distraendolo con vibrazioni.','image',false,39) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Smartphone vietato in zona match. Richiamo + Allontanamento dispositivo per condotta tecnica scorretta.',true,1),
((SELECT id FROM q),'Permesso, non interferisce con trottole.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[HEAD JUDGE] Tu HJ sei contemporaneamente giocatore al Banco 1 e devi giudicare Banco 4. Conflitto?','image',false,40) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Delega Banco 4 a Floor Judge fidato. Si torna a giocare. Conflitto evitato.',true,1),
((SELECT id FROM q),'Si interrompono entrambi i match per dare priorità HJ.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[MASTER] Un torneo Hub di 4 città richiede sincronizzazione.','image',false,41) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'HJ unico Coordinatore Macro + Delega Sub-HJ locali + Stream condivisa + Cronometri sincronizzati.',true,1),
((SELECT id FROM q),'Ogni città fa per sé.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[FAKE BEYBLADE] Bey con qualità sospetta. Plastica leggera, decals strane. Ma supera il peso e dimensioni.','image',false,42) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Fake confermato. Anche se passa metriche fisiche, il brand non ufficiale = pezzo vietato.',true,1),
((SELECT id FROM q),'Concesso se peso ok.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[GRADO 4] 2 giocatori arrivano in fondo a tutti i Tiebreaker matematici (G1-G3) ancora pari.','image',false,43) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Grado 4: Match diretto Spareggio 3 mosse veloce arbitrato da HJ stesso.',true,1),
((SELECT id FROM q),'Lancio moneta come ultimo Grado.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[FALLO TECNICO] Lancio tirato urlando ''Vai!'' invece di ''Lancio!''.','image',false,44) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Reset turno. Comunicazione cerimoniale obbligatoria per sincronia.',true,1),
((SELECT id FROM q),'Lancio valido se sgancia simultaneo.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[CASISTICA SVIZZERA] Ho 3 Lose su 5 turni Swiss, totale 9 punti. Posso ancora passare la Top Cut?','image',false,45) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Matematicamente lo droppa in automatico. Libera tavolo e torna a casa. Sbarramento 3-Lose raggiunto.',true,1),
((SELECT id FROM q),'Gioca per allenarsi.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[LANCIO] B sgancia prima della parola Lancio. A sgancia regolarmente. Le trottole impattano a mezz''aria fortissimo.','image',false,46) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Il Fallo (Lancio Anticipato di B) ha priorità cronologica assoluta sul Mid-Air successivo. Giallo per B.',true,1),
((SELECT id FROM q),'Ritiro Pulito per Mid-Air copre tutto.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[FAIRPLAY] Mamma del bimbo entra in area gioco recintata (Ring) per suggerire le mosse.','image',false,47) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Allontanamento genitore dal Ring e Richiamo al Giocatore per Coaching Illegale attivo.',true,1),
((SELECT id FROM q),'Tollerato per minorenni.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[TRABOCCHETTO FISICO] Bey cade di taglio sull''Xtreme Line verde, continua a girare ruotando sul verde come su un nastro trasportatore.','image',false,48) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Vivo, finché non cade nelle tasche centrali o over, la striscia verde è campo regolarissimo.',true,1),
((SELECT id FROM q),'Out of bound su linea verde.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[VAR EXTREME] Scontro violento, uno si smonta (Burst) ma la lama scheggia la telecamera VAR distruggendola.','image',false,49) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Il Burst era netto ed evidente in arena, punto assegnato, partita interrotta per danni materiali IBNA. Game Loss se danni procurati con intenzione, altrimenti scontro valido.',true,1),
((SELECT id FROM q),'Match annullato.',false,2);
WITH q AS (INSERT INTO referee_test_questions (test_type, question_text, media_type, is_multiple_choice, sort_order) VALUES ('head_judge','[HARDWARE] Giocatore usa String Launcher vecchissimo generazione Metal Fusion moddato. Legale?','image',false,50) RETURNING id)
INSERT INTO referee_test_answers (question_id, answer_text, is_correct, sort_order) VALUES
((SELECT id FROM q),'Pezzo Non Conforme da usura invalidante. Sostituire o ritiro dal match.',true,1),
((SELECT id FROM q),'Tollerato, peggio per lui.',false,2);