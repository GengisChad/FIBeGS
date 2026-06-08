import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Award, UserPlus, Upload, X, Pencil } from "lucide-react";
import AdminPagination, { useAdminPagination } from "@/components/admin/AdminPagination";

interface BadgeItem {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  color: string;
  created_at: string;
}

interface UserBadgeRow {
  id: string;
  user_id: string;
  badge_id: string;
  assigned_at: string;
}

const BadgesAdminTab = () => {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadgeRow[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIconUrl, setNewIconUrl] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const [assignBadgeId, setAssignBadgeId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");

  // Edit state
  const [editBadge, setEditBadge] = useState<BadgeItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIconUrl, setEditIconUrl] = useState("");
  const [uploadingEditIcon, setUploadingEditIcon] = useState(false);
  const editIconInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(0);

  const fetchAll = async () => {
    const [{ data: b }, { data: ub }, { data: p }] = await Promise.all([
      supabase.from("badges" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("user_badges" as any).select("*"),
      supabase.from("profiles").select("user_id, display_name, username"),
    ]);
    setBadges((b as any[]) ?? []);
    setUserBadges((ub as any[]) ?? []);
    setProfiles(p ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const getProfileName = (userId: string) => {
    const p = profiles.find((p) => p.user_id === userId);
    return p?.display_name || p?.username || "Utente";
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Seleziona un file immagine", variant: "destructive" }); return; }
    setUploadingIcon(true);
    try { file = await prepareImageForUpload(file, { maxDimension: 512, preservePng: true }); }
    catch (err: any) { toast({ title: err?.message || "Immagine non valida", variant: "destructive" }); setUploadingIcon(false); return; }
    const ext = file.name.split(".").pop();
    const path = `badges/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("collection-images").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast({ title: "Errore nel caricamento", variant: "destructive" }); setUploadingIcon(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("collection-images").getPublicUrl(path);
    setNewIconUrl(publicUrl);
    setUploadingIcon(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast({ title: "Inserisci un nome", variant: "destructive" }); return; }
    if (!newIconUrl) { toast({ title: "Carica un'immagine per il badge", variant: "destructive" }); return; }
    const { error } = await supabase.from("badges" as any).insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      color: "#000000",
      icon_url: newIconUrl,
    } as any);
    if (error) { toast({ title: "Errore nella creazione", variant: "destructive" }); return; }
    toast({ title: "Badge creato!" });
    setShowCreate(false);
    setNewName(""); setNewDesc(""); setNewIconUrl("");
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Eliminare questo badge? Verrà rimosso da tutti gli utenti.")) return;
    await supabase.from("badges" as any).delete().eq("id", id);
    toast({ title: "Badge eliminato" });
    fetchAll();
  };

  const handleAssign = async () => {
    if (!assignBadgeId || !assignUserId) return;
    const { error } = await supabase.from("user_badges" as any).insert({
      user_id: assignUserId,
      badge_id: assignBadgeId,
    } as any);
    if (error) {
      if (error.code === "23505") toast({ title: "L'utente ha già questo badge", variant: "destructive" });
      else toast({ title: "Errore nell'assegnazione", variant: "destructive" });
      return;
    }
    toast({ title: "Badge assegnato!" });
    setAssignBadgeId(null); setAssignUserId("");
    fetchAll();
  };

  const handleRemoveUserBadge = async (ubId: string) => {
    await supabase.from("user_badges" as any).delete().eq("id", ubId);
    toast({ title: "Badge rimosso dall'utente" });
    fetchAll();
  };

  const openEdit = (b: BadgeItem) => {
    setEditBadge(b);
    setEditName(b.name);
    setEditDesc(b.description || "");
    setEditIconUrl(b.icon_url || "");
  };

  const handleEditIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Seleziona un file immagine", variant: "destructive" }); return; }
    setUploadingEditIcon(true);
    try { file = await prepareImageForUpload(file, { maxDimension: 512, preservePng: true }); }
    catch (err: any) { toast({ title: err?.message || "Immagine non valida", variant: "destructive" }); setUploadingEditIcon(false); return; }
    const ext = file.name.split(".").pop();
    const path = `badges/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("collection-images").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast({ title: "Errore nel caricamento", variant: "destructive" }); setUploadingEditIcon(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("collection-images").getPublicUrl(path);
    setEditIconUrl(publicUrl);
    setUploadingEditIcon(false);
  };

  const handleUpdate = async () => {
    if (!editBadge || !editName.trim()) { toast({ title: "Inserisci un nome", variant: "destructive" }); return; }
    const { error } = await supabase.from("badges" as any).update({
      name: editName.trim(),
      description: editDesc.trim() || null,
      icon_url: editIconUrl || null,
    } as any).eq("id", editBadge.id);
    if (error) { toast({ title: "Errore nell'aggiornamento", variant: "destructive" }); return; }
    toast({ title: "Badge aggiornato!" });
    setEditBadge(null);
    fetchAll();
  };

  const { getPageItems, totalPages } = useAdminPagination(badges);
  const pagedBadges = getPageItems(page);

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Award size={20} /> Gestione Badge ({badges.length})
            </CardTitle>
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus size={14} className="mr-1" /> Nuovo Badge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <p className="text-muted-foreground">Nessun badge creato.</p>
          ) : (
            <>
              <div className="overflow-x-auto" style={{ display: 'block' }}>
              <Table className="[display:table] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Badge</TableHead>
                    <TableHead className="min-w-[200px]">Descrizione</TableHead>
                    <TableHead className="whitespace-nowrap">Assegnati</TableHead>
                    <TableHead className="min-w-[250px]">Utenti</TableHead>
                    <TableHead className="whitespace-nowrap">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedBadges.map((b) => {
                    const assigned = userBadges.filter((ub) => ub.badge_id === b.id);
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {b.icon_url ? (
                              <img src={b.icon_url} alt={b.name} className="w-10 h-10 object-contain shrink-0" />
                            ) : (
                              <Award size={24} className="text-muted-foreground shrink-0" />
                            )}
                            <span className="font-medium">{b.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {b.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{assigned.length}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {assigned.map((ub) => (
                              <Badge key={ub.id} variant="secondary" className="text-[10px] gap-1">
                                {getProfileName(ub.user_id)}
                                <button onClick={() => handleRemoveUserBadge(ub.id)} className="hover:text-destructive">
                                  <Trash2 size={10} />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                              <Pencil size={14} />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setAssignBadgeId(b.id); setAssignUserId(""); }}>
                              <UserPlus size={14} />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(b.id)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              <AdminPagination page={page} totalItems={badges.length} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Badge Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crea nuovo Badge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="es. Campione Regionale" className="mt-1" />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="es. Vincitore del torneo regionale" className="mt-1" />
            </div>
            <div>
              <Label>Immagine Badge *</Label>
              <div className="mt-2 flex flex-col items-center gap-3">
                {newIconUrl ? (
                  <div className="relative">
                    <img src={newIconUrl} alt="Badge" className="w-20 h-20 object-contain" />
                    <button
                      onClick={() => setNewIconUrl("")}
                      className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => iconInputRef.current?.click()}
                    disabled={uploadingIcon}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {uploadingIcon ? (
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload size={20} />
                        <span className="text-[10px]">Carica</span>
                      </>
                    )}
                  </button>
                )}
                <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                <span className="text-xs text-muted-foreground">PNG o JPG, max 2MB</span>
              </div>
            </div>
            {/* Preview */}
            {newIconUrl && newName && (
              <div className="flex flex-col items-center gap-1.5 p-4 bg-secondary/50 rounded-lg">
                <span className="text-xs text-muted-foreground">Anteprima profilo:</span>
                <div className="flex flex-col items-center gap-1">
                  <img src={newIconUrl} alt="" className="w-10 h-10 object-contain" />
                  <span className="text-[10px] font-medium text-muted-foreground">{newName}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annulla</Button>
            <Button onClick={handleCreate}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Badge Dialog */}
      <Dialog open={!!assignBadgeId} onOpenChange={(o) => !o && setAssignBadgeId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assegna Badge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Utente</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleziona utente..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.display_name || p.username || "Utente"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignBadgeId(null)}>Annulla</Button>
            <Button onClick={handleAssign} disabled={!assignUserId}>Assegna</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Badge Dialog */}
      <Dialog open={!!editBadge} onOpenChange={(o) => !o && setEditBadge(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica Badge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Immagine Badge</Label>
              <div className="mt-2 flex flex-col items-center gap-3">
                {editIconUrl ? (
                  <div className="relative">
                    <img src={editIconUrl} alt="Badge" className="w-20 h-20 object-contain" />
                    <button
                      onClick={() => setEditIconUrl("")}
                      className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => editIconInputRef.current?.click()}
                    disabled={uploadingEditIcon}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {uploadingEditIcon ? (
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload size={20} />
                        <span className="text-[10px]">Carica</span>
                      </>
                    )}
                  </button>
                )}
                <input ref={editIconInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditIconUpload} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBadge(null)}>Annulla</Button>
            <Button onClick={handleUpdate}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BadgesAdminTab;
