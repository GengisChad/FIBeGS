import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Search, Merge, Pencil, Copy, Users, RefreshCw, Mail, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AdminPagination, { useAdminPagination } from "./AdminPagination";

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  region_id: string | null;
  points: number;
  wins: number;
  bio: string | null;
  created_at: string;
}

const UserManagementTab = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Edit dialog
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ username: "", display_name: "", city: "", region_id: "", bio: "", email: "" });
  const [originalEmail, setOriginalEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  // Merge dialog
  const [mergeOpen, setMergeOpen] = useState(false);
  const [keepUser, setKeepUser] = useState<Profile | null>(null);
  const [mergeUser, setMergeUser] = useState<Profile | null>(null);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeOptions, setMergeOptions] = useState({
    keepDisplayName: true, keepUsername: true, keepAvatar: true, keepCity: true, keepRegion: true, keepEmail: true,
  });
  const [merging, setMerging] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const pageSize = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase.from("profiles").select("id, user_id, username, display_name, avatar_url, city, region_id, points, wins, bio, created_at").order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    setProfiles(all);
    const { data: regData } = await supabase.from("regions").select("id, name").order("name");
    setRegions(regData ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const s = search.toLowerCase();
    return profiles.filter(p =>
      p.username?.toLowerCase().includes(s) ||
      p.display_name?.toLowerCase().includes(s) ||
      p.user_id.toLowerCase().includes(s) ||
      p.city?.toLowerCase().includes(s)
    );
  }, [profiles, search]);

  const { getPageItems } = useAdminPagination(filtered);
  const paged = getPageItems(page);

  const regionName = (id: string | null) => regions.find(r => r.id === id)?.name || "-";

  const openEdit = async (p: Profile) => {
    setEditUser(p);
    setEditForm({
      username: p.username || "",
      display_name: p.display_name || "",
      city: p.city || "",
      region_id: p.region_id || "",
      bio: p.bio || "",
      email: "",
    });
    setOriginalEmail("");
    // Fetch current email via users_export view
    const { data } = await supabase.from("users_export" as any).select("email").eq("id", p.user_id).maybeSingle();
    const em = (data as any)?.email || "";
    setOriginalEmail(em);
    setEditForm(f => ({ ...f, email: em }));
  };

  const handleChangeEmail = async () => {
    if (!editUser) return;
    if (!editForm.email || editForm.email === originalEmail) return;
    setEmailSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-update-user-email", {
      body: { target_user_id: editUser.user_id, new_email: editForm.email },
    });
    setEmailSaving(false);
    if (error || (data as any)?.error) {
      toast({ title: "Errore", description: (data as any)?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Email aggiornata" });
      setOriginalEmail(editForm.email);
    }
  };

  const handleSendReset = async () => {
    if (!editUser) return;
    setResetSending(true);
    const { data, error } = await supabase.functions.invoke("admin-update-user-email", {
      body: { target_user_id: editUser.user_id, send_reset: true },
    });
    setResetSending(false);
    if (error || (data as any)?.error) {
      toast({ title: "Errore", description: (data as any)?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Email di reset password inviata" });
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    const { data, error } = await supabase.rpc("admin_update_profile" as any, {
      _user_id: editUser.user_id,
      _username: editForm.username || null,
      _display_name: editForm.display_name || null,
      _city: editForm.city || null,
      _region_id: editForm.region_id || null,
      _bio: editForm.bio || null,
    });
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profilo aggiornato" });
      setEditUser(null);
      fetchData();
    }
  };

  const openMerge = (p: Profile) => {
    setKeepUser(p);
    setMergeUser(null);
    setMergeSearch("");
    setMergeOptions({ keepDisplayName: true, keepUsername: true, keepAvatar: true, keepCity: true, keepRegion: true, keepEmail: true });
    setMergeOpen(true);
  };

  const mergeSearchResults = useMemo(() => {
    if (!mergeSearch.trim() || !keepUser) return [];
    const s = mergeSearch.toLowerCase();
    return profiles.filter(p =>
      p.user_id !== keepUser.user_id &&
      (p.username?.toLowerCase().includes(s) || p.display_name?.toLowerCase().includes(s) || p.user_id.toLowerCase().includes(s))
    ).slice(0, 10);
  }, [profiles, mergeSearch, keepUser]);

  const handleMerge = async () => {
    if (!keepUser || !mergeUser) return;
    setMerging(true);
    const { data, error } = await supabase.rpc("admin_merge_users" as any, {
      _keep_user_id: keepUser.user_id,
      _merge_user_id: mergeUser.user_id,
      _keep_display_name: mergeOptions.keepDisplayName,
      _keep_username: mergeOptions.keepUsername,
      _keep_avatar: mergeOptions.keepAvatar,
      _keep_city: mergeOptions.keepCity,
      _keep_region: mergeOptions.keepRegion,
      _keep_email: mergeOptions.keepEmail,
    });
    setMerging(false);
    if (error) {
      toast({ title: "Errore nel merge", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account uniti con successo!" });
      setMergeOpen(false);
      fetchData();
    }
  };

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users size={20} /> Gestione Avanzata Utenti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cerca per username, nome, user_id, città..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw size={16} /></Button>
        </div>

        <div className="text-sm text-muted-foreground">{filtered.length} utenti trovati</div>

        <div className="space-y-2">
          {paged.map((p: Profile) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition">
              <Avatar className="h-10 w-10">
                <AvatarImage src={p.avatar_url || ""} />
                <AvatarFallback>{(p.display_name || p.username || "?")[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{p.display_name || p.username || "Senza nome"}</span>
                  {p.username && <Badge variant="outline" className="text-[10px]">@{p.username}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground flex gap-3 flex-wrap mt-0.5">
                  <span className="font-mono">{p.user_id.slice(0, 8)}...</span>
                  <span>{p.city || "-"}</span>
                  <span>{regionName(p.region_id)}</span>
                  <span>{p.points}pt / {p.wins}W</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Modifica"><Pencil size={14} /></Button>
                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(p.user_id); toast({ title: "User ID copiato" }); }} title="Copia ID"><Copy size={14} /></Button>
                <Button variant="ghost" size="icon" onClick={() => openMerge(p)} title="Unisci account"><Merge size={14} /></Button>
              </div>
            </div>
          ))}
        </div>

        <AdminPagination totalItems={filtered.length} page={page} onPageChange={setPage} />

        {/* Edit Dialog */}
        <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Modifica Profilo</DialogTitle></DialogHeader>
            {editUser && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground font-mono">User ID: {editUser.user_id}</div>
                <div className="space-y-1">
                  <Label>Username</Label>
                  <Input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Display Name</Label>
                  <Input value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Città</Label>
                  <Input value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Regione</Label>
                  <Select value={editForm.region_id} onValueChange={v => setEditForm(f => ({ ...f, region_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Bio</Label>
                  <Input value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} />
                </div>
                <div className="space-y-1 pt-3 border-t border-border">
                  <Label className="flex items-center gap-1.5"><Mail size={14} /> Email Account</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                    <Button
                      size="sm"
                      onClick={handleChangeEmail}
                      disabled={emailSaving || !editForm.email || editForm.email === originalEmail}
                    >
                      {emailSaving ? "..." : "Cambia"}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={handleSendReset}
                    disabled={resetSending || !originalEmail}
                  >
                    <KeyRound size={14} className="mr-1.5" />
                    {resetSending ? "Invio..." : "Invia email reset password"}
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>Annulla</Button>
              <Button onClick={handleSaveEdit}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Merge Dialog */}
        <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Unisci Account</DialogTitle></DialogHeader>
            {keepUser && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Account da mantenere</Label>
                  <div className="flex items-center gap-2 p-2 rounded border border-primary/30 bg-primary/5 mt-1">
                    <Avatar className="h-8 w-8"><AvatarImage src={keepUser.avatar_url || ""} /><AvatarFallback>{(keepUser.display_name || "?")[0]}</AvatarFallback></Avatar>
                    <div>
                      <div className="text-sm font-medium">{keepUser.display_name || keepUser.username}</div>
                      <div className="text-xs text-muted-foreground font-mono">{keepUser.user_id.slice(0, 12)}...</div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Account da unire (verrà eliminato)</Label>
                  <Input placeholder="Cerca per username, nome o user_id..." value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} className="mt-1" />
                  {mergeSearchResults.length > 0 && !mergeUser && (
                    <div className="mt-1 border rounded max-h-40 overflow-auto">
                      {mergeSearchResults.map(p => (
                        <button key={p.id} className="w-full flex items-center gap-2 p-2 hover:bg-secondary/50 text-left" onClick={() => { setMergeUser(p); setMergeSearch(""); }}>
                          <Avatar className="h-6 w-6"><AvatarImage src={p.avatar_url || ""} /><AvatarFallback>{(p.display_name || "?")[0]}</AvatarFallback></Avatar>
                          <span className="text-sm">{p.display_name || p.username} <span className="text-muted-foreground">@{p.username}</span></span>
                        </button>
                      ))}
                    </div>
                  )}
                  {mergeUser && (
                    <div className="flex items-center gap-2 p-2 rounded border border-destructive/30 bg-destructive/5 mt-1">
                      <Avatar className="h-8 w-8"><AvatarImage src={mergeUser.avatar_url || ""} /><AvatarFallback>{(mergeUser.display_name || "?")[0]}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{mergeUser.display_name || mergeUser.username}</div>
                        <div className="text-xs text-muted-foreground font-mono">{mergeUser.user_id.slice(0, 12)}...</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setMergeUser(null)}>Cambia</Button>
                    </div>
                  )}
                </div>

                {mergeUser && (
                  <div className="space-y-2 border rounded p-3">
                    <Label className="text-xs font-semibold">Quali dati mantenere dall'account principale?</Label>
                    {[
                      { key: "keepDisplayName", label: `Nome: "${keepUser.display_name}" vs "${mergeUser.display_name}"` },
                      { key: "keepUsername", label: `Username: "${keepUser.username}" vs "${mergeUser.username}"` },
                      { key: "keepAvatar", label: "Avatar" },
                      { key: "keepCity", label: `Città: "${keepUser.city}" vs "${mergeUser.city}"` },
                      { key: "keepRegion", label: "Regione" },
                      { key: "keepEmail", label: "Email account (l'altra email verrà indicata come da eliminare manualmente)" },
                    ].map(opt => (
                      <div key={opt.key} className="flex items-center gap-2">
                        <Checkbox
                          checked={(mergeOptions as any)[opt.key]}
                          onCheckedChange={v => setMergeOptions(o => ({ ...o, [opt.key]: !!v }))}
                        />
                        <span className="text-xs">{opt.label}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      ✓ = usa dati dell'account principale. ✗ = usa dati dell'account da eliminare.
                      Risultati tornei, match, badge, post e iscrizioni saranno tutti trasferiti all'account principale.
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMergeOpen(false)}>Annulla</Button>
              <Button variant="destructive" onClick={handleMerge} disabled={!mergeUser || merging}>
                {merging ? "Unione in corso..." : "Unisci Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default UserManagementTab;
