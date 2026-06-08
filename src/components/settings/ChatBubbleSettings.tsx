import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ChatBubble, isChatBubbleSupported } from "@/plugins/ChatBubble";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MessageCircle, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Settings card: enable/disable Messenger-style floating chat bubbles.
 * Only visible inside the Android native shell.
 */
export const ChatBubbleSettings = () => {
  const supported = isChatBubbleSupported();
  const [enabled, setEnabled] = useState(false);
  const [hasPerm, setHasPerm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    (async () => {
      const [e, p] = await Promise.all([
        ChatBubble.isEnabled(),
        ChatBubble.hasOverlayPermission(),
      ]);
      setEnabled(e.enabled);
      setHasPerm(p.granted);
    })();
  }, [supported]);

  if (!supported) return null;

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next && !hasPerm) {
        const res = await ChatBubble.requestOverlayPermission();
        setHasPerm(res.granted);
        if (!res.granted) {
          toast({
            title: "Permesso richiesto",
            description: "Concedi 'Visualizza sopra altre app' nelle impostazioni Android, poi torna qui.",
          });
          setBusy(false);
          return;
        }
      }
      await ChatBubble.setEnabled({ enabled: next });
      setEnabled(next);
      toast({
        title: next ? "Chat floating attive" : "Chat floating disattivate",
        description: next
          ? "Riceverai le bolle chat quando arrivano nuovi messaggi privati."
          : "Continuerai a ricevere le notifiche standard.",
      });
    } finally {
      setBusy(false);
    }
  };

  const recheckPerm = async () => {
    const p = await ChatBubble.hasOverlayPermission();
    setHasPerm(p.granted);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary">
          <MessageCircle size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Bolle chat floating</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stile Messenger: i messaggi privati appaiono come bolle galleggianti
            sopra ogni app. Tocca per rispondere senza aprire FIBApp.
          </p>
        </div>
        <Switch checked={enabled} disabled={busy} onCheckedChange={toggle} />
      </div>
      {!hasPerm && Capacitor.getPlatform() === "android" && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs">
          <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1">
            <p>Serve il permesso <strong>"Visualizza sopra altre app"</strong>.</p>
            <div className="flex gap-2 mt-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => ChatBubble.requestOverlayPermission().then(r => setHasPerm(r.granted))}>
                Concedi permesso
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={recheckPerm}>
                Ho già concesso
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
