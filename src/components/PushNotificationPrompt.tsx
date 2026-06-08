import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNativePush } from "@/hooks/useNativePush";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "push_prompt_dismissed_v2";
const SHOW_DELAY_MS = 4000;

export const PushNotificationPrompt = () => {
  const { user } = useAuth();
  const isNative = Capacitor.isNativePlatform();
  const { isSupported, isSubscribed, permission, subscribe } = usePushNotifications();
  const { isNativeSupported, isRegistered, registerNativePush, checkPermission } = useNativePush();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    let cancelled = false;
    const decide = async () => {
      if (isNative && isNativeSupported) {
        const perm = await checkPermission();
        if (perm === "granted" || isRegistered) return;
      } else {
        if (!isSupported) return;
        if (permission === "granted" && isSubscribed) return;
        if (permission === "denied") return;
      }
      if (!cancelled) {
        setTimeout(() => !cancelled && setVisible(true), SHOW_DELAY_MS);
      }
    };
    decide();
    return () => {
      cancelled = true;
    };
  }, [user, isNative, isNativeSupported, isSupported, isSubscribed, permission, isRegistered, checkPermission]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const ok = isNative && isNativeSupported ? await registerNativePush() : await subscribe();
      if (ok) {
        toast({ title: "Notifiche attivate", description: "Riceverai un avviso solo per le novità importanti." });
        localStorage.setItem(STORAGE_KEY, "1");
        setVisible(false);
      } else {
        toast({ title: "Permesso negato", description: "Puoi riattivarle dalle impostazioni del dispositivo.", variant: "destructive" });
        localStorage.setItem(STORAGE_KEY, "1");
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0 z-50 w-[92%] max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-secondary text-muted-foreground"
        aria-label="Chiudi"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary">
          <Bell size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Attiva le notifiche</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Solo eventi importanti: club approvato, inviti, nuovi tornei dei club che segui e badge.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={enable} disabled={busy} className="flex-1">
              {busy ? "Attivazione…" : "Attiva"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Non ora</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
