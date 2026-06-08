import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, Share, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ibna_install_prompt_dismissed_at";
const DISMISS_DAYS = 7;
const SHOW_DELAY_MS = 8000;

export const InstallAppPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    let handler: ((e: Event) => void) | undefined;
    let installedHandler: (() => void) | undefined;

    try {
      // Skip in native app, in iframe, or if already installed/standalone
      if (Capacitor.isNativePlatform()) return;
      try {
        if (window.self !== window.top) return;
      } catch {
        return;
      }
      if (window.matchMedia?.("(display-mode: standalone)").matches) return;
      if ((navigator as any).standalone === true) return;

      const ua = navigator.userAgent || "";
      const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      // CRITICAL: Skip the custom install prompt entirely on iOS Safari.
      // It has been linked to WebKit instability (blank/reloading pages) and
      // iOS already provides its own native "Add to Home Screen" flow.
      if (iOSDevice) return;

      // Respect recent dismissal
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const ts = parseInt(dismissed, 10);
        if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
          return;
        }
      }

      setIsIOS(false);

      handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      };

      window.addEventListener("beforeinstallprompt", handler as EventListener);

      installedHandler = () => {
        setVisible(false);
        setDeferredPrompt(null);
      };
      window.addEventListener("appinstalled", installedHandler);
    } catch (err) {
      console.warn("[InstallAppPrompt] init failed", err);
    }

    return () => {
      try {
        if (handler) window.removeEventListener("beforeinstallprompt", handler as EventListener);
        if (installedHandler) window.removeEventListener("appinstalled", installedHandler);
        if (timer) window.clearTimeout(timer);
      } catch {
        /* noop */
      }
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Smartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm mb-0.5">Installa FIB</h3>
          {isIOS && !deferredPrompt ? (
            <p className="text-xs text-muted-foreground leading-snug">
              Tocca <Share size={12} className="inline mx-0.5" /> e poi <strong>"Aggiungi alla schermata Home"</strong>.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground leading-snug">
              Aggiungila alla home: accesso rapido, notifiche e modalità a schermo intero.
            </p>
          )}
          <div className="flex items-center gap-2 mt-2.5">
            {deferredPrompt ? (
              <Button size="sm" variant="hero" onClick={handleInstall} className="gap-1.5 h-8">
                <Download size={14} />
                Installa
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild className="h-8">
                <Link to="/installa" onClick={dismiss}>Scopri come</Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss} className="h-8 text-muted-foreground">
              Più tardi
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Chiudi"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors -mt-0.5 -mr-0.5"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
