import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Copy, Megaphone, Send, Sparkles, Wrench, RefreshCw, Calendar, Users, Shield } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  scope: string;
  created_at: string;
  created_by: string;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; colors: string; dot: string }> = {
  new: {
    label: "Novità",
    icon: <Sparkles size={12} />,
    colors: "bg-green-500/15 text-green-400 border-green-500/30",
    dot: "bg-green-400",
  },
  update: {
    label: "Aggiornamento",
    icon: <RefreshCw size={12} />,
    colors: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    dot: "bg-blue-400",
  },
  fix: {
    label: "Correzione",
    icon: <Wrench size={12} />,
    colors: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    dot: "bg-orange-400",
  },
};

interface GroupedDay {
  date: string;
  label: string;
  entries: ChangelogEntry[];
  byCategory: Record<string, ChangelogEntry[]>;
}

const categoryOrder = ["new", "update", "fix"] as const;

const ChangelogAdminTab = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("update");
  const [newScope, setNewScope] = useState("user");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeScope, setActiveScope] = useState("user");


  const fetchEntries = async () => {
    const { data } = await supabase
      .from("changelog_entries")
      .select("*")
      .order("created_at", { ascending: false });
    setEntries((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const groupedDays = useMemo<GroupedDay[]>(() => {
    const filtered = entries.filter(e => (e.scope || "user") === activeScope);
    const dayMap = new Map<string, ChangelogEntry[]>();
    for (const entry of filtered) {
      const dayKey = format(new Date(entry.created_at), "yyyy-MM-dd");
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
      dayMap.get(dayKey)!.push(entry);
    }
    return Array.from(dayMap.entries()).map(([date, dayEntries]) => {
      const byCategory: Record<string, ChangelogEntry[]> = {};
      for (const e of dayEntries) {
        if (!byCategory[e.category]) byCategory[e.category] = [];
        byCategory[e.category].push(e);
      }
      return { date, label: format(new Date(date), "dd MMMM yyyy", { locale: it }), entries: dayEntries, byCategory };
    });
  }, [entries, activeScope]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDesc.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from("changelog_entries").insert({
      title: newTitle.trim(),
      description: newDesc.trim(),
      category: newCategory,
      scope: newScope,
      created_by: user.id,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nota aggiunta" });
      setNewTitle(""); setNewDesc(""); setNewCategory("update"); setNewScope("user"); setShowAdd(false);
      fetchEntries();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("changelog_entries").delete().eq("id", id);
    fetchEntries();
  };

  const toggleDay = (date: string) => {
    setSelectedDays(prev => {
      const n = new Set(prev);
      if (n.has(date)) n.delete(date); else n.add(date);
      return n;
    });
  };

  const toggleAll = () => {
    if (selectedDays.size === groupedDays.length && groupedDays.length > 0) setSelectedDays(new Set());
    else setSelectedDays(new Set(groupedDays.map(d => d.date)));
  };

  const selectedEntries = useMemo(() => {
    return entries.filter(e => {
      if ((e.scope || "user") !== activeScope) return false;
      const dayKey = format(new Date(e.created_at), "yyyy-MM-dd");
      return selectedDays.has(dayKey);
    });
  }, [entries, selectedDays, activeScope]);

  const formatForCopy = () => {
    const dayGroups = new Map<string, ChangelogEntry[]>();
    for (const e of selectedEntries) {
      const dayKey = format(new Date(e.created_at), "yyyy-MM-dd");
      if (!dayGroups.has(dayKey)) dayGroups.set(dayKey, []);
      dayGroups.get(dayKey)!.push(e);
    }
    const sortedDays = Array.from(dayGroups.entries()).sort(([a], [b]) => b.localeCompare(a));
    return sortedDays.map(([date, dayEntries]) => {
      const label = format(new Date(date), "dd MMMM yyyy", { locale: it });
      const byCategory: Record<string, ChangelogEntry[]> = {};
      for (const e of dayEntries) {
        if (!byCategory[e.category]) byCategory[e.category] = [];
        byCategory[e.category].push(e);
      }
      const body = categoryOrder
        .filter(cat => byCategory[cat]?.length)
        .map(cat => {
          const cfg = categoryConfig[cat];
          const items = byCategory[cat].map(e => `  • ${e.title} — ${e.description}`).join("\n");
          return `${cfg.label.toUpperCase()}\n${items}`;
        })
        .join("\n\n");
      return `📅 ${label}\n${body}`;
    }).join("\n\n---\n\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formatForCopy());
    toast({ title: "Copiato negli appunti!" });
  };

  const handleAnnounce = async () => {
    if (!announcementTitle.trim() || !user) return;
    setSaving(true);

    const byCategory: Record<string, ChangelogEntry[]> = {};
    for (const e of selectedEntries) {
      if (!byCategory[e.category]) byCategory[e.category] = [];
      byCategory[e.category].push(e);
    }
    const message = categoryOrder
      .filter(cat => byCategory[cat]?.length)
      .map(cat => {
        const cfg = categoryConfig[cat];
        const items = byCategory[cat].map(e => `• ${e.title} — ${e.description}`).join("\n");
        return `**${cfg.label}**\n${items}`;
      })
      .join("\n\n");

    const { error: annErr } = await supabase.from("announcements").insert({
      title: announcementTitle.trim(),
      message,
      sent_by: user.id,
      recipients_count: 0,
    });

    if (annErr) {
      toast({ title: "Errore", description: annErr.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    toast({ title: "Annuncio pubblicato!", description: "Visibile a tutti gli utenti nel pannello notifiche" });
    setSaving(false);
    setShowAnnounce(false);
    setAnnouncementTitle("");
  };

  const renderDayCard = (day: GroupedDay) => {
    const isSelected = selectedDays.has(day.date);
    return (
      <div
        key={day.date}
        className={`rounded-lg border p-4 transition-colors ${isSelected ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
      >
        {/* Day header - clickable to select whole day */}
        <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => toggleDay(day.date)}>
          <Checkbox checked={isSelected} onCheckedChange={() => toggleDay(day.date)} className="shrink-0" />
          <Calendar size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-oswald uppercase tracking-widest text-foreground flex-1">
            {day.label}
          </h3>
          <span className="text-[10px] text-muted-foreground">{day.entries.length} note</span>
        </div>

        {/* Categories within this day */}
        <div className="space-y-3 ml-7">
          {categoryOrder
            .filter(cat => day.byCategory[cat]?.length)
            .map(cat => {
              const cfg = categoryConfig[cat];
              const catEntries = day.byCategory[cat];
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <Badge variant="outline" className={`${cfg.colors} text-xs gap-1`}>
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">({catEntries.length})</span>
                  </div>
                  <div className="ml-4 border-l-2 border-border pl-3 space-y-1">
                    {catEntries.map(entry => (
                      <div key={entry.id} className="flex items-start gap-2 group py-0.5 hover:bg-secondary/20 rounded-r px-2 -mx-1 transition-colors">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{entry.title}</span>
                          <p className="text-xs text-muted-foreground leading-relaxed">{entry.description}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-lg font-oswald uppercase tracking-wider">Changelog</CardTitle>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} className="mr-1" /> Nuova nota
        </Button>

      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scope tabs */}
        <Tabs value={activeScope} onValueChange={v => { setActiveScope(v); setSelectedDays(new Set()); }}>
          <TabsList className="w-full">
            <TabsTrigger value="user" className="flex-1 gap-1.5">
              <Users size={14} /> Utenti
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex-1 gap-1.5">
              <Shield size={14} /> Admin
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Selection toolbar */}
        {selectedDays.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium">
              {selectedDays.size} giorn{selectedDays.size === 1 ? "o" : "i"} selezionat{selectedDays.size === 1 ? "o" : "i"} ({selectedEntries.length} note)
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={handleCopy}>
              <Copy size={14} className="mr-1" /> Copia
            </Button>
            <Button size="sm" onClick={() => { setAnnouncementTitle(""); setShowAnnounce(true); }}>
              <Megaphone size={14} className="mr-1" /> Annuncia
            </Button>
          </div>
        )}

        {/* Select all */}
        {groupedDays.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedDays.size === groupedDays.length && groupedDays.length > 0}
              onCheckedChange={toggleAll}
            />
            <span className="text-xs text-muted-foreground">Seleziona tutti i giorni ({groupedDays.length})</span>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Caricamento...</p>
        ) : groupedDays.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nessuna nota {activeScope === "admin" ? "lato admin" : "lato utenti"}.
          </p>
        ) : (
          <div className="space-y-3">
            {groupedDays.map(day => renderDayCard(day))}
          </div>
        )}

        {/* Add dialog */}
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuova nota changelog</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">🆕 Novità</SelectItem>
                      <SelectItem value="update">🔄 Aggiornamento</SelectItem>
                      <SelectItem value="fix">🔧 Correzione</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Destinatari</Label>
                  <Select value={newScope} onValueChange={setNewScope}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">👥 Utenti</SelectItem>
                      <SelectItem value="admin">🛡️ Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Titolo</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Es: Nuova sezione changelog" />
              </div>
              <div>
                <Label>Descrizione</Label>
                <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Breve descrizione..." rows={3} maxLength={300} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Annulla</Button>
              <Button onClick={handleAdd} disabled={saving || !newTitle.trim() || !newDesc.trim()}>
                {saving ? "Salvataggio..." : "Aggiungi"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Announce dialog */}
        <Dialog open={showAnnounce} onOpenChange={setShowAnnounce}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crea annuncio dal changelog</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Titolo annuncio</Label>
                <Input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} placeholder="Es: Aggiornamento v2.5" />
              </div>
              <div>
                <Label>Anteprima</Label>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border text-sm space-y-3 max-h-64 overflow-y-auto">
                  {categoryOrder
                    .filter(cat => selectedEntries.some(e => e.category === cat))
                    .map(cat => {
                      const cfg = categoryConfig[cat];
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            <span className="font-semibold text-xs uppercase tracking-wider">{cfg.label}</span>
                          </div>
                          <ul className="ml-4 space-y-0.5">
                            {selectedEntries.filter(e => e.category === cat).map(e => (
                              <li key={e.id} className="text-xs text-muted-foreground">• {e.title} — {e.description}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAnnounce(false)}>Annulla</Button>
              <Button onClick={handleAnnounce} disabled={saving || !announcementTitle.trim()}>
                <Send size={14} className="mr-1" /> {saving ? "Invio..." : "Invia annuncio"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
};

export default ChangelogAdminTab;
