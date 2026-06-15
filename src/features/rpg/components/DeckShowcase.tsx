import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, Layers, Sword, Shield, Zap, Activity, Lock } from "lucide-react";
import { useActiveGameDeck } from "../state/gameDeckStore";
import { SERIES_LABEL, SLOT_ORDER, TYPE_EMOJI, TYPE_LABELS } from "../data/componentsCatalog";

const STAT_META = [
  { key: "ATK", label: "ATK", icon: Sword },
  { key: "DEF", label: "DEF", icon: Shield },
  { key: "STA", label: "STA", icon: Activity },
  { key: "BURST RES", label: "BR", icon: Zap },
] as const;

export const DeckShowcase = ({ onEdit, locked = false }: { onEdit: () => void; locked?: boolean }) => {
  const { data, loading } = useActiveGameDeck();

  if (loading) {
    return <Card className="rounded-xl border-white/10 bg-black/35 p-6 text-center text-sm text-white/60">Caricamento deck...</Card>;
  }

  if (!data) {
    return (
      <Card className="rounded-xl border-dashed border-white/20 bg-black/35 p-6 text-center text-white">
        <Layers className="mx-auto h-10 w-10 text-primary" />
        <div className="mt-3 font-black">Nessun deck pronto</div>
        <Button onClick={onEdit} size="sm" disabled={locked} className="mt-4">
          {locked ? <Lock className="mr-2 h-4 w-4" /> : <Edit3 className="mr-2 h-4 w-4" />}
          {locked ? "Deck bloccato" : "Crea deck"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-xl border-white/10 bg-black/35 p-3 text-white">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Deck</div>
          <div className="truncate text-lg font-black">{data.deck.name}</div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit} disabled={locked} className="border-white/15 bg-white/5">
          {locked ? <Lock className="mr-1 h-3.5 w-3.5" /> : <Edit3 className="mr-1 h-3.5 w-3.5" />}
          {locked ? "Bloccato" : "Modifica"}
        </Button>
      </div>

      {locked && (
        <div className="mb-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
          Deck bloccato fino alla fine del livello.
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-3">
        {data.beys.map((b) => {
          const equipped = SLOT_ORDER.map((slot) => b.parts[slot]).filter(Boolean);
          const image = equipped.find((comp) => comp?.image_url)?.image_url;

          return (
            <div key={b.position} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-xl border border-white/10 bg-white/[0.055] p-2 lg:grid-cols-1">
              <div className="flex aspect-square items-center justify-center rounded-lg border border-white/10 bg-black/30">
                {image ? (
                  <img src={image} alt={b.name} className="h-[86%] w-[86%] object-contain" loading="lazy" draggable={false} />
                ) : (
                  <Layers className="h-8 w-8 text-white/25" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-primary">Bey {b.position} - {SERIES_LABEL[b.series]}</div>
                  <div className="shrink-0 text-xs">{TYPE_EMOJI[b.type]}</div>
                </div>
                <div className="truncate text-sm font-black">{b.name}</div>
                <div className="mt-1 truncate text-[11px] font-semibold text-white/50">{TYPE_LABELS[b.type]} - {equipped.length} pezzi</div>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {STAT_META.map(({ key, label, icon: Icon }) => (
                    <div key={key} className="rounded-md bg-black/25 px-1.5 py-1 text-center">
                      <Icon className="mx-auto h-3 w-3 text-white/45" />
                      <div className="text-[9px] font-bold text-white/45">{label}</div>
                      <div className="text-[11px] font-black tabular-nums">{b.totalStats[key] ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
