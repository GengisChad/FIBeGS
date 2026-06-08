import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Unlink, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

type Platform = "challonge" | "challengermode";

const PLATFORM_META: Record<Platform, { label: string; description: string }> = {
  challonge: {
    label: "Challonge",
    description: "Collega il tuo account Challonge per identificarti automaticamente nei tornei importati.",
  },
  challengermode: {
    label: "Challengermode",
    description: "Collega il tuo account Challengermode per il riconoscimento automatico nei tornei.",
  },
};

interface LinkedAccount {
  platform: Platform;
  external_username: string;
  external_user_id: string | null;
  updated_at: string;
}

export default function LinkedExternalAccounts({ userId }: { userId: string }) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Platform | null>(null);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_external_accounts")
      .select("platform, external_username, external_user_id, updated_at")
      .eq("user_id", userId);
    setAccounts((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetch(); }, [userId]);

  const startLink = async (platform: Platform) => {
    setBusy(platform);

    // Open a placeholder tab synchronously so popup-blockers don't kick in.
    // We'll redirect this tab once we receive the auth_url.
    let popup: Window | null = null;
    if (!Capacitor.isNativePlatform()) {
      popup = window.open("about:blank", "_blank");
    }

    try {
      const redirect_uri = window.location.hostname.endsWith("ibna.it")
        ? `https://ibna.it/${platform}-callback`
        : `${window.location.origin}/${platform}-callback`;
      const { data, error } = await supabase.functions.invoke("link-external-account", {
        body: { action: "start", platform, redirect_uri },
      });
      if (error) throw error;
      const url = (data as any)?.auth_url;
      if (!url) throw new Error((data as any)?.error || "URL OAuth mancante");

      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url, presentationStyle: "popover" });
      } else if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        // Popup was blocked → fall back to same-tab navigation
        window.location.href = url;
      }
      setBusy(null);
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      const msg = err?.message ?? err?.context?.error ?? String(err);
      toast.error(`Errore: ${msg}`);
      setBusy(null);
    }
  };

  const unlink = async (platform: Platform) => {
    setBusy(platform);
    try {
      const { error } = await supabase.functions.invoke("link-external-account", {
        body: { action: "unlink", platform },
      });
      if (error) throw error;
      toast.success(`${PLATFORM_META[platform].label} scollegato`);
      await fetch();
    } catch (err: any) {
      toast.error(`Errore: ${err.message ?? err}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 size={18} /> Account collegati
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="animate-spin" size={20} /></div>
        ) : (
          (Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
            const linked = accounts.find((a) => a.platform === platform);
            return (
              <div key={platform} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{PLATFORM_META[platform].label}</span>
                    {linked && <Badge variant="default" className="text-[10px]">{linked.external_username}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{PLATFORM_META[platform].description}</p>
                </div>
                {linked ? (
                  <Button variant="outline" size="sm" disabled={busy === platform} onClick={() => unlink(platform)}>
                    {busy === platform ? <Loader2 className="animate-spin" size={14} /> : <><Unlink size={14} className="mr-1" />Scollega</>}
                  </Button>
                ) : (
                  <Button size="sm" disabled={busy === platform} onClick={() => startLink(platform)}>
                    {busy === platform ? <Loader2 className="animate-spin" size={14} /> : <><ExternalLink size={14} className="mr-1" />Collega</>}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
