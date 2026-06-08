import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Compass, Search } from "lucide-react";

interface Referent {
  id: string;
  user_id: string;
  region_id: string;
  public_email: string | null;
  public_phone: string | null;
  bio: string | null;
  is_active: boolean;
  region?: { name: string } | null;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

const RegionalReferentsAdminTab = () => {
  const [items, setItems] = useState<Referent[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const fetchAll = async () => {
    const [{ data: refs }, { data: regs }] = await Promise.all([
      (supabase as any).from("regional_referents").select("*").order("created_at", { ascending: false }),
      supabase.from("regions").select("id, name").order("name"),
    ]);
    const list = refs ?? [];
    // Enrich with region + profile
    const userIds = list.map((r: any) => r.user_id);
    const regionIds = list.map((r: any) => r.region_id);
    const [{ data: profs }, { data: regs2 }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      regionIds.length ? supabase.from("regions").select("id, name").in("id", regionIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap = new Map((profs as any[] ?? []).map((p) => [p.user_id, p]));
    const regMap = new Map((regs2 as any[] ?? []).map((r) => [r.id, r]));
    setItems(
      list.map((r: any) => ({
        ...r,
        region: regMap.get(r.region_id) ?? null,
        profile: profMap.get(r.user_id) ?? null,
      })),
    );
    setRegions(regs ?? []);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const searchUser = async (q: string) => {
    setUserSearch(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);
    setSearchResults(data ?? []);
  };

  const save = async () => {
    if (!editing?.user_id || !editing?.region_id) {
      toast({ title: "Seleziona utente e regione", variant: "destructive" });
      return;
    }
    const payload = {
      user_id: editing.user_id,
      region_id: editing.region_id,
      public_email: editing.public_email || null,
      public_phone: editing.public_phone || null,
      bio: editing.bio || null,
      is_active: editing.is_active ?? true,
    };
    let err;
    if (editing.id) {
      ({ error: err } = await (supabase as any).from("regional_referents").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await (supabase as any).from("regional_referents").insert(payload));
    }
    if (err) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setEditing(null);
    setUserSearch("");
    setSearchResults([]);
    fetchAll();
    toast({ title: "Referente salvato" });
  };

  const remove = async (id: string) => {
    if (!confirm("Rimuovere questo referente regionale?")) return;
    const { error } = await (supabase as any).from("regional_referents").delete().eq("id", id);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Compass size={18} /> Referenti Regionali
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing({ user_id: "", region_id: "", public_email: "", public_phone: "", bio: "", is_active: true });
            setOpen(true);
          }}
        >
          <Plus size={14} className="mr-1" /> Aggiungi
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utente</TableHead>
              <TableHead>Regione</TableHead>
              <TableHead>Contatti pubblici</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.profile?.display_name || r.profile?.username || r.user_id.slice(0, 8)}
                  {r.profile?.username && (
                    <span className="text-xs text-muted-foreground ml-1">@{r.profile.username}</span>
                  )}
                </TableCell>
                <TableCell>{r.region?.name || "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.public_email || "-"}
                  {r.public_phone ? ` · ${r.public_phone}` : ""}
                </TableCell>
                <TableCell>
                  <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Attivo" : "Disattivato"}</Badge>
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                  Nessun referente regionale assegnato.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Modifica" : "Nuovo"} Referente Regionale</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {!editing?.id && (
                <div>
                  <Label>Utente</Label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per username o nome…"
                      value={userSearch}
                      onChange={(e) => searchUser(e.target.value)}
                      className="pl-9"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow max-h-44 overflow-auto">
                        {searchResults.map((u) => (
                          <button
                            key={u.user_id}
                            onClick={() => {
                              setEditing((p: any) => ({ ...p, user_id: u.user_id }));
                              setUserSearch(u.display_name || u.username);
                              setSearchResults([]);
                            }}
                            className="w-full text-left p-2 hover:bg-secondary/50 text-sm"
                          >
                            {u.display_name || u.username}
                            {u.username && <span className="text-xs text-muted-foreground ml-1">@{u.username}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {editing?.user_id && (
                    <p className="text-xs text-muted-foreground mt-1">Selezionato: {editing.user_id.slice(0, 8)}…</p>
                  )}
                </div>
              )}
              <div>
                <Label>Regione</Label>
                <Select
                  value={editing?.region_id || ""}
                  onValueChange={(v) => setEditing((p: any) => ({ ...p, region_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona regione" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Email pubblica</Label>
                <Input
                  value={editing?.public_email || ""}
                  onChange={(e) => setEditing((p: any) => ({ ...p, public_email: e.target.value }))}
                  placeholder="referente@esempio.it"
                />
              </div>
              <div>
                <Label>Telefono pubblico</Label>
                <Input
                  value={editing?.public_phone || ""}
                  onChange={(e) => setEditing((p: any) => ({ ...p, public_phone: e.target.value }))}
                  placeholder="+39…"
                />
              </div>
              <div>
                <Label>Bio / Note</Label>
                <Textarea
                  value={editing?.bio || ""}
                  onChange={(e) => setEditing((p: any) => ({ ...p, bio: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing?.is_active ?? true}
                  onCheckedChange={(v) => setEditing((p: any) => ({ ...p, is_active: v }))}
                />
                <Label>Attivo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default RegionalReferentsAdminTab;
