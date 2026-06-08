import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, AlertTriangle, Clock, Ban, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ModerationActionDialog, type ModerationAction } from "@/components/moderation/ModerationActionDialog";
import AdminPagination, { useAdminPagination } from "./AdminPagination";

interface ProfileLite {
  user_id: string; username: string | null; display_name: string | null; avatar_url: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  forum: "Forum", market: "Market", decks: "Deck", tournaments: "Tornei", profile: "Profilo",
};

const ModerationAdminTab = () => {
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [warns, setWarns] = useState<any[]>([]);
  const [timeouts, setTimeouts] = useState<any[]>([]);
  const [bans, setBans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [target, setTarget] = useState<ProfileLite | null>(null);
  const [action, setAction] = useState<ModerationAction | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: pf }, { data: w }, { data: t }, { data: b }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, display_name, avatar_url").order("created_at", { ascending: false }).limit(500),
      (supabase as any).from("user_warns").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      (supabase as any).from("user_timeouts").select("*").is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
      (supabase as any).from("user_bans").select("*").is("revoked_at", null).order("created_at", { ascending: false }),
    ]);
    setProfiles((pf as any) || []);
    setWarns(w || []); setTimeouts(t || []); setBans(b || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.user_id, p])), [profiles]);

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    const s = search.toLowerCase();
    return profiles.filter(p => p.display_name?.toLowerCase().includes(s) || p.username?.toLowerCase().includes(s) || p.user_id.includes(s));
  }, [profiles, search]);

  const userStats = useMemo(() => {
    const map = new Map<string, { warns: Record<string, number>; timeoutActive: boolean; banActive: boolean }>();
    profiles.forEach(p => map.set(p.user_id, { warns: {}, timeoutActive: false, banActive: false }));
    warns.forEach(w => { const s = map.get(w.user_id); if (s) s.warns[w.section] = (s.warns[w.section] || 0) + 1; });
    timeouts.forEach(t => { const s = map.get(t.user_id); if (s) s.timeoutActive = true; });
    bans.forEach(b => { const s = map.get(b.user_id); if (s) s.banActive = true; });
    return map;
  }, [profiles, warns, timeouts, bans]);

  const usersWithIssues = useMemo(() => {
    return filteredProfiles.filter(p => {
      const s = userStats.get(p.user_id);
      if (!s) return false;
      const totalWarns = Object.values(s.warns).reduce((a, b) => a + b, 0);
      return totalWarns > 0 || s.timeoutActive || s.banActive;
    });
  }, [filteredProfiles, userStats]);

  const { getPageItems } = useAdminPagination(search.trim() ? filteredProfiles : usersWithIssues);
  const paged = getPageItems(page);

  const revokeWarn = async (id: string) => {
    await (supabase as any).from("user_warns").update({ is_active: false }).eq("id", id);
    toast({ title: "Warn rimosso" }); fetchAll();
  };
  const revokeTimeout = async (id: string) => {
    await (supabase as any).from("user_timeouts").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    toast({ title: "Time-out revocato" }); fetchAll();
  };
  const revokeBan = async (id: string) => {
    await (supabase as any).from("user_bans").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    toast({ title: "Ban revocato" }); fetchAll();
  };

  const openAction = (p: ProfileLite, a: ModerationAction) => { setTarget(p); setAction(a); };

  const renderUserRow = (p: ProfileLite) => {
    const stats = userStats.get(p.user_id) || { warns: {}, timeoutActive: false, banActive: false };
    const totalWarns = Object.values(stats.warns).reduce((a, b) => a + b, 0);
    const anyMaxed = Object.values(stats.warns).some(c => c >= 3);
    return (
      <div key={p.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition">
        <Avatar className="h-10 w-10">
          <AvatarImage src={p.avatar_url || ""} />
          <AvatarFallback>{(p.display_name || p.username || "?")[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{p.display_name || p.username || "Senza nome"}</span>
            {p.username && <Badge variant="outline" className="text-[10px]">@{p.username}</Badge>}
            {stats.banActive && <Badge variant="destructive" className="text-[10px] gap-1"><Ban size={10} /> BAN</Badge>}
            {stats.timeoutActive && <Badge className="bg-orange-500 text-white text-[10px] gap-1"><Clock size={10} /> Time-out</Badge>}
          </div>
          <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-1">
            {Object.entries(stats.warns).map(([s, c]) => (
              <Badge key={s} variant={c >= 3 ? "destructive" : "outline"} className="text-[10px]">
                {SECTION_LABELS[s]}: {c}/3
              </Badge>
            ))}
            {totalWarns === 0 && <span className="text-[11px]">Nessun warn</span>}
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => openAction(p, "warn")} className="gap-1">
            <AlertTriangle size={13} /> Warn
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAction(p, "timeout")} className="gap-1">
            <Clock size={13} /> Time-out
          </Button>
          <Button size="sm" variant="destructive" onClick={() => openAction(p, "ban")} disabled={!anyMaxed} className="gap-1">
            <Ban size={13} /> Ban
          </Button>
        </div>
      </div>
    );
  };

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldAlert size={20} /> Moderazione Utenti</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Utenti</TabsTrigger>
            <TabsTrigger value="warns">Warn attivi ({warns.length})</TabsTrigger>
            <TabsTrigger value="timeouts">Time-out ({timeouts.length})</TabsTrigger>
            <TabsTrigger value="bans">Ban ({bans.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cerca utente per nome, username o ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <p className="text-xs text-muted-foreground">
              {search.trim() ? `${filteredProfiles.length} risultati` : `${usersWithIssues.length} utenti con sanzioni attive`}
            </p>
            <div className="space-y-2">
              {paged.map(renderUserRow)}
              {paged.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nessun utente.</p>}
            </div>
            <AdminPagination page={page} totalItems={(search.trim() ? filteredProfiles : usersWithIssues).length} onPageChange={setPage} />
          </TabsContent>

          <TabsContent value="warns" className="space-y-2">
            {warns.length === 0 && <p className="text-sm text-muted-foreground">Nessun warn attivo.</p>}
            {warns.map((w: any) => {
              const p = profileMap.get(w.user_id);
              return (
                <div key={w.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                  <Avatar className="h-9 w-9 mt-0.5"><AvatarImage src={p?.avatar_url || ""} /><AvatarFallback>{(p?.display_name || "?")[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p?.display_name || p?.username || w.user_id.slice(0, 8)}</span>
                      <Badge variant="outline" className="text-[10px]">{SECTION_LABELS[w.section]}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString("it-IT")}</span>
                    </div>
                    <p className="text-xs mt-1">{w.reason}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => revokeWarn(w.id)}><RotateCcw size={13} /></Button>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="timeouts" className="space-y-2">
            {timeouts.length === 0 && <p className="text-sm text-muted-foreground">Nessun time-out attivo.</p>}
            {timeouts.map((t: any) => {
              const p = profileMap.get(t.user_id);
              return (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                  <Avatar className="h-9 w-9 mt-0.5"><AvatarImage src={p?.avatar_url || ""} /><AvatarFallback>{(p?.display_name || "?")[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p?.display_name || p?.username || t.user_id.slice(0, 8)}</span>
                      <Badge className="bg-orange-500 text-white text-[10px]">Fino al {new Date(t.expires_at).toLocaleString("it-IT")}</Badge>
                    </div>
                    <p className="text-xs mt-1">{t.reason}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => revokeTimeout(t.id)}><RotateCcw size={13} /></Button>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="bans" className="space-y-2">
            {bans.length === 0 && <p className="text-sm text-muted-foreground">Nessun ban attivo.</p>}
            {bans.map((b: any) => {
              const p = profileMap.get(b.user_id);
              return (
                <div key={b.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                  <Avatar className="h-9 w-9 mt-0.5"><AvatarImage src={p?.avatar_url || ""} /><AvatarFallback>{(p?.display_name || "?")[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p?.display_name || p?.username || b.user_id.slice(0, 8)}</span>
                      <Badge variant="destructive" className="text-[10px]">
                        {b.expires_at ? `Fino al ${new Date(b.expires_at).toLocaleDateString("it-IT")}` : "Permanente"}
                      </Badge>
                    </div>
                    <p className="text-xs mt-1">{b.reason}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => revokeBan(b.id)}><RotateCcw size={13} /></Button>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>

      {target && action && (
        <ModerationActionDialog
          open={!!action}
          onOpenChange={(o) => { if (!o) { setAction(null); setTarget(null); fetchAll(); } }}
          action={action}
          targetUserId={target.user_id}
          targetUserName={target.display_name || target.username || undefined}
          onApplied={fetchAll}
        />
      )}
    </Card>
  );
};

export default ModerationAdminTab;
