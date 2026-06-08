import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Unlink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

type Platform = "challonge" | "challengermode";

const META: Record<Platform, { label: string; description: string }> = {
  challonge: {
    label: "Challonge",
    description: "Collega il profilo Challonge del tuo bambino per riconoscerlo nei tornei importati.",
  },
  challengermode: {
    label: "Challengermode",
    description: "Collega il profilo Challengermode del tuo bambino per il riconoscimento automatico.",
  },
};

interface LinkedAccount {
  platform: Platform;
  external_username: string;
}

export default function ChildLinkedAccountsDialog({
  open,
  onOpenChange,
  childId,
  childName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  childId: string | null;
  childName: string;
}) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Platform | null>(null);

  const fetchAccounts = async () => {
    if (!childId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("user_external_accounts")
      .select("platform, external_username")
      .eq("child_profile_id", childId);
    setAccounts((data ?? []) as LinkedAccount[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open && childId) fetchAccounts();
  }, [open, childId]);

  const startLink = async (platform: Platform) => {
    if (!childId) return;
    setBusy(platform);
    let popup: Window | null = null;
    if (!Capacitor.isNativePlatform()) {
      popup = window.open("about:blank", "_blank");
    }
    try {
      const redirect_uri = window.location.hostname.endsWith("ibna.it")
        ? `https://ibna.it/${platform}-callback`
        : `${window.location.origin}/${platform}-callback`;
      const { data, error } = await supabase.functions.invoke("link-external-account", {
        body: { action: "start", platform, redirect_uri, child_profile_id: childId },
      });
      if (error) throw error;
      const url = (data as any)?.auth_url;
      if (!url) throw new Error("URL OAuth mancante");
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url, presentationStyle: "popover" });
      } else if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      toast.error(`Errore: ${err.message ?? err}`);
    } finally {
      setBusy(null);
    }
  };

  const unlink = async (platform: Platform) => {
    if (!childId) return;
    setBusy(platform);
    try {
      const { error } = await supabase.functions.invoke("link-external-account", {
        body: { action: "unlink", platform, child_profile_id: childId },
      });
      if (error) throw error;
      toast.success(`${META[platform].label} scollegato`);
      await fetchAccounts();
    } catch (err: any) {
      toast.error(`Errore: ${err.message ?? err}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 size={18} /> Account collegati di {childName}
          </DialogTitle>
          <DialogDescription>
            Collega gli account dei tornei online del tuo bambino. Se in futuro
            il profilo verrà convertito in account autonomo, i collegamenti
            verranno mantenuti.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : (
            (Object.keys(META) as Platform[]).map((platform) => {
              const linked = accounts.find((a) => a.platform === platform);
              return (
                <div
                  key={platform}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{META[platform].label}</span>
                      {linked && (
                        <Badge variant="default" className="text-[10px]">
                          {linked.external_username}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {META[platform].description}
                    </p>
                  </div>
                  {linked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === platform}
                      onClick={() => unlink(platform)}
                    >
                      {busy === platform ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <>
                          <Unlink size={14} className="mr-1" />
                          Scollega
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy === platform}
                      onClick={() => startLink(platform)}
                    >
                      {busy === platform ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <>
                          <ExternalLink size={14} className="mr-1" />
                          Collega
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
