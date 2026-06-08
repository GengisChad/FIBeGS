import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Check, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <Smartphone className="mx-auto mb-4 text-primary" size={48} />
            <h1 className="section-title">
              INSTALLA <span className="gradient-text">L'APP</span>
            </h1>
            <p className="text-muted-foreground mt-4">
              Accedi rapidamente a tornei, classifiche e forum direttamente dalla schermata home del tuo telefono.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
            {isInstalled ? (
              <div className="text-center py-8">
                <Check className="mx-auto mb-4 text-green-500" size={48} />
                <h2 className="font-display text-xl mb-2">App già installata!</h2>
                <p className="text-muted-foreground">
                  Hai già installato FIB sul tuo dispositivo. Cercala nella schermata home.
                </p>
              </div>
            ) : deferredPrompt ? (
              <div className="text-center py-8">
                <h2 className="font-display text-xl mb-4">Pronto per installare</h2>
                <p className="text-muted-foreground mb-6">
                  Clicca il pulsante qui sotto per aggiungere FIB alla tua schermata home.
                </p>
                <Button variant="hero" size="lg" onClick={handleInstall} className="gap-2">
                  <Download size={20} />
                  Installa App
                </Button>
              </div>
            ) : isIOS ? (
              <div className="py-4 space-y-4">
                <h2 className="font-display text-xl text-center mb-4">Come installare su iPhone/iPad</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-secondary rounded-xl">
                    <span className="font-display text-primary text-lg shrink-0">1</span>
                    <p className="text-sm">Tocca il pulsante <strong>Condividi</strong> <Share size={14} className="inline" /> nella barra di Safari</p>
                  </div>
                  <div className="flex items-start gap-4 p-4 bg-secondary rounded-xl">
                    <span className="font-display text-primary text-lg shrink-0">2</span>
                    <p className="text-sm">Scorri e seleziona <strong>"Aggiungi alla schermata Home"</strong></p>
                  </div>
                  <div className="flex items-start gap-4 p-4 bg-secondary rounded-xl">
                    <span className="font-display text-primary text-lg shrink-0">3</span>
                    <p className="text-sm">Tocca <strong>"Aggiungi"</strong> in alto a destra</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <h2 className="font-display text-xl text-center mb-4">Come installare su Android</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-secondary rounded-xl">
                    <span className="font-display text-primary text-lg shrink-0">1</span>
                    <p className="text-sm">Apri questo sito con <strong>Chrome</strong></p>
                  </div>
                  <div className="flex items-start gap-4 p-4 bg-secondary rounded-xl">
                    <span className="font-display text-primary text-lg shrink-0">2</span>
                    <p className="text-sm">Tocca il menu <strong>⋮</strong> in alto a destra</p>
                  </div>
                  <div className="flex items-start gap-4 p-4 bg-secondary rounded-xl">
                    <span className="font-display text-primary text-lg shrink-0">3</span>
                    <p className="text-sm">Seleziona <strong>"Installa app"</strong> o <strong>"Aggiungi alla schermata Home"</strong></p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">Vantaggi dell'app</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  "Accesso rapido dalla home",
                  "Funziona anche offline",
                  "Notifiche push per i tornei",
                  "Esperienza a schermo intero",
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-sm">
                    <Check size={14} className="text-primary shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Install;
