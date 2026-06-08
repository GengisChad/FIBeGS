import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/forum/RichTextEditor";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Trophy, Image, Users, X, Search } from "lucide-react";
import AdminPagination, { useAdminPagination } from "@/components/admin/AdminPagination";

interface Championship {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rules_text: string | null;
  banner_url: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  club_required: boolean;
  created_at: string;
}

interface Sponsor {
  id: string;
  championship_id: string;
  name: string;
  logo_url: string;
  link_url: string | null;
  sort_order: number;
}

interface Manager {
  id: string;
  user_id: string;
  championship_id: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  rules_text: "",
  banner_url: "",
  logo_url: "",
  primary_color: "#FFD700",
  secondary_color: "#1a1a2e",
  is_active: true,
  club_required: false,
};

const ChampionshipsAdminTab = () => {
  const { user } = useAuth();
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Championship | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);

  // Sponsors
  const [sponsorsDialogOpen, setSponsorsDialogOpen] = useState(false);
  const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorForm, setSponsorForm] = useState({ name: "", logo_url: "", link_url: "" });

  // Managers
  const [managersDialogOpen, setManagersDialogOpen] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [managerSearch, setManagerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchChampionships = async () => {
    const { data } = await supabase
      .from("championships")
      .select("id, name, slug, description, banner_url, logo_url, primary_color, secondary_color, club_required, is_active, rules_text, created_at")
      .order("created_at", { ascending: false });
    setChampionships((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchChampionships(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Championship) => {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      rules_text: c.rules_text || "",
      banner_url: c.banner_url || "",
      logo_url: c.logo_url || "",
      primary_color: c.primary_color || "#FFD700",
      secondary_color: c.secondary_color || "#1a1a2e",
      is_active: c.is_active,
      club_required: c.club_required,
    });
    setDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Nome e slug sono obbligatori");
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      rules_text: form.rules_text.trim() || null,
      banner_url: form.banner_url.trim() || null,
      logo_url: form.logo_url.trim() || null,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      is_active: form.is_active,
      club_required: form.club_required,
    };

    if (editing) {
      const { error } = await supabase.from("championships").update(payload).eq("id", editing.id);
      if (error) toast.error("Errore nel salvataggio");
      else toast.success("Campionato aggiornato");
    } else {
      const { error } = await supabase.from("championships").insert({ ...payload, created_by: user!.id } as any);
      if (error) {
        if (error.code === "23505") toast.error("Slug già in uso");
        else toast.error("Errore nella creazione");
      } else toast.success("Campionato creato");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchChampionships();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo campionato? Tutti i tornei associati verranno scollegati.")) return;
    await supabase.from("championships").delete().eq("id", id);
    toast.success("Campionato eliminato");
    fetchChampionships();
  };

  // Sponsors management
  const openSponsors = async (c: Championship) => {
    setSelectedChampionship(c);
    const { data } = await supabase
      .from("championship_sponsors")
      .select("id, championship_id, name, logo_url, link_url, sort_order")
      .eq("championship_id", c.id)
      .order("sort_order");
    setSponsors((data as any) ?? []);
    setSponsorForm({ name: "", logo_url: "", link_url: "" });
    setSponsorsDialogOpen(true);
  };

  const addSponsor = async () => {
    if (!sponsorForm.name.trim() || !sponsorForm.logo_url.trim() || !selectedChampionship) return;
    const { error } = await supabase.from("championship_sponsors").insert({
      championship_id: selectedChampionship.id,
      name: sponsorForm.name.trim(),
      logo_url: sponsorForm.logo_url.trim(),
      link_url: sponsorForm.link_url.trim() || null,
      sort_order: sponsors.length,
    } as any);
    if (error) toast.error("Errore");
    else {
      toast.success("Sponsor aggiunto");
      setSponsorForm({ name: "", logo_url: "", link_url: "" });
      openSponsors(selectedChampionship);
    }
  };

  const removeSponsor = async (id: string) => {
    await supabase.from("championship_sponsors").delete().eq("id", id);
    if (selectedChampionship) openSponsors(selectedChampionship);
  };

  // Managers management
  const openManagers = async (c: Championship) => {
    setSelectedChampionship(c);
    setManagerSearch("");
    setSearchResults([]);

    const { data } = await supabase
      .from("championship_managers")
      .select("id, championship_id, user_id")
      .eq("championship_id", c.id);

    const managerData = (data as any) ?? [];

    // Fetch profiles for managers
    if (managerData.length > 0) {
      const userIds = managerData.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { profileMap[p.user_id] = p; });

      managerData.forEach((m: any) => { m.profile = profileMap[m.user_id] || null; });
    }

    setManagers(managerData);
    setManagersDialogOpen(true);
  };

  const searchSponsorUsers = async (query: string) => {
    setManagerSearch(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);

    // Search any user by username or display name
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(20);

    // Filter out already assigned managers
    const existingIds = managers.map(m => m.user_id);
    setSearchResults((profiles ?? []).filter(p => !existingIds.includes(p.user_id)));
    setSearching(false);
  };

  const addManager = async (userId: string) => {
    if (!selectedChampionship) return;
    const { error } = await supabase.from("championship_managers").insert({
      championship_id: selectedChampionship.id,
      user_id: userId,
    } as any);
    if (error) toast.error("Errore nell'aggiunta");
    else {
      toast.success("Gestore aggiunto");
      openManagers(selectedChampionship);
    }
  };

  const removeManager = async (id: string) => {
    await supabase.from("championship_managers").delete().eq("id", id);
    if (selectedChampionship) openManagers(selectedChampionship);
  };

  const { getPageItems } = useAdminPagination(championships);
  const pagedChampionships = getPageItems(page);

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Trophy size={20} className="text-primary" /> Campionati Speciali ({championships.length})
            </CardTitle>
            <Button onClick={openCreate} className="gap-2">
              <Plus size={16} /> Nuovo Campionato
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {championships.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessun campionato creato</p>
          ) : (
            <div className="space-y-3">
              {pagedChampionships.map((c) => (
                <div key={c.id} className="p-4 rounded-xl bg-secondary/30 border border-border flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Trophy size={18} className="text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
                          {c.is_active ? "Attivo" : "Inattivo"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">/campionati/{c.slug}</span>
                        {c.club_required && (
                          <Badge variant="outline" className="text-[10px]">Club richiesto</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openManagers(c)} className="gap-1">
                      <Users size={14} /> Gestori
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openSponsors(c)} className="gap-1">
                      <Image size={14} /> Sponsor
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <AdminPagination page={page} totalItems={championships.length} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica Campionato" : "Nuovo Campionato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    name,
                    slug: !editing ? generateSlug(name) : prev.slug,
                  }));
                }}
                placeholder="Es. Campionato Regionale Lombardia"
              />
            </div>
            <div>
              <Label>Slug URL *</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="campionato-lombardia"
              />
              <p className="text-xs text-muted-foreground mt-1">URL: /campionati/{form.slug || "..."}</p>
            </div>
            <div>
              <Label>Descrizione</Label>
              <RichTextEditor
                initialContent={form.description}
                onChange={(html) => setForm(prev => ({ ...prev, description: html }))}
                placeholder="Descrizione del campionato..."
              />
            </div>
            <div>
              <Label>Regolamento</Label>
              <RichTextEditor
                initialContent={form.rules_text}
                onChange={(html) => setForm(prev => ({ ...prev, rules_text: html }))}
                placeholder="Regole specifiche del campionato..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>URL Banner</Label>
                <Input
                  value={form.banner_url}
                  onChange={(e) => setForm(prev => ({ ...prev, banner_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>URL Logo</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm(prev => ({ ...prev, logo_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Colore Primario</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-10 h-10 rounded border border-border cursor-pointer"
                  />
                  <Input value={form.primary_color} onChange={(e) => setForm(prev => ({ ...prev, primary_color: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Colore Secondario</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.secondary_color}
                    onChange={(e) => setForm(prev => ({ ...prev, secondary_color: e.target.value }))}
                    className="w-10 h-10 rounded border border-border cursor-pointer"
                  />
                  <Input value={form.secondary_color} onChange={(e) => setForm(prev => ({ ...prev, secondary_color: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Attivo</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(prev => ({ ...prev, is_active: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Club richiesto per iscrizione</Label>
                <p className="text-xs text-muted-foreground">I giocatori devono appartenere a un club</p>
              </div>
              <Switch checked={form.club_required} onCheckedChange={(v) => setForm(prev => ({ ...prev, club_required: v }))} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvataggio..." : editing ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sponsors Dialog */}
      <Dialog open={sponsorsDialogOpen} onOpenChange={setSponsorsDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sponsor - {selectedChampionship?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {sponsors.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 border border-border">
                <img src={s.logo_url} alt={s.name} className="w-10 h-10 rounded object-contain bg-white p-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {s.link_url && <p className="text-xs text-muted-foreground truncate">{s.link_url}</p>}
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeSponsor(s.id)}>
                  <X size={14} />
                </Button>
              </div>
            ))}

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Aggiungi Sponsor</p>
              <Input
                value={sponsorForm.name}
                onChange={(e) => setSponsorForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome sponsor"
              />
              <Input
                value={sponsorForm.logo_url}
                onChange={(e) => setSponsorForm(prev => ({ ...prev, logo_url: e.target.value }))}
                placeholder="URL logo sponsor"
              />
              <Input
                value={sponsorForm.link_url}
                onChange={(e) => setSponsorForm(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="Link sito (opzionale)"
              />
              <Button onClick={addSponsor} disabled={!sponsorForm.name.trim() || !sponsorForm.logo_url.trim()} className="w-full gap-2">
                <Plus size={16} /> Aggiungi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Managers Dialog */}
      <Dialog open={managersDialogOpen} onOpenChange={setManagersDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users size={18} /> Gestori - {selectedChampionship?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Qualsiasi utente può essere assegnato come gestore: avrà un ruolo temporaneo legato al campionato e potrà creare/gestire i tornei e modificare le impostazioni. Quando il campionato non è più attivo non sarà più possibile modificare i gestori.
            </p>

            {/* Current managers */}
            {managers.length > 0 ? (
              <div className="space-y-2">
                {managers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                    {m.profile?.avatar_url ? (
                      <img src={m.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {(m.profile?.display_name || m.profile?.username || "?")[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.profile?.display_name || m.profile?.username || "Utente sconosciuto"}
                      </p>
                      {m.profile?.username && (
                        <p className="text-xs text-muted-foreground">@{m.profile.username}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">Gestore</Badge>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeManager(m.id)}>
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun gestore assegnato</p>
            )}

            {/* Search */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Aggiungi Gestore</p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={managerSearch}
                  onChange={(e) => searchSponsorUsers(e.target.value)}
                  placeholder="Cerca utenti per nome o username..."
                  className="pl-9"
                />
              </div>
              {searching && <p className="text-xs text-muted-foreground">Ricerca...</p>}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((p) => (
                    <div key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {(p.display_name || p.username || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.display_name || p.username}</p>
                        {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                      </div>
                      <Button size="sm" onClick={() => addManager(p.user_id)} className="gap-1 shrink-0">
                        <Plus size={14} /> Aggiungi
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {managerSearch.length >= 2 && searchResults.length === 0 && !searching && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nessun utente trovato.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChampionshipsAdminTab;
