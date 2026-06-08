import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, Layers, Sword, Shield, Zap, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { useActiveGameDeck } from "../state/gameDeckStore";
import {
  RARITY_COLORS,
  SERIES_LABEL,
  SLOT_LABEL,
  SLOT_ORDER,
  TYPE_EMOJI,
  TYPE_LABELS,
} from "../data/componentsCatalog";

const STAT_META = [
  { key: "ATK", label: "ATK", icon: Sword, color: "from-rose-500 to-rose-400" },
  { key: "DEF", label: "DEF", icon: Shield, color: "from-emerald-500 to-emerald-400" },
  { key: "STA", label: "STA", icon: Activity, color: "from-sky-500 to-sky-400" },
  { key: "BURST RES", label: "BURST", icon: Zap, color: "from-amber-500 to-amber-400" },
] as const;

const MAX_STAT = 60;
const AUTO_MS = 4200;

export const DeckShowcase = ({ onEdit }: { onEdit: () => void }) => {
  const { data, loading } = useActiveGameDeck();
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) setActive((i) => (i + 1) % 3);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [data]);

  if (loading) return <Card className="p-8 text-center text-sm text-muted-foreground">Caricamento deck...</Card>;
  if (!data) {
    return (
      <Card className="p-6 text-center space-y-3 border-dashed">
        <Layers className="h-10 w-10 mx-auto text-primary" />
        <div className="font-bold">Nessun deck pronto</div>
        <p className="text-xs text-muted-foreground">Assembla i tuoi 3 Beyblade combinando i componenti che hai sbloccato.</p>
        <Button onClick={onEdit} size="sm"><Edit3 className="h-4 w-4 mr-2" />Vai al Deck Editor</Button>
      </Card>
    );
  }

  // 3 faces of a triangular prism rotated 120° each.
  // Rotating the prism by -active*120deg brings the i-th face to the front.
  const rotY = -active * 120;

  return (
    <Card
      className="relative overflow-hidden p-4 sm:p-6 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={() => { pausedRef.current = true; }}
      onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 1500); }}
    >
      {/* Glow background */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-5 w-5 text-primary shrink-0" />
          <div className="font-bold truncate">{data.deck.name}</div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Edit3 className="h-3 w-3 mr-1" />Modifica
        </Button>
      </div>

      {/* 3D triangular carousel stage */}
      <div
        className="relative mx-auto"
        style={{ perspective: "1400px", height: 360 }}
      >
        <div
          className="absolute inset-0 transition-transform duration-700 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: `translateZ(-260px) rotateY(${rotY}deg)`,
          }}
        >
          {data.beys.map((b, idx) => {
            const equipped = SLOT_ORDER.map((slot) => ({ slot, comp: b.parts[slot] })).filter((p) => p.comp);
            const faceRot = idx * 120;
            const isActive = idx === active;
            return (
              <div
                key={b.position}
                className="absolute inset-0"
                style={{
                  transform: `rotateY(${faceRot}deg) translateZ(260px)`,
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                }}
              >
                <div
                  className={`mx-auto h-full w-full max-w-2xl rounded-2xl border ${isActive ? "border-primary/60 shadow-[0_0_40px_rgba(99,102,241,0.25)]" : "border-border/50"} bg-card/85 backdrop-blur p-4 flex flex-col`}
                >
                  {/* Bey header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Bey {b.position} · <span className="text-primary">{SERIES_LABEL[b.series]}</span>
                      </div>
                      <div className="text-lg font-extrabold truncate">{b.name}</div>
                    </div>
                    <div className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-full bg-muted/40 shrink-0">
                      <span>{TYPE_EMOJI[b.type]}</span>
                      <span className="font-bold uppercase tracking-wider">{TYPE_LABELS[b.type]}</span>
                    </div>
                  </div>

                  {/* Components row — large horizontal */}
                  <div className="flex-1 flex items-center justify-center">
                    {equipped.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">Nessun pezzo equipaggiato</div>
                    ) : (
                      <div className="flex items-end justify-center gap-2 sm:gap-4 w-full">
                        {equipped.map(({ slot, comp }, i) => (
                          <div
                            key={slot}
                            className="flex-1 max-w-[140px] flex flex-col items-center"
                            style={{ transform: `translateY(${i % 2 === 0 ? 0 : -8}px)` }}
                          >
                            <div className="relative w-full aspect-square rounded-xl bg-gradient-to-br from-muted/40 to-background border border-border/50 overflow-hidden flex items-center justify-center group">
                              <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-primary/0 to-primary/10" />
                              {comp!.image_url ? (
                                <img
                                  src={comp!.image_url}
                                  alt={comp!.name}
                                  className="w-[88%] h-[88%] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-105"
                                  loading="lazy"
                                  draggable={false}
                                />
                              ) : (
                                <div className="text-2xl text-muted-foreground">·</div>
                              )}
                              <span className={`absolute top-1 right-1 text-[9px] px-1 rounded border ${RARITY_COLORS[comp!.rarity]}`}>
                                {TYPE_EMOJI[comp!.bey_type]}
                              </span>
                            </div>
                            <div className="mt-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">{SLOT_LABEL[slot]}</div>
                            <div className="text-[11px] font-semibold text-center truncate w-full">{comp!.name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats row — below components */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border/40">
                    {STAT_META.map(({ key, label, icon: Icon, color }) => {
                      const v = b.totalStats[key] ?? 0;
                      const pct = Math.min(100, Math.round((v / MAX_STAT) * 100));
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-1 text-muted-foreground uppercase tracking-wider">
                              <Icon className="h-3 w-3" />{label}
                            </span>
                            <span className="font-bold tabular-nums">{v}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="relative mt-4 flex items-center justify-between">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setActive((i) => (i + 2) % 3)}
          aria-label="Bey precedente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          {data.beys.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Bey ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
            />
          ))}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setActive((i) => (i + 1) % 3)}
          aria-label="Bey successivo"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
