import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { CatalogComponent, RARITY_COLORS, RARITY_LABELS, SLOT_LABEL, SlotKind, TYPE_EMOJI, TYPE_LABELS } from "../data/componentsCatalog";
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

export const RpgComponentPicker = ({ open, onOpenChange, slot, catalog, owned, value, onSelect }: Props) => {
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const base = catalog.filter((c) => c.slot === slot && c.enabled && (owned.get(c.id) ?? 0) > 0);
    if (!search) return base;
    const s = search.toLowerCase();
    return base.filter((c) => c.name.toLowerCase().includes(s));
  }, [catalog, slot, owned, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Scegli {SLOT_LABEL[slot]}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..." className="pl-8" />
        </div>
        {value && (
          <Button variant="ghost" size="sm" onClick={() => { onSelect(null); onOpenChange(false); }} className="self-start">
            <X className="h-3 w-3 mr-1" />Rimuovi selezione
          </Button>
        )}
        <div className="overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pr-1">
          {items.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-12">
              Nessun {SLOT_LABEL[slot]} posseduto. Sbloccane dallo Shop o dal Gacha.
            </div>
          )}
          {items.map((c) => {
            const qty = owned.get(c.id) ?? 0;
            const active = c.id === value;
            return (
              <button
                key={c.id}
                onClick={() => { onSelect(c.id); onOpenChange(false); }}
                className={`p-2 rounded-lg border text-left transition-all ${active ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/60"} bg-card`}
              >
                <div className="aspect-square bg-muted/40 rounded mb-1.5 overflow-hidden flex items-center justify-center">
                  {c.image_url ? <img src={c.image_url} alt={c.name} className="w-full h-full object-contain" loading="lazy" /> : <div className="text-2xl">{TYPE_EMOJI[c.bey_type]}</div>}
                </div>
                <div className="text-xs font-bold truncate">{c.name}</div>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  <span className={`text-[9px] px-1 py-0.5 rounded border ${RARITY_COLORS[c.rarity]}`}>{RARITY_LABELS[c.rarity]}</span>
                  <span className="text-[9px] text-muted-foreground">{TYPE_EMOJI[c.bey_type]} {TYPE_LABELS[c.bey_type]}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">x{qty}</span>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
