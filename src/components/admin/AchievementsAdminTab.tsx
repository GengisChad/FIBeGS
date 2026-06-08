import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Trophy, Target, Plus, Pencil, Trash2, Star, Calendar } from "lucide-react";

const CONDITION_TYPES = [
  { value: "tournament_count", label: "Tornei giocati" },
  { value: "tournament_wins", label: "Tornei vinti" },
  { value: "match_wins", label: "Match vinti" },
  { value: "top_placement", label: "Piazzamenti top N" },
  { value: "forum_posts", label: "Post nel forum" },
  { value: "forum_likes_received", label: "Like ricevuti (forum)" },
  { value: "decks_created", label: "Deck creati" },
  { value: "collection_count", label: "Pezzi in collezione" },
];

const CONDITION_LABEL: Record<string, string> = Object.fromEntries(CONDITION_TYPES.map(c => [c.value, c.label]));

interface AchievementForm {
  name: string;
  description: string;
  icon_url: string;
  badge_id: string;
  bonus_points: number;
  condition_type: string;
  condition_value: number;
  condition_meta: Record<string, any>;
  is_active: boolean;
  sort_order: number;
}

interface MissionForm extends AchievementForm {
  period: string;
  starts_at: string;
  ends_at: string;
}

const emptyAchievement: AchievementForm = {
  name: "", description: "", icon_url: "", badge_id: "", bonus_points: 0,
  condition_type: "tournament_count", condition_value: 1, condition_meta: {},
  is_active: true, sort_order: 0,
};

const emptyMission: MissionForm = {
  ...emptyAchievement, period: "weekly",
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
};

const AchievementsAdminTab = () => {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAch, setEditAch] = useState<AchievementForm | null>(null);
  const [editAchId, setEditAchId] = useState<string | null>(null);
  const [editMis, setEditMis] = useState<MissionForm | null>(null);
  const [editMisId, setEditMisId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [a, m, b] = await Promise.all([
      supabase.from("achievements").select("*").order("sort_order"),
      supabase.from("missions").select("*").order("sort_order"),
      supabase.from("badges").select("id, name").order("name"),
    ]);
    setAchievements(a.data ?? []);
    setMissions(m.data ?? []);
    setBadges(b.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const saveAchievement = async () => {
    if (!editAch) return;
    const payload = {
      name: editAch.name,
      description: editAch.description || null,
      icon_url: editAch.icon_url || null,
      badge_id: editAch.badge_id || null,
      bonus_points: editAch.bonus_points,
      condition_type: editAch.condition_type,
      condition_value: editAch.condition_value,
      condition_meta: editAch.condition_meta,
      is_active: editAch.is_active,
      sort_order: editAch.sort_order,
    };
    const res = editAchId
      ? await supabase.from("achievements").update(payload).eq("id", editAchId)
      : await supabase.from("achievements").insert(payload);
    if (res.error) { toast({ title: "Errore", description: res.error.message, variant: "destructive" }); return; }
    toast({ title: editAchId ? "Achievement aggiornato" : "Achievement creato" });
    setEditAch(null); setEditAchId(null); fetchAll();
  };

  const deleteAchievement = async (id: string) => {
    await supabase.from("achievements").delete().eq("id", id);
    toast({ title: "Achievement eliminato" }); fetchAll();
  };

  const saveMission = async () => {
    if (!editMis) return;
    const payload = {
      name: editMis.name,
      description: editMis.description || null,
      icon_url: editMis.icon_url || null,
      badge_id: editMis.badge_id || null,
      bonus_points: editMis.bonus_points,
      condition_type: editMis.condition_type,
      condition_value: editMis.condition_value,
      condition_meta: editMis.condition_meta,
      period: editMis.period,
      starts_at: editMis.starts_at,
      ends_at: editMis.ends_at,
      is_active: editMis.is_active,
      sort_order: editMis.sort_order,
    };
    const res = editMisId
      ? await supabase.from("missions").update(payload).eq("id", editMisId)
      : await supabase.from("missions").insert(payload);
    if (res.error) { toast({ title: "Errore", description: res.error.message, variant: "destructive" }); return; }
    toast({ title: editMisId ? "Missione aggiornata" : "Missione creata" });
    setEditMis(null); setEditMisId(null); fetchAll();
  };

  const deleteMission = async (id: string) => {
    await supabase.from("missions").delete().eq("id", id);
    toast({ title: "Missione eliminata" }); fetchAll();
  };

  const openEditAch = (a: any) => {
    setEditAchId(a.id);
    setEditAch({
      name: a.name, description: a.description || "", icon_url: a.icon_url || "",
      badge_id: a.badge_id || "", bonus_points: a.bonus_points,
      condition_type: a.condition_type, condition_value: a.condition_value,
      condition_meta: a.condition_meta || {}, is_active: a.is_active, sort_order: a.sort_order,
    });
  };

  const openEditMis = (m: any) => {
    setEditMisId(m.id);
    setEditMis({
      name: m.name, description: m.description || "", icon_url: m.icon_url || "",
      badge_id: m.badge_id || "", bonus_points: m.bonus_points,
      condition_type: m.condition_type, condition_value: m.condition_value,
      condition_meta: m.condition_meta || {}, is_active: m.is_active, sort_order: m.sort_order,
      period: m.period, starts_at: m.starts_at?.slice(0, 16) || "", ends_at: m.ends_at?.slice(0, 16) || "",
    });
  };

  if (loading) return <p className="text-muted-foreground text-center py-8">Caricamento...</p>;

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Trophy size={20} /> Achievement & Missioni</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <Tabs defaultValue="achievements" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
            <TabsTrigger value="achievements" className="gap-1.5"><Star size={14} /> Achievement</TabsTrigger>
            <TabsTrigger value="missions" className="gap-1.5"><Target size={14} /> Missioni</TabsTrigger>
          </TabsList>

          {/* ─── ACHIEVEMENTS ─── */}
          <TabsContent value="achievements" className="space-y-4">
            <Button size="sm" className="w-full sm:w-auto" onClick={() => { setEditAchId(null); setEditAch({ ...emptyAchievement }); }}>
              <Plus size={14} className="mr-1" /> Nuovo Achievement
            </Button>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {achievements.map(a => (
                <div key={a.id} className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px]">{CONDITION_LABEL[a.condition_type] || a.condition_type}</Badge>
                        <Badge variant="secondary" className="text-[10px]">x{a.condition_value}</Badge>
                        {a.bonus_points > 0 && <Badge className="text-[10px]">+{a.bonus_points} pt</Badge>}
                        <span className="text-xs">{a.is_active ? "✅" : "❌"}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditAch(a)}><Pencil size={14} /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteAchievement(a.id)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                </div>
              ))}
              {achievements.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Nessun achievement</p>}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Condizione</TableHead>
                    <TableHead>Valore</TableHead>
                    <TableHead>Punti</TableHead>
                    <TableHead>Attivo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {achievements.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{CONDITION_LABEL[a.condition_type] || a.condition_type}</Badge></TableCell>
                      <TableCell>{a.condition_value}</TableCell>
                      <TableCell>{a.bonus_points > 0 ? `+${a.bonus_points}` : "-"}</TableCell>
                      <TableCell>{a.is_active ? "✅" : "❌"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditAch(a)}><Pencil size={14} /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteAchievement(a.id)}><Trash2 size={14} /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {achievements.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessun achievement</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── MISSIONS ─── */}
          <TabsContent value="missions" className="space-y-4">
            <Button size="sm" className="w-full sm:w-auto" onClick={() => { setEditMisId(null); setEditMis({ ...emptyMission }); }}>
              <Plus size={14} className="mr-1" /> Nuova Missione
            </Button>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {missions.map(m => (
                <div key={m.id} className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-[10px]">{m.period === "weekly" ? "Settimanale" : "Mensile"}</Badge>
                        <Badge variant="outline" className="text-[10px]">{CONDITION_LABEL[m.condition_type] || m.condition_type}</Badge>
                        <Badge variant="outline" className="text-[10px]">x{m.condition_value}</Badge>
                        {m.bonus_points > 0 && <Badge className="text-[10px]">+{m.bonus_points} pt</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar size={10} /> Scade: {new Date(m.ends_at).toLocaleDateString("it")}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditMis(m)}><Pencil size={14} /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMission(m.id)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                </div>
              ))}
              {missions.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Nessuna missione</p>}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Condizione</TableHead>
                    <TableHead>Valore</TableHead>
                    <TableHead>Punti</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missions.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{m.period === "weekly" ? "Settimanale" : "Mensile"}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{CONDITION_LABEL[m.condition_type] || m.condition_type}</Badge></TableCell>
                      <TableCell>{m.condition_value}</TableCell>
                      <TableCell>{m.bonus_points > 0 ? `+${m.bonus_points}` : "-"}</TableCell>
                      <TableCell className="text-xs">{new Date(m.ends_at).toLocaleDateString("it")}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditMis(m)}><Pencil size={14} /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMission(m.id)}><Trash2 size={14} /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {missions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nessuna missione</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── Achievement Dialog ─── */}
        <Dialog open={editAch !== null} onOpenChange={o => { if (!o) { setEditAch(null); setEditAchId(null); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editAchId ? "Modifica" : "Nuovo"} Achievement</DialogTitle></DialogHeader>
            {editAch && <AchievementFormFields form={editAch} setForm={setEditAch as any} badges={badges} />}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditAch(null); setEditAchId(null); }}>Annulla</Button>
              <Button onClick={saveAchievement}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Mission Dialog ─── */}
        <Dialog open={editMis !== null} onOpenChange={o => { if (!o) { setEditMis(null); setEditMisId(null); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editMisId ? "Modifica" : "Nuova"} Missione</DialogTitle></DialogHeader>
            {editMis && <MissionFormFields form={editMis} setForm={setEditMis as any} badges={badges} />}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditMis(null); setEditMisId(null); }}>Annulla</Button>
              <Button onClick={saveMission}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ─── Shared form fields ─── */
const AchievementFormFields = ({ form, setForm, badges }: { form: AchievementForm; setForm: (f: AchievementForm) => void; badges: any[] }) => (
  <div className="space-y-4">
    <div>
      <Label>Nome *</Label>
      <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
    </div>
    <div>
      <Label>Descrizione</Label>
      <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
    </div>
    <div>
      <Label>URL Icona</Label>
      <Input value={form.icon_url} onChange={e => setForm({ ...form, icon_url: e.target.value })} placeholder="https://..." />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Tipo condizione</Label>
        <Select value={form.condition_type} onValueChange={v => setForm({ ...form, condition_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONDITION_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Valore obiettivo</Label>
        <Input type="number" min={1} value={form.condition_value} onChange={e => setForm({ ...form, condition_value: parseInt(e.target.value) || 1 })} />
      </div>
    </div>
    {form.condition_type === "top_placement" && (
      <div>
        <Label>Piazzamento massimo (es. 3 = top 3)</Label>
        <Input type="number" min={1} value={(form.condition_meta as any)?.max_placement || 3}
          onChange={e => setForm({ ...form, condition_meta: { ...form.condition_meta, max_placement: parseInt(e.target.value) || 3 } })} />
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Badge premio</Label>
        <Select value={form.badge_id} onValueChange={v => setForm({ ...form, badge_id: v === "_none" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Nessuno</SelectItem>
            {badges.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Punti bonus</Label>
        <Input type="number" min={0} value={form.bonus_points} onChange={e => setForm({ ...form, bonus_points: parseInt(e.target.value) || 0 })} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Ordine</Label>
        <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
      </div>
      <div className="flex items-center gap-2 pt-6">
        <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
        <Label>Attivo</Label>
      </div>
    </div>
  </div>
);

const MissionFormFields = ({ form, setForm, badges }: { form: MissionForm; setForm: (f: MissionForm) => void; badges: any[] }) => (
  <div className="space-y-4">
    <AchievementFormFields form={form} setForm={setForm as any} badges={badges} />
    <div className="grid grid-cols-3 gap-3">
      <div>
        <Label>Periodo</Label>
        <Select value={form.period} onValueChange={v => setForm({ ...form, period: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Settimanale</SelectItem>
            <SelectItem value="monthly">Mensile</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Inizio</Label>
        <Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
      </div>
      <div>
        <Label>Fine</Label>
        <Input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
      </div>
    </div>
  </div>
);

export default AchievementsAdminTab;
