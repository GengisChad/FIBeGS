import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Square, RotateCcw, Trophy, Sparkles } from "lucide-react";
import ArenaScene from "./ArenaScene";
import AssetManager, { SpriteAsset } from "./AssetManager";
import ParticipantManager from "./ParticipantManager";
import ParamsPanel from "./ParamsPanel";
import { Participant, DEFAULT_PARAMS, SimParams } from "./types";

export default function RandomPickerTab() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [params, setParams] = useState<SimParams>({ ...DEFAULT_PARAMS });
  const [sprites, setSprites] = useState<SpriteAsset[]>([]);
  const [arenaTextureUrl, setArenaTextureUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [winner, setWinner] = useState<Participant | null>(null);

  // Auto-assegna sprite UNICI ai partecipanti, in base al tipo.
  // Priorità: sprite del tipo esatto, poi sprite "any". Mai duplicati.
  // Se non bastano, lo spriteUrl resta undefined (verrà mostrato il pallino).
  const participantsKey = participants.map((p) => `${p.id}:${p.type}`).join("|");
  const spritesKey = sprites.map((s) => `${s.url}:${s.type}`).join("|");
  useEffect(() => {
    if (participants.length === 0) return;

    const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
    const byType: Record<string, string[]> = {
      attack: shuffle(sprites.filter((s) => s.type === "attack").map((s) => s.url)),
      defense: shuffle(sprites.filter((s) => s.type === "defense").map((s) => s.url)),
      stamina: shuffle(sprites.filter((s) => s.type === "stamina").map((s) => s.url)),
    };
    const anyPool: string[] = shuffle(sprites.filter((s) => s.type === "any").map((s) => s.url));
    const used = new Set<string>();

    let changed = false;
    const next = participants.map((p) => {
      let url: string | undefined;
      const typedPool = byType[p.type] || [];
      url = typedPool.find((u) => !used.has(u));
      if (!url) url = anyPool.find((u) => !used.has(u));
      if (url) used.add(url);
      if (p.spriteUrl !== url) {
        changed = true;
        return { ...p, spriteUrl: url };
      }
      return p;
    });
    if (changed) setParticipants(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantsKey, spritesKey]);

  const canStart = participants.length >= 8 && participants.length <= 128;

  const start = () => {
    setWinner(null);
    setResetKey((k) => k + 1);
    setRunning(true);
  };
  const stop = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setWinner(null);
    setResetKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      {/* HEADER pulito */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Random Picker</h2>
            <p className="text-xs text-muted-foreground">
              Simulazione Beyblade · 8-128 partecipanti
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {participants.length} bey
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {sprites.length} sprite
          </Badge>
        </div>
      </div>

      {/* LAYOUT: arena dominante a sinistra/centro, sidebar a destra */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ARENA + controlli */}
        <div className="space-y-4 min-w-0">
          <Card className="overflow-hidden border-border/50 bg-muted/30">
            <div className="relative aspect-square w-full max-h-[78vh] mx-auto">
              <ArenaScene
                participants={participants}
                params={params}
                arenaTextureUrl={arenaTextureUrl}
                running={running}
                resetKey={resetKey}
                onFinish={(w) => {
                  setRunning(false);
                  setWinner(w);
                }}
              />
              {/* Status indicator */}
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 border border-border/50">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    running ? "bg-primary animate-pulse" : "bg-muted-foreground"
                  }`}
                />
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground">
                  {running ? "Live" : "Idle"}
                </span>
              </div>
            </div>
          </Card>

          {/* Toolbar controlli */}
          <div className="flex flex-wrap items-center gap-2">
            {!running ? (
              <Button onClick={start} disabled={!canStart} size="lg" className="font-semibold">
                <Play size={16} className="mr-2 fill-current" /> Avvia
              </Button>
            ) : (
              <Button variant="destructive" onClick={stop} size="lg" className="font-semibold">
                <Square size={16} className="mr-2 fill-current" /> Stop
              </Button>
            )}
            <Button
              variant="outline"
              onClick={reset}
              disabled={participants.length === 0}
              size="lg"
            >
              <RotateCcw size={16} className="mr-2" /> Reset
            </Button>
            {!canStart && participants.length > 0 && (
              <p className="text-xs text-muted-foreground ml-auto">
                Servono <span className="font-semibold text-foreground">8-128</span> partecipanti
              </p>
            )}
          </div>

          {/* Vincitore */}
          {winner && (
            <Card className="p-5 border-primary/40 bg-primary/5 animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Trophy size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Vincitore
                  </p>
                  <p className="text-2xl font-bold truncate">{winner.name}</p>
                </div>
              </div>
            </Card>
          )}
          {!winner && !running && resetKey > 0 && (
            <Card className="p-3 text-xs text-muted-foreground border-dashed">
              Simulazione conclusa senza un vincitore (eliminazione simultanea).
            </Card>
          )}

          {/* Assets + Bladers su 2 colonne sotto l'arena */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AssetManager onSpritesChange={setSprites} onArenaChange={setArenaTextureUrl} />
            <ParticipantManager
              participants={participants}
              setParticipants={setParticipants}
              sprites={sprites}
            />
          </div>
        </div>

        {/* SIDEBAR parametri */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <ParamsPanel params={params} setParams={setParams} />
        </div>
      </div>
    </div>
  );
}
