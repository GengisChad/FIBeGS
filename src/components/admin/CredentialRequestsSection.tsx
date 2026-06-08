import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { KeyRound, Check, X, AlertCircle, RefreshCw } from "lucide-react";

interface CredentialRequest {
  id: string;
  category: string;
  username: string;
  new_email: string;
  message: string | null;
  status: string;
  matched_user_id: string | null;
  handled_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  apple_id_login: "Apple ID non disponibile",
  lost_email_access: "Email non più accessibile",
  other: "Altro problema credenziali",
};

const CredentialRequestsSection = () => {
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncOpen, setSyncOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<CredentialRequest | null>(null);
  const [matchedProfile, setMatchedProfile] = useState<{ user_id: string; display_name: string | null; username: string | null } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [processing, setProcessing] = useState(false);
  const [searchingProfile, setSearchingProfile] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("credential_help_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests((data as CredentialRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openApprove = async (req: CredentialRequest) => {
    setActiveRequest(req);
    setConfirmEmail(req.new_email);
    setMatchedProfile(null);
    setSyncOpen(true);
    setSearchingProfile(true);

    // Try to find profile by exact username match
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, username")
      .ilike("username", req.username)
      .limit(1)
      .maybeSingle();

    setMatchedProfile(data as any);
    setSearchingProfile(false);
  };

  const handleSync = async () => {
    if (!activeRequest || !matchedProfile) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-sync-credential-email", {
        body: {
          request_id: activeRequest.id,
          target_user_id: matchedProfile.user_id,
          new_email: confirmEmail.trim(),
        },
      });
      if (error || (data && (data as any).error)) {
        toast({
          title: "Errore",
          description: (data as any)?.error || error?.message || "Operazione fallita",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Email aggiornata e mail di recupero password inviata ✅" });
      setSyncOpen(false);
      setActiveRequest(null);
      fetchRequests();
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (req: CredentialRequest) => {
    if (!confirm("Rifiutare questa richiesta?")) return;
    const { error } = await supabase
      .from("credential_help_requests")
      .update({
        status: "rejected",
        handled_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Richiesta rifiutata" });
      fetchRequests();
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const handled = requests.filter((r) => r.status !== "pending");

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <KeyRound size={20} className="text-primary" />
            Problemi credenziali ({pending.length} in attesa)
            <Button size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={fetchRequests}>
              <RefreshCw size={14} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Caricamento...</p>
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nessuna richiesta ricevuta.</p>
          ) : (
            <div className="space-y-3">
              {[...pending, ...handled].map((req) => (
                <div
                  key={req.id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    req.status === "pending" ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">@{req.username}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {CATEGORY_LABELS[req.category] || req.category}
                        </Badge>
                        <Badge
                          variant={
                            req.status === "approved"
                              ? "secondary"
                              : req.status === "rejected"
                              ? "destructive"
                              : "default"
                          }
                          className="text-[10px]"
                        >
                          {req.status === "approved"
                            ? "✅ Approvata"
                            : req.status === "rejected"
                            ? "❌ Rifiutata"
                            : "In attesa"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nuova email: <span className="font-mono text-foreground">{req.new_email}</span>
                      </p>
                      {req.message && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{req.message}"</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(req.created_at).toLocaleString("it-IT")}
                      </p>
                    </div>
                    {req.status === "pending" && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="default" onClick={() => openApprove(req)}>
                          <Check size={14} className="mr-1" /> Approva
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(req)}>
                          <X size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Dialog */}
      <Dialog open={syncOpen} onOpenChange={(o) => { if (!o) { setSyncOpen(false); setActiveRequest(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} /> Sincronizza email account
            </DialogTitle>
            <DialogDescription>
              L'email verrà sostituita nell'account del giocatore e verrà inviata automaticamente una mail per il recupero password.
            </DialogDescription>
          </DialogHeader>

          {activeRequest && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Username richiesto:</span>{" "}
                  <span className="font-medium">@{activeRequest.username}</span>
                </div>
                {searchingProfile ? (
                  <p className="text-xs text-muted-foreground">Ricerca profilo in corso...</p>
                ) : matchedProfile ? (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Profilo trovato:</span>{" "}
                    <span className="font-medium text-foreground">
                      {matchedProfile.display_name || matchedProfile.username}
                    </span>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      ID: {matchedProfile.user_id}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle size={12} /> Nessun profilo trovato con questo username
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-email">Nuova email da associare</Label>
                <Input
                  id="confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Email originale richiesta:{" "}
                  <span className="font-mono">{activeRequest.new_email}</span>
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleSync}
              disabled={processing || !matchedProfile || !confirmEmail.trim()}
            >
              {processing ? "Sincronizzazione..." : "Conferma e invia reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CredentialRequestsSection;
