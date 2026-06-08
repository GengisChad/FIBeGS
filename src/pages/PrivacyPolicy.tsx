import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl font-display font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Ultimo aggiornamento: 22 Marzo 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Titolare del Trattamento</h2>
            <p>Il titolare del trattamento dei dati è FIB (Federazione Italiana Bladers), piattaforma online dedicata alla community italiana del Beyblade competitivo. Per qualsiasi richiesta relativa alla privacy, contattaci tramite la sezione "Contatti" presente nella pagina FAQ del sito.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Base Giuridica del Trattamento</h2>
            <p>I dati personali vengono trattati sulla base di:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Consenso dell'interessato</strong> (Art. 6, par. 1, lett. a del GDPR) — fornito al momento della registrazione e dell'utilizzo della piattaforma.</li>
              <li><strong>Esecuzione di un contratto</strong> (Art. 6, par. 1, lett. b) — necessario per l'erogazione dei servizi richiesti (iscrizione tornei, gestione profilo, partecipazione al forum).</li>
              <li><strong>Legittimo interesse</strong> (Art. 6, par. 1, lett. f) — per il funzionamento sicuro della piattaforma, la prevenzione di abusi e la moderazione dei contenuti.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Dati Raccolti</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">3.1 Dati forniti direttamente dall'utente</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Dati di registrazione:</strong> indirizzo email, username, nome visualizzato.</li>
              <li><strong>Dati di profilo (facoltativi):</strong> città, regione, avatar, banner, biografia.</li>
              <li><strong>Dati di contatto del club:</strong> numero di telefono (fornito volontariamente al club di appartenenza, conservato in tabella separata con accesso ristretto).</li>
              <li><strong>Contenuti generati:</strong> post del forum, risposte, deck, inserzioni del mercato, feedback.</li>
            </ul>
            <h3 className="text-lg font-medium mt-4 mb-2">3.2 Dati raccolti automaticamente</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Dati tecnici:</strong> informazioni sul dispositivo (user agent) inviate con i feedback per finalità di debug.</li>
              <li><strong>Dati di navigazione:</strong> timestamp dell'ultima attività ("ultimo accesso") per mostrare lo stato online.</li>
              <li><strong>Notifiche push:</strong> endpoint e chiavi di crittografia per l'invio di notifiche (Web Push o FCM).</li>
            </ul>
            <h3 className="text-lg font-medium mt-4 mb-2">3.3 Dati dei minori</h3>
            <p>La piattaforma consente la creazione di profili per minori esclusivamente da parte di un genitore/tutore legale con ruolo "Genitore" verificato. I profili minori contengono solo: nome visualizzato, città, regione e avatar. Non raccogliamo email o dati di contatto diretto dei minori.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Finalità del Trattamento</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Fornitura e gestione dei servizi della piattaforma (tornei, classifiche, forum, mercato).</li>
              <li>Autenticazione e sicurezza dell'account.</li>
              <li>Comunicazione tramite notifiche in-app e push relative ad attività pertinenti.</li>
              <li>Moderazione dei contenuti e prevenzione di abusi.</li>
              <li>Statistiche aggregate e classifiche pubbliche (punti, vittorie, piazzamenti).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Conservazione dei Dati</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Dati dell'account:</strong> conservati fino alla cancellazione dell'account da parte dell'utente.</li>
              <li><strong>Notifiche lette:</strong> eliminate automaticamente dopo 30 giorni.</li>
              <li><strong>Locandine tornei:</strong> eliminate automaticamente 10 giorni dopo la fine del torneo.</li>
              <li><strong>Account non confermati:</strong> eliminati automaticamente tramite processo di pulizia periodico.</li>
              <li><strong>Inserzioni mercato:</strong> soggette a pulizia periodica automatica.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Sicurezza dei Dati</h2>
            <p>Adottiamo le seguenti misure di sicurezza a protezione dei dati:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Row Level Security (RLS):</strong> ogni tabella del database è protetta da policy granulari che garantiscono l'accesso ai dati solo agli utenti autorizzati.</li>
              <li><strong>Isolamento dei dati sensibili:</strong> i numeri di telefono sono conservati in una tabella dedicata (<code>club_member_phones</code>) accessibile esclusivamente allo staff del club e agli amministratori tramite funzione RPC con privilegi elevati.</li>
              <li><strong>Validazione server-side:</strong> trigger di database validano tutti gli input prima dell'inserimento.</li>
              <li><strong>Sanitizzazione HTML:</strong> tutti i contenuti HTML generati dagli utenti vengono sanificati con DOMPurify per prevenire attacchi XSS.</li>
              <li><strong>Autenticazione sicura:</strong> gestita tramite Supabase Auth con JWT, refresh token automatico e sessioni persistenti.</li>
              <li><strong>Crittografia:</strong> tutte le comunicazioni avvengono tramite HTTPS. Le chiavi push sono crittografate end-to-end.</li>
              <li><strong>Funzioni Edge protette:</strong> le operazioni sensibili richiedono verifica JWT e controllo dei ruoli.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Condivisione dei Dati</h2>
            <p>Non vendiamo, affittiamo o condividiamo i dati personali con terze parti a fini commerciali. I dati possono essere condivisi con:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase Inc.:</strong> provider infrastrutturale per hosting database, autenticazione e storage (sede: USA, conforme al EU-US Data Privacy Framework).</li>
              <li><strong>Servizi di terze parti integrati:</strong> Giphy (ricerca GIF nel forum), piattaforme social linkate volontariamente dall'utente o dal club.</li>
            </ul>
            <p>I dati pubblici del profilo (username, nome visualizzato, avatar, punti, vittorie, città) sono visibili ad altri utenti della piattaforma come parte del funzionamento del servizio.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Diritti dell'Interessato</h2>
            <p>Ai sensi del GDPR (Regolamento UE 2016/679), hai diritto di:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Accesso</strong> (Art. 15): ottenere conferma dell'esistenza di un trattamento e accedere ai tuoi dati.</li>
              <li><strong>Rettifica</strong> (Art. 16): correggere dati inesatti o incompleti tramite la pagina Profilo.</li>
              <li><strong>Cancellazione</strong> (Art. 17): richiedere la cancellazione dei tuoi dati contattandoci.</li>
              <li><strong>Limitazione</strong> (Art. 18): richiedere la limitazione del trattamento in determinati casi.</li>
              <li><strong>Portabilità</strong> (Art. 20): ricevere i tuoi dati in formato strutturato e leggibile.</li>
              <li><strong>Opposizione</strong> (Art. 21): opporti al trattamento basato su legittimo interesse.</li>
              <li><strong>Revoca del consenso</strong>: ritirare il consenso in qualsiasi momento senza pregiudicare la liceità del trattamento precedente.</li>
            </ul>
            <p className="mt-2">Per esercitare questi diritti, contattaci tramite la sezione dedicata nella pagina FAQ. Hai inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.garanteprivacy.it</a>).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Trasferimento Dati Extra-UE</h2>
            <p>I dati sono trattati tramite infrastruttura Supabase che può utilizzare server situati negli Stati Uniti. Il trasferimento è legittimato dal EU-US Data Privacy Framework e dalle clausole contrattuali standard (SCC) adottate dalla Commissione Europea.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Modifiche alla Privacy Policy</h2>
            <p>Ci riserviamo il diritto di aggiornare questa informativa. Le modifiche sostanziali saranno comunicate tramite notifica in-app. L'uso continuativo della piattaforma dopo la pubblicazione delle modifiche costituisce accettazione delle stesse.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
