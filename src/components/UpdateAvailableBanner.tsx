import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CURRENT_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const POLL_INTERVAL_MS = 60_000;
const DISMISS_KEY = "ibna_update_dismissed_version";

export const UpdateAvailableBanner = () => {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (!data?.version) return;
      if (data.version !== CURRENT_VERSION) {
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed === data.version) return;
        setLatestVersion(data.version);
      }
    } catch {
      /* offline / no version file — ignore */
    }
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    try {
      if (window.self !== window.top) return; // skip in iframe (Lovable preview)
    } catch {
      return;
    }
    if (window.location.hostname.includes("lovableproject.com")) return;

    void checkForUpdate();
    const id = window.setInterval(checkForUpdate, POLL_INTERVAL_MS);
    const onFocus = () => void checkForUpdate();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkForUpdate]);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      // Force the active service worker to fetch and activate the new build.
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(
          regs.map(async (r) => {
            try {
              await r.update();
              if (r.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" });
            } catch {
              /* noop */
            }
          })
        );
      }
      // Purge runtime caches so the next load fetches fresh assets.
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.allSettled(names.map((n) => caches.delete(n)));
      }
    } finally {
      // Hard reload with cache-buster.
      const url = new URL(window.location.href);
      url.searchParams.set("v", Date.now().toString());
      window.location.replace(url.toString());
    }
  };

  const dismiss = () => {
    if (latestVersion) localStorage.setItem(DISMISS_KEY, latestVersion);
    setLatestVersion(null);
  };

  if (!latestVersion) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1rem)] max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-3 flex items-center gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <RefreshCw size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">Aggiornamento disponibile</p>
          <p className="text-xs text-muted-foreground leading-snug">
            È stata rilasciata una nuova versione di FIB.
          </p>
        </div>
        <Button
          size="sm"
          variant="hero"
          onClick={handleUpdate}
          disabled={updating}
          className="h-8 gap-1.5"
        >
          <RefreshCw size={14} className={updating ? "animate-spin" : ""} />
          {updating ? "Aggiorno…" : "Aggiorna"}
        </Button>
        <button
          onClick={dismiss}
          aria-label="Ignora"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
