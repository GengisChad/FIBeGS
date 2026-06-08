import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl font-display font-bold mb-2">Termini di Servizio</h1>
        <p className="text-sm text-muted-foreground mb-8">Ultimo aggiornamento: 22 Marzo 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Accettazione dei Termini</h2>
            <p>Utilizzando la piattaforma FIB (Federazione Italiana Bladers), l'utente accetta integralmente i presenti Termini di Servizio. Se non si accettano questi termini, è necessario cessare immediatamente l'utilizzo della piattaforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Descrizione del Servizio</h2>
            <p>FIB è una piattaforma comunitaria dedicata al Beyblade competitivo in Italia. I servizi offerti includono:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Gestione di tornei e campionati con classifiche e punteggi.</li>
              <li>Forum di discussione con sistema di moderazione.</li>
              <li>Gestione di club e sedi con strumenti organizzativi.</li>
              <li>Mercato per la compravendita di componenti tra utenti.</li>
              <li>Collezione digitale e creazione di deck.</li>
              <li>Sezione media con contenuti aggregati da piattaforme terze.</li>
              <li>Sistema di achievement, missioni e badge.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Registrazione e Account</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Per accedere alle funzionalità della piattaforma è necessario creare un account con un indirizzo email valido.</li>
              <li>L'utente è responsabile della sicurezza delle proprie credenziali e di tutte le attività svolte tramite il proprio account.</li>
              <li>Ogni persona può possedere un solo account. La creazione di account multipli è vietata.</li>
              <li>L'username scelto deve rispettare le linee guida della community e non contenere contenuti offensivi.</li>
              <li>Gli account non confermati (email non verificata) verranno eliminati automaticamente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Profili Minori</h2>
            <p>I minori di 14 anni non possono registrarsi autonomamente sulla piattaforma. Un genitore/tutore legale con ruolo "Genitore" verificato può creare e gestire profili per i propri figli. Il genitore è responsabile di tutte le attività svolte tramite i profili dei minori sotto la propria tutela.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Contenuti degli Utenti</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Gli utenti mantengono la proprietà intellettuale dei contenuti originali pubblicati (testi, immagini caricate).</li>
              <li>Pubblicando contenuti sulla piattaforma, l'utente concede a FIB una licenza non esclusiva, gratuita e mondiale per visualizzare, distribuire e modificare tali contenuti nell'ambito del funzionamento della piattaforma.</li>
              <li>È vietato pubblicare contenuti illegali, diffamatori, offensivi, violenti, sessualmente espliciti, discriminatori o che violino diritti di terzi.</li>
              <li>I contenuti sono soggetti a moderazione. Staff e amministratori possono rimuovere contenuti che violano le linee guida senza preavviso.</li>
              <li>Il sistema di filtro anti-profanità è attivo su forum e mercato. Tentare di aggirarlo può comportare sanzioni.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Club e Tornei</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>La creazione di club è soggetta ad approvazione da parte dello staff FIB.</li>
              <li>I club leader e il loro staff sono responsabili della gestione del club e dei tornei organizzati.</li>
              <li>Ogni utente può essere membro di un solo club alla volta.</li>
              <li>I tornei devono rispettare il regolamento ufficiale FIB.</li>
              <li>Le classifiche e i punteggi sono calcolati automaticamente dal sistema e non possono essere modificati manualmente dagli utenti.</li>
              <li>FIB non è responsabile per eventuali controversie tra organizzatori e partecipanti relative a quote di iscrizione o premi.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Mercato</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>FIB funge esclusivamente da piattaforma di annunci. Non è parte delle transazioni tra utenti.</li>
              <li>Le transazioni avvengono direttamente tra acquirente e venditore. FIB non garantisce la qualità, l'autenticità o la consegna dei prodotti.</li>
              <li>È vietato pubblicare inserzioni per prodotti contraffatti, illegali o non correlati al Beyblade.</li>
              <li>FIB declina ogni responsabilità per perdite economiche, truffe o inadempienze derivanti da transazioni tra utenti.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Contenuti Media</h2>
            <p>La sezione media di FIB funge da aggregatore di contenuti disponibili su piattaforme terze (YouTube e altre). FIB non ospita, archivia o distribuisce file multimediali sui propri server. La responsabilità della disponibilità e conformità legale dei contenuti ricade interamente sulle piattaforme di pubblicazione originali.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Proprietà Intellettuale</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>FIB non è affiliata con Takara Tomy, Hasbro o altri detentori dei diritti di Beyblade.</li>
              <li>I marchi "Beyblade", "Beyblade X" e relativi sono di proprietà dei rispettivi titolari.</li>
              <li>Il codice sorgente, il design e i contenuti originali della piattaforma FIB sono protetti da diritto d'autore.</li>
              <li>È vietata la riproduzione, distribuzione o modifica non autorizzata dei contenuti della piattaforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Condotte Vietate</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Utilizzare la piattaforma per scopi illegali o non autorizzati.</li>
              <li>Tentare di accedere ad account, dati o funzionalità non autorizzate.</li>
              <li>Interferire con il funzionamento della piattaforma (attacchi DDoS, injection, scraping automatizzato).</li>
              <li>Manipolare classifiche, punteggi o risultati dei tornei.</li>
              <li>Creare account falsi o impersonare altri utenti.</li>
              <li>Utilizzare strumenti di sviluppo o automazione per alterare il comportamento della piattaforma.</li>
              <li>Molestie, bullismo, doxxing o qualsiasi forma di abuso nei confronti di altri utenti.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Sanzioni</h2>
            <p>La violazione dei presenti termini può comportare, a discrezione dello staff:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Rimozione dei contenuti in violazione.</li>
              <li>Sospensione temporanea o permanente dell'account.</li>
              <li>Esclusione da tornei e classifiche.</li>
              <li>Rimozione dal club di appartenenza.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">12. Limitazione di Responsabilità</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>FIB è fornita "così com'è" senza garanzie di alcun tipo, esplicite o implicite.</li>
              <li>Non garantiamo la disponibilità continua e ininterrotta del servizio.</li>
              <li>Non siamo responsabili per perdita di dati, danni diretti o indiretti derivanti dall'uso della piattaforma.</li>
              <li>Non siamo responsabili per contenuti pubblicati da terzi sulla piattaforma.</li>
              <li>Non siamo responsabili per link esterni o servizi di terze parti collegati alla piattaforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">13. Modifiche ai Termini</h2>
            <p>Ci riserviamo il diritto di modificare questi termini in qualsiasi momento. Le modifiche sostanziali saranno comunicate tramite notifica in-app. L'uso continuativo della piattaforma dopo la pubblicazione delle modifiche costituisce accettazione dei nuovi termini.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">14. Legge Applicabile</h2>
            <p>I presenti termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà competente il Foro del luogo di residenza del consumatore, ai sensi dell'Art. 33 del Codice del Consumo (D.Lgs. 206/2005).</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
