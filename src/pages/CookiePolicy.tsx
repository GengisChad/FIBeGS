import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl font-display font-bold mb-2">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Ultimo aggiornamento: 22 Marzo 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Cosa sono i Cookie</h2>
            <p>I cookie sono piccoli file di testo che vengono memorizzati sul dispositivo dell'utente quando visita un sito web. Vengono utilizzati per memorizzare informazioni e preferenze, migliorare l'esperienza di navigazione e garantire il funzionamento di determinate funzionalità.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Cookie Utilizzati</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Cookie Tecnici (Necessari)</h3>
            <p>Questi cookie sono essenziali per il funzionamento della piattaforma e non possono essere disattivati. Includono:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-3 py-2 text-left">Cookie</th>
                    <th className="border border-border px-3 py-2 text-left">Finalità</th>
                    <th className="border border-border px-3 py-2 text-left">Durata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-3 py-2"><code>sb-*-auth-token</code></td>
                    <td className="border border-border px-3 py-2">Autenticazione e sessione utente (token JWT)</td>
                    <td className="border border-border px-3 py-2">Sessione / Refresh automatico</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2"><code>theme</code></td>
                    <td className="border border-border px-3 py-2">Preferenza tema (chiaro/scuro/personalizzato)</td>
                    <td className="border border-border px-3 py-2">Persistente (localStorage)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2 Local Storage</h3>
            <p>Oltre ai cookie tradizionali, la piattaforma utilizza il Local Storage del browser per:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-3 py-2 text-left">Chiave</th>
                    <th className="border border-border px-3 py-2 text-left">Finalità</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-3 py-2">Token di autenticazione</td>
                    <td className="border border-border px-3 py-2">Mantenere la sessione attiva tra le visite</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Preferenze tema</td>
                    <td className="border border-border px-3 py-2">Ricordare il tema selezionato dall'utente</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Cache query</td>
                    <td className="border border-border px-3 py-2">Migliorare le prestazioni riducendo le richieste al server</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium mt-4 mb-2">2.3 Cookie di Terze Parti</h3>
            <p>La piattaforma potrebbe caricare contenuti da servizi di terze parti che impostano i propri cookie:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>YouTube:</strong> embed di video nella sezione media (soggetti alla Cookie Policy di Google).</li>
              <li><strong>Giphy:</strong> ricerca e caricamento GIF nel forum (soggetti alla Privacy Policy di Giphy).</li>
            </ul>
            <p>FIBeGS non ha controllo sui cookie impostati da questi servizi di terze parti.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Cookie NON Utilizzati</h2>
            <p>FIBeGS <strong>non utilizza</strong>:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Cookie di profilazione o pubblicitari.</li>
              <li>Cookie di tracciamento cross-site.</li>
              <li>Cookie di analytics di terze parti (Google Analytics, Facebook Pixel, etc.).</li>
              <li>Cookie per remarketing o retargeting.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Gestione dei Cookie</h2>
            <p>Puoi gestire le preferenze sui cookie attraverso le impostazioni del tuo browser. Tieni presente che la disattivazione dei cookie tecnici potrebbe compromettere il funzionamento della piattaforma, in particolare l'autenticazione.</p>
            <p>Istruzioni per i browser principali:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/it/kb/Gestione%20dei%20cookie" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Safari</a></li>
              <li><a href="https://support.microsoft.com/it-it/microsoft-edge" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Edge</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Aggiornamenti</h2>
            <p>Questa Cookie Policy può essere aggiornata periodicamente per riflettere cambiamenti nelle tecnologie utilizzate o nella normativa vigente. La data di ultimo aggiornamento è indicata in cima a questa pagina.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Riferimenti Normativi</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Regolamento (UE) 2016/679 (GDPR)</li>
              <li>Direttiva 2002/58/CE (ePrivacy Directive)</li>
              <li>D.Lgs. 196/2003 (Codice Privacy italiano) come modificato dal D.Lgs. 101/2018</li>
              <li>Linee guida del Garante Privacy sui cookie del 10 giugno 2021</li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CookiePolicy;
