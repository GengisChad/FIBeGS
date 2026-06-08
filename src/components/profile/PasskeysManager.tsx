import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, Loader2, Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { registerPasskey, passkeySupported } from "@/lib/passkeys";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Passkey {
  id: string;
  device_name: string | null;
  device_os: string | null;
  created_at: string;
  last_used_at: string | null;
}

export default function PasskeysManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const supported = passkeySupported();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_passkeys")
      .select("id, device_name, device_os, created_at, last_used_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setItems((data || []) as Passkey[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleAdd = async () => {
    setAdding(true);
    const res = await registerPasskey();
    setAdding(false);
    if (res.ok) {
      toast.success("Passkey aggiunta");
      load();
    } else {
      toast.error(res.error);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Rimuovere questa passkey? Non potrai più usarla per accedere.")) return;
    const { error } = await supabase
      .from("user_passkeys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Passkey rimossa");
      load();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" /> Dispositivi e passkey
            </CardTitle>
            <CardDescription>
              Gestisci i dispositivi che possono accedere al tuo account con accesso rapido.
            </CardDescription>
          </div>
          {supported && (
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Aggiungi
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!supported && (
          <p className="text-sm text-muted-foreground">
            Il tuo browser non supporta le passkey su questo dispositivo.
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nessuna passkey configurata. Aggiungine una per accedere senza password.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {p.device_name || "Dispositivo sconosciuto"}
                    </span>
                    {p.device_os && (
                      <Badge variant="secondary" className="text-xs">
                        {p.device_os}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Creata{" "}
                    {format(new Date(p.created_at), "d MMM yyyy", { locale: it })}
                    {p.last_used_at && (
                      <>
                        {" "}
                        · ultimo uso{" "}
                        {format(new Date(p.last_used_at), "d MMM yyyy", { locale: it })}
                      </>
                    )}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRevoke(p.id)}
                  className="text-destructive hover:text-destructive"
                  aria-label="Rimuovi passkey"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
