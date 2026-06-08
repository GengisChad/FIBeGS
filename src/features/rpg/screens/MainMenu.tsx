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

  const Hub = ({ icon: Icon, label, onClick }: any) => (
    <button
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-card/80 hover:bg-card hover:border-primary/60 hover:-translate-y-0.5 transition-all"
    >
      <Icon className="h-7 w-7 text-primary group-hover:scale-110 transition-transform" />
      <div className="text-xs font-semibold uppercase tracking-wider">{label}</div>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-bold">{profile.currency}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
            <Gift className="h-4 w-4 text-fuchsia-400" />
            <span className="text-sm font-bold">{profile.gacha_points}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Livello max sbloccato: <span className="font-bold text-foreground">{profile.unlocked_level}</span> / {MAX_LEVEL}
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onNavigate("admin")}>
              <ShieldAlert className="h-3.5 w-3.5 mr-1" />Admin
            </Button>
          )}
          <Button
            size="sm"
            variant={debugOpen ? "secondary" : "outline"}
            className="h-7 px-2 text-[11px]"
            onClick={() => setDebugOpen((o) => !o)}
          >
            <Bug className="h-3.5 w-3.5 mr-1" />Debug
          </Button>
        </div>
      </div>

      {debugOpen && (
        <Card className="p-3 border-dashed border-amber-400/50 bg-amber-500/5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400 mr-2">Debug</div>
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
              <InfinityIcon className="h-3.5 w-3.5 mr-1" />Costi gratis: {freeMode ? "ON" : "OFF"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCurrency(1000)}>
              <Plus className="h-3.5 w-3.5 mr-1" /><Coins className="h-3.5 w-3.5 mr-1 text-amber-400" />+1000
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCurrency(10000)}>
              <Plus className="h-3.5 w-3.5 mr-1" /><Coins className="h-3.5 w-3.5 mr-1 text-amber-400" />+10k
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addGachaPoints(100)}>
              <Plus className="h-3.5 w-3.5 mr-1" /><Gift className="h-3.5 w-3.5 mr-1 text-fuchsia-400" />+100
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCurrency(-profile.currency)}>
              Reset monete
            </Button>
          </div>
        </Card>
      )}

      {/* Deck principale (sostituisce il personaggio) */}
      <DeckShowcase onEdit={() => onNavigate("deck")} />

      {/* Play CTA */}
      <Card className="p-4 flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-primary/15 via-card to-card border-primary/30">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Prossimo livello</div>
          <div className="text-lg font-bold">Livello {nextLevel}{level ? ` · ${level.name}` : ""}</div>
        </div>
        <Button size="lg" onClick={() => level && onPlay(level.id)}>
          <Play className="h-5 w-5 mr-2" />Inizia battaglia
        </Button>
      </Card>

      {/* Hub */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Hub icon={Package} label="Shop" onClick={() => onNavigate("shop")} />
        <Hub icon={Layers} label="Deck" onClick={() => onNavigate("deck")} />
        <Hub icon={Sword} label="Inventario" onClick={() => onNavigate("inventory")} />
        <Hub icon={Swords} label="PvP" onClick={() => onNavigate("pvp")} />
        <Hub icon={Map} label="Livelli" onClick={() => onNavigate("level")} />
        <Hub icon={Gift} label="Gacha" onClick={() => onNavigate("gacha")} />
      </div>
    </div>
  );
};
