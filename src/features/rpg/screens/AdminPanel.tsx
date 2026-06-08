import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  CatalogComponent, RARITY_COLORS, RARITY_LABELS, Rarity,
  SLOT_LABEL, SLOT_ORDER, SlotKind, TYPE_LABELS, autoTypeFromStats, loadGameComponents,
} from "../data/componentsCatalog";
import { BeyType } from "../data/beys";

const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];
const TYPES: BeyType[] = ["attack", "defense", "stamina", "balance"];

type FilterKey = "all" | SlotKind;

export const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  const [components, setComponents] = useState<CatalogComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    loadGameComponents().then((c) => { setComponents(c); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return components.filter((c) =>
      (filter === "all" || c.slot === filter) &&
      (!s || c.name.toLowerCase().includes(s))
    );
  }, [components, search, filter]);

  const updateLocal = (id: string, patch: Partial<CatalogComponent>) => {
    setComponents((cur) => cur.map((c) => c.id === id ? { ...c, ...patch } : c));
  };

  const persist = async (id: string, patch: { rarity?: Rarity; bey_type?: BeyType; enabled?: boolean }) => {
    const current = components.find((c) => c.id === id);
    if (!current) return;
    const newIsManual = patch.bey_type !== undefined ? true : current.bey_type_is_manual;
    const row = {
      component_id: id,
      rarity: patch.rarity ?? current.rarity,
      bey_type: patch.bey_type ?? current.bey_type,
      bey_type_manual: newIsManual,
      enabled: patch.enabled ?? current.enabled,
    };
    const { error } = await (supabase as any)
      .from("rpg_component_settings")
      .upsert(row, { onConflict: "component_id" });
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    updateLocal(id, { ...patch, bey_type_is_manual: newIsManual });
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Caricamento componenti...</div>;

  // Build filter tabs grouped: blades / cx / hardware.
  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Tutti" },
    ...SLOT_ORDER.map((s) => ({ key: s, label: SLOT_LABEL[s] })),
  ];

  // Counts per filter for at-a-glance info.
  const countByFilter = (k: FilterKey) =>
    k === "all" ? components.length : components.filter((c) => c.slot === k).length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Button>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold">Admin · Configurazione Componenti</h2>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} / {components.length}</div>
      </div>

      <Card className="p-3 space-y-2 border-amber-400/30">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca componente..." className="pl-8 h-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                filter === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border hover:border-primary/40"
              }`}
            >
              <span>{t.label}</span>
              <span className={`text-[9px] opacity-70 ${filter === t.key ? "" : "text-muted-foreground"}`}>
                {countByFilter(t.key)}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Componente</th>
              <th className="text-left p-2 hidden md:table-cell">Slot</th>
              <th className="text-left p-2 hidden lg:table-cell">Stats (ATK/DEF/STA/BR)</th>
              <th className="text-left p-2">Rarità</th>
              <th className="text-left p-2">Tipologia</th>
              <th className="text-left p-2">Attivo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const auto = autoTypeFromStats(c.stats);
              return (
                <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-muted/30 rounded overflow-hidden flex items-center justify-center shrink-0">
                        {c.image_url ? <img src={c.image_url} alt={c.name} className="w-full h-full object-contain" loading="lazy" /> : null}
                      </div>
                      <div>
                        <div className="font-bold">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground md:hidden">{SLOT_LABEL[c.slot]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-muted-foreground hidden md:table-cell">{SLOT_LABEL[c.slot]}</td>
                  <td className="p-2 hidden lg:table-cell text-[10px] tabular-nums">
                    {(c.stats["ATK"] ?? 0)} / {(c.stats["DEF"] ?? 0)} / {(c.stats["STA"] ?? 0)} / {(c.stats["BURST RES"] ?? 0)}
                  </td>
                  <td className="p-2">
                    <select
                      value={c.rarity}
                      onChange={(e) => persist(c.id, { rarity: e.target.value as Rarity })}
                      className={`text-[11px] px-1.5 py-1 rounded border bg-card ${RARITY_COLORS[c.rarity]}`}
                    >
                      {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <select
                        value={c.bey_type}
                        onChange={(e) => persist(c.id, { bey_type: e.target.value as BeyType })}
                        className="text-[11px] px-1.5 py-1 rounded border border-border bg-card"
                      >
                        {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                      </select>
                      <span
                        className={`text-[9px] px-1 rounded border ${
                          c.bey_type_is_manual
                            ? "border-amber-400/50 text-amber-300 bg-amber-400/10"
                            : "border-sky-400/40 text-sky-300 bg-sky-400/10"
                        }`}
                        title={c.bey_type_is_manual ? "Override manuale (clicca per ripristinare auto)" : `Calcolata da stats → ${TYPE_LABELS[auto]}`}
                        onClick={async () => {
                          if (!c.bey_type_is_manual) return;
                          await (supabase as any).from("rpg_component_settings").upsert(
                            { component_id: c.id, rarity: c.rarity, bey_type: auto, bey_type_manual: false, enabled: c.enabled },
                            { onConflict: "component_id" }
                          );
                          updateLocal(c.id, { bey_type: auto, bey_type_is_manual: false });
                        }}
                        style={{ cursor: c.bey_type_is_manual ? "pointer" : "default" }}
                      >
                        {c.bey_type_is_manual ? "MAN" : "AUTO"}
                      </span>
                    </div>
                  </td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) => persist(c.id, { enabled: e.target.checked })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
