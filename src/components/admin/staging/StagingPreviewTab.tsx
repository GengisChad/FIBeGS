import { useMemo, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Users, Award, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { StagingBracketView } from "./StagingBracketView";
import { computeStagingStandings } from "@/lib/computeStagingStandings";

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
  placement_bracket?: string | null;
  [key: string]: any;
}

interface StagingPreviewTabProps {
  participants: any[];
  standings: any[];
  matches: MatchData[];
  onMatchesChange: (next: MatchData[]) => void;
  onStandingsChange: (next: any[]) => void;
}

const isTiebreaker = (m: any): boolean => {
  const explicit = (m?.phase || "").toString().toLowerCase();
  if (explicit === "tiebreaker" || explicit === "spareggio" || explicit === "placement") return true;
  const bracket = (m?.bracket || "").toString().toLowerCase();
  return /(lower|loser|losers|perdenti|consolation|repechage)/.test(bracket);
};

export const StagingPreviewTab = ({
  participants,
  standings,
  matches,
  onStandingsChange,
}: StagingPreviewTabProps) => {
  // Always recompute standings from current participants + matches so the preview
  // is in sync with the source data (no stale ties or 0-0 rows).
  const computed = useMemo(
    () => computeStagingStandings(participants, matches),
    [participants, matches],
  );

  // Push the recomputed standings up to the editor so "Salva" persists them.
  // Skip when nothing has actually changed to avoid render loops.
  const lastPushedRef = useRef<string>("");
  useEffect(() => {
    if (!onStandingsChange) return;
    const sig = JSON.stringify(computed.standings.map((s) => [s.position, s.externalName, s.totalPoints, s.wins, s.losses]));
    if (sig === lastPushedRef.current) return;
    lastPushedRef.current = sig;
    onStandingsChange(computed.standings as any);
  }, [computed.standings, onStandingsChange]);

  const sortedStandings = computed.standings;

  // Per-player wins (excluding tiebreakers) for ranking preview
  const winsByName = useMemo(() => {
    const m = new Map<string, number>();
    matches.forEach((mt: any) => {
      if (isTiebreaker(mt)) return;
      const p1 = (mt.team1Name || mt.player1 || "").toString().trim().toLowerCase();
      const p2 = (mt.team2Name || mt.player2 || "").toString().trim().toLowerCase();
      const s1 = typeof mt.score1 === "number" ? mt.score1 : null;
      const s2 = typeof mt.score2 === "number" ? mt.score2 : null;
      const w = s1 != null && s2 != null && s1 !== s2
        ? (s1 > s2 ? p1 : p2)
        : (mt.winnerName || "").toString().trim().toLowerCase();
      if (!w) return;
      m.set(w, (m.get(w) || 0) + 1);
    });
    return m;
  }, [matches]);

  // BFL points = 2 (participation) + 4 × wins. NO scaling: i punti torneo
  // sono fissi, lo scaling stagionale è una cosa diversa applicata altrove.
  const N = participants.length;

  const pointsPreview = useMemo(() => {
    return participants
      .map((p: any) => {
        const key = (p.externalName || "").toString().trim().toLowerCase();
        const wins = winsByName.get(key) || 0;
        const points = 2 + wins * 4;
        return {
          externalName: p.externalName,
          matchedDisplayName: p.matchedDisplayName,
          matched: !!p.matchedUserId,
          wins,
          points,
        };
      })
      .sort((a, b) => b.points - a.points || b.wins - a.wins);
  }, [participants, winsByName]);

  // Stats summary
  const stats = useMemo(() => {
    const totalMatches = matches.length;
    const withScore = matches.filter((m: any) => m.score1 != null || m.score2 != null).length;
    const tiebreakers = matches.filter(isTiebreaker).length;
    const matched = participants.filter((p: any) => p.matchedUserId).length;
    return { totalMatches, withScore, tiebreakers, matched };
  }, [matches, participants]);

  return (
    <div className="space-y-3">
      {/* TOP STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard icon={<Users size={14} />} label="Partecipanti" value={`${stats.matched}/${N}`} hint="collegati" />
        <StatCard icon={<Layers size={14} />} label="Match" value={`${stats.withScore}/${stats.totalMatches}`} hint="con punteggio" />
        <StatCard icon={<Trophy size={14} />} label="Spareggi" value={`${stats.tiebreakers}`} hint="non contano vittorie" />
        <StatCard icon={<Award size={14} />} label="Match vinti tot." value={`${Array.from(winsByName.values()).reduce((a, b) => a + b, 0)}`} hint="esclusi spareggi" />
      </div>

      {/* PODIUM — full width, compact horizontal */}
      <div className="border border-border rounded-lg p-3 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent">
        <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold">
          <Trophy size={14} className="text-yellow-500" /> Podio
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((pos) => {
            const player = sortedStandings.find((s) => s.position === pos);
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div
                key={pos}
                className={cn(
                  "border rounded-lg p-3 text-center flex flex-col items-center justify-center gap-1",
                  pos === 1 && "border-yellow-500/50 bg-yellow-500/5",
                  pos === 2 && "border-gray-400/50 bg-gray-400/5",
                  pos === 3 && "border-orange-600/50 bg-orange-600/5",
                )}
              >
                <div className="text-3xl">{medals[pos - 1]}</div>
                <div className="text-sm font-medium truncate w-full">
                  {player?.matchedDisplayName || player?.externalName || "—"}
                </div>
                <div className="flex gap-2 text-[10px]">
                  <Badge variant="secondary" className="text-[9px]">{player?.wins ?? 0}V</Badge>
                  <Badge variant="default" className="text-[9px]">{player?.totalPoints ?? 0} pt</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN GRID: 3 columns on xl */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* LEFT: classifica finale */}
        <Panel
          title="Classifica finale"
          icon={<Users size={13} />}
          count={sortedStandings.length}
          className="lg:col-span-3"
        >
          <ScrollArea className="h-[480px]">
            <div className="divide-y divide-border/40">
              {sortedStandings.map((s: any, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-accent/30">
                  <div className={cn(
                    "w-7 h-6 rounded flex items-center justify-center text-[10px] font-bold tabular-nums shrink-0",
                    s.position === 1 && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
                    s.position === 2 && "bg-gray-400/20",
                    s.position === 3 && "bg-orange-600/20 text-orange-600 dark:text-orange-400",
                    s.position > 3 && "bg-muted text-muted-foreground",
                  )}>
                    {s.position || i + 1}°
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">
                      {s.matchedDisplayName || s.externalName}
                    </div>
                    {!s.matchedUserId && (
                      <Badge variant="outline" className="text-[8px] h-3 px-1 mt-0.5">Segnaposto</Badge>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {s.wins ?? 0}-{s.losses ?? 0}
                    </div>
                    <Badge variant="default" className="text-[9px] tabular-nums">{s.totalPoints ?? 0} pt</Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Panel>

        {/* CENTER: bracket interattivo */}
        <Panel
          title="Bracket interattivo"
          icon={<Layers size={13} />}
          count={matches.length}
          className="lg:col-span-6"
          hint="Clicca un match per i dettagli"
        >
          <div className="p-3">
            <StagingBracketView matches={matches} />
          </div>
        </Panel>

        {/* RIGHT: ranking points preview */}
        <Panel
          title="Punti BFL previsti"
          icon={<Award size={13} />}
          className="lg:col-span-3"
          hint="Bonus 2 + 4×V (spareggi esclusi)"
        >
          <ScrollArea className="h-[480px]">
            <div className="divide-y divide-border/40">
              {pointsPreview.map((p, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]">
                  <div className="w-5 text-center font-mono text-muted-foreground text-[10px]">{i + 1}</div>
                  <div className="flex-1 min-w-0 truncate">
                    {p.matched ? (
                      <span className="font-medium">{p.matchedDisplayName}</span>
                    ) : (
                      <span className="text-muted-foreground">{p.externalName}</span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[9px] h-4">{p.wins}V</Badge>
                  <Badge variant="default" className="text-[10px] tabular-nums w-12 justify-center">
                    {p.points} pt
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Panel>
      </div>
    </div>
  );
};

// ─── helpers ────────────────────────────────────────────────

const StatCard = ({
  icon, label, value, hint,
}: { icon: React.ReactNode; label: string; value: string; hint?: string }) => (
  <div className="border border-border rounded-lg px-3 py-2 bg-muted/20">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      {icon} {label}
    </div>
    <div className="text-lg font-bold tabular-nums">{value}</div>
    {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
  </div>
);

const Panel = ({
  title, icon, count, hint, className, children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn("border border-border rounded-lg overflow-hidden bg-card", className)}>
    <div className="bg-muted/40 px-3 py-2 border-b border-border flex items-center gap-1.5">
      {icon}
      <span className="text-xs font-semibold">{title}</span>
      {count != null && <Badge variant="outline" className="text-[9px] h-4">{count}</Badge>}
      {hint && <span className="ml-auto text-[10px] text-muted-foreground truncate">{hint}</span>}
    </div>
    {children}
  </div>
);
