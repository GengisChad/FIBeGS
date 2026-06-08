import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Check, X, Box } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Model3D {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  download_url: string;
  category: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const categories = [
  { value: "stadium", label: "Stadi" },
  { value: "accessory", label: "Accessori" },
  { value: "part", label: "Parti" },
  { value: "altro", label: "Altro" },
];

const Ranked3DModelsAdminTab = () => {
  const [models, setModels] = useState<Model3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Model3D | null>(null);
  const [form, setForm] = useState({ name: "", description: "", image_url: "", download_url: "", category: "stadium", sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const fetchModels = async () => {
    const { data } = await (supabase.from("ranked_3d_models" as any).select("*").order("sort_order") as any);
    setModels((data as Model3D[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchModels(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", image_url: "", download_url: "", category: "stadium", sort_order: 0 });
    setDialogOpen(true);
  };

  const openEdit = (m: Model3D) => {
    setEditing(m);
    setForm({ name: m.name, description: m.description || "", image_url: m.image_url || "", download_url: m.download_url, category: m.category, sort_order: m.sort_order });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.download_url.trim()) {
      toast({ title: "Nome e URL download obbligatori", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      download_url: form.download_url.trim(),
      category: form.category,
      sort_order: form.sort_order,
    };

    if (editing) {
      await (supabase.from("ranked_3d_models" as any) as any).update(payload).eq("id", editing.id);
    } else {
      await (supabase.from("ranked_3d_models" as any) as any).insert(payload);
    }
    setSaving(false);
    setDialogOpen(false);
    toast({ title: editing ? "Modello aggiornato" : "Modello aggiunto" });
    fetchModels();
  };

  const toggleActive = async (m: Model3D) => {
    await (supabase.from("ranked_3d_models" as any) as any).update({ is_active: !m.is_active }).eq("id", m.id);
    fetchModels();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo modello?")) return;
    await (supabase.from("ranked_3d_models" as any) as any).delete().eq("id", id);
    toast({ title: "Modello eliminato" });
    fetchModels();
  };

  if (loading) return <p className="text-muted-foreground text-center py-8">Caricamento...</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Box size={20} /> Modelli 3D Ranked
        </CardTitle>
        <Button size="sm" onClick={openCreate} className="gap-1">
          <Plus size={14} /> Aggiungi
        </Button>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Nessun modello 3D configurato.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Ordine</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{categories.find(c => c.value === m.category)?.label || m.category}</Badge>
                  </TableCell>
                  <TableCell>{m.sort_order}</TableCell>
                  <TableCell>
                    <Badge
                      variant={m.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(m)}
                    >
                      {m.is_active ? "Attivo" : "Nascosto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(m.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica Modello" : "Nuovo Modello 3D"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Es: Linguetta String Launcher" />
              </div>
              <div>
                <Label>Descrizione</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrizione opzionale" rows={2} />
              </div>
              <div>
                <Label>URL Immagine</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>URL Download *</Label>
                <Input value={form.download_url} onChange={(e) => setForm({ ...form, download_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ordine</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default Ranked3DModelsAdminTab;
