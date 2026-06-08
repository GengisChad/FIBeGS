import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Layers, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  AssembledBey,
  BeyParts,
  BeySeries,
  CatalogComponent,
  RARITY_COLORS,
  RARITY_LABELS,
  RatchetMode,
  SERIES_LABEL,
  SERIES_ORDER,
  SLOT_LABEL,
  SlotKind,
  TYPE_EMOJI,
  TYPE_LABELS,
  assembleBey,
  seriesAllowsRibs,
  slotsForSeries,
} from "../data/componentsCatalog";
import {
  DeckSlotSelection,
  saveGameDeck,
  useActiveGameDeck,
  useOwnedComponents,
} from "../state/gameDeckStore";
import { RpgComponentPicker } from "../components/RpgComponentPicker";

interface BeyDraft {
  series: BeySeries;
  ratchetMode: RatchetMode;
  slots: Partial<Record<SlotKind, string | null>>;
}

const emptyDraft = (): BeyDraft => ({ series: "BX", ratchetMode: "ratchet", slots: {} });

export const GameDeckBuilder = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const { data, catalog, loading, reload } = useActiveGameDeck();
  const { owned } = useOwnedComponents();
  const [drafts, setDrafts] = useState<BeyDraft[]>([emptyDraft(), emptyDraft(), emptyDraft()]);
  const [picker, setPicker] = useState<{ pos: number; slot: SlotKind } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDrafts(
      data.beys.map((b) => {
        const slots: Partial<Record<SlotKind, string | null>> = {};
        (Object.keys(b.parts) as SlotKind[]).forEach((s) => {
          slots[s] = b.parts[s]?.id ?? null;
        });
        return { series: b.series, ratchetMode: b.ratchetMode, slots };
      }),
    );
  }, [data]);

  const componentById = (id: string | null | undefined): CatalogComponent | null =>
    id ? catalog.find((c) => c.id === id) ?? null : null;

  const buildParts = (d: BeyDraft): BeyParts => {
    const p: BeyParts = {};
    slotsForSeries(d.series, d.ratchetMode).forEach((slot) => {
      p[slot] = componentById(d.slots[slot]);
    });
    return p;
  };

  const assembled: AssembledBey[] = drafts.map((d, i) =>
    assembleBey(i + 1, d.series, d.ratchetMode, buildParts(d)),
  );

  const setSlot = (pos: number, slot: SlotKind, val: string | null) => {
    setDrafts((cur) =>
      cur.map((d, i) => (i === pos ? { ...d, slots: { ...d.slots, [slot]: val } } : d)),
    );
  };

  const setSeries = (pos: number, series: BeySeries) => {
    setDrafts((cur) =>
      cur.map((d, i) => {
        if (i !== pos) return d;
        // UX♾️ forza ratchet (anche se non lo userà — slotsForSeries lo ignora)
        const mode: RatchetMode = !seriesAllowsRibs(series) ? "ratchet" : d.ratchetMode;
        const allowed = new Set(slotsForSeries(series, mode));
        const slots: Partial<Record<SlotKind, string | null>> = {};
        Object.entries(d.slots).forEach(([k, v]) => {
          if (allowed.has(k as SlotKind)) slots[k as SlotKind] = v;
        });
        return { series, ratchetMode: mode, slots };
      }),
    );
  };

  const setRatchetMode = (pos: number, mode: RatchetMode) => {
    setDrafts((cur) =>
      cur.map((d, i) => {
        if (i !== pos) return d;
        const allowed = new Set(slotsForSeries(d.series, mode));
        const slots: Partial<Record<SlotKind, string | null>> = {};
        Object.entries(d.slots).forEach(([k, v]) => {
          if (allowed.has(k as SlotKind)) slots[k as SlotKind] = v;
        });
        return { ...d, ratchetMode: mode, slots };
      }),
    );
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: DeckSlotSelection[] = drafts.map((d, i) => ({
        position: i + 1,
        series: d.series,
        ratchetMode: d.ratchetMode,
        ...d.slots,
      }));
      await saveGameDeck(user.id, data?.deck.id ?? null, payload);
      await reload();
      toast({ title: "Deck salvato" });
      onBack();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Caricamento...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />Indietro
        </Button>
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Editor Deck di Gioco</h2>
        </div>
        <Button onClick={save} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-2" />Salva
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Per ogni Bey scegli la serie (BX, BX♾️, UX, UX♾️, CX, CX♾️) e — quando ammesso — se
        terminare con Ratchet+Bit o con Ribs (singolo pezzo). UX♾️ non usa ratchet/ribs, solo Bit.
      </p>

      <div className="grid lg:grid-cols-3 gap-4">
        {assembled.map((b, idx) => {
          const draft = drafts[idx];
          const slots = slotsForSeries(draft.series, draft.ratchetMode);
          const ribsAllowed = seriesAllowsRibs(draft.series);
          return (
            <Card key={idx} className="p-4 space-y-3 border-primary/20">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Bey {b.position}
                </div>
                <div className="text-xs flex items-center gap-1 font-bold">
                  {TYPE_EMOJI[b.type]} {TYPE_LABELS[b.type]}
                </div>
              </div>

              {/* Series selector */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Serie
                </div>
                <div className="flex flex-wrap gap-1">
                  {SERIES_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSeries(idx, s)}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all border ${
                        draft.series === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:border-primary/50"
                      }`}
                    >
                      {SERIES_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ratchet/Ribs toggle */}
              {ribsAllowed && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    Configurazione base
                  </div>
                  <div className="flex gap-1">
                    {(["ratchet", "ribs"] as RatchetMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setRatchetMode(idx, m)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all border ${
                          draft.ratchetMode === m
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border hover:border-primary/50"
                        }`}
                      >
                        {m === "ratchet" ? "Ratchet + Bit" : "Ribs (integrato)"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Slot buttons */}
              {slots.map((slot) => {
                const comp = componentById(draft.slots[slot]);
                return (
                  <button
                    key={slot}
                    onClick={() => setPicker({ pos: idx, slot })}
                    className="w-full p-2 rounded-lg border border-dashed border-border hover:border-primary/60 bg-card/50 flex items-center gap-2 text-left transition-all"
                  >
                    <div className="w-12 h-12 bg-muted/30 rounded overflow-hidden flex items-center justify-center shrink-0">
                      {comp?.image_url ? (
                        <img src={comp.image_url} alt={comp.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-[10px] text-muted-foreground">+</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {SLOT_LABEL[slot]}
                      </div>
                      {comp ? (
                        <>
                          <div className="text-xs font-bold truncate">{comp.name}</div>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            <span className={`text-[9px] px-1 rounded border ${RARITY_COLORS[comp.rarity]}`}>
                              {RARITY_LABELS[comp.rarity]}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {TYPE_EMOJI[comp.bey_type]}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">Seleziona...</div>
                      )}
                    </div>
                  </button>
                );
              })}

              <div className="pt-2 border-t border-border/50 space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Stats</div>
                {(["ATK","DEF","STA","BURST RES"] as const).map((k) => {
                  const v = b.totalStats[k] ?? 0;
                  const pct = Math.min(100, Math.round((v / 60) * 100));
                  const color =
                    k === "ATK" ? "bg-rose-500" :
                    k === "DEF" ? "bg-emerald-500" :
                    k === "STA" ? "bg-sky-500" : "bg-amber-500";
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[10px] w-12 text-muted-foreground">{k}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-bold w-6 text-right tabular-nums">{v}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-1 text-[11px]">
                  <span className="text-muted-foreground">Burst Pool</span><span className="font-bold">{b.hp}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Stamina Pool</span><span className="font-bold">{b.stamina}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {picker && (
        <RpgComponentPicker
          open
          onOpenChange={(v) => !v && setPicker(null)}
          slot={picker.slot}
          catalog={catalog}
          owned={owned}
          value={drafts[picker.pos].slots[picker.slot] ?? null}
          onSelect={(id) => setSlot(picker.pos, picker.slot, id)}
        />
      )}
    </div>
  );
};
