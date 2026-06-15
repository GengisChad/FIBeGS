import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  CatalogComponent,
  RARITY_COLORS,
  RARITY_LABELS,
  SLOT_LABEL,
  SlotKind,
  TYPE_EMOJI,
  TYPE_LABELS,
  Rarity,
} from "../data/componentsCatalog";
import { BeyType } from "../data/beys";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slot: SlotKind;
  catalog: CatalogComponent[];
  owned: Map<string, number>;
  value: string | null;
  onSelect: (componentId: string | null) => void;
}

const TYPE_FILTERS: Array<{ value: "all" | BeyType; label: string }> = [
  { value: "all", label: "Tutti" },
  { value: "attack", label: "Attacco" },
  { value: "defense", label: "Difesa" },
  { value: "stamina", label: "Stamina" },
  { value: "balance", label: "Balance" },
];

const RARITY_FILTERS: Array<{ value: "all" | Rarity; label: string }> = [
  { value: "all", label: "Tutte" },
  { value: "common", label: "Comune" },
  { value: "rare", label: "Raro" },
  { value: "epic", label: "Epico" },
  { value: "legendary", label: "Leggendario" },
];

export const RpgComponentPicker = ({ open, onOpenChange, slot, catalog, owned, value, onSelect }: Props) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | BeyType>("all");
  const [rarityFilter, setRarityFilter] = useState<"all" | Rarity>("all");

  const ownedForSlot = useMemo(
    () => catalog.filter((c) => c.slot === slot && c.enabled && (owned.get(c.id) ?? 0) > 0),
    [catalog, owned, slot],
  );

  const items = useMemo(() => {
    const s = search.trim().toLowerCase();
    return ownedForSlot.filter((c) => {
      const matchesSearch = !s || c.name.toLowerCase().includes(s);
      const matchesType = typeFilter === "all" || c.bey_type === typeFilter;
      const matchesRarity = rarityFilter === "all" || c.rarity === rarityFilter;
      return matchesSearch && matchesType && matchesRarity;
    });
  }, [ownedForSlot, rarityFilter, search, typeFilter]);

  const selected = value ? catalog.find((c) => c.id === value) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] max-h-[92dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden p-0 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-5">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">Scegli {SLOT_LABEL[slot]}</span>
            <span className="shrink-0 rounded-full bg-muted/40 px-2 py-1 text-[10px] font-bold text-muted-foreground">
              {items.length}/{ownedForSlot.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-border bg-background/95 px-4 py-3 sm:px-5">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca componente..."
                className="h-10 pl-9"
              />
            </div>
            {selected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onSelect(null); onOpenChange(false); }}
                className="justify-start lg:justify-center"
              >
                <X className="mr-1 h-3.5 w-3.5" />Rimuovi selezione
              </Button>
            )}
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            <div className="flex min-w-0 gap-1 overflow-x-auto pb-1">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setTypeFilter(filter.value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                    typeFilter === filter.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {filter.value === "all" ? null : <span className="mr-1">{TYPE_EMOJI[filter.value]}</span>}
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 gap-1 overflow-x-auto pb-1 xl:justify-end">
              {RARITY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setRarityFilter(filter.value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                    rarityFilter === filter.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {items.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
              Nessun {SLOT_LABEL[slot]} trovato con questi filtri.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
              {items.map((c) => {
                const qty = owned.get(c.id) ?? 0;
                const active = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onSelect(c.id); onOpenChange(false); }}
                    className={`min-w-0 rounded-lg border bg-card p-2.5 text-left transition-all ${
                      active ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/60"
                    }`}
                  >
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.name} className="h-full w-full object-contain" loading="lazy" />
                        ) : (
                          <div className="text-2xl">{TYPE_EMOJI[c.bey_type]}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 min-h-9 text-sm font-bold leading-tight">{c.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] ${RARITY_COLORS[c.rarity]}`}>
                            {RARITY_LABELS[c.rarity]}
                          </span>
                          <span className="rounded bg-muted/35 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {TYPE_EMOJI[c.bey_type]} {TYPE_LABELS[c.bey_type]}
                          </span>
                          <span className="rounded bg-muted/35 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                            x{qty}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
