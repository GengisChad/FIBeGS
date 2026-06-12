import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Bug, ChevronsUpDown, Send, Trash2, User as UserIcon, Bell, Heart, Award, Swords, Megaphone, Trophy, AlertTriangle, UserPlus, CheckCircle, XCircle } from "lucide-react";

type Profile = { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null };

type TestCase = {
  key: string;
  label: string;
  icon: typeof Bell;
  type: string;
  title: string;
  message: string;
  link?: string;
  push: boolean;
  description: string;
};

const TESTS: TestCase[] = [
  {
    key: "club_approved", label: "Club Approvato", icon: CheckCircle,
    type: "club_approved", title: "Club Approvato!",
    message: "Il tuo club \"Club di Test\" è stato approvato! Fai ora parte del club.",
    link: "/clubs", push: true,
    description: "Notifica + push quando un club viene approvato.",
  },
  {
    key: "club_rejected", label: "Club Rifiutato", icon: XCircle,
    type: "club_rejected", title: "Richiesta Club Rifiutata",
    message: "La richiesta per il club \"Club di Test\" è stata rifiutata. Motivo: nome non conforme.",
    link: "/clubs", push: true,
    description: "Notifica + push quando una richiesta club viene rifiutata.",
  },
  {
    key: "club_request_ready", label: "Richiesta Pronta (staff)", icon: AlertTriangle,
    type: "club_request_ready", title: "Richiesta Club Pronta",
    message: "Tutti i membri hanno accettato l'invito per il club \"Club di Test\". Pronta per approvazione.",
    link: "/admin", push: false,
    description: "Notifica per staff quando 7+ inviti sono accettati.",
  },
  {
    key: "club_tournament", label: "Nuovo Torneo Club", icon: Swords,
    type: "club_tournament", title: "Nuovo torneo!",
    message: "Club di Test ha pubblicato il torneo \"Torneo Estate 2026\"",
    link: "/tournaments", push: true,
    description: "Notifica + push quando un club che segui o di cui sei membro pubblica un torneo.",
  },
  {
    key: "badge_earned", label: "Badge Ottenuto", icon: Award,
    type: "badge_earned", title: "Nuovo badge ottenuto!",
    message: "Hai ottenuto il badge \"Veterano\"",
    link: "/profile", push: true,
    description: "Notifica + push per nuovo badge.",
  },
  {
    key: "achievement_earned", label: "Achievement Sbloccato", icon: Trophy,
    type: "achievement_earned", title: "Achievement sbloccato!",
    message: "Hai sbloccato l'achievement \"Primo Torneo\" (+50 punti)",
    link: "/achievements", push: true,
    description: "Notifica + push per nuovo achievement.",
  },
  {
    key: "staff_announcement", label: "Annuncio Staff", icon: Megaphone,
    type: "staff_announcement", title: "Comunicazione Ufficiale",
    message: "Questo è un annuncio di test dallo staff FIBeGS. Comunicazioni importanti appariranno qui.",
    link: "/", push: true,
    description: "Notifica + push per annunci ufficiali staff.",
  },
];

const DebugTestsTab = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && !targetId) setTargetId(user.id);
  }, [user, targetId]);

  useEffect(() => {
    const load = async () => {
      const q = search.trim();
      let query = supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .order("display_name", { ascending: true })
        .limit(30);
      if (q.length >= 2) {
        query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
      }
      const { data } = await query;
      setProfiles((data as Profile[]) ?? []);
    };
    load();
  }, [search]);

  const target = profiles.find((p) => p.user_id === targetId);
  const targetLabel = target
    ? target.display_name || target.username || target.user_id.slice(0, 8)
    : targetId === user?.id
      ? "Me stesso"
      : "Seleziona utente…";

  const triggerPushNow = async () => {
    try {
      await supabase.functions.invoke("auto-push-notification");
    } catch (err) {
      console.error("Push trigger error:", err);
    }
  };

  const runTest = async (t: TestCase) => {
    if (!targetId) {
      toast({ title: "Seleziona un utente", variant: "destructive" });
      return;
    }
    setBusy(t.key);
    try {
      const { error } = await supabase.rpc("admin_debug_send_notification", {
        _target_user_id: targetId,
        _type: t.type,
        _title: t.title,
        _message: t.message,
        _link: t.link ?? null,
        _push: t.push,
      });
      if (error) throw error;

      if (t.push) await triggerPushNow();

      toast({
        title: "Test inviato",
        description: t.push ? "Notifica + push inviati." : "Notifica in-app inviata.",
      });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const runClubInvite = async () => {
    if (!targetId) {
      toast({ title: "Seleziona un utente", variant: "destructive" });
      return;
    }
    setBusy("club_invite_real");
    try {
      const { error } = await supabase.rpc("admin_debug_create_club_invite", {
        _target_user_id: targetId,
      });
      if (error) throw error;
      await triggerPushNow();
      toast({
        title: "Banner invito creato",
        description: "Il banner comparirà all'utente target. Usa 'Pulisci test' per cancellarlo.",
      });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const runClubRequest = async () => {
    if (!targetId) {
      toast({ title: "Seleziona un utente", variant: "destructive" });
      return;
    }
    setBusy("club_request_real");
    try {
      const { error } = await supabase.rpc("admin_debug_create_club_request" as any, {
        _target_user_id: targetId,
      });
      if (error) throw error;
      toast({
        title: "Banner richiesta creato",
        description: "Il banner di richiesta apertura club comparirà all'utente target. Usa 'Pulisci test' per cancellarlo.",
      });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const cleanupAll = async () => {
    if (!confirm("Eliminare tutte le notifiche e richieste club di test ([TEST])?")) return;
    setBusy("cleanup");
    try {
      const { data, error } = await supabase.rpc("admin_debug_cleanup_tests");
      if (error) throw error;
      const result = data as { notifications_deleted: number; club_requests_deleted: number };
      toast({
        title: "Pulizia completata",
        description: `${result.notifications_deleted} notifiche, ${result.club_requests_deleted} richieste club eliminate.`,
      });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-primary" />
          Debug Test Notifiche & Banner
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Invia notifiche di test (e push reali) a te stesso o a un altro utente per verificare desktop/mobile.
          Tutti i test sono marcati con <code className="bg-muted px-1 rounded">[TEST]</code>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target selector */}
        <div className="space-y-2">
          <Label>Utente target</Label>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={targetId === user?.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTargetId(user?.id ?? "")}
              className="gap-1.5"
            >
              <UserIcon size={14} /> Me stesso
            </Button>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 min-w-[200px] justify-between">
                  <span className="truncate">{targetLabel}</span>
                  <ChevronsUpDown size={14} className="opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Cerca utente…" value={search} onValueChange={setSearch} />
                  <CommandList>
                    <CommandEmpty>Nessun utente trovato.</CommandEmpty>
                    <CommandGroup>
                      {profiles.map((p) => (
                        <CommandItem
                          key={p.user_id}
                          value={p.user_id}
                          onSelect={() => {
                            setTargetId(p.user_id);
                            setOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{p.display_name || p.username || "—"}</span>
                            {p.username && p.display_name && (
                              <span className="text-[10px] text-muted-foreground">@{p.username}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {target && (
            <Badge variant="secondary" className="text-xs">
              ID: {target.user_id.slice(0, 8)}…
            </Badge>
          )}
        </div>

        {/* Special tests: real club banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-dashed border-primary/40 p-4 bg-primary/5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <AlertTriangle size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Banner richiesta apertura club</h3>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Crea una richiesta club fittizia <strong>a nome dell'utente target</strong>. Apparirà il banner "Richiesta Club in attesa" nella sua pagina /clubs.
                </p>
                <Button size="sm" onClick={runClubRequest} disabled={busy === "club_request_real"} className="gap-1.5">
                  <Send size={14} />
                  {busy === "club_request_real" ? "Creazione…" : "Crea banner richiesta"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-primary/40 p-4 bg-primary/5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <UserPlus size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Banner invito a club in creazione</h3>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Crea una richiesta club dell'admin + un invito per l'utente target. Apparirà il banner di invito nella sua pagina /clubs e home.
                </p>
                <Button size="sm" onClick={runClubInvite} disabled={busy === "club_invite_real"} className="gap-1.5">
                  <Send size={14} />
                  {busy === "club_invite_real" ? "Creazione…" : "Crea banner invito"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Notification tests grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TESTS.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.key} className="rounded-lg border border-border p-3 bg-background/50">
                <div className="flex items-start gap-2 mb-2">
                  <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm">{t.label}</span>
                      {t.push ? (
                        <Badge variant="default" className="text-[9px] px-1.5 py-0">PUSH</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">IN-APP</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => runTest(t)}
                  disabled={busy === t.key}
                >
                  <Send size={12} />
                  {busy === t.key ? "Invio…" : "Invia test"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Cleanup */}
        <div className="pt-3 border-t border-border">
          <Button variant="destructive" size="sm" onClick={cleanupAll} disabled={busy === "cleanup"} className="gap-1.5">
            <Trash2 size={14} />
            {busy === "cleanup" ? "Pulizia…" : "Pulisci tutti i test"}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Elimina tutte le notifiche e richieste club marcate <code className="bg-muted px-1 rounded">[TEST]</code> dal database.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugTestsTab;
