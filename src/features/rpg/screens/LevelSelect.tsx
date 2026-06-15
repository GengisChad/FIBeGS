import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lock, Play, ArrowLeft, Coins, Gift } from "lucide-react";
import { LEVELS } from "../data/levels";
import { useRpg } from "../state/rpgStore";
import { getBey } from "../data/beys";

interface Props { onBack: () => void; onPlay: (id?: number) => void; }

export const LevelSelect = ({ onBack, onPlay }: Props) => {
  const { run } = useRpg();
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Button>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LEVELS.map((l) => {
          const locked = l.id !== run.currentLevel;
          const active = l.id === run.currentLevel;
          return (
            <Card key={l.id} className={`p-4 space-y-3 ${active ? "border-primary/60 ring-2 ring-primary/20" : "opacity-50"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Livello {l.id}</div>
                  <div className="font-bold">{l.name}</div>
                </div>
                {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex gap-2">
                {l.enemyDeck.map(getBey).map((b, i) => (
                  <div key={i} className="w-10 h-10 rounded bg-background flex items-center justify-center text-xl border border-border">{b.emoji}</div>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Coins className="h-3 w-3 text-amber-400" />{l.reward.currency}</span>
                <span className="flex items-center gap-1"><Gift className="h-3 w-3 text-fuchsia-400" />{l.reward.gachaPoints}</span>
              </div>
              <Button disabled={locked} className="w-full" size="sm" onClick={() => onPlay(l.id)}>
                <Play className="h-4 w-4 mr-2" />{run.inBattle && active ? "Continua" : "Gioca"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
