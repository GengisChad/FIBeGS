import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Trophy, Swords, Users } from "lucide-react";

interface MatchData {
  team1Name?: string;
  team2Name?: string;
  player1?: string;
  player2?: string;
  score1?: number | null;
  score2?: number | null;
  winnerName?: string;
  stage?: number;
  round?: number;
  group?: number;
  bracket?: string;
  phase?: string;
  seriesTitle?: string;
  [key: string]: any;
}

interface Props {
  matches: MatchData[];
}

/**
 * Visual preview of imported tournament:
 *  - Swiss tab: rounds grid
 *  - Top tab: bracket-tree style columns (R1 → R2 → … → Final)
 *  - Click any match slot → dialog with full info
 */
export const StagingBracketView = ({ matches }: Props) => {
  const [selected, setSelected] = useState<MatchData | null>(null);

  // Prefer explicit phase from importer; fallback to heuristic for legacy data
  const { swiss, top, spareggi } = useMemo(() => {
    const swiss: MatchData[] = [];
    const top: MatchData[] = [];
    const spareggi: MatchData[] = [];
    matches.forEach((m, idx) => {
      const tagged = { ...m, _idx: idx } as MatchData;
      const explicit = typeof m.phase === "string" ? m.phase.toLowerCase() : null;
      const bracketLower = typeof m.bracket === "string" ? m.bracket.toLowerCase() : "";
      const isLowerBracket = /(lower|loser|losers|perdenti|consolation|repechage)/.test(bracketLower);

      if (explicit === "tiebreaker" || explicit === "spareggio" || explicit === "placement" || isLowerBracket) {
        spareggi.push(tagged);
        return;
      }
      let isTop: boolean;
      if (explicit === "swiss" || explicit === "group") isTop = false;
      else if (explicit === "top_cut" || explicit === "top-cut" || explicit === "elimination") isTop = true;
      else {
        isTop =
          (typeof m.bracket === "string" && /final|semi|quarter|round.*16|top|elim|upper|winner/i.test(m.bracket)) ||
          !!m.placement_bracket;
      }
      if (isTop) top.push(tagged);
      else swiss.push(tagged);
    });
    return { swiss, top, spareggi };
  }, [matches]);

  const swissByRound = useMemo(() => {
    const map = new Map<number, MatchData[]>();
    swiss.forEach((m) => {
      const r = typeof m.round === "number" ? m.round : 0;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [swiss]);

  const topByRound = useMemo(() => {
    const map = new Map<number, MatchData[]>();
    top.forEach((m) => {
      const r = typeof m.round === "number" ? m.round : 1;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([r, ms]) => [r, ms.sort((a, b) => (a._idx ?? 0) - (b._idx ?? 0))] as [number, MatchData[]]);
  }, [top]);

  const spareggiByRound = useMemo(() => {
    const map = new Map<number, MatchData[]>();
    spareggi.forEach((m) => {
      const r = typeof m.round === "number" ? m.round : 1;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([r, ms]) => [r, ms.sort((a, b) => (a._idx ?? 0) - (b._idx ?? 0))] as [number, MatchData[]]);
  }, [spareggi]);

  const renderSlot = (m: MatchData) => {
    const p1 = m.team1Name || m.player1 || "—";
    const p2 = m.team2Name || m.player2 || "—";
    const w1 = m.winnerName === p1;
    const w2 = m.winnerName === p2;
    return (
      <button
        key={m._idx}
        onClick={() => setSelected(m)}
        className={cn(
          "w-full text-left border border-border rounded-md bg-background hover:border-primary/60 hover:bg-accent/30 transition-colors",
          "px-2 py-1.5 text-[11px] space-y-0.5"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate flex-1", w1 && "font-semibold text-primary")}>{p1}</span>
          <span className={cn("font-mono text-xs tabular-nums", w1 && "font-semibold text-primary")}>
            {m.score1 ?? "-"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate flex-1", w2 && "font-semibold text-primary")}>{p2}</span>
          <span className={cn("font-mono text-xs tabular-nums", w2 && "font-semibold text-primary")}>
            {m.score2 ?? "-"}
          </span>
        </div>
      </button>
    );
  };

  if (matches.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
        Nessun match da visualizzare
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue={swiss.length > 0 ? "swiss" : top.length > 0 ? "top" : "spareggi"} className="w-full">
        <TabsList className="h-8">
          <TabsTrigger value="swiss" className="text-xs gap-1.5" disabled={swiss.length === 0}>
            <Users size={12} /> Swiss ({swiss.length})
          </TabsTrigger>
          <TabsTrigger value="top" className="text-xs gap-1.5" disabled={top.length === 0}>
            <Trophy size={12} /> Top-Cut ({top.length})
          </TabsTrigger>
          <TabsTrigger value="spareggi" className="text-xs gap-1.5" disabled={spareggi.length === 0}>
            <Swords size={12} /> Spareggi ({spareggi.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swiss" className="mt-3">
          <div className="space-y-3">
            {swissByRound.map(([r, ms]) => (
              <div key={r} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-[11px] font-semibold flex items-center gap-2">
                  <Swords size={11} /> Round {r || "?"}
                  <Badge variant="secondary" className="text-[9px] ml-auto">{ms.length} match</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-2">
                  {ms.map(renderSlot)}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="top" className="mt-3">
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-fit">
              {topByRound.map(([r, ms], colIdx) => {
                const isLast = colIdx === topByRound.length - 1;
                return (
                  <div key={r} className="flex flex-col gap-2 min-w-[180px]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                      {isLast ? "Finale" : `Round ${r}`}
                    </div>
                    <div
                      className="flex flex-col justify-around flex-1 gap-2"
                      style={{ minHeight: `${Math.max(ms.length, 1) * 56}px` }}
                    >
                      {ms.map(renderSlot)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="spareggi" className="mt-3">
          <div className="text-[10px] text-muted-foreground mb-2">
            Match del loser bracket / spareggio · NON assegnano punti vittoria, ma determinano i piazzamenti finali oltre la top-cut.
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-fit">
              {spareggiByRound.map(([r, ms]) => (
                <div key={r} className="flex flex-col gap-2 min-w-[180px]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                    Round {r}
                  </div>
                  <div className="flex flex-col gap-2">
                    {ms.map(renderSlot)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {selected?.bracket || (selected?.round != null ? `Round ${selected.round}` : "Match")}
              {selected?.seriesTitle && <span className="text-muted-foreground"> · {selected.seriesTitle}</span>}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className={cn("text-right", selected.winnerName === (selected.team1Name || selected.player1) && "font-bold text-primary")}>
                  {selected.team1Name || selected.player1 || "—"}
                </div>
                <div className="font-mono text-lg px-2">
                  {selected.score1 ?? "-"} - {selected.score2 ?? "-"}
                </div>
                <div className={cn(selected.winnerName === (selected.team2Name || selected.player2) && "font-bold text-primary")}>
                  {selected.team2Name || selected.player2 || "—"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground border-t border-border pt-2 space-y-1">
                {selected.winnerName && <div>Vincitore: <span className="text-foreground font-medium">{selected.winnerName}</span></div>}
                {selected.round != null && <div>Round: {selected.round}</div>}
                {selected.stage != null && <div>Stage: {selected.stage + 1}</div>}
                {selected.group != null && <div>Gruppo: {selected.group}</div>}
                {selected.placement_bracket && <div>Spareggio: {selected.placement_bracket}</div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
