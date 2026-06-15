import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Coins,
  Gift,
  Layers,
  Package,
  Sword,
  Swords,
  Play,
  Bug,
  Plus,
  Infinity as InfinityIcon,
  ShieldAlert,
  Lock,
  LogOut,
} from "lucide-react";
import { useRpg } from "../state/rpgStore";
import { getRunLevel } from "../data/levels";
import { getLevelBackground } from "../data/levelAssets";
import { useAdmin } from "@/hooks/useAdmin";
import { DeckShowcase } from "../components/DeckShowcase";
import { toast } from "@/hooks/use-toast";

interface Props {
  onNavigate: (screen: "deck" | "shop" | "inventory" | "pvp" | "gacha" | "admin") => void;
  onPlay: (levelId?: number) => void;
  onExit: () => void;
}

export const MainMenu = ({ onNavigate, onPlay, onExit }: Props) => {
  const { profile, run, freeMode, setFreeMode, addCurrency, addGachaPoints } = useRpg();
  const { isAdmin } = useAdmin();
  const [debugOpen, setDebugOpen] = useState(false);
  const runLevel = run.currentLevel;
  const level = getRunLevel(runLevel);
  const ctaLabel = run.inBattle ? "Continua" : "Inizia battaglia";
  const bg = getLevelBackground(runLevel);

  const Action = ({ icon: Icon, label, onClick, disabled = false }: any) => (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 text-left text-white transition hover:border-primary/60 hover:bg-black/45 disabled:opacity-50"
    >
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <span className="truncate text-sm font-black">{label}</span>
    </button>
  );

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-black text-white md:min-h-0">
      <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" draggable={false} />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.86),rgba(0,0,0,.62)),linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.88))]" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col gap-3 p-3 sm:p-4 md:min-h-0 md:p-5">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">BEY-Tokon RPG</div>
            <div className="truncate text-xl font-black sm:text-2xl">Menu principale</div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-black/30" onClick={() => onNavigate("admin")} aria-label="Admin">
                <ShieldAlert className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant={debugOpen ? "secondary" : "outline"}
              className="h-9 w-9 border-white/15 bg-black/30"
              onClick={() => setDebugOpen((o) => !o)}
              aria-label="Debug"
            >
              <Bug className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-black/30 md:hidden" onClick={onExit} aria-label="Esci">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {debugOpen && (
          <Card className="border-amber-300/40 bg-amber-300/10 p-3 text-white">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 text-[11px] font-black uppercase tracking-widest text-amber-200">Debug</div>
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
                <Plus className="mr-1 h-3.5 w-3.5" /><Coins className="mr-1 h-3.5 w-3.5 text-amber-300" />+1000
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCurrency(10000)}>
                <Plus className="mr-1 h-3.5 w-3.5" /><Coins className="mr-1 h-3.5 w-3.5 text-amber-300" />+10k
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addGachaPoints(100)}>
                <Plus className="mr-1 h-3.5 w-3.5" /><Gift className="mr-1 h-3.5 w-3.5 text-fuchsia-300" />+100
              </Button>
            </div>
          </Card>
        )}

        <main className="grid flex-1 gap-3 md:grid-cols-[300px_minmax(0,1fr)] md:items-start">
          <section className="space-y-3">
            <Card className="overflow-hidden border-white/10 bg-black/40 p-4 text-white">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                {run.inBattle ? "Battaglia sospesa" : "Run corrente"}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-4xl font-black leading-none">Lv {runLevel}</div>
                  <div className="mt-1 text-xs font-bold text-white/50">Run infinita</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1 text-xs font-bold text-amber-200">
                    <Coins className="h-3.5 w-3.5" />{profile.currency}
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-1 text-xs font-bold text-fuchsia-200">
                    <Gift className="h-3.5 w-3.5" />{profile.gacha_points}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-primary">Prossima sfida</div>
                <div className="mt-1 truncate text-lg font-black">{level?.name ?? "Arena"}</div>
                {run.inBattle && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-100">
                    <Lock className="h-3.5 w-3.5" />Deck bloccato
                  </div>
                )}
              </div>
              <Button size="lg" onClick={() => level && onPlay(runLevel)} className="mt-4 h-12 w-full text-base font-black">
                <Play className="mr-2 h-5 w-5" />{ctaLabel}
              </Button>
            </Card>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              <Action icon={Package} label="Shop" onClick={() => onNavigate("shop")} />
              <Action icon={Gift} label="Gacha" onClick={() => onNavigate("gacha")} />
            </div>
          </section>

          <section className="space-y-3">
            <DeckShowcase
              onEdit={() => {
                if (!run.inBattle) onNavigate("deck");
              }}
              locked={run.inBattle}
            />

            <nav className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <Action icon={run.inBattle ? Lock : Layers} label="Deck" disabled={run.inBattle} onClick={() => onNavigate("deck")} />
              <Action icon={Sword} label="Inventario" onClick={() => onNavigate("inventory")} />
              <Action icon={Swords} label="PvP" onClick={() => onNavigate("pvp")} />
            </nav>
          </section>
        </main>
      </div>
    </div>
  );
};
