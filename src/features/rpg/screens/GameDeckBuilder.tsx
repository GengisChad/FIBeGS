import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, Layers, Save, Shield, Sword, Zap, Activity, Lock } from "lucide-react";
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
import { useRpg } from "../state/rpgStore";
import { RpgComponentPicker } from "../components/RpgComponentPicker";

interface BeyDraft {
  series: BeySeries;
  ratchetMode: RatchetMode;
  slots: Partial<Record<SlotKind, string | null>>;
}

const emptyDraft = (): BeyDraft => ({ series: "BX", ratchetMode: "ratchet", slots: {} });

const STAT_ROWS = [
  { key: "ATK", label: "ATK", icon: Sword, color: "bg-rose-500" },
  { key: "DEF", label: "DEF", icon: Shield, color: "bg-emerald-500" },
  { key: "STA", label: "STA", icon: Activity, color: "bg-sky-500" },
  { key: "BURST RES", label: "BURST", icon: Zap, color: "bg-amber-500" },
] as const;

export const GameDeckBuilder = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const { run } = useRpg();
  const { data, catalog, loading, reload } = useActiveGameDeck();
  const { owned } = useOwnedComponents();
  const [drafts, setDrafts] = useState<BeyDraft[]>([emptyDraft(), emptyDraft(), emptyDraft()]);
  const [activeBey, setActiveBey] = useState(0);
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
    return <div className="py-20 text-center text-muted-foreground">Caricamento...</div>;
  }

  if (run.inBattle) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />Indietro
        </Button>
        <Card className="p-8 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h2 className="text-xl font-extrabold">Deck bloccato</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Hai gia iniziato il livello {run.currentLevel}. Puoi modificare il deck solo dopo aver completato o perso il livello in corso.
          </p>
        </Card>
      </div>
    );
  }

  const activeDraft = drafts[activeBey];
  const activeAssembled = assembled[activeBey];
  const activeSlots = slotsForSeries(activeDraft.series, activeDraft.ratchetMode);
  const activeFilled = activeSlots.filter((slot) => activeDraft.slots[slot]).length;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="sticky top-20 z-20 rounded-xl border border-border bg-background/95 p-3 shadow-sm supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
            <ArrowLeft className="mr-2 h-4 w-4" />Indietro
          </Button>
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-2">
              <Layers className="h-5 w-5 shrink-0 text-primary" />
              <h2 className="truncate text-base font-bold sm:text-lg">Editor Deck di Gioco</h2>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Scegli serie, configurazione e componenti per i 3 Bey del deck.
            </p>
          </div>
          <Button onClick={save} disabled={saving} size="sm" className="shrink-0">
            <Save className="mr-2 h-4 w-4" />Salva
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="space-y-3 xl:sticky xl:top-40 xl:self-start">
          <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
            {assembled.map((b, idx) => {
              const draft = drafts[idx];
              const slots = slotsForSeries(draft.series, draft.ratchetMode);
              const filled = slots.filter((slot) => draft.slots[slot]).length;
              const complete = filled === slots.length;
              return (
                <button
                  key={b.position}
                  type="button"
                  onClick={() => setActiveBey(idx)}
                  className={`min-w-0 rounded-lg border p-3 text-left transition-all ${
                    activeBey === idx
                      ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Bey {idx + 1}
                    </span>
                    {complete && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                  <div className="truncate text-xs font-bold sm:text-sm">{b.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{SERIES_LABEL[draft.series]}</span>
                    <span>{filled}/{slots.length}</span>
                    <span>{TYPE_EMOJI[b.type]} {TYPE_LABELS[b.type]}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <Card className="overflow-hidden border-primary/20">
            <div className="border-b border-border bg-card/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Bey {activeBey + 1}</div>
                  <h3 className="truncate text-xl font-extrabold">{activeAssembled.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {activeFilled === activeSlots.length ? "Configurazione completa" : `${activeSlots.length - activeFilled} slot da completare`}
                  </p>
                </div>
                <div className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-bold">
                  {TYPE_EMOJI[activeAssembled.type]} {TYPE_LABELS[activeAssembled.type]}
                </div>
              </div>
            </div>

            <div className="space-y-5 p-4">
              <section className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Serie</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {SERIES_ORDER.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeries(activeBey, s)}
                      className={`min-h-10 rounded-lg border px-2 text-xs font-bold transition-all ${
                        activeDraft.series === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      {SERIES_LABEL[s]}
                    </button>
                  ))}
                </div>
              </section>

              {seriesAllowsRibs(activeDraft.series) && (
                <section className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Configurazione base</div>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-1">
                    {(["ratchet", "ribs"] as RatchetMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRatchetMode(activeBey, m)}
                        className={`min-h-10 rounded-md px-3 text-xs font-bold transition-all ${
                          activeDraft.ratchetMode === m
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-background hover:text-foreground"
                        }`}
                      >
                        {m === "ratchet" ? "Ratchet + Bit" : "Ribs integrato"}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Componenti</div>
                  <div className="text-[10px] font-bold text-muted-foreground">{activeFilled}/{activeSlots.length}</div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {activeSlots.map((slot) => {
                    const comp = componentById(activeDraft.slots[slot]);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setPicker({ pos: activeBey, slot })}
                        className="group min-w-0 rounded-lg border border-dashed border-border bg-card/60 p-2.5 text-left transition-all hover:border-primary/60 hover:bg-card"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/30">
                            {comp?.image_url ? (
                              <img src={comp.image_url} alt={comp.name} className="h-full w-full object-contain" />
                            ) : (
                              <div className="text-lg text-muted-foreground">+</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{SLOT_LABEL[slot]}</div>
                            {comp ? (
                              <>
                                <div className="break-words text-sm font-bold leading-tight">{comp.name}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <span className={`rounded border px-1.5 py-0.5 text-[9px] ${RARITY_COLORS[comp.rarity]}`}>
                                    {RARITY_LABELS[comp.rarity]}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {TYPE_EMOJI[comp.bey_type]} {TYPE_LABELS[comp.bey_type]}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground">Seleziona componente</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </Card>
        </main>

        <aside className="space-y-3 xl:sticky xl:top-40 xl:self-start">
          <Card className="p-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Statistiche Bey {activeBey + 1}
            </div>
            <div className="space-y-3">
              {STAT_ROWS.map(({ key, label, icon: Icon, color }) => {
                const v = activeAssembled.totalStats[key] ?? 0;
                const pct = Math.min(100, Math.round((v / 60) * 100));
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />{label}
                      </span>
                      <span className="font-bold tabular-nums">{v}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
              <div className="rounded-md bg-muted/30 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Burst Pool</div>
                <div className="font-bold tabular-nums">{activeAssembled.hp}</div>
              </div>
              <div className="rounded-md bg-muted/30 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Stamina</div>
                <div className="font-bold tabular-nums">{activeAssembled.stamina}</div>
              </div>
            </div>
          </Card>
        </aside>
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
