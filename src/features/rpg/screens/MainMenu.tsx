import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Gift, Layers, Package, Sword, Swords, Map, Play, Bug, Plus, Infinity as InfinityIcon, ShieldAlert } from "lucide-react";
import { useRpg } from "../state/rpgStore";
import { LEVELS, MAX_LEVEL } from "../data/levels";
import { useAdmin } from "@/hooks/useAdmin";
import { DeckShowcase } from "../components/DeckShowcase";
import { toast } from "@/hooks/use-toast";

interface Props {
  onNavigate: (screen: "level" | "deck" | "shop" | "inventory" | "pvp" | "gacha" | "admin") => void;
  onPlay: (levelId: number) => void;
}

export const MainMenu = ({ onNavigate, onPlay }: Props) => {
  const { profile, freeMode, setFreeMode, addCurrency, addGachaPoints } = useRpg();
  const { isAdmin } = useAdmin();
  const [debugOpen, setDebugOpen] = useState(false);
  const nextLevel = Math.min(profile.unlocked_level, MAX_LEVEL);
  const level = LEVELS.find((l) => l.id === nextLevel);

  const Hub = ({ icon: Icon, label, caption, onClick }: any) => (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-lg border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card/95"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{label}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{caption}</span>
        </span>
      </div>
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary">RPG Hub</div>
              <h2 className="truncate text-xl font-extrabold">BEY-Tokon</h2>
              <p className="text-xs text-muted-foreground">
                Livello max sbloccato: <span className="font-bold text-foreground">{profile.unlocked_level}</span> / {MAX_LEVEL}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />Monete
                </div>
                <div className="font-bold tabular-nums">{profile.currency}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                  <Gift className="h-3.5 w-3.5 text-fuchsia-400" />Gacha
                </div>
                <div className="font-bold tabular-nums">{profile.gacha_points}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex h-full flex-wrap items-center justify-end gap-2">
            {isAdmin && (
              <Button size="sm" variant="outline" className="h-8 px-2 text-[11px]" onClick={() => onNavigate("admin")}>
                <ShieldAlert className="mr-1 h-3.5 w-3.5" />Admin
              </Button>
            )}
            <Button
              size="sm"
              variant={debugOpen ? "secondary" : "outline"}
              className="h-8 px-2 text-[11px]"
              onClick={() => setDebugOpen((o) => !o)}
            >
              <Bug className="mr-1 h-3.5 w-3.5" />Debug
            </Button>
          </div>
        </Card>
      </div>

      {debugOpen && (
        <Card className="border-dashed border-amber-400/50 bg-amber-500/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 text-[11px] font-bold uppercase tracking-widest text-amber-400">Debug</div>
            <Button
              size="sm"
              variant={freeMode ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => {
                const next = !freeMode;
                setFreeMode(next);
                toast({ title: `Costi ${next ? "disattivati" : "attivati"}` });
              }}
            >
              <InfinityIcon className="mr-1 h-3.5 w-3.5" />Costi gratis: {freeMode ? "ON" : "OFF"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCurrency(1000)}>
              <Plus className="mr-1 h-3.5 w-3.5" /><Coins className="mr-1 h-3.5 w-3.5 text-amber-400" />+1000
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCurrency(10000)}>
              <Plus className="mr-1 h-3.5 w-3.5" /><Coins className="mr-1 h-3.5 w-3.5 text-amber-400" />+10k
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addGachaPoints(100)}>
              <Plus className="mr-1 h-3.5 w-3.5" /><Gift className="mr-1 h-3.5 w-3.5 text-fuchsia-400" />+100
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCurrency(-profile.currency)}>
              Reset monete
            </Button>
          </div>
        </Card>
      )}

      <DeckShowcase onEdit={() => onNavigate("deck")} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/10 p-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Prossimo livello</div>
            <div className="truncate text-lg font-bold">Livello {nextLevel}{level ? ` - ${level.name}` : ""}</div>
          </div>
          <Button size="lg" onClick={() => level && onPlay(level.id)} className="shrink-0">
            <Play className="mr-2 h-5 w-5" />Inizia battaglia
          </Button>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Hub icon={Package} label="Shop" caption="Componenti" onClick={() => onNavigate("shop")} />
          <Hub icon={Gift} label="Gacha" caption="Pull e premi" onClick={() => onNavigate("gacha")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Hub icon={Layers} label="Deck" caption="Editor gioco" onClick={() => onNavigate("deck")} />
        <Hub icon={Sword} label="Inventario" caption="In arrivo" onClick={() => onNavigate("inventory")} />
        <Hub icon={Swords} label="PvP" caption="In arrivo" onClick={() => onNavigate("pvp")} />
        <Hub icon={Map} label="Livelli" caption="Campagna" onClick={() => onNavigate("level")} />
      </div>
    </div>
  );
};
