-- Reset academy courses
DELETE FROM public.judge_course_quiz_answers;
DELETE FROM public.judge_course_progress;
DELETE FROM public.judge_course_steps;
DELETE FROM public.judge_courses;

WITH cid_1 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 01 · Ammissibilità Prodotti e Brand Ufficiali', 'Analisi profonda sui brand ammessi (Takara e Hasbro), divieto di generazioni passate e lo sdoganamento del Day-One globale.', true, true, 1)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_1), 0, 'paragraph', NULL, '
                <h3>La Generazione X e i Licenziatari</h3>
                <p>Nei tornei Ranked IBNA, l''equità competitiva e la sicurezza fisica dei giocatori sono il pilastro fondante. Per questo motivo, l''ecosistema di gioco è strettamente blindato e limitato esclusivamente alla <strong>4° Generazione (Beyblade X)</strong>, inaugurata sul mercato globale a partire da Luglio 2023.</p>
                <p>È stato imposto un veto assoluto sulle generazioni storiche precedenti, come le serie <em>Beyblade Burst</em>, <em>Metal Fight</em> o <em>Bakuten Shoot</em>. Questa non è solo una scelta commerciale, ma una necessità fisica: le trottole della 4° Generazione sono progettate con leghe metalliche più dense e sistemi di ingranaggio (X-Dash) che sviluppano velocità e impatti devastanti. Introdurre una trottola di plastica della prima generazione contro una Blade X in metallo comporterebbe la disintegrazione del giocattolo vecchio, creando schegge pericolose per gli occhi dei partecipanti, oltre a danneggiare irreversibilmente la superficie concava dell''Xtreme Stadium.</p>
                <p>Il panorama dei produttori ufficiali si divide in due colossi che detengono le licenze mondiali: <strong>Takara Tomy</strong> (che storicamente copre il mercato asiatico e giapponese) e <strong>Hasbro</strong> (che gestisce la distribuzione per l''occidente, Europa e Americhe). Nell''Edizione 12 del regolamento IBNA, è sancita la totale e pacifica convivenza di questi due marchi. Contrariamente alle dicerie del passato, Hasbro e Takara Tomy per la 4° Generazione condividono gli stessi identici stampi di fabbrica, la stessa densità dei metalli e le stesse viti. Non vi è alcuna differenza prestazionale. Entrambi i brand sono ammessi e possono essere perfino ibridati tra loro (es. Lama Takara montata su Ratchet Hasbro).</p>
                
                <h4>La Rivoluzione del "Day-One" Globale</h4>
                <p>In passato, le community locali imponevano barriere temporali, vietando l''uso di trottole importate dal Giappone fino a quando non venivano distribuite ufficialmente nei negozi italiani. Questa regola è stata abolita. Il circuito IBNA riconosce il <strong>Day-One Globale</strong>.</p>
                
                <div class="casistica-box">
                    <span class="tag-scenario">Importazione e Barriere Geografiche</span>
                    <h5><i class="fa-solid fa-earth-americas"></i> Casistica 1: La release esclusiva asiatica</h5>
                    <p>La Takara Tomy rilascia un nuovo Beyblade esclusivo per il Giappone il 15 di Maggio. Un giocatore italiano lo pre-ordina online e gli arriva tramite corriere aereo il 18 Maggio, presentandosi al torneo regionale di Roma del 19 Maggio. <strong>Il pezzo è assolutamente giocabile e legale.</strong> Il fatto che nei negozi fisici italiani quel prodotto non arriverà prima di dicembre è totalmente ininfluente. L''orologio dell''ammissibilità scatta nel momento esatto in cui il pezzo viene regolarmente venduto nel suo paese d''origine.</p>
                </div>
                
                <div class="casistica-box">
                    <span class="tag-scenario">Eccezioni Territoriali Occidentali</span>
                    <h5><i class="fa-solid fa-store"></i> Casistica 2: Esclusiva GDO Americana</h5>
                    <p>Hasbro annuncia un "Multipack" contenente ricolorazioni esclusive con pesi leggermente diversi, ma decide di venderlo solo tramite la catena di supermercati Target, esclusivamente sul suolo statunitense. Un turista lo compra e lo porta in Europa. Anche in questo caso, essendo un prodotto con licenza ufficiale e regolarmente a scaffale (anche se in un solo stato estero), diventa giocabile all''istante nei tornei Ranked globali IBNA.</p>
                </div>

                <div class="warning-box">
                    <h5><i class="fa-solid fa-ban"></i> Tolleranza Zero per le Imitazioni (Fake)</h5>
                    <p>Qualsiasi prodotto non marchiato esplicitamente sulla scatola come Takara Tomy o Hasbro (es. marchi come Flame, MQ, o trottole senza brand da mercatini) è considerato "Fake". I materiali contraffatti spesso contengono leghe di piombo tossico e si frantumano. L''utilizzo di un Fake in un torneo comporta l''immediata <strong>Squalifica (Game Loss o Drop dell''intero evento)</strong>.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_1), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Un americano usa un Bey Hasbro appena uscito in USA. In Italia non c''è. È ammesso?","options":["No, scatta solo quando arriva in Italia.","Sì, ammesso fin dal suo Day-One globale."],"correctIndex":1,"explanation":"Esatto! Nessuna barriera."}'::jsonb),
  ((SELECT id FROM cid_1), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Un giocatore si presenta con un Bey originale della vecchia serie ''Beyblade Burst''.","options":["Non ammesso. Solo 4° Generazione (Beyblade X).","Ammesso, perché prodotto ufficiale Takara."],"correctIndex":0,"explanation":"Corretto. Niente generazioni passate."}'::jsonb),
  ((SELECT id FROM cid_1), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Giocatore con Blade imitazione ''Flame'', identica alla Takara. Può usarla?","options":["Sì, se il peso non differisce.","No. L''uso di imitazioni (fake) comporta la Squalifica."],"correctIndex":1,"explanation":"Perfetto. Solo originali."}'::jsonb);

WITH cid_2 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 02 · Stampe 3D, Modding e Personalizzazioni Estetiche', 'La "Lista Omologata IBNA" per le stampe 3D e i divieti tassativi sulle alterazioni chimiche, verniciature e adesivi sulle lame di contatto.', true, true, 2)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_2), 0, 'paragraph', NULL, '
                <h3>Il Modding Strutturale e i Pericoli del 3D</h3>
                <p>Nel circuito moderno, i Beyblade raggiungono regimi di rotazione che superano i 7000 RPM (giri al minuto). A queste velocità, l''integrità strutturale dei componenti non è negoziabile. Per questo motivo, l''IBNA è categorica: <strong>è severamente vietato produrre, stampare in 3D, fresare o usare macchinari CNC per ricreare "Parti Attive"</strong> del gioco. Per "parte attiva" si intende qualsiasi componente che scende nell''arena e partecipa all''impatto (Lama in metallo, Ratchet in plastica, Bit/Punta), così come i componenti strutturali del lanciatore (gli ingranaggi interni o la corda di trazione).</p>
                <p>Stampare un Ratchet in PLA, ABS o resina, per quanto accurato e identico al peso originale, è illegale. I polimeri stampati in casa non hanno la medesima struttura molecolare della plastica iniettata a caldo industrialmente, e sotto lo stress dell''impatto si frantumerebbero in schegge simili a proiettili.</p>
                
                <h4>La "Lista Omologata" degli Accessori Supportivi</h4>
                <p>Per accontentare la community dei maker e favorire l''ergonomia, l''IBNA ha redatto una stretta <strong>Lista Omologata</strong>. Questi file 3D approvati riguardano esclusivamente accessori di supporto "esterni" alla fisica del lancio. Se un file non è in questa lista, non entra nel palazzetto.</p>
                <ul>
                    <li><strong>Slip Grip / Finger Rest:</strong> Estensioni ergonomiche da applicare al manico del lanciatore per migliorare la presa delle dita.</li>
                    <li><strong>Tasche Xtreme Rigide (Cover):</strong> Coperchi che si incastrano sopra le tasche dell''Over/Xtreme per evitare che i bey saltino in faccia al pubblico dopo un finish potente.</li>
                    <li><strong>Clip e Basette Gommate:</strong> Supporti anti-scivolo da applicare sotto lo stadio per ancorarlo al tavolo in modo sicuro, senza comprimerlo.</li>
                </ul>
                <p>Va precisato che gli accessori puramente "passivi", come le scatole per trasportare i bey (Deck Box), le fondine da cintura o i porta-lanciatori, non influenzando minimamente la partita, sono sempre e totalmente liberi e non richiedono alcuna approvazione dalla Lista Omologata.</p>

                <div class="casistica-box">
                    <span class="tag-scenario">Personalizzazione Cosmetica</span>
                    <h5><i class="fa-solid fa-droplet"></i> Casistica 1: Vernice Trasparente per "Proteggere" la Lama</h5>
                    <p>Un giocatore, stanco di vedere i graffi da battaglia sul suo amato Beyblade dorato, decide di spalmare uno strato di smalto per unghie trasparente, o vernice epossidica protettiva, lungo tutto il bordo metallico di contatto (Blade).<br>
                    <strong>Verdetto: Illegale (Cheat).</strong> Anche se la vernice è trasparente e lo scopo è solo "protettivo", quello strato applicato crea uno spessore chimico che assorbe l''urto ("smorza" il suono) e altera il coefficiente d''attrito originale previsto da Takara Tomy. Inibisce il recoil. Questo comporta la Squalifica o la richiesta immediata di sostituire la Blade.</p>
                </div>
                
                <div class="warning-box">
                    <h5><i class="fa-solid fa-note-sticky"></i> Divieto di Adesivi sul Bordo</h5>
                    <p>Così come per la vernice, è <strong>tassativamente vietato</strong> applicare scotch, nastri isolanti, o gli adesivi originali (sticker) forniti nelle vecchie scatole, direttamente lungo le pareti verticali metalliche della Blade destinate al contatto fisico. Gli sticker possono essere applicati solo sulle parti piatte superiori del metallo o sulla plastica centrale del Lock Chip, zone che non impattano mai con la trottola nemica.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_2), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Un giocatore ha stampato in 3D un Ratchet personalizzato del peso esatto.","options":["No. Pezzi attivi in 3D mai ammessi (Squalifica).","Sì, se rispetta il peso."],"correctIndex":0,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_2), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Sottile adesivo trasparente sul bordo esterno della Blade. È consentito?","options":["Sì, se sottile è estetico.","No, è severamente vietato. Altera l''attrito."],"correctIndex":1,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_2), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Grossa scatola porta-bey in 3D non presente in Lista Omologata.","options":["Non fa nulla, il pezzo è idoneo (accessorio passivo).","Deve rimuoverla. Tutto deve essere in Lista."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb);

WITH cid_3 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 03 · Ratchet Swap, Smontaggio e Riconoscimento Fake', 'Analisi profonda dell''anatomia delle plastiche. Condizioni per scambiare parti del Ratchet, manomissioni chimiche e il trucco delle viti Triwing.', true, true, 3)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_3), 0, 'paragraph', NULL, '
                <h3>Smontaggio e il Protocollo Ratchet Swap</h3>
                <p>La quarta generazione introduce la meccanica del "Burst" (esplosione) controllata dalla tensione delle plastiche. Il pezzo intermedio, chiamato <strong>Ratchet</strong>, non è un blocco unico fuso, ma è composto da una complessa architettura di sotto-componenti fissati da viti. Per favorire il ricambio estetico (per chi desidera coordinare i colori) o per riparare anelli danneggiati, il regolamento consente il <strong>Ratchet Swap</strong>: ovvero la possibilità di smontare con un cacciavite il Ratchet e mischiarne le parti con quelle di un altro Ratchet originale.</p>
                
                <h4>L''Anatomia Inviolabile</h4>
                <p>Tuttavia, l''operazione di smontaggio espone al rischio di manomissione. L''arbitro deve vigilare che il Ratchet, una volta richiuso, contenga categoricamente queste <strong>quattro componenti strutturali obbligatorie</strong>, senza omissioni:</p>
                <ol>
                    <li><strong>L''Anello Esterno (Outer Ring):</strong> La scocca colorata che impatta (es. con 3, 4 o 5 punte).</li>
                    <li><strong>L''Anello Interno (Inner Ring):</strong> Il disco piatto plastico che fa da supporto inferiore.</li>
                    <li><strong>La Clessidra Centrale (Core):</strong> Il cuore dell''ingranaggio che contiene le "pinze" (morsetti bianchi) che afferrano il Bit.</li>
                    <li><strong>Il Perno Centrale (Lock Pin):</strong> Un cilindretto fondamentale nascosto all''interno che regola la resistenza alla torsione del Burst.</li>
                </ol>

                <div class="casistica-box">
                    <span class="tag-scenario">Frode Meccanica (Cheat)</span>
                    <h5><i class="fa-solid fa-wrench"></i> Casistica 1: Omissione dolosa e Limatura</h5>
                    <p>Durante il Bey Check, l''arbitro nota che il Ratchet di un giocatore si smonta con un soffio. Svitandolo, scopre che il giocatore ha rimosso intenzionalmente il "Perno Centrale" e ha limato con carta abrasiva i dentini della clessidra per allentare al massimo la resistenza ed evitare che i denti facciano attrito.<br>
                    <strong>Verdetto: Espulsione per Frode Sportiva.</strong> Asportare o limare materiale originale per alterare meccanicamente le performance di fabbrica è il reato più grave nei tornei IBNA. Il pezzo è totalmente illecito.</p>
                </div>
                
                <div class="warning-box">
                    <h5><i class="fa-solid fa-magnifying-glass"></i> Il Sesto Senso dell''Arbitro: Le Viti Triwing e i FAKE</h5>
                    <p>I falsari cinesi copiano perfettamente il metallo e la plastica, ma cadono quasi sempre su un dettaglio fondamentale per tagliare i costi: <strong>le viti</strong>. Tutte le Blade e tutti i Ratchet originali Takara Tomy e Hasbro sono serrati in fabbrica utilizzando esclusivamente speciali <strong>Viti Triwing (testa a Y a tre punte)</strong> o, in rari casi specifici di revisione, <strong>viti Security Torx (stella con foro)</strong>.<br><br>
                    Se durante il controllo ti trovi davanti un Beyblade le cui lame o plastiche sono chiuse con banali e comunissime <strong>Viti a Croce (Phillips)</strong> o Viti a Taglio, hai il 99% di certezza di avere in mano un prodotto contraffatto (Fake). Dichiara il pezzo illegale e inibisci il giocatore dall''usarlo.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_3), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Svitando un Ratchet manca il ''Perno'' che fissa la resistenza al burst.","options":["Irregolare. Omissione altera resistenza.","Approvato se l''anello regge."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_3), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Ratchet serrato con viti a croce invece di Triwing a Y.","options":["Dichiaro ''Fake''. Usano solo Triwing.","Convalido se ben serrato."],"correctIndex":0,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_3), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Giocatore ha limato le Pinze della Clessidra per alterare lo scatto.","options":["Ratchet irregolare (Cheat). Truffa meccanica.","Conforme finché anello esterno intatto."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb);

WITH cid_4 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 04 · Gestione, Manutenzione e Riparazione dello Stadio', 'Distanze da terra, posizionamento, tecniche di rinforzo e il confine netto tra manutenzione strutturale consentita e compromissione dell''area.', true, true, 4)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_4), 0, 'paragraph', NULL, '
                <h3>Geometria e Sicurezza dell''Xtreme Stadium</h3>
                <p>L''arena (Xtreme Stadium) è il campo di battaglia, e la sua corretta installazione influenza la fisica dei lanci. Il regolamento stabilisce che l''arena deve poggiare su tavoli o supporti stabili, posizionata a un''altezza che va da un <strong>minimo di 45 cm a un massimo di 80 cm</strong> da terra. Arene piazzate direttamente sul pavimento o su trespoli troppo alti (che obbligano i giocatori ad alzare i gomiti oltre le spalle) sbilanciano le posture di lancio e sono vietate in ambienti Ranked.</p>
                
                <h4>La "Respirazione" della Cupola Trasparente</h4>
                <p>Per impedire che lo stadio scivoli sul tavolo liscio, spesso gli organizzatori lo inseriscono in intelaiature di cartone rigido o anelli in gommapiuma. <strong>C''è una regola d''oro: le pareti del coperchio trasparente non devono MAI essere schiacciate o compresse verso l''interno dalle strutture di supporto.</strong> La plastica della cupola è progettata per flettere e assorbire l''energia cinetica quando un Beyblade pesante viene scagliato fuori asse e sbatte contro la parete. Se blocchi la cupola in una morsa di legno rigida, al primo impatto violento la plastica non potrà vibrare e si spaccherà all''istante.</p>

                <div class="casistica-box">
                    <span class="tag-scenario">Usura e Riparazioni</span>
                    <h5><i class="fa-solid fa-hammer"></i> Casistica 1: I Rinforzi in Nastro Telato</h5>
                    <p>I drop dall''alto creano micro-fratture al centro dell''arena. L''organizzatore decide di prevenire i danni stendendo una croce di nastro telato americano nero e massiccio.<br>
                    <strong>Dove lo mette è vitale per la legalità del torneo:</strong><br>
                    Se incolla il nastro <em>esclusivamente SOTTO il guscio verde</em>, a contatto col legno del tavolo, operazione <strong>LECITISSIMA</strong> e consigliata. Crea spessore e assorbe l''urto.<br>
                    Se invece spalma anche solo un pezzetto di nastro telato <em>ALL''INTERNO della Battle Zone bianca</em>, o sul fondo del pavimento di gioco dove strisciano le punte, l''arena diventa <strong>COMPROMESSA E INUTILIZZABILE</strong>. I materiali plastici/telati alterano i coefficienti di attrito delle punte, frenando le trottole e falsando le stamina battle.</p>
                </div>

                <div class="warning-box">
                    <h5><i class="fa-solid fa-skull-crossbones"></i> Divieto di Colle e Resine Epossidiche Interne</h5>
                    <p>Nel tentativo ingenuo di riparare buchi o graffi profondi formatisi sulla plastica bianca di combattimento, alcuni club spalmano resine o super-colla levigata per tappare i crateri. Qualsiasi applicazione di materiale chimico addizionale all''interno della zona di scivolamento delle trottole invalida lo stadio Ranked. Un''arena con i crateri profondi deve essere semplicemente sostituita.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_4), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Colla trasparente all''interno della Battle Zone per non usurare la linea.","options":["No. Materiale estraneo interno compromette arena.","Sì, se levigato."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb),
  ((SELECT id FROM cid_4), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Scatola artigianale schiaccia e deforma i bordi della cupola trasparente verso l''interno.","options":["Setup errato. Basi non comprimono pareti.","Sì se lo stadio non scivola."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_4), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Nastro telato nero ESCLUSIVAMENTE SOTTO il fondo plastico esterno.","options":["Consentito. Manutenzione strutturale tollerata.","Vietato. Invalida arena."],"correctIndex":0,"explanation":"Corretto."}'::jsonb);

WITH cid_5 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 05 · Composizione del Deck, Logistica e Segretezza Pre-Match', 'La "Regola della Singola Copia", eccezioni plastiche, gestione asettica del ritardo al tavolo (Timer) e l''intangibilità dell''ordine segreto.', true, true, 5)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_5), 0, 'paragraph', NULL, '
                <h3>Architettura del Deck a 3 Beyblade</h3>
                <p>Nelle manifestazioni competitive (formato 3on3), il blader deve presentare al tavolo un team composto esattamente da 3 Beyblade. Per garantire la varietà strategica del metagame ed evitare "spam" di pezzi insuperabili, vige la ferrea <strong>Regola della Singola Copia</strong>.</p>
                <p>Ogni Beyblade deve essere completamente unico nelle sue tre componenti funzionali (Blade in metallo, Ratchet intermedio e Bit/Punta). <strong>È illegale schierare due componenti aventi lo stesso nome meccanico o la stessa forma.</strong> Ad esempio: non puoi mettere la punta "Flat" rossa nel primo Bey e una punta "Flat" blu nel terzo Bey. Il colore (ricolor) non inganna l''arbitro: la geometria funzionale è identica, quindi viola la Singola Copia.</p>
                
                <h4>L''Eccezione Cosmetica: Il Lock Chip Centrale</h4>
                <p>L''unico minuscolo elemento esente da questa restrizione è il "Lock Chip", il bottoncino in plastica centrale che raffigura la testa dell''avatar (es. il draghetto di DranSword o l''elmo di KnightShield). Poiché questo chip è considerato un "tappo" estetico che non tocca mai l''arena o l''avversario e non sposta pesi rilevanti, un giocatore è liberissimo di avere tre Beyblade completamente diversi per metallo e punte, ma aventi tutti e tre incastonato il chip plastico di DranSword.</p>

                <div class="casistica-box">
                    <span class="tag-scenario">Logistica Massiva e Tempi Morti</span>
                    <h5><i class="fa-solid fa-stopwatch"></i> Casistica 1: Il Timer di Assenza e il "No Show"</h5>
                    <p>In un palazzetto con centinaia di iscritti, il ritmo dei turni a tabellone svizzero (Swiss System) è vitale. Se il software annuncia gli accoppiamenti e un giocatore, richiamato dallo speaker, non si presenta al Tavolo 4, l''arbitro innesca immediatamente il suo cronometro mentale (o fisico). Il limite <strong>Massimo e Inderogabile</strong> di tolleranza per ritardi fisiologici (bagno, folla) è fissato a <strong>3 Minuti esatti</strong>.<br>
                    Allo scadere del terzo minuto, l''arbitro ferma il tempo, sancisce il "No Show" formale, e dichiara la <strong>Sconfitta a Tavolino (Game Loss Totale)</strong> contro l''assente, assegnando la vittoria a tavolino (BYE/Win) al giocatore in attesa. Niente scuse, niente attese infinite.</p>
                </div>
                
                <div class="warning-box">
                    <h5><i class="fa-solid fa-user-secret"></i> La Segretezza dell''Ordine e le Interferenze</h5>
                    <p>Prima dell''inizio del Match, entrambi i blader devono decidere in <strong>totale autonomia e segretezza</strong> l''ordine in cui lanceranno i loro 3 Beyblade, posizionandoli celati nelle mani o nel deck box. Se l''ordine viene svelato precocemente, o se l''avversario scruta in modo furbo (Scouting illecito), o ancora peggio se un amico dal pubblico urla a gran voce <em>"Metti DranDagger per primo che lo sfondi!"</em> distruggendo la "Fog of War", l''arbitro interrompe tutto, sanziona i colpevoli con un Richiamo per coaching passivo, e <strong>obbliga a rimescolare alla cieca le sequenze di lancio</strong>.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_5), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Giocatore B mette punta Flat nel primo, e Flat di colore diverso nel terzo.","options":["Invalida deck. Ricolor non bypassano la Singola Copia.","Convalida se le lame sono diverse."],"correctIndex":0,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_5), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Quanto tempo per presentarsi prima di subire Game Loss per No Show?","options":["Massimo inderogabile di 3 Minuti.","Limite di 5 o 10 Minuti."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_5), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Compagno dal pubblico urla: ''Metti il blu!''. L''avversario sente l''ordine.","options":["Richiamo e obbligo rimescolare ordine.","Game Loss immediato."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb);

WITH cid_6 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 06 · Bey Check, Sigilli di Gara e Valutazione Usura', 'Il protocollo oggettivo per diagnosticare l''usura letale, il sistema dei 2/3 Arbitri per pezzi sigillati e l''inviolabilità del deck a partita in corso.', true, true, 6)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_6), 0, 'paragraph', NULL, '
                <h3>Il Rituale del Bey Check</h3>
                <p>Nessun match Ranked può iniziare senza il via libera dell''arbitro. Il "Bey Check" è la fase ispettiva in cui l''ufficiale di gara prende letteralmente in mano i deck di entrambi i contendenti, svita i pezzi, ne accerta l''originalità (viti Triwing), e valuta il livello di usura della plastica. Questo è l''unico momento in cui il giocatore ha il diritto di sollevare dubbi sul materiale avversario, rivolgendosi all''arbitro.</p>
                
                <h4>L''Inviolabilità del Sigillo</h4>
                <p>Una volta che l''arbitro ha riconsegnato le trottole assemblate e ha scandito il "Pronti", il deck diventa <strong>Sigillato e Inviolabile</strong>. Da quel momento, fino alla fine di tutti i round che compongono la partita, <strong>è severamente vietato ai giocatori smontare, svitare, sostituire punte o cambiare i propri bey</strong>. Ogni alterazione post-check comporta un Fallo o la Squalifica. L''unica cosa che il giocatore è libero di sostituire o scambiare durante la gara è il lanciatore (Launcher) e la corda di trazione.</p>

                <div class="casistica-box">
                    <span class="tag-scenario">Usura Fisiologica vs Alterazione Strutturale</span>
                    <h5><i class="fa-solid fa-recycle"></i> Casistica 1: I Gommini Polverizzati</h5>
                    <p>La lama "Impact Drake" è famosa per avere tre grossi inserti rossi in morbida gomma per frenare gli avversari. Un blader usa la stessa lama da 8 mesi; la gomma si è letteralmente fusa ed erosa fino a sparire completamente, lasciando nudi i buchi di metallo vivo sottostanti. Si presenta al Check.<br>
                    <strong>Verdetto: Non Conforme (Bocciato).</strong> Un conto sono i graffi e le scheggiature da normale battaglia (usura fisiologica), un conto è l''obliterazione di una componente materiale primaria. Senza la gomma originaria, quel bey non svolge più la funzione meccanica per cui Takara Tomy l''ha bilanciato. Deve sostituire la lama metallica o ritirarsi.</p>
                </div>
                
                <div class="warning-box">
                    <h5><i class="fa-solid fa-users-rays"></i> Pezzi "Saldati": La Regola dei 2/3 Arbitri</h5>
                    <p>Un trucco sottile è usare Ratchet difettosi o leggermente dilatati dal calore che, una volta avvitati sulla Blade, diventano rigidissimi, quasi bloccati ("saldati"), rendendo la trottola praticamente immune al Burst Finish. Come si fa a giudicare oggettivamente se un pezzo è solo "molto saldo" (legale) o "irregolarmente inamovibile"?<br><br>
                    L''IBNA ha istituito il protocollo d''emergenza: <strong>Se l''arbitro ha il dubbio e fatica enormemente a svitare il pezzo a mani nude, congela il tempo e chiama altri 2 Arbitri presenti in sala.</strong> I tre ufficiali testano il pezzo a rotazione. Se <strong>almeno 2 su 3</strong> concordano che la rigidità esce dai parametri di fabbrica tollerabili, la trottola viene bocciata a maggioranza democratica e inappellabile. Il giocatore deve cambiare il pezzo.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_6), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Svitando il Ratchet senti resistenza titanica. Il giocatore dice che non hai forza.","options":["Regola 2/3 Arbitri per test collegiale.","Autorità suprema, dichiari subito compromesso."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_6), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Check ok. Al secondo round, smonta e sostituisce la punta.","options":["Convalido cambio veloce.","Sanzione. Superato il check è vietato modificare."],"correctIndex":1,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_6), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Lama senza più gli inserti in gomma rossa (metallo vivo).","options":["Non conforme. Manca gomma strutturale.","Regolare per usura da battaglia."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb);

WITH cid_7 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 07 · Regole di Lancio, Falli Spaziali e Metriche Temporali', 'Il confine invisibile dell''altitudine, l''ingiustizia del "Countermove" e l''attenta scomposizione fonetica della formula d''avvio gara.', true, true, 7)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_7), 0, 'paragraph', NULL, '
                <h3>Limiti Spaziali e Balistica</h3>
                <p>La fase di lancio (Shoot) è il momento di massima tensione. Il regolamento vincola le posture dei blader a parametri stringenti per impedire tattiche dannose. La regola spaziale primaria è l''altitudine: <strong>Il lanciatore non deve MAI superare i 20 centimetri di altezza</strong> misurati dal fondo della Battle Zone. Lanciare da un''altezza superiore è considerato "Schiacciata / Drop dall''alto"; non solo è pericoloso perché la trottola può rimbalzare violentemente e colpire il volto dei presenti, ma spacca irrimediabilmente il fondo in plastica dell''Xtreme Stadium. Ogni lancio da altezze eccessive genera un Fallo Tecnico istantaneo.</p>
                
                <h4>La Guerra dei Nervi: Il Countermove</h4>
                <p>Nei momenti pre-lancio, i giocatori inclinano il polso per dare angolazioni d''attacco. È nata la prassi scorretta di aspettare che l''avversario si posizioni, per poi cambiare bruscamente la propria postura all''ultimo secondo, forzando l''avversario a reagire di nuovo (una danza infinita che ritardava la gara).<br>
                L''IBNA ha introdotto il divieto di <strong>Countermove</strong>: una volta che l''arbitro ha scandito il "Pronti?", i giocatori sono "congelati". Sbraitare, abbassarsi repentinamente, o strattonare il polso per ingannare l''angolo nemico all''ultimo secondo produce l''annullamento dell''azione e un Fallo Tecnico al furbetto.</p>

                <div class="casistica-box">
                    <span class="tag-scenario">Geometria Sonora Inderogabile</span>
                    <h5><i class="fa-solid fa-microphone-lines"></i> Casistica 1: La Sillabazione d''Oro (Finestra L-O)</h5>
                    <p>La formula ufficiale di avvio IBNA è rigida. L''arbitro alza il braccio e scandisce ad alta voce: <em>"Tre, Due, Uno, Pronti?... <strong>LANCIO!</strong>"</em>.<br>
                    Il momento esatto in cui i denti del lanciatore lasciano fisicamente la trottola deve cadere <strong>esclusivamente all''interno della finestra fonetica che intercorre tra la consonante ''L'' e la chiusura della vocale ''O'' della parola Lancio!</strong>.<br><br>
                    Se il giocatore A tira la corda udendo il silenzio subito dopo il "Pronti", è <strong>Lancio Anticipato</strong>. Se tira la corda quando l''arbitro ha ormai chiuso la bocca, è <strong>Lancio Ritardato</strong>. In entrambi i casi, l''arbitro fischia l''annullamento, ferma i bey, e assegna Giallo (Fallo Tecnico).</p>
                </div>
                
                <div class="warning-box">
                    <h5><i class="fa-solid fa-hand-holding-hand"></i> Perdita di Presa (Launcher Drop)</h5>
                    <p>Nella foga del tiro, può capitare di tirare il Winder (corda) con una violenza tale da farsi sfuggire di mano l''intero lanciatore pesante in plastica. Se il lanciatore precipita all''interno della Battle Zone, si assegna la <strong>Squalifica Immediata del Round (Game Loss Singolo)</strong> al giocatore sbadato. L''impatto di un lanciatore gigante da 150 grammi sui bey che girano a 7000 RPM li può distruggere in mille pezzi. È considerato gioco pericoloso per danni a terzi.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_7), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"B si abbassa. A fa ''Countermove'' e strattona il polso cambiando inclinazione al Pronti.","options":["Fallo Tecnico per Countermove contro A.","Azione permessa."],"correctIndex":0,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_7), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"B tira la corda e sgancia prima di udire la parola Lancio.","options":["Tolleranza mezzo secondo.","Fallo. Sgancio nella finestra L_O."],"correctIndex":1,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_7), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"A lancia a 40 cm dal fondo.","options":["No, max 20 cm.","Sì, non vi sono tetti."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb);

WITH cid_8 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 08 · Fenomenologia dell''Esplosione: Burst vs Soft Burst', 'La scissione visiva come conditio sine qua non per chiamare l''esplosione, l''inganno dei cedimenti a sandwich e le rotture hardware letali.', true, true, 8)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_8), 0, 'paragraph', NULL, '
                <h3>Il Burst Finish (+2 Punti)</h3>
                <p>La condizione più spettacolare e celebre del gioco è il <strong>Burst Finish (Esplosione)</strong>. L''algoritmo matematico e le regole lo codificano assegnando ben 2 Punti all''esecutore. Tuttavia, la chiamata arbitrale su questo evento deve essere clinica e priva di emozioni: l''esplosione si verifica e si convalida <strong>UNICAMENTE quando almeno due dei tre componenti base del Beyblade (Lama, Ratchet, Punta) si separano e si distaccano fisicamente l''uno dall''altro</strong>, proiettandosi via nell''arena.</p>
                <p>La scissione visiva spaziale tra i pezzi è l''unico metro di giudizio. Se non c''è luce (vuoto) tra i pezzi, il Burst non è avvenuto.</p>

                <div class="casistica-box">
                    <span class="tag-scenario">L''Inganno Meccanico</span>
                    <h5><i class="fa-solid fa-compress"></i> Casistica 1: Il Paradosso del "Soft Burst"</h5>
                    <p>Durante uno scontro devastante, i ganci interni del Ratchet del Giocatore A cedono. Il blocco plastico si sgancia dalla lama e si disassa, ma complice la gravità e lo schiacciamento della punta sul pavimento, <strong>i pezzi rimangono incastrati a "sandwich", ammucchiati uno sopra l''altro</strong>. La trottola, seppur pesantemente sbilenca e zoppicante, continua a raschiare sul fondo roteando.<br>
                    Il Giocatore B urla trionfante "Burst! Ho vinto!".<br>
                    <strong>Il verdetto dell''arbitro: Silenzio, gioco ancora vivo.</strong> Nessun punto assegnato. Si tratta di un "Soft Burst" (Esplosione debole). Mancando la reale separazione balistica dei pezzi a terra, per il Ruling IBNA la trottola è da considerarsi tecnicamente "in rotazione". Se il Giocatore A, con la sua trottola zoppicante e in Soft Burst, riesce incredibilmente a spingere il blader B fuori in una buca (Over Finish), il Giocatore A ottiene i punti e vince il round!</p>
                </div>
                
                <div class="warning-box">
                    <h5><i class="fa-solid fa-heart-crack"></i> Rotture Reali e Danni Hardware</h5>
                    <p>Le trottole sono soggette a forte stress. Se durante lo scontro l''anello in plastica colorata esterna si spezza, ma la trottola continua a girare, l''arbitro deve decretare il match nullo (Ritiro Pulito e sostituzione pezzo rotto) per preservare la sicurezza.<br><br>
                    Ma se il colpo spezza letteralmente a metà la <strong>Lama in Metallo</strong> (Blade) o frantuma il <strong>Lock Chip centrale in due tronconi visibili</strong>, il regolamento impone di applicare il <strong>Burst Finish (2 Punti persi)</strong> per chi subisce il danno fatale. La rottura traumatica del corpo primario equivale all''esplosione meccanica, con l''aggravante di dover buttare la propria trottola.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_8), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Ratchet si sposta, resta incastrato. Trottola gira sbilenca. Urla ''Burst!''.","options":["Soft Burst: senza scissione fisica è vivo.","Burst Finish."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_8), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Lama e Ratchet si disuniscono: rotolano lontani.","options":["Burst Finish netto (2 Punti).","Spin Finish."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb),
  ((SELECT id FROM cid_8), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Lama in Plastica (Chip) si spezza a metà per difetto. Pezzi non saltati.","options":["Burst Finish. Rottura fisica disintegra il bey in due pezzi reali.","Ritiro, non è Burst vero."],"correctIndex":0,"explanation":"Corretto."}'::jsonb);

WITH cid_9 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 09 · La Geometria del Vuoto: Finish Spaziali e l''Arte del Beywheeling', 'Il concetto tollerante dello Hovering millimetrico, la mappatura delle buche arena e la tattica estrema del rotolamento passivo sulla Blade metallica.', true, true, 9)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_9), 0, 'paragraph', NULL, '
                <h3>Mappatura Tasche e Valori</h3>
                <p>Oltre alla rotazione e all''esplosione, l''Xtreme Stadium presenta la via d''uscita fisica come mezzo di vittoria, suddivisa in due livelli di pericolosità e pregio:</p>
                <ul>
                    <li><strong>Over Finish (+2 Punti):</strong> Si verifica quando il Beyblade viene sbalzato all''interno delle due tasche curve laterali "superiori", quelle contrassegnate solitamente dalle grafiche stampate o dai loghi.</li>
                    <li><strong>Xtreme Finish (+3 Punti):</strong> Si verifica unicamente quando il Beyblade precipita nel "buco grande" centrale, ovvero il baratro frontale che si affaccia sulla rampa dentata verde. L''Xtreme Dash è progettato proprio per canalizzare la violenza in questo imbuto mortale.</li>
                </ul>

                <h4>L''Essenza dell''Hovering (Il Bordo Salvezza)</h4>
                <p>Uno degli errori più comuni per gli arbitri inesperti è il fischio precoce. La regola IBNA impone che la trottola debba aver superato <strong>COMPLETAMENTE</strong> (al 100% della sua massa) la linea perimetrale concava bianca e sia precipitata palesemente nel vuoto sottostante.<br>
                Se un Beyblade viene sbalzato oltre il bordo, ma si inclina in modo tale che il perno di plastica inferiore (o il bordo della lama) continui a sfregare e toccare <strong>anche solo per un millimetro</strong> la zona di gioco bianca originale (la Battle Zone), siamo di fronte alla situazione di <strong>Hovering (In bilico)</strong>. Finché c''è contatto fisico con la terraferma bianca, la trottola è viva e il round continua. L''arbitro deve trattenere il fiato e aspettare la fine della rotazione.</p>

                <div class="casistica-box">
                    <span class="tag-scenario">Rotolamento Esecutivo</span>
                    <h5><i class="fa-solid fa-tire"></i> Casistica 1: L''Estensione del "Beywheeling"</h5>
                    <p>Durante le fasi di bassa inerzia (stamina battle a fine corsa), un Beyblade inclinato perde l''equilibrio, cade su un fianco in modo brusco e la sua punta si solleva da terra. Invece di fermarsi di colpo, comincia a viaggiare appoggiato sul bordo esterno della sua Lama Metallica (Blade), correndo in cerchio come se fosse lo pneumatico di una moto in piega.<br>
                    <strong>Verdetto: Rotazione ATTIVA e gioco vivo.</strong> Questa rara meccanica si chiama "Beywheeling". Finché la trottola continua a correre lungo la linea dell''arena sfruttando l''attrito del fianco metallico, e (cosa fondamentale) <strong>mantiene inalterato il suo originario senso di rotazione (Destro o Sinistro)</strong> imposto dal lanciatore, il timer vitale non si ferma. Spesso il Beywheeling permette a un giocatore dato per spacciato di guadagnare quei due secondi preziosissimi per sopravvivere all''avversario e rubare lo Spin Finish (1 Punto).</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_9), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Bey in Hovering sul baratro, spigolo tocca plastica bianca.","options":["Chiama Finish.","Attende. Se tocca bianco, è vivo."],"correctIndex":1,"explanation":"Perfetto."}'::jsonb),
  ((SELECT id FROM cid_9), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Cade di taglio e rotola lungo il bordo sulla Lama metallica.","options":["Fermo matematico.","Vivo, se rotola conservando senso di giro."],"correctIndex":1,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_9), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Cade nella tasca laterale curva.","options":["Over Finish (+2 Punti).","Xtreme Finish (+3 Punti)."],"correctIndex":0,"explanation":"Esatto."}'::jsonb);

WITH cid_10 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 10 · Own Finish (Self K.O.) e la Magia Inerziale del Reverse', 'La penalità suprema da 1 punto per caduta solitaria, le condizioni d''innesco e l''annullamento spettacolare del rientro balistico anche "accappottato".', true, true, 10)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_10), 0, 'paragraph', NULL, '
                <h3>L''Umiliazione dell''Own Finish</h3>
                <p>L''Own Finish (ovvero l''Autogol o Self K.O.) è una delle meccaniche sanzionatorie più severe inserite per punire la scarsa padronanza della potenza di fuoco. Si innesca quando un giocatore, sparando in maniera incontrollata, vede la propria trottola auto-catapultarsi in una qualsiasi buca esterna (Over o Xtreme) <strong>SENZA AVER MAI AVUTO ALCUN CONTATTO FISICO CON LA TROTTOLA AVVERSARIA</strong> durante l''intero arco vitale del round.</p>
                <p>Se c''è stato anche solo un micro-sfioramento tra i metalli un secondo prima di cadere, diventa un normale scontro e i punti vanno al nemico. Ma se cadi nel vuoto da illibato, la sanzione è la seguente:<br>
                <strong>1. Assegnazione di +1 Punto Penalità diretto al punteggio dell''Avversario.</strong><br>
                <strong>2. Ripetizione Obbligatoria del lancio</strong>, mantenendo incastrati rigorosamente gli stessi due Beyblade usati per l''errore.</p>
                
                <h4>Il Miracolo della Sopravvivenza: La regola "Reverse"</h4>
                <p>Nelle primissime edizioni, se la trottola superava la linea perimetrale concava del precipizio, il round si stoppava. Ora la balistica folle dell''Xtreme Stadium ha introdotto l''epica eccezione chiamata <strong>Reverse</strong> (Rimbalzo di Salvezza).</p>

                <div class="casistica-box">
                    <span class="tag-scenario">La Speranza Inerziale (Reverse)</span>
                    <h5><i class="fa-solid fa-rotate-left"></i> Casistica 1: L''Annullamento del Reverse Accappottato</h5>
                    <p>Bey X viene scaraventato violentemente verso la voragine Xtreme. Supera la linea bianca, si ritrova a volare a vuoto dentro il buco, ma sbatte contro la parete nera in fondo al tunnel e, come un flipper, <strong>schizza verticalmente in alto ricadendo all''interno della Battle Zone bianca</strong>.<br><br>
                    Il bey, a causa del folle balzo, atterra "accappottato" (sottosopra, poggiando in modo errato sull''anello colorato liscio) ma continua a girare freneticamente sul dorso <strong>rispettando in pieno il suo senso di rotazione originale (Destro o Sinistro)</strong>.<br>
                    <strong>Verdetto dell''arbitro: IL REVERSE È VALIDO. ROUND IN CORSO E VIVO.</strong><br>
                    L''incredibile rientro in area cancella retroattivamente il Finish. La posa disgraziata in cui si ritrova ("accappottata", di spigolo, o traballante) è totalmente ignorata dal regolamento: l''unica metrica che conta per la salvezza è che il bey abbia ancora l''inerzia originaria e sia riuscito a rimordere la plastica bianca. Il round prosegue con il bey capovolto.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_10), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Precipita, Reverse sul muro e balza nel campo bianco. Rientra accappottato girando bene.","options":["Reverse valido. Posa accappottata non invalida.","Assegna il punto. Sottosopra non vale."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_10), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Mai toccate. Y cade da solo in Xtreme.","options":["Own Finish: 1 Pt a X e Ripetizione.","Xtreme Finish: 3 Punti per X."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb),
  ((SELECT id FROM cid_10), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"X in Over. Attimo dopo, Y cade in Xtreme. Draw?","options":["No. Chi esce prima (X) chiude l''evento. Y vince.","Draw."],"correctIndex":0,"explanation":"Inappuntabile."}'::jsonb);

WITH cid_11 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 11 · Infrazioni Spaziali, Falli Tecnici e Matrice Cumulativa', 'Il vasto catalogo delle infrazioni senza contatto, il confine della mezzeria (Invasione) e la complessa matematica dei cartellini gialli cumulativi (Doppio Fallo).', true, true, 11)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_11), 0, 'paragraph', NULL, '
                <h3>Il Catalogo delle Violazioni Sanzionabili in Gara</h3>
                <p>A differenza dei Falli Comportamentali (insulti, aggressività) che portano ai Richiami e Squalifiche dirette (Game Loss), i <strong>Falli Tecnici (Cartellino Giallo)</strong> sono legati alle meccaniche fisiche del tiro e sono parte integrante della tattica di stress tra giocatori. Al verificarsi di un Fallo Tecnico, l''arbitro ferma immediatamente lo scontro in corso (annullandolo totalmente) e decreta il Rilancio Obbligatorio.</p>
                
                <h4>I 3 Falli Tecnici Capitali:</h4>
                <ol>
                    <li><strong>Lancio Anticipato / Ritardato (Mis-Shoot):</strong> L''incapacità di sganciare la trottola nella micro-finestra fonetica della ''L-O'' di Lancio, come spiegato al Corso 07.</li>
                    <li><strong>Invasione (Over the Line):</strong> Il lanciatore, il braccio, le mani, o persino i capelli lunghi di un giocatore oltrepassano la netta "Mezzeria Immaginaria" dello stadio che divide l''Emisfero A dall''Emisfero B, impedendo all''avversario una trazione comoda e sicura.</li>
                    <li><strong>Il Drop Diretto ("Schiacciata in Buca"):</strong> Scagliare un attacco obliquo a discesa così estremo che il Beyblade atterra planando direttamente all''interno della tasca estrema Over o Xtreme, <strong>senza aver compiuto nemmeno un minuscolo primo tocco sulla plastica concava bianca</strong> della Battle Zone. L''approdo diretto nelle buche invalida il tiro per evitare canestri sleali dall''alto.</li>
                </ol>

                <div class="warning-box">
                    <h5><i class="fa-solid fa-layer-group"></i> L''Algoritmo del Doppio Fallo Cumulativo</h5>
                    <p>Un singolo fallo annulla e rilancia, ma la clemenza ha un limite temporale ben preciso: <strong>IL RILANCIO DEL MEDESIMO ROUND.</strong><br><br>
                    Se il giocatore B commette un Fallo (es. Invasione), riceve un Giallo "Pendente" annotato dall''arbitro e si Rilancia per rigiocare quel round. <br>
                    Se durante quel preciso Rilancio, il giocatore B compie un <strong>SECONDO FALLO</strong> (qualsiasi esso sia, per es. un Lancio Anticipato, quindi diverso dal primo), matura la Condanna. La matematica punitiva dell''IBNA innesca 3 conseguenze automatiche:<br>
                    <strong>1. Si assegna forzatamente +1 Punto Regalo all''Avversario (A).</strong><br>
                    <strong>2. Si innesca una nuova Ripetizione Obbligatoria</strong> (il round non è ancora considerato "finito" dai bey fisici, quindi non si passa alla scelta del nuovo bey, si tira di nuovo).<br>
                    <strong>3. L''arbitro "Resetta a Zero" la fedina dei falli per entrambi i giocatori</strong>, ripulendo i registri gialli.</p>
                </div>
                
                <div class="casistica-box">
                    <span class="tag-scenario">Falli Simultanei e l''Effetto Specchio</span>
                    <h5><i class="fa-solid fa-people-arrows"></i> Casistica 1: Doppio Sbaglio Parallelo</h5>
                    <p>Cosa succede se entrambi i giocatori, per la foga del momento, sganciano il lanciatore in clamoroso Anticipo simultaneo per ben due rilanci consecutivi?<br>
                    Il regolamento è saggio: I falli contemporanei simultanei "in fotocopia" <strong>sterilizzano la sanzione punitiva e non regalano +1 Punto a nessuno dei due</strong>. L''assegnazione incrociata e paralizzata bloccherebbe il match in un vortice di punteggi fasulli senza merito fisico. Si annulla per Doppio Fallo Simultaneo all''infinito finché uno dei due non tira decentemente senza sbagliare, bloccando gli abusi di pareggio.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_11), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"X e Y sganciano in anticipo per due lanci consecutivi simultanei.","options":["1 Pt a X e 1 Pt a Y.","Nessun punto. Fallo simultaneo fa stallo."],"correctIndex":1,"explanation":"Perfetto."}'::jsonb),
  ((SELECT id FROM cid_11), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"B tocca cupola al 1° lancio. Al rilancio sgancia in anticipo.","options":["Doppio Fallo: +1 Punto ad A, reset e ripetizione.","Penalità e passa a bey successivo."],"correctIndex":0,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_11), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Spara la trottola direttamente in tasca senza toccare bianco.","options":["Fallo Lancio (Schiacciata). Giallo.","Own Finish convalidato."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb);

WITH cid_12 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 12 · L''Avvento Tecnologico: Contatti Aerei (Mid-Air) e Utilizzo del VAR', 'La nullità indotta dagli impatti aerei, il protocollo di solitudine dell''arbitro al monitor e i 3 Trigger probatori (audio, vettoriali e ottici).', true, true, 12)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_12), 0, 'paragraph', NULL, '
                <h3>Eventi Fortuiti e Ritiro Pulito</h3>
                <p>Non tutte le interruzioni in un round sono colpa di un blader malizioso. Vi sono degli "Eventi Fortuiti" che impongono all''arbitro di interrompere fischiando un <strong>Ritiro Pulito e Totale</strong>, un annullamento senza l''ombra di cartellini gialli o falli tecnici annotati.</p>
                <p>Esempi emblematici di Ritiro Pulito sono: la corda del lanciatore in nylon che si sfilaccia e si disintegra in mano per cedimento strutturale usura durante la trazione violenta, oppure il beyblade mal incastrato che scivola dai ganci del launcher mentre lo si sta avvicinando all''arena. In questi casi c''è pietà totale, stop ai cronometri, sostituzione della periferica o riaggancio, e ripresa lineare del gioco.</p>
                
                <h4>Il Fenomeno Balistico: Il Contatto Aereo (Mid-Air)</h4>
                <p>Il più celebre e contestato evento fortuito che richiede il Ritiro Pulito assoluto è il temutissimo "Mid-Air". Questo si verifica quando le due trottole metalliche, lanciate con inclinazioni aggressive, si incrociano a mezz''aria scontrandosi <strong>*PRIMA* di aver mai toccato il fondo in plastica concavo bianco della Battle Zone</strong>.<br>
                L''urto aereo sballa tutte le energie cinetiche e angoli d''attacco originariamente voluti, trasformando lo scontro a terra in una ruota della fortuna scialba. Se il Mid-Air è certificato, <strong>qualunque cosa succeda un decimo di secondo dopo non ha alcun valore storico o punteggio (perfino un''Esplosione/Burst Finish a terra causata dal trauma aereo). Il round è nullo da capo a piedi.</strong></p>

                <div class="casistica-box">
                    <span class="tag-scenario">La Triangolazione Probatoria</span>
                    <h5><i class="fa-solid fa-video"></i> Casistica 1: I 3 Trigger Ufficiali del Sistema VAR IBNA</h5>
                    <p>Data l''altissima velocità, l''occhio umano da solo non basta per capire se due trottole si sono sfiorate in volo o appena mezzo millimetro poggiate a terra. L''Edizione 12 ha istituzionalizzato le action cam sul lato arbitro. In caso di dubbio severo, <strong>l''arbitro congela i giocatori sul posto e visiona DA SOLO e isolato il replay al monitor (è vietata la co-visione di gruppo o l''ingerenza dei giocatori)</strong>, alla ricerca di tre segnali specifici (I Trigger):</p>
                    <ol>
                        <li><strong>Il Desincronismo Sonoro (Audio):</strong> Sente in cuffia il netto "Clack" tagliente del metallo che anticipa clamorosamente il sordo "Tonfo" plastico dell''atterraggio a terra. L''audio sfalsato è la prova regina (Trigger Primario Supremo).</li>
                        <li><strong>Le Ombre Rivelatrici (Ottica):</strong> Osserva il fondo bianco al rallentatore: se le due ombre circolari proiettate dai bey si intersecano e fondono assieme formando un 8 scuro *prima* che il corpo solido tocchi la plastica, l''impatto aereo è certificato (seppur soggetto ai falsi positivi dei fari led).</li>
                        <li><strong>La Parabola Spezzata (Vettori):</strong> Traccia le linee di caduta. Se una delle trottole, scendendo curva, subisce uno "scatto nervoso" innaturale a mezz''aria, alterando la sua fluidità gravitazionale prima dell''atterraggio, c''è stato contatto segreto invisibile.</li>
                    </ol>
                    <p>L''incrocio simultaneo e concorde di <strong>almeno due di questi tre Trigger</strong> sul monitor garantisce matematicamente la chiamata legale e inoppugnabile del Ritiro per Mid-Air.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_12), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Mid-Air. Blader vogliono guardare VAR insieme.","options":["Arbitro guarda da solo per evitare pressioni.","Obbligato a mostrare."],"correctIndex":0,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_12), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"VAR: clack acuto netto, parabola spezzata, ma ombre distanti per luce.","options":["Clack e parabola bastano per Mid-Air.","Senza ombra fusa il lancio è valido."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb),
  ((SELECT id FROM cid_12), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Corda lanciatore si spezza internamente al tiro.","options":["Danno appurato, Ritiro Pulito e muletto.","Scontro validato."],"correctIndex":0,"explanation":"Esatto."}'::jsonb);

WITH cid_13 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 13 · Giurisprudenza Comportamentale, Squalifiche Dure e Reato di Cheat', 'La piramide punitiva per difendere l''etica IBNA: dal limite fisiologico dell''esultanza, alla protezione fisica dei materiali fino all''espulsione radiale per alterazioni chimico-pesistiche clandestine.', true, true, 13)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_13), 0, 'paragraph', NULL, '
                <h3>La Piramide della Giustizia Disciplinare</h3>
                <p>Un torneo IBNA Ranked è un campo di altissima tensione emotiva, dove il Fairplay eugenetico degli scacchi incontra l''agonismo fragoroso e violento degli E-Sport picchiaduro. L''arbitro è il custode dell''onore, e ha a disposizione una triplice scala di punizioni extracurriculari, staccate dai semplici "falli tecnici da tiro" (Cartellini Gialli) visti in precedenza.</p>
                
                <h4>Livello 1: Richiamo e Ammonizione Comportamentale</h4>
                <p>Il Richiamo Verbale Formale è la frustata sulla lavagna per colpire le maleducazioni limitate: urlare sfottò maliziosi mirando il volto dell''avversario sconfitto, ritardare furbescamente il cronometro chiacchierando col pubblico durante il montaggio o sbuffare rumorosamente a ogni ruling sfavorevole. <br>
                <strong>Attenzione alla Cumulabilità:</strong> Al verificarsi del Secondo Richiamo formale consecutivo per la stessa condotta, si innesca automaticamente <strong>l''Ammonizione Severa</strong>, ovvero una sanzione gravissima che prelude all''espulsione, registrata permanentemente nei log informatici del player in quel torneo.</p>

                <div class="warning-box">
                    <h5><i class="fa-solid fa-hand"></i> Livello 2: Game Loss (La Sconfitta a Tavolino per Salvaguardia)</h5>
                    <p>La Sconfitta immediata dell''intero scontro (Match o Round) viene sdoganata senza pietà davanti ad atti che superano il semplice fastidio verbale e invadono la giurisdizione materiale della Battle Zone.</p>
                    <p><strong>Il Reato "Mani in Cupola":</strong> I blader amano morbosamente le proprie trottole cromate. Quando un bey cade in una buca, o sbatte pesantemente, l''istinto animale del giocatore è quello di allungare velocemente la mano all''interno dell''arena ancora attiva per recuperare il pezzo ed evitargli graffi inutili, <strong>PRIMA</strong> che la trottola nemica superstite si sia fermata e <strong>PRIMA</strong> che l''arbitro abbia fischiato la fine sancendo e chiamando ad alta voce i punti.<br><br>
                    <strong>L''inserimento preventivo non autorizzato di mani e braccia all''interno dei confini fisici trasparenti del coperchio (cupola) genera IL GAME LOSS AUTOMATICO PER CHI INFILA LE MANI.</strong> Oltre ad essere un''ingerenza intollerabile (conflitto con possibili Beywheeling estremi della trottola salvata), le dita nude poste vicino a una lama in metallo che rotea a 7000 RPM rischiano tagli profondi e mutilazioni tendinee. La tutela della carne viene prima dei graffi sulla vernice.</p>
                </div>
                
                <div class="casistica-box">
                    <span class="tag-scenario">Frode Sportiva e Bandi A Vita</span>
                    <h5><i class="fa-solid fa-scale-unbalanced"></i> Livello 3: Cheat, Drop e Radiazione Diretta</h5>
                    <p>Esistono atti dolosi che vanno oltre la maleducazione, sfociando nella vera e propria truffa agonistica occulta per aggirare le fondamenta meccaniche della gravità (Cheat). L''intervento porta al Drop inesorabile (espulsione totale e fisica con annullamento punti dall''evento in corso) e alla proposta di radiazione dal database per i circuiti futuri.</p>
                    <ul>
                        <li><strong>Zavorramento Clandestino (Weight Doping):</strong> Svitare il Lock Chip in plastica e riempire i piccoli vuoti reticolari sottostanti con minuscoli pallini di piombo, pasta al tungsteno espansa o abbondanti strati densi di colla bi-componente invisibile, con lo scopo unico e premeditato di alterare il peso nativo (aggiungendo grammi fantasma per stabilizzare il recoil in maniera illegale).</li>
                        <li><strong>Sabotaggio Strutturale Inverso:</strong> Scartavetrare e polverizzare deliberatamente i ganci della clessidra in modo da rendere il pezzo inutilizzabile.</li>
                        <li><strong>Danno e Vandalia Ambientale:</strong> Preso da un raptus di follia o di ira a causa di un Finish a sfavore, il giocatore urla, afferra il suo pezzo e lo scaraventa brutalmente sfondando il fondo in plastica bianco dell''Xtreme Stadium o danneggiando la strumentazione VAR dell''arbitro. A nulla valgono le scuse in lacrime successive: chi spezza i costosi supporti logistici IBNA compra il biglietto di sola uscita.</li>
                    </ul>
                </div>
            ', NULL),
  ((SELECT id FROM cid_13), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"A crolla. B infila mano per salvare bey *prima* del fischio.","options":["Game Loss per B. Mani in Cupola.","Vittoria ratificata con richiamo."],"correctIndex":0,"explanation":"Meraviglioso."}'::jsonb),
  ((SELECT id FROM cid_13), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Al Check l''arbitro trova piombo e tungsteno nella Blade di nascosto.","options":["Espulsione per CHEAT. Frode sportiva.","Pezzo non conforme, ammonizione."],"correctIndex":0,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_13), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"B urla in faccia ad A. 1° Richiamo. B lo rifà.","options":["Secondo Richiamo si converte in Ammonizione.","Decurta punti."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb);

WITH cid_14 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 14 · Macroeconomia del Server: Tornei Ranked, Soglie Minime e il Correttivo BFL', 'La struttura cloud di certificazione punti, il calibro numerico d''innesco della validità massimale, le frodi demografiche bot e il capolavoro algoritmico del Best From Last 10.', true, true, 14)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_14), 0, 'paragraph', NULL, '
                <h3>Il Circuito Ranked Ufficiale e i Moltiplicatori</h3>
                <p>L''accademia IBNA non serve a gestire i campetti ricreativi, ma ad orchestrare il gigantesco database statistico europeo. I "Punti Ranked" (che sbloccano accessi a campionati, status privilegiati e premi) non vengono erogati generosamente a pioggia. Il software IBNA ha una valvola di sicurezza per tutelare l''importanza dell''impegno massivo: un torneo sblocca il suo potenziale come <strong>Torneo Ranked di Pieno Valore unicamente se riesce a raggiungere e a far sedere al tavolo ALMENO 16 giocatori reali fisici</strong>.</p>
                <p>Raduni di nicchia, scantinati tra 8 o 12 amici intimi, pur essendo tecnicamente tornei svizzeri caricabili, restituiscono al database punti depotenziati, irrisori, considerati nulli o frazionali, incapaci di spingere un nome nei veri alti rank statali. I 16 giocatori segnano il confine matematico tra l''Hobby domenicale e la Lega.</p>

                <div class="warning-box">
                    <h5><i class="fa-solid fa-ghost"></i> Frode Demografica (Il Ghosting / Mod. Solo)</h5>
                    <p>Davanti all''ostacolo dei 16 player, i piccoli club di provincia si scontrano con la dura realtà di poter essere solo in 13 o 14. Purtroppo, la disperazione spinge alcuni Head Judge senza etica (organizzatori) ad alterare i database, iscrivendo a tradimento account "fantasma" (bot o nickname di amici rimasti a casa malati) nei bracket per gonfiare il conteggio a 16 e ingannare l''algoritmo server.<br><br>
                    Questa operazione (nota come <strong>Ghosting</strong>) sfalsa la progressione Buchholz dell''intero continente. Se l''IBNA scopre (grazie agli storici digitali o a segnalazioni dei presenti) che in un torneo sono stati inseriti match o punti finti di entità inesistenti, la risposta è letale: <strong>Annullamento e radiazione totale dell''intero evento, stralcio dei punteggi guadagnati onestamente da tutti i presenti, e pesanti cartellini rossi dirigenziali per l''organizzatore truffaldino.</strong> Nessun compromesso per tutelare i presenti è tollerato quando le fondazioni stesse del Rank si infettano di bot.</p>
                </div>
                
                <h4>Il Capolavoro Sociale dell''Algoritmo BFL (Best From Last 10)</h4>
                <p>Senza tetti correttivi, la classifica mondiale degli E-sport periferici diventa sempre un "Pay-to-Win Logistico": vince banalmente e ciecamente il ragazzino figlio di milionari che spende fiumi di denaro in aerei e treni partecipando a 70 tornei regionali scadenti l''anno, accumulando una valanga insormontabile di "punticini base di partecipazione", distruggendo sportivamente il prodigio puro del nord che ha soldi e tempo solo per fare 12 tornei all''anno vincendoli però tutti quanti con estremo sudore e fatica.<br><br>
                Per annientare questo divario classista tossico, l''IBNA applica il filtro matematico salvifico: <strong>Il calcolo BFL (Best From Last 10)</strong>.<br>
                A fine anno o semestre, per calcolare il Rank Reale di uno sfidante, il server ignora l''accumulo totale infinito dei numeri e pesca, screma ed estrapola <strong>ESCLUSIVAMENTE I SUOI 10 MIGLIORI RISULTATI ASSOLUTI DI PICCO</strong> ottenuti nell''annata. Le restanti (es. 40 o 60) scialbe posizioni ottenute nei torneini dove si è piazzato ventesimo, vengono inesorabilmente cestinate e non sommano più. Il genio povero con 10 podi d''oro netti regnerà sempre invincibile sopra il blader ricco con 50 podi mediocri in giro per le fiere minori d''Europa. La pura eccellenza d''urto (Quality) annienta sempre lo spam inflazionato (Quantity).</p>
            ', NULL),
  ((SELECT id FROM cid_14), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Siete 13 giocatori. Calcolato come Ranked Ufficiale pieno?","options":["No. Sotto 16 i punti sono trascurabili.","Sì, bastano 8."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_14), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Pro-player fa 42 tornei medi. Tu 12 tornei stravinti. Chi vince la classifica?","options":["Tu col BFL. Somma solo i Migliori 10.","Lui sommando 42 tornei."],"correctIndex":0,"explanation":"Perfetto."}'::jsonb),
  ((SELECT id FROM cid_14), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Mancano 2 per quota 16. HJ iscrive 2 profili fantasma.","options":["Annulla evento Ranked per frode demografica.","Convalida per rispetto ai 14."],"correctIndex":0,"explanation":"Corretto."}'::jsonb);

WITH cid_15 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 15 · Matematica del Tabellone Svizzero e Architettura delle Top Cut', 'Il corretto e inderogabile ridimensionamento proporzionale delle Bracket a scontro diretto (Top 8/16/32) e le ottimizzazioni automatiche salva-tempo del "Dropout a 3 Vite".', true, true, 15)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_15), 0, 'paragraph', NULL, '
                <h3>Swiss Rounds: L''Orologio Biologico dell''Evento</h3>
                <p>Nelle grandi competizioni con molteplici e diversificati skill level, i classici gironi all''italiana creerebbero stalli infiniti e logorerebbero giocatori e palazzetti fino all''alba. L''IBNA abbraccia integralmente il <strong>Sistema di Abbinamento Svizzero (Swiss Bracket)</strong>: un format dinamico dove i vincitori si scontrano man mano sempre e solo contro altri vincitori (alti Elo), spingendo verso il basso in gironi fango i perdenti, e arrivando in pochissimi e rapidi turni a delineare i veri re meritevoli d''alta classifica su cui appuntare i fari per la qualificazione alle finali, la "Top Cut".</p>
                
                <h4>Il Proporzionalismo Inderogabile delle Fasi Finali (Cut)</h4>
                <p>La Top Cut (il passaggio dalla bolgia a punti agli scontri diretti epici in stile ottavi, quarti o semifinali dirette sul palco d''onore) non è plasmabile né gonfiabile ad arbitrio. Il server forza la grandezza della Top in base alla massa muscolare dell''evento, per non svilire o banalizzare il prestigio di arrivarci:</p>
                <ul>
                    <li><strong>Da 16 a 32 Player reali:</strong> La Top Cut è fissa ed esclusivamente a <strong>Top 8</strong> (Si passa direttamente ai Quarti di Finale).</li>
                    <li><strong>Da 33 a 64 Player:</strong> Base a Top 8. (L''Head Judge, qualora abbia fiumi di tempo bonus e arene vuote, può facoltativamente allargare magnanimamente la tenaglia alla <strong>Top 16</strong>).</li>
                    <li><strong>Oltre 129+ Player:</strong> Eventi titanici che attivano l''epica Bracket prolungata e mostruosa a <strong>Top 32</strong>.</li>
                </ul>

                <div class="casistica-box">
                    <span class="tag-scenario">Ottimizzazioni Crudeli e Salva-Tempo</span>
                    <h5><i class="fa-solid fa-scissors"></i> Casistica 1: Lo Sbarramento Automatico a "3 Vite"</h5>
                    <p>Immaginate un Super Regionale da 80 iscritti in un locale che deve chiudere a mezzanotte. Generare incroci infiniti anche per i giocatori in fondo alla classifica distrugge l''evento. Per i tornei macro (oltre i 6 Turni Svizzeri massivi), il software innesca un blocco chirurgico matematico: <strong>La Soglia delle 3 Vite (Drop letale)</strong>.<br><br>
                    Se durante il tabellone il giocatore X cade e accumula storicamente <strong>3 Sconfitte Letali assolute (3 Lose)</strong>, l''algoritmo calcola all''istante che, matematicamente e senza alcun dubbio residuo, X non potrà MAI E POI MAI superare in classifica e agganciare il punteggio necessario per rientrare nella magica Top 16. La sua gara è finita, sterile. Invece di costringerlo a vagare nei tavoli bassi, l''algoritmo lo "Droppa" (elimina ed espelle dalla competizione) automaticamente in anticipo e senza pietà, liberando preziose sedie, arbitri e spazio palco per concentrarsi solo sull''élite sopravvissuta ai vertici.</p>
                </div>
                
                <div class="warning-box">
                    <h5><i class="fa-solid fa-cloud-sun"></i> Il Free-Pass in Vetta: Il Riposo degli Eroi</h5>
                    <p>Il sistema lavora simmetricamente. Al turno 5 di un massiccio torneo da 7 Turni Svizzeri, il mostruoso giocatore "Falco" veleggia e domina con uno spaventoso "5-0" (Zero Sconfitte). Guardando la matematica residua degli altri 79 partecipanti, il sistema appura che anche qualora Falco abbandonasse l''edificio ora, ha accumulato troppi punti di scarto: è intoccabile e blinderà sempre e comunque il posto al vertice per l''ingresso in Top Cut. <br><br>
                    Falco non deve logorare se stesso e l''hardware dei suoi beyblade in round "inutili" e "superflui" contro gente fortissima nei turni 6 e 7. L''algoritmo lo rimuove dai bracket d''attesa e gli assegna il <strong>"Taglio Diretto / Free-Pass"</strong>, fermandolo in oasi, tutelandolo dalla stanchezza e alleggerendo ulteriormente il peso d''incrocio agli arbitri.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_15), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Torneo 70 iscritti. Notte fonda. Come ottimizzi?","options":["Drop Automatico (3 Vite). Elimina in anticipo chi accumula lose.","Dimezza partite First to 2."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_15), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Torneo 28 iscritti. HJ può allargare a Top 16 per amici?","options":["Sì, HJ ha potere.","No, richiede 32+ per proporzione."],"correctIndex":1,"explanation":"Perfetto."}'::jsonb),
  ((SELECT id FROM cid_15), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Player 5-0 e inarrivabile. Gioca il turno 6 e 7?","options":["Free-Pass Vetta. Salta round inutili e riposa.","Obbligato a giocare."],"correctIndex":0,"explanation":"Giustissimo."}'::jsonb);

WITH cid_16 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 16 · Decodifica Tiebreaker: Buchholz, Parità e Differenziali Meritocratici', 'Il divieto drastico sulla pratica anacronistica del Sudden Death ai tavoli, la piramide dei 4 gradi algoritmici (Tiebreaker) e la glorificazione spietata e bellica della "Game Win Difference" per lo sbarramento.', true, true, 16)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_16), 0, 'paragraph', NULL, '
                <h3>La Fine della Prassi Artigianale (Divieto Sudden Death)</h3>
                <p>Nelle ere pre-informatiche (o peggio nei raduni di circolo mal gestiti), quando il Turno Svizzero si chiudeva e sorgeva l''incubo che 3 giocatori fossero appaiati ciecamente in fondo con gli stessi esatti "12 Punti", c''era l''abitudine sciatta degli organizzatori di lanciare la spugna, chiamare al banco i tizi disperati e imporre brutali "spareggi lampo a 1 punto a mano nuda" o tirare monetine (Sudden Death fuori tabellone).<br><br>
                L''IBNA <strong>vieta categoricamente e punisce</strong> di inventare o architettare "partitelle slegate" o sfide "Sudden Death offline" per dirimere o sbloccare pareggi in bracket di Svizzera. Frantumano le ore di logica accumulata a monte. I pareggi numerici al vertice vengono sempre e unicamente sbloccati, spaccati in due e risolti dai <strong>Filtri Matematici Criptici dell''Algoritmo Centrale (Tiebreakers)</strong>, in scala di 4 gradi discendenti.</p>
                
                <h4>L''Inquisizione Algoritmica: I 4 Gradi del Tiebreaker</h4>
                <p>Se X e Y finiscono stremati e incollati al decimo posto della griglia Svizzera, ed entrambi bramano di rubare quell''ottavo slot, l''intelligenza artificiale interroga la loro storia:</p>
                <ul>
                    <li><strong>[G.1] Valore Torneo:</strong> Inerente ai macro calcoli incrociati di picco di ranking nazionale (irrilevante nel microscopico svizzero in loco, qui è neutro).</li>
                    <li><strong>[G.2] Punti Base Totali:</strong> Lo scoglio primario (Siete entrambi bloccati a quota 12 pt accumulati, perfetto pareggio iniziale matematico).</li>
                    <li><strong>[G.3] Win Rate e le Battaglie Fisiche "Sanguinose":</strong> L''algoritmo non è stupido. Guarda come hai costruito i tuoi 12 pt. Il Giocatore X ha sudato sangue vincendo ben 4 battaglie fisiche e perdendone una al tavolo contro esseri umani reali. Il giocatore Y, invece, ha avuto la fortuna che l''organizzatore fosse in numero dispari per un round: ha vinto 3 battaglie, ma il suo quarto punteggio è un BYE fantasma e asettico piovuto dal cielo e regalato a tavolino dal bot come riposo obbligato.<br>
                    <strong>L''IA esalta il sangue: X passa e sconfigge Y al volo al Grado 3, perché il software premia sempre chi ha forgiato il suo bottino con vittorie fisiche concrete (Scontri Umani) snobbando le vittorie fantasma da riposo dispari.</strong></li>
                </ul>

                <div class="casistica-box">
                    <span class="tag-scenario">La Sofferenza Altrui</span>
                    <h5><i class="fa-solid fa-chess"></i> Grado [G.4]: Il Dio Algoritmico (Buchholz / Game Win Difference)</h5>
                    <p>Immaginate ora il blocco totale: X ha 12 pt con 4 vittorie fisiche umane. E anche Y ha 12 pt con 4 identiche vittorie fisiche sudatesi sul campo. L''algoritmo è disperato e attiva il grado supremo, la divinità del calcolo: il <strong>Buchholz o Game Win Difference (GWD)</strong>.<br><br>
                    Il sistema smette di guardare cosa hanno fatto X e Y in arena, e inizia a guardare <strong>QUANTO SONO DIVENTATI FORTI A FINE GIORNATA I 4 AVVERSARI SPECIFICI</strong> che X ha affrontato nella sua via crucis verso le 19.00 di sera, sommandone algebricamente gli score di fine giornata. E fa la stessa somma storica e mostruosa guardando le facce dei 4 avversari sconfitti da Y nel passato.<br><br>
                    Se la "strada mortale" storicamente incrociata dal giocatore X brulicava di pro-player spaventosi e dèi che ora dimorano in Top 2 a 30 punti storici... mentre i vecchi avversari di Y erano tutti schiappe colossali e ragazzini pivelli caduti in fondo a 0 punti a fine gara... l''Algoritmo emette la sua sentenza gloriosa: <strong>IL GIOCATORE X MERITA DI ROMPERE IL PAREGGIO E PRENDERSI LA TOP, PERCHÉ LA SUA GAME WIN DIFFERENCE (BUCHHOLZ) ATTESTA CHE HA INCROCIATO E RESISTITO ALLE MAZZATE DEI CAMPIONI PIÙ FORTI DELLA REGIONE ALZANDO IL SUO VALORE PESATO ESTREMO, MENTRE Y HA SCONFITTO SOLO CARNE DA MACELLO IN RATING.</strong></p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_16), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Appaiati. Quale metrica estrema pesa quanto hai sudato per strada?","options":["Buchholz (GWD). Somma potenza avversari storici.","Elo Burst Finish."],"correctIndex":0,"explanation":"Intuizione eccellente."}'::jsonb),
  ((SELECT id FROM cid_16), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Parità. Arbitro propone partita spareggio (Sudden Death) offline per entrare in Top.","options":["Viola la norma. Mai spareggio offline, fa il Buchholz.","Corretto se acconsentono."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_16), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"X ha 16pt con 4 match fisici. Y ha 16pt con 3 match + 1 BYE. Chi vince G3?","options":["Vince X. Win da combattimento batte BYE.","Nessuno. Scende al Buchholz."],"correctIndex":0,"explanation":"Perfezione."}'::jsonb);

WITH cid_17 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 17 · Fairplay, Agonismo Educato e l''Arte del Buonsenso', 'La gestione contestuale dell''adrenalina: tollerare con classe i micro-contatti ininfluenti, i confini liberi dell''esultanza esplosiva e il muro rosso invalicabile della tutela hardware.', true, true, 17)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_17), 0, 'paragraph', NULL, '
                <h3>Il Principio Fondamentale del Buonsenso e del Fairplay</h3>
                <p>Nessun codice penale, per quanto profondo, può imbrigliare la caotica e imprevedibile casualità dello sport fisico. La "macchina" del regolamento IBNA non è progettata per creare arbitri robotici, punitivi ed oppressivi, ma gestori di spettacolo. Applicare alla lettera asettica e chirurgica ogni rigo delle infrazioni senza misurarle col calibro del <strong>Buonsenso e del Fairplay (Codice di Tolleranza)</strong> significherebbe spezzare il ritmo e l''anima ludica dell''evento in una sfilza nevrotica e noiosa di fischi burocratici ininfluenti.</p>
                
                <div class="casistica-box">
                    <span class="tag-scenario">La Tolleranza Contestuale</span>
                    <h5><i class="fa-solid fa-hand-sparkles"></i> Casistica 1: Il Contatto Goffo Accidentale Ininfluente</h5>
                    <p>Durante la violenta fase di trazione muscolare del ''Pronti...Lancio'', il gomito lungo e teso del Giocatore A sfiora e sfrega lievemente, in modo del tutto accidentale e non calibrato, la base in legno del tavolo su cui poggia l''arena.<br><br>
                    <strong>L''impatto reale sull''ecosistema:</strong> Lo stadio in plastica bianca non ha tremato, il coperchio non si è flesso, l''inerzia o l''angolo della trottola appena sganciata non ha subito la minima esitazione, e la visuale dell''avversario B era immacolata.<br>
                    Il Giocatore B, infido, si appella freddamente alla "Regola del Contatto Esterno" pretendendo l''assegnazione sadica del Fallo Tecnico all''avversario A.<br><br>
                    <strong>La risoluzione dell''Arbitro Saggio: Il Fairplay impone di sorridere, negare fermamente e ad alta voce il Fallo a B</strong>, e validare splendidamente la regolarità immacolata dell''azione in corso e vivo. Punire un millimetro irrilevante, invisibile e accidentale che non ha prodotto onde di caos tangibile finisce solo per distruggere lo show con pedanteria insopportabile e inutile paralisi da codice a barre.</p>
                </div>

                <h4><span class="index">17.1.1</span> L''Adrenalina Contenuta: Esultanza e Rifiuto Estetico</h4>
                <p>Esultare fragorosamente ed euforicamente è un diritto inalienabile e fisiologico, sacrosanto nel sudore competitivo agonistico. Gridare "Sì!", stringere i pugni, saltare per aria lontano dall''arena e piangere abbracciato al proprio team locale a 10 metri dal palcoscenico è non solo ammissibile, ma vitale per la salute drammatica del torneo.<br><br>
                <strong>Il reato estetico subentra quando crolla l''Educazione e si punta la derisione verso il soggetto debole.</strong> Urlare paonazzi la propria gioia e il proprio "Sì!" sfottendo miratamente in maniera aggressiva e prolungata il viso a cinque centimetri di distanza del povero sconfitto attonito a terra, o calpestargli inavvertitamente gli spazi intimi col corpo, porta la mannaia del Richiamo istantaneo (con potenziale scala verso il Game Loss per aggravante atteggiamento sadico sportivo).</p>

                <div class="warning-box">
                    <h5><i class="fa-solid fa-burst"></i> Danni Ambientali da Stizza Rabbiosa (Red Line)</h5>
                    <p>L''arbitro deve calare una coltre di piombo e intolleranza assoluta davanti ad una specifica emozione: l''Ira riversata sui materiali inerti o sul club. <br><br>
                    Se un blader è così divorato dall''amarezza per aver subito uno Xtreme Finish beffardo o un Burst all''ultimo secondo, da estrarre la sua stessa trottola per i pezzi smontati e scagliarli ciecamente al suolo o batterli pugni contusi contro il bancone dei giudici o sul costoso display monitor dell''Head Judge, <strong>si procede con la Squalifica o Game Loss Istantaneo senza udienza e un severo Richiamo per Code of Conduct Violato</strong>. L''IRA ESPLOSIVA CONTRO LA FISICITÀ DEI MATERIALI IBNA O DELL''ARENA (danneggiando o incrinando le proprietà a noleggio del club ospitante per pura immaturità emotiva irrisolta) porta all''esilio immediato. L''adrenalina è il cuore, ma scagliare materiali pesanti in mezzo alla gente è puro crimine irresponsabile ignorante.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_17), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Gomito sfiora tavolo. Niente si muove. B vuole fallo.","options":["Fallo. Regolamento è freddo.","Nega fallo. Tocco ininfluente in ottica Fairplay."],"correctIndex":1,"explanation":"Meraviglioso."}'::jsonb),
  ((SELECT id FROM cid_17), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Vince, esce dal tavolo, alza braccia e urla verso il suo team felice.","options":["Ammissibile, fuori dal cerchio avversario.","Richiamo per schiamazzi."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_17), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Per stizza, scaraventa il bey sul bancone giuria.","options":["Tollera adrenalina.","Richiamo severo/Game Loss. Gesto contro materiali."],"correctIndex":1,"explanation":"Perfetto."}'::jsonb);

WITH cid_18 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO 18 · Sinergia del Corpo Arbitrale IBNA', 'Le gerarchie logiche, il rapporto vitale di smaltimento calore ai banchi multipli in svizzera e l''ultimo baluardo assoluto per dirimere ricorsi in fiamme al tavolo: The Head Judge.', true, true, 18)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_18), 0, 'paragraph', NULL, '
                <h3>Corpo Arbitrale in Assetto da Tabellone Svizzero e Bilanciamento Carichi</h3>
                <p>Nelle fornaci di enormi macro-eventi con ondate di 70-120 blader infoiati, è fisicamente ed empiricamente impossibile (se non folle e letale) pretendere che il singolo Head Judge possa presiedere e ispezionare millimetricamente ogni fottuto stadio concavo per decine di ore filate. La chiave strutturale del management è la delega in un formicaio coeso.</p>
                <p>Per snellire celermente i processi svizzeri ed evitare i devastanti e tossici accumuli di stress visivo cognitivo al corpo giudicante che portano ad abbagli clamorosi al tramonto (fatica d''arbitraggio da sfinimento lenti a contatto / tunnel vision in arena), <strong>il rapporto aureo consigliato e quasi obbligato per la perfezione logistica è di schierare militarmente 1 Arbitro Base/Ausiliario Formato in pattugliamento fisso ogni 8 Giocatori attivi (cioè 1 Judge gestisce in tranquillità circa 4 tavoli caldi ravvicinati) + Aggiungere almeno 1 ulteriore Arbitro "Jolly/Rover/Assistente Extra" che pattuglia sganciato</strong> in moto circolare per l''intero palazzetto, sostituendo chirurgicamente o accorpando il lavoro momentaneo dei suoi fratelli fermi qualora un singolo match in loop tiri la partita troppo per le lunghe su un bancone specifico a causa di stalli infuocati ripetuti e dibattiti accesi tra giocatori esagitati. Questa falange armata salva i nervi, i riflessi di chiamata burst e velocizza l''evasione dei tabelloni digitali smaltendo rapidamente ondate infinite di punteggi.</p>
                
                <div class="warning-box">
                    <h5><i class="fa-solid fa-users-rays"></i> La Sentenza dell''Head Judge e i Ricorsi "Seduta Stante"</h5>
                    <p>Le decisioni fulminee "sul calar della trottola" prese al tavolo dall''Arbitro Base/Ausiliario (specie se supportate storicamente da inconfutabili trigger di VAR telecamere isolate o da logica pacifica sul ruling di base consolidato) sono virtualmente, al 98%, legge d''acciaio inoppugnabile e divina, pena il tilt perpetuo dei turni in corso per lagnanze asfissianti su chiamate pulite.<br><br>
                    Tuttavia, subentra la nobiltà del Diritto di Appello Interno. Ma ci sono dei paletti. Se i due contendenti furiosi, oppure lo stesso neo-arbitro che arranca incerto nel panico, intravedono o ravvisano un buco colossale, una falla oscura, un cortocircuito di regole o un''interpretazione palesemente rovesciata in un contenzioso rarissimo di nicchia estrema (es. un triplo mid-air che atterra rimbalzando fuori da mani altrui ma toccando vestiti sul ring prima dell''esplosione incrociata... un caso delirante che spacca la mente in due) ... essi detengono il Diritto insindacabile e sacro di bloccare tutto il tempo fermando i cronometri e le dita, sollevare la mano al cielo ed invocare <strong>l''Esclusivo, Pesante e Definitivo Giudizio Sul Tavolo del General Manager, the "Head Judge (HJ)" (Arbitro Capo Incaricato)</strong>.<br><br>
                    <strong>ATTENZIONE: IL DOGMA DELL''HJ:</strong><br>
                    Quando l''HJ viene chiamato in cattedra al tavolo dal caos, osserva la dinamica, calibra i due contendenti sudati, sfoglia le pagine di piombo del Ruling IBNA nel suo cervello o tablet e cala la sua ghigliottina, IL SUO RULING DIRIME, DECAPITA E CONGELA IRREVERSIBILMENTE IL CONTENZIOSO LOGICO.<br>
                    <strong>La decisione estrema e furente dell''HJ al tavolo NON È, E NON SARÀ MAI, SOGGETTA A REPLICA O SBUFFE O LAMENTI PIAGNUCOLOSI. Non esiste l''escamotage disperato o la furbata tossica di "denunciare" l''arbitro o i risultati tramite un ignobile "Ticket reclamo Post-Evento Online/Telegram via telefono" da spedire la sera dopo nascosti dal divano piangendo col Direttivo Europeo o lo Sviluppatore dell''App per cercare di annullare tutto, rubare punti magici per posta a tavolino smembrando la storia, o far ribaltare a distanza, vigliaccamente e freddamente, una top bracket ormai chiusa a mezzanotte con foto finte...</strong><br><br>
                    Tutto ciò che sanguina, vive e muore logisticamente nella Svizzera... viene sepolto irrimediabilmente, santificato e archiviato definitivamente nell''esatto secondo di polvere e urla in cui l''HJ abbassa severo il suo megafono al palazzetto offline. Amen.</p>
                </div>
            ', NULL),
  ((SELECT id FROM cid_18), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Rapporto consigliato Arbitri/Giocatori nei macro tornei?","options":["1 Arbitro ogni 20 Giocatori.","1 Arbitro ogni 8 Giocatori + 1 Jolly."],"correctIndex":1,"explanation":"Corretto."}'::jsonb),
  ((SELECT id FROM cid_18), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Lite infinita al tavolo. Chi ha il potere definitivo?","options":["L''Head Judge (HJ) in sala in modo assolutistico.","Commissione esterna telefonica post-evento."],"correctIndex":0,"explanation":"Esatto."}'::jsonb),
  ((SELECT id FROM cid_18), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Arbitro base fai un errore. HJ interviene e ti corregge. Che fai?","options":["Contesti perché hai patentino.","Ti fai da parte e impari dal Ruling d''emergenza."],"correctIndex":1,"explanation":"Perfetto."}'::jsonb);

WITH cid_19 AS (
  INSERT INTO public.judge_courses (title, description, is_published, required_for_test, position)
  VALUES ('CORSO MASTER · Organizzazione Macroscopica, Delega Desk Caller e Relazioni Istituzionali Head Judge', 'Relazioni governative PR IBNA, accordi e tutele assicurative titaniche intercedendo per il CONI e la FIGEST, organigramma dirigenziale, il blocco burocratico software e il ruolo salvifico del Data-Entry Desk/Caller.', true, false, 19)
  RETURNING id
)
INSERT INTO public.judge_course_steps (course_id, position, step_type, title, content_html, quiz) VALUES
  ((SELECT id FROM cid_19), 0, 'paragraph', NULL, '
            <h3>Oltre il Metallo dello Stadio: L''Ascesa Istituzionale PR e Burocratica</h3>
            <p>Raggiungere il grado e la visione occulta ed elevata dell''Head Judge significa estirpare dal cervello la minuscola percezione del giocatore o dell''arbitro ausiliario "da trincea". Significa comprendere che l''ecosistema logistico IBNA non si regge, non sopravvive e non si alimenta cibandosi semplicemente e in maniera passiva compilando annoiati i noiosi foglietti di calcolo del software Bracket Ranked la domenica pomeriggio sul tavolo del bar di un club.</p>
            <p>Al fine supremo di poter ospitare enormi e strutturati eventi territoriali protetti, attrarre fondi e sponsor massicci e costruire cattedrali di folla in veri palazzetti regionali sportivi protetti... l''intero organigramma dell''Associazione, sotto il peso dell''Head Judge, deve inevitabilmente espandersi e flettersi diramandosi oltre il ludico e agganciando pesantemente la sfera politica, diplomatica governativa italiana e mondiale per tramutare un passatempo glorificato in una fottuta e vera realtà agonistica eugenetica riconosciuta, temuta e foraggiata dal macro-stato civile.</p>

            <h4><span class="index">19.1.1</span> Il Dipartimento Esterno Relazioni: Enti, Aziende, Takara e Tutele CONI</h4>
            <p>Per trasformare strutturalmente un modesto raduno isolato tra 30 anime polverose di provincia in un Macro Tappa Master Ufficiale luccicante con palchi sopraelevati massicci, fari led chirurgici accecanti, arene omologate esclusive fornite in loco da fabbrica e cascate infinite di merchandising legale introvabile per i Top Player... l''organizzazione dirigenziale occulta e l''HJ stesso sono chiamati a impiegare titanici sforzi occulti di natura PR (Pubbliche Relazioni Diplomatiche massimaliste), designati e condannati ad un faticoso e logorante triplice ruolo esterno invisibile all''utente base giocante:</p>
            <ul>
                <li><strong>1. Collaborazione Corporate / Ponti Asiatici e Americani:</strong> Intessere, pregare e mantenere accesi ed oliati preziosi canali comunicativi diretti e logistici con uffici inaccessibili di multinazionali come l''americana <strong>Hasbro</strong> e la madrepatria giapponese <strong>Takara Tomy</strong> al fine vitale di blindare le licenze o i patrocini invisibili d''uso loghi e materiali protetti per non scivolare nel buio legale e nell''oscurantismo dei Copyright e brevetti strike.</li>
                <li><strong>2. Legittimazione, Tutele Statali e l''Ombrello d''Acciaio E-Sport:</strong> Questa è la "Boss Fight" finale segreta dell''intera organizzazione IBNA. Inoltrare dossier enormi e logoranti, creare affiliazioni statutarie, bypass e accordi con enormi enti o federazioni strutturate del gioco tradizionale governativo italiano come la <strong>FIGEST (Federazione Italiana Giochi e Sport Tradizionali)</strong>. <br>
                Il folle, eugenetico e titanico "Piano Macro-Sistemico e Assoluto a Lungo Termine" dell''Academy e del Direttivo è quello di scavare incessantemente, politicamente e burocraticamente la montagna delle leggi per poter <strong>operare un clamoroso e inattaccabile Riconoscimento Ufficiale dello Stato di questo "E-sport Ibrido e ad altissima velocità fisica d''impatto" (Beyblade) certificato in Gazzetta all''interno del monolitico e inavvicinabile Registro CONI (Comitato Olimpico Nazionale Italiano) E-Sports</strong>. <br>
                <strong>PERCHÉ LO SI FA?</strong> Questo ancoraggio tentacolare pazzesco statale, questa fusione col CONI (che i blader pivelli non comprendono o ridicolizzano non sapendo) <strong>garantirebbe per sempre alla fragile anima IBNA un gigantesco e vitale ombrello di Tutele Assicurative Sportive su Infortuni e Coperture Mediche massimaliste (sia per lo staff sfiancato che per i ragazzini e i player che si beccano schegge metalliche sui palchi e si maciullano mani incaute in arena), e innescherebbe clamorose "Agevolazioni Burocratiche/De-tassazioni pazzesche e priorità assoluta per l''affitto statale/comunale e la requisizione logistica a bassissimo costo fiscale o gratuito agevolato" degli enormi e introvabili Palazzetti dello Sport (i Pala-Ghiaccio / Pala-Sport) che le città italiane tengono in cassaforte per basket o volley e non cederebbero mai per giocattoli asiatici senza bollo. Un piccolo circolo, un club amatoriale anarchico, ribelle o disperso su un campetto sfitto abusivo o parrocchia non otterrebbe e non attrarrebbe e non assorbirebbe mai e poi mai per vie povere tali mastodontiche coperture assicurative governative per crescere il montepremi.</strong></li>
            </ul>

            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 40px 0;">

            <h3>Il Macro-Organigramma Formativo Interno: Academy Logistica IBNA</h3>
            
            <h4><span class="index">19.2.1</span> L''Abilitazione Arbitrale E La Follia dell''Ego (Tu sei un soldato)</h4>
            <p>Il felice ottenimento e lo sblocco trionfale della magica interfaccia di questo "Dossier/Patentino o Brevetto IBNA Academy Ufficiale e Certificato" a cui stai partecipando, ti incorona e sblocca senza dubbio la gloriosa <strong>"Abilitazione Arbitrale Permanente Certificata e Approvata all''interno del database logistico informatico europeo centrale in Cloud"</strong>. <br><br>
            <strong>Tuttavia... Ascolta bene la realtà dell''Hangar in trincea:</strong><br>
            Tuttavia, l''Head Judge Manager Incaricato Supremo dell''evento col megafono (L''HJ, l''organizzatore sovrano pagante) in quel preciso palazzetto sudato la domenica mattina <strong>DETIENE SEMPRE ED INSINDACABILMENTE IL SUPREMO ED EGOISTICO DIRITTO D''AULA E LA TOTALE ASSOLUTA DISCREZIONE OPERATIVA DELLE TRUPPE SUL CAMPO per dislocarti, declassarti, parcheggiarti a terra, incatenarti ai tabelloni poveri esterni o metterti brutalmente e saggiamente "in prova formativa/rodaggio osservativo logistico" e testare la tua tenuta allo stress ormonale brutale a fianco ai pro prima di osare consegnarti chiavi in mano i tavoli infuocati radioattivi a sangue della super Top Cut dei pro-player mostruosi in Semi-Finale.</strong> <br>
            Superare e spammare 30 risposte a crocette mnemoniche (o copiate col telefono da un amico) stando comodamente in pigiama davanti allo schermo dell''app Academy un venerdì sera... non certifica in alcun modo magico la tua "tenuta allo stress panico/adrenalina esplosiva/pianto d''arena/urla minacciose/tilt uditivo in VAR" al tavolo vero sotto i 40 gradi dei riflettori LED, davanti alla furia umana e fisica di decine di persone in foga agonistica armate di corde d''assalto al Nazionale che ti urlano di fare fallo a 10cm dalla bocca guardandoti furiosi.<br>
            <strong>Non osare presentarti e sbattere in faccia orgoglioso il patentino software all''HJ in sala reclamando la Poltrona Reale d''Oro della finalissima o cercando di calpestare le sue deleghe disperate e umiliarlo o sostituirlo per far sfoggio dei tuoi muscoli burocratici teorici, credendo che il quiz ti renda un Dio in Terra infallibile del Ruling e autorizzato a calpestare lo staff locale obsoleto che paga i tavoli. Sei un preziosissimo e letale arbitro IBNA, sei l''eccellenza informata in soccorso, ma resti l''affiancamento del Club Ospitante che ha tirato su i muri fisici del palazzo.</strong></p>

            <div class="warning-box">
                <h5><i class="fa-solid fa-server"></i> DELEGA ASSOLUTA DEL DESK (Il "Data-Entry Caller" Logistico Informatico in Rete)</h5>
                <p>Nelle fornaci di fine pomeriggio, per snellire in modo violento e miracoloso l''agonia dei grandi eventi (Sopra i 6 Turni Svizzera per 80 iscritti impazziti) e per evitare categoricamente il devastante letale "Tilt Nervoso/Cognitivo Corto Circuito" totale dell''intero corpo arbitrale...<br>
                La super-manualistica IBNA e il codice Master per HJ imposta ed emana <strong>LA REGOLA D''ORO E PIETRA MILIARE DELLA "SEPARAZIONE COGNITIVA TOTALE DEGLI INCARICHI (Separation of Church and State in logistica)"</strong>:<br><br>
                L''Head Judge sano e cosciente deve separare come un fiume netto il sangue dal silicio: Gli Arbitri Base corrono, ispezionano sudati, fischiano fisicamente coi polmoni, litigano coi bimbi piangenti in arena e strillano l''estenuante visione chirurgica dei burst e guardano cecati i VAR nei minuscoli schermi ai minuscoli tavoli. <strong>E BASTA. DEVONO RESTARE INCATENATI AL TAVOLO A FIANCO DEI BEY. NON SI MUOVONO DA LÌ.</strong><br><br>
                Mentre, in fondo alla sala buia, al riparo dalle urla e dalle plastiche, una <strong>Figura Terza Esterna Asettica, Fredda e Calcolatrice (che perfino potrebbe non essere un arbitro patentato, ma un informatico esterno puro prestato che non conosce il gioco fisicamente e che non si interessa delle arene, ma solo dei numeri... o la fidanzata dell''HJ munita di dita veloci a tastiera e concentrazione zen isolata con le cuffie) siede blindata e intoccabile al PC CENTRALE SERVER nel ruolo gelido ed esclusivo del "DESK/CALLER / DATA-ENTRY"</strong>.<br><br>
                L''addetto o l''addetta Desk Caller "Carica ossessivamente" algebricamente i numeri sui server software GWD ricevendo i bigliettini e i gridolini dagli arbitri sporchi a distanza senza farsi coinvolgere nelle discussioni, annuncia col microfono freddo a tutto volume dall''alto verso le casse e richiama a voce stentorea gli abbinamenti del Turno Svizzero dettati dal software asettico che macina in Cloud per sbloccare e stampare le Top Cut senza commettere un singolo e fottuto errore fatale matematico o inversione punti o invertire il Pairings sul sistema rovinando le finali ad un Pro innocente.<br><br>
                <strong>INCARICARE LO STESSO POVERO, SINGOLO ARBITRO SUDATO DALL''ADRENALINA D''ARENA DI FARSI MILLE VOLTE IL VIAGGIO E LA SPOLA MASSACRANTE "TAVOLO-SPAZIO-SEDIA PC-TAVOLO-MEGAFONO-LITIGIO TAVOLO-CARICO PUNTI COMPUTER" COME UNA TROTTOLA UMANA IMPAZZITA È PURO SUICIDIO ORGANIZZATIVO MACRO-LOGISTICO E MASOCHISMO ALLO STATO PURO E GARANTISCE CATASTROFI ALGORTIMICHE AL TURNO 6! DELEGA DEL DESK ASSOLUTA. LA MACCHINA (PC) SEPARATA DAL SANGUE (ARENA).</strong></p>
            </div>
        ', NULL),
  ((SELECT id FROM cid_19), 1, 'quiz', 'Quiz · Domanda 1', NULL, '{"question":"Motivazione politica dietro affiliazione FIGEST/CONI?","options":["Fornire corsi gratis e abbattere tasse di importazione.","Riconoscimento legale per tutele assicurative/mediche."],"correctIndex":1,"explanation":"Incredibile."}'::jsonb),
  ((SELECT id FROM cid_19), 2, 'quiz', 'Quiz · Domanda 2', NULL, '{"question":"Regionale 100+. Arbitro arbitra poi corre al PC a caricare punti. Operato top?","options":["Sì, l''HJ deve far tutto.","Disastroso. Si delega il Data-Entry al Desk Caller."],"correctIndex":1,"explanation":"Eccellente."}'::jsonb),
  ((SELECT id FROM cid_19), 3, 'quiz', 'Quiz · Domanda 3', NULL, '{"question":"Passi test Master. Vai al Nazionale e pretendi di arbitrare la Top Cut.","options":["L''HJ in carica ha discrezione di farti rodare a lato.","Destituisci lo staff obsoleto reclamando il tavolo."],"correctIndex":0,"explanation":"Ottimo."}'::jsonb);