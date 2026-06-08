import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Mail, Heart, Clock, Compass } from "lucide-react";
import RegionalReferentsAdminTab from "./RegionalReferentsAdminTab";

/* ─── Contact Categories ─── */
const ContactCategoriesSection = () => {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from("faq_contact_categories").select("*").order("sort_order");
    setItems(data ?? []);
  };
  useEffect(() => { fetch(); }, []);

  const save = async () => {
    if (!editing?.name?.trim()) return;
    if (editing.id) {
      await supabase.from("faq_contact_categories").update(editing).eq("id", editing.id);
    } else {
      await supabase.from("faq_contact_categories").insert(editing);
    }
    setOpen(false); setEditing(null); fetch();
    toast({ title: "Salvato!" });
  };

  const remove = async (id: string) => {
    await supabase.from("faq_contact_categories").delete().eq("id", id);
    fetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2"><Mail size={18} /> Categorie Contatto</CardTitle>
        <Button size="sm" onClick={() => { setEditing({ name: "", description: "", email: "", icon: "Mail", sort_order: items.length, is_active: true }); setOpen(true); }}>
          <Plus size={14} className="mr-1" /> Aggiungi
        </Button>
      </CardHeader>
      <CardContent>
        {/* Mobile */}
        <div className="sm:hidden space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{item.name}</span>
                <Badge variant={item.is_active ? "default" : "secondary"} className="text-[10px]">{item.is_active ? "Attivo" : "No"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{item.email || "Nessuna email"} · {item.icon} · #{item.sort_order}</p>
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(item); setOpen(true); }}><Pencil size={12} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(item.id)}><Trash2 size={12} className="text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Icona</TableHead>
                <TableHead>Ordine</TableHead>
                <TableHead>Attivo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.email || "-"}</TableCell>
                  <TableCell>{item.icon}</TableCell>
                  <TableCell>{item.sort_order}</TableCell>
                  <TableCell><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Sì" : "No"}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setOpen(true); }}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Modifica" : "Nuova"} Categoria</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing?.name || ""} onChange={e => setEditing((p: any) => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Descrizione</Label><Textarea value={editing?.description || ""} onChange={e => setEditing((p: any) => ({ ...p, description: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={editing?.email || ""} onChange={e => setEditing((p: any) => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Icona (lucide)</Label>
                <Select value={editing?.icon || "Mail"} onValueChange={v => setEditing((p: any) => ({ ...p, icon: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Mail", "Handshake", "Building2", "MessageSquare", "Heart", "Star", "Crown"].map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ordine</Label><Input type="number" value={editing?.sort_order ?? 0} onChange={e => setEditing((p: any) => ({ ...p, sort_order: +e.target.value }))} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editing?.is_active ?? true} onCheckedChange={v => setEditing((p: any) => ({ ...p, is_active: v }))} />
                <Label>Attivo</Label>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Salva</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ─── Supporters ─── */
const SupportersSection = () => {
  const [items, setItems] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const fetchAll = async () => {
    const [{ data: s }, { data: b }] = await Promise.all([
      supabase.from("faq_supporters").select("*").order("sort_order"),
      supabase.from("badges").select("id, name"),
    ]);
    setItems(s ?? []);
    setBadges(b ?? []);
  };
  useEffect(() => { fetchAll(); }, []);

  const save = async () => {
    if (!editing?.display_name?.trim()) return;
    const { id, ...rest } = editing;
    if (!rest.badge_id) rest.badge_id = null;
    if (!rest.user_id) rest.user_id = null;
    
    if (id) {
      await supabase.from("faq_supporters").update(rest).eq("id", id);
    } else {
      await supabase.from("faq_supporters").insert(rest);
    }
    setOpen(false); setEditing(null); fetchAll();
    toast({ title: "Salvato!" });
  };

  const remove = async (id: string) => {
    await supabase.from("faq_supporters").delete().eq("id", id);
    fetchAll();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2"><Heart size={18} /> Supporters & Donatori</CardTitle>
        <Button size="sm" onClick={() => { setEditing({ display_name: "", avatar_url: "", tier: "supporter", message: "", badge_id: null, user_id: null, sort_order: items.length, is_active: true }); setOpen(true); }}>
          <Plus size={14} className="mr-1" /> Aggiungi
        </Button>
      </CardHeader>
      <CardContent>
        {/* Mobile */}
        <div className="sm:hidden space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{item.display_name}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{item.tier}</Badge>
                  <Badge variant={item.is_active ? "default" : "secondary"} className="text-[10px]">{item.is_active ? "Attivo" : "No"}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Badge: {badges.find(b => b.id === item.badge_id)?.name || "-"}
                {item.user_id ? ` · ${item.user_id.slice(0, 8)}...` : ""}
              </p>
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(item); setOpen(true); }}><Pencil size={12} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(item.id)}><Trash2 size={12} className="text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Attivo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.display_name}</TableCell>
                  <TableCell><Badge variant="outline">{item.tier}</Badge></TableCell>
                  <TableCell className="text-sm">{badges.find(b => b.id === item.badge_id)?.name || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{item.user_id ? item.user_id.slice(0, 8) + "..." : "-"}</TableCell>
                  <TableCell><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Sì" : "No"}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setOpen(true); }}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Modifica" : "Nuovo"} Supporter</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome visualizzato</Label><Input value={editing?.display_name || ""} onChange={e => setEditing((p: any) => ({ ...p, display_name: e.target.value }))} /></div>
              <div><Label>Avatar URL</Label><Input value={editing?.avatar_url || ""} onChange={e => setEditing((p: any) => ({ ...p, avatar_url: e.target.value }))} /></div>
              <div><Label>Tier</Label>
                <Select value={editing?.tier || "supporter"} onValueChange={v => setEditing((p: any) => ({ ...p, tier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supporter">Supporter</SelectItem>
                    <SelectItem value="donor">Donatore</SelectItem>
                    <SelectItem value="sponsor">Sponsor</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Messaggio (opzionale)</Label><Input value={editing?.message || ""} onChange={e => setEditing((p: any) => ({ ...p, message: e.target.value }))} /></div>
              <div><Label>Badge (auto-assegnato se user_id impostato)</Label>
                <Select value={editing?.badge_id || "none"} onValueChange={v => setEditing((p: any) => ({ ...p, badge_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {badges.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>User ID (UUID, opzionale)</Label><Input value={editing?.user_id || ""} onChange={e => setEditing((p: any) => ({ ...p, user_id: e.target.value || null }))} placeholder="UUID dell'utente" /></div>
              <div><Label>Ordine</Label><Input type="number" value={editing?.sort_order ?? 0} onChange={e => setEditing((p: any) => ({ ...p, sort_order: +e.target.value }))} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editing?.is_active ?? true} onCheckedChange={v => setEditing((p: any) => ({ ...p, is_active: v }))} />
                <Label>Attivo</Label>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Salva</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ─── History Entries ─── */
const HistorySection = () => {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from("faq_history_entries").select("*").order("sort_order");
    setItems(data ?? []);
  };
  useEffect(() => { fetch(); }, []);

  const save = async () => {
    if (!editing?.title?.trim() || !editing?.year) return;
    if (editing.id) {
      await supabase.from("faq_history_entries").update(editing).eq("id", editing.id);
    } else {
      await supabase.from("faq_history_entries").insert(editing);
    }
    setOpen(false); setEditing(null); fetch();
    toast({ title: "Salvato!" });
  };

  const remove = async (id: string) => {
    await supabase.from("faq_history_entries").delete().eq("id", id);
    fetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2"><Clock size={18} /> Timeline Storia</CardTitle>
        <Button size="sm" onClick={() => { setEditing({ year: new Date().getFullYear(), month: null, title: "", description: "", image_url: "", generation: "", sort_order: items.length }); setOpen(true); }}>
          <Plus size={14} className="mr-1" /> Aggiungi
        </Button>
      </CardHeader>
      <CardContent>
        {/* Mobile */}
        <div className="sm:hidden space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary text-sm">{item.year}</span>
                  {item.month && <span className="text-xs text-muted-foreground">/{item.month}</span>}
                </div>
                <Badge variant="outline" className="text-[10px]">{item.generation || "-"}</Badge>
              </div>
              <p className="text-sm font-medium line-clamp-1">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.image_url ? "📷 " : ""}#{item.sort_order}
              </p>
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(item); setOpen(true); }}><Pencil size={12} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(item.id)}><Trash2 size={12} className="text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anno</TableHead>
                <TableHead>Mese</TableHead>
                <TableHead>Titolo</TableHead>
                <TableHead>Generazione</TableHead>
                <TableHead>Immagine</TableHead>
                <TableHead>Ordine</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold text-primary">{item.year}</TableCell>
                  <TableCell>{item.month || "-"}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{item.title}</TableCell>
                  <TableCell><Badge variant="outline">{item.generation || "-"}</Badge></TableCell>
                  <TableCell>{item.image_url ? "✓" : "-"}</TableCell>
                  <TableCell>{item.sort_order}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setOpen(true); }}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Modifica" : "Nuova"} Voce Timeline</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Anno</Label><Input type="number" value={editing?.year || ""} onChange={e => setEditing((p: any) => ({ ...p, year: +e.target.value }))} /></div>
                <div><Label>Mese (opzionale)</Label><Input type="number" min={1} max={12} value={editing?.month || ""} onChange={e => setEditing((p: any) => ({ ...p, month: e.target.value ? +e.target.value : null }))} /></div>
              </div>
              <div><Label>Titolo</Label><Input value={editing?.title || ""} onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Descrizione</Label><Textarea value={editing?.description || ""} onChange={e => setEditing((p: any) => ({ ...p, description: e.target.value }))} rows={4} /></div>
              <div><Label>URL Immagine</Label><Input value={editing?.image_url || ""} onChange={e => setEditing((p: any) => ({ ...p, image_url: e.target.value }))} /></div>
              <div><Label>Generazione/Era (es. "1ª Gen", "Beyblade X")</Label><Input value={editing?.generation || ""} onChange={e => setEditing((p: any) => ({ ...p, generation: e.target.value }))} /></div>
              <div><Label>Ordine</Label><Input type="number" value={editing?.sort_order ?? 0} onChange={e => setEditing((p: any) => ({ ...p, sort_order: +e.target.value }))} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Salva</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ─── Main Tab ─── */
const FaqAdminTab = () => {
  return (
    <Tabs defaultValue="contacts" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="contacts"><Mail size={14} className="mr-1" /> Contatti</TabsTrigger>
        <TabsTrigger value="supporters"><Heart size={14} className="mr-1" /> Supporters</TabsTrigger>
        <TabsTrigger value="referents"><Compass size={14} className="mr-1" /> Referenti Regionali</TabsTrigger>
        <TabsTrigger value="history"><Clock size={14} className="mr-1" /> Storia</TabsTrigger>
      </TabsList>
      <TabsContent value="contacts"><ContactCategoriesSection /></TabsContent>
      <TabsContent value="supporters"><SupportersSection /></TabsContent>
      <TabsContent value="referents"><RegionalReferentsAdminTab /></TabsContent>
      <TabsContent value="history"><HistorySection /></TabsContent>
    </Tabs>
  );
};

export default FaqAdminTab;
