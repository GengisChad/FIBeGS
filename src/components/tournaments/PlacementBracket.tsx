import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Undo2, Bell, Trophy } from "lucide-react";
import { MatchScoringDialog } from "./MatchScoringDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Match {
  id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  status: string;
  pairing_meta?: any | null;
  phase?: string;
}

interface Props {
  tiebreakerMatches: Match[];
  thirdPlaceMatch?: Match | null;
  topCutSize: number;
  topCutFinalRound: number;
  tiebreakerDepth: number;
  tiebreakerMode?: "advanced" | "rapid";
  playerMap: Map<string, string>;
  avatarMap?: Map<string, string | null>;
  usernameMap?: Map<string, string>;
  onResult: (matchId: string, winnerId: string | null, p1Score: number, p2Score: number) => void;
  onUndoMatch?: (matchId: string) => void;
  onNotifyPlayers?: (playerIds: string[]) => void;
  isStaff: boolean;
  scoringPolicy?: string;
  currentUserId?: string;
  userHasRefereeBadge?: boolean;
  isParticipant?: boolean;
  winThresholdEarly?: number;
  winThresholdLate?: number;
}

const ord = (n: number) => `${n}°`;

const roundSourceLabel = (rfFinal: number): string => {
  if (rfFinal === 1) return "Semi";
  if (rfFinal === 2) return "Quarti";
  if (rfFinal === 3) return "Ottavi";
  if (rfFinal === 4) return "Sedicesimi";
  return `T${rfFinal}`;
};

type SlotRef =
  | { kind: "loser-tc"; label: string }
  | { kind: "winner-of"; matchKey: string; label: string }
  | { kind: "loser-of"; matchKey: string; label: string }
  | { kind: "player"; playerId: string };

type AbstractMatch = {
  key: string;
  bandStart: number;
  bandEnd: number;
  tcRound: number;
  groupPath: string; // "", "W", "L", "W.L", ...
  groupSize: number;
  bracketIndex: number;
  level: number; // 1..L
  isFinal: boolean;
  placementWinner?: number;
  placementLoser?: number;
  // resolved later:
  slot1: SlotRef;
  slot2: SlotRef;
};

type Band = {
  tcRound: number;
  start: number;
  end: number;
  K: number;
  levels: number;
  columns: AbstractMatch[][]; // by level (0-indexed)
};

function buildBand(tcRound: number, K: number, bandStart: number, topCutFinalRound: number, mode: "advanced" | "rapid" = "advanced"): Band {
  const sourceLabel = roundSourceLabel(topCutFinalRound - tcRound);
  const bandEnd = bandStart + K - 1;

  // Rapid mode: single column of K/2 final matches, each resolves two adjacent placements.
  if (mode === "rapid") {
    const column: AbstractMatch[] = [];
    for (let i = 0; i + 1 < K; i += 2) {
      const ps = bandStart + i;
      column.push({
        key: `r${tcRound}|root|s2|i${i / 2}`,
        bandStart,
        bandEnd,
        tcRound,
        groupPath: "root",
        groupSize: 2,
        bracketIndex: i / 2,
        level: 1,
        isFinal: true,
        placementWinner: ps,
        placementLoser: ps + 1,
        slot1: { kind: "loser-tc", label: `Perdente ${sourceLabel} #${i + 1}` },
        slot2: { kind: "loser-tc", label: `Perdente ${sourceLabel} #${i + 2}` },
      });
    }
    return { tcRound, start: bandStart, end: bandEnd, K, levels: 1, columns: [column] };
  }

  const levels = Math.max(1, Math.round(Math.log2(K)));
  const columns: AbstractMatch[][] = Array.from({ length: levels }, () => []);

  // Helper to build a sub-bracket recursively
  // players: array of SlotRef of length groupSize
  const recurse = (
    players: SlotRef[],
    groupPath: string,
    groupSize: number,
    placementStart: number,
    level: number,
  ) => {
    if (groupSize === 2) {
      const key = `r${tcRound}|${groupPath || "root"}|s${groupSize}|i0`;
      columns[level - 1].push({
        key,
        bandStart,
        bandEnd,
        tcRound,
        groupPath: groupPath || "root",
        groupSize: 2,
        bracketIndex: 0,
        level,
        isFinal: true,
        placementWinner: placementStart,
        placementLoser: placementStart + 1,
        slot1: players[0],
        slot2: players[1],
      });
      return;
    }
    const numMatches = groupSize / 2;
    const created: AbstractMatch[] = [];
    for (let i = 0; i < numMatches; i++) {
      const key = `r${tcRound}|${groupPath || "root"}|s${groupSize}|i${i}`;
      const m: AbstractMatch = {
        key,
        bandStart,
        bandEnd,
        tcRound,
        groupPath: groupPath || "root",
        groupSize,
        bracketIndex: i,
        level,
        isFinal: false,
        slot1: players[2 * i],
        slot2: players[2 * i + 1],
      };
      columns[level - 1].push(m);
      created.push(m);
    }
    // Now build W and L subgroups
    const winnerSlots: SlotRef[] = created.map((m, i) => ({
      kind: "winner-of",
      matchKey: m.key,
      label: `Vincitore Sp.${i + 1}`,
    }));
    const loserSlots: SlotRef[] = created.map((m, i) => ({
      kind: "loser-of",
      matchKey: m.key,
      label: `Perdente Sp.${i + 1}`,
    }));
    const isRoot = !groupPath;
    const winnersPath = isRoot ? "W" : `${groupPath}.W`;
    const losersPath = isRoot ? "L" : `${groupPath}.L`;
    recurse(winnerSlots, winnersPath, groupSize / 2, placementStart, level + 1);
    recurse(loserSlots, losersPath, groupSize / 2, placementStart + groupSize / 2, level + 1);
  };

  const initial: SlotRef[] = Array.from({ length: K }, (_, i) => ({
    kind: "loser-tc",
    label: `Perdente ${sourceLabel} #${i + 1}`,
  }));
  recurse(initial, "", K, bandStart, 1);

  return { tcRound, start: bandStart, end: bandEnd, K, levels, columns };
}

const findRealMatch = (
  matches: Match[],
  am: AbstractMatch,
): Match | undefined => {
  return matches.find((m) => {
    const meta = m.pairing_meta;
    if (!meta) return false;
    if (meta.tb_top_cut_round !== am.tcRound) return false;
    if ((meta.tb_group_path || "root") !== am.groupPath) return false;
    if ((meta.tb_group_size || 0) !== am.groupSize) return false;
    if ((meta.tb_bracket_index ?? 0) !== am.bracketIndex) return false;
    return true;
  });
};

export const PlacementBracket = ({
  tiebreakerMatches,
  thirdPlaceMatch,
  topCutSize,
  topCutFinalRound,
  tiebreakerDepth,
  tiebreakerMode = "advanced",
  playerMap,
  avatarMap,
  usernameMap,
  onResult,
  onUndoMatch,
  onNotifyPlayers,
  isStaff,
  scoringPolicy,
  currentUserId,
  userHasRefereeBadge,
  isParticipant,
  winThresholdEarly,
  winThresholdLate,
}: Props) => {
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);

  const bands = useMemo<Band[]>(() => {
    if (!topCutSize || !topCutFinalRound || tiebreakerDepth <= 0) return [];
    const out: Band[] = [];
    // bands from R=1..F-1 (excluding final). 3rd/4th is handled separately.
    for (let R = 1; R < topCutFinalRound; R++) {
      const rfFinal = topCutFinalRound - R;
      const start = rfFinal === 1 ? 3 : Math.pow(2, rfFinal) + 1;
      const end = Math.pow(2, rfFinal + 1);
      const K = end - start + 1;
      if (start > tiebreakerDepth) continue;
      if (rfFinal === 1) continue; // 3rd/4th rendered separately
      out.push(buildBand(R, K, start, topCutFinalRound, tiebreakerMode));
    }
    return out;
  }, [topCutSize, topCutFinalRound, tiebreakerDepth, tiebreakerMode]);

  const showThirdPlace = !!thirdPlaceMatch && tiebreakerDepth >= 3;

  if (bands.length === 0 && !showThirdPlace) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Nessuno spareggio piazzamento configurato per questo torneo.
        </p>
      </div>
    );
  }

  // Helper to resolve a SlotRef into a player name + match-card label
  const resolveSlot = (
    slot: SlotRef,
    realByKey: Map<string, Match>,
  ): { playerId: string | null; label: string; avatarUrl?: string | null } => {
    if (slot.kind === "player") {
      return {
        playerId: slot.playerId,
        label: playerMap.get(slot.playerId) || "TBD",
        avatarUrl: avatarMap?.get(slot.playerId),
      };
    }
    if (slot.kind === "loser-tc") {
      return { playerId: null, label: slot.label };
    }
    // winner-of / loser-of: try to resolve from real match
    const parent = realByKey.get(slot.matchKey);
    if (parent && parent.status === "completed" && parent.winner_id) {
      const playerId =
        slot.kind === "winner-of"
          ? parent.winner_id
          : parent.player1_id === parent.winner_id
          ? parent.player2_id
          : parent.player1_id;
      if (playerId) {
        return {
          playerId,
          label: playerMap.get(playerId) || "TBD",
          avatarUrl: avatarMap?.get(playerId),
        };
      }
    }
    return { playerId: null, label: slot.label };
  };

  const renderBand = (band: Band) => {
    const realByKey = new Map<string, Match>();
    band.columns.forEach((col) => {
      col.forEach((am) => {
        const real = findRealMatch(tiebreakerMatches, am);
        if (real) realByKey.set(am.key, real);
      });
    });

    // Compact layout without connector lines.
    const ROW_H = 116;
    const ROW_GAP = 24;
    const ROUND_GAP = 28;
    const firstColCount = band.columns[0]?.length || 1;
    const gridRows = Math.max(firstColCount * 2 - 1, 1);

    return (
      <section
        key={`band-${band.tcRound}`}
        className="rounded-2xl border border-border bg-card p-3 sm:p-4"
      >
        <header className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="font-display text-base sm:text-lg">
            Spareggio {ord(band.start)}–{ord(band.end)} posto
          </h3>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {roundSourceLabel(topCutFinalRound - band.tcRound)} · {band.K} giocatori
          </span>
        </header>

        <div
          className="overflow-x-auto -mx-1 px-1"
          style={{ WebkitOverflowScrolling: "touch" as any }}
        >
          <div className="grid grid-flow-col items-stretch" style={{ columnGap: ROUND_GAP, minWidth: "max-content" }}>
            {band.columns.map((col, colIdx) => {
              const isFinalCol = colIdx === band.levels - 1;
              const title = isFinalCol
                ? "Finali piazzamento"
                : band.levels === 1
                ? "Spareggi"
                : `Turno ${colIdx + 1}`;
              const totalHeight = gridRows * ROW_H + (gridRows - 1) * ROW_GAP;
              return (
                <section key={colIdx} className="grid grid-rows-[auto_1fr] shrink-0 w-[210px] sm:w-[230px]">
                  <h4 className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground text-center mb-2">
                    {title}
                  </h4>
                  <div className="flex flex-col justify-around" style={{ height: `${totalHeight}px`, gap: `${ROW_GAP}px` }}>
                    {col.map((am) => {
                      const real = realByKey.get(am.key);
                      const s1 = resolveSlot(am.slot1, realByKey);
                      const s2 = resolveSlot(am.slot2, realByKey);
                      const p1Id = real?.player1_id ?? s1.playerId;
                      const p2Id = real?.player2_id ?? s2.playerId;
                      const p1Name = p1Id ? playerMap.get(p1Id) || s1.label : s1.label;
                      const p2Name = p2Id ? playerMap.get(p2Id) || s2.label : s2.label;
                      const p1Avatar = p1Id ? avatarMap?.get(p1Id) : null;
                      const p2Avatar = p2Id ? avatarMap?.get(p2Id) : null;
                      return (
                        <div key={am.key} className="relative shrink-0">
                          <PlacementMatchCard
                            abstract={am}
                            real={real}
                            p1Id={p1Id}
                            p2Id={p2Id}
                            p1Name={p1Name}
                            p2Name={p2Name}
                            p1Avatar={p1Avatar}
                            p2Avatar={p2Avatar}
                            isStaff={isStaff}
                            scoringPolicy={scoringPolicy}
                            currentUserId={currentUserId}
                            userHasRefereeBadge={userHasRefereeBadge}
                            isParticipant={isParticipant}
                            onOpenScoring={() => real && setScoringMatch(real)}
                            onUndoMatch={onUndoMatch}
                            onNotifyPlayers={onNotifyPlayers}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {bands.map(renderBand)}

      {showThirdPlace && thirdPlaceMatch && (
        <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <header className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="font-display text-base sm:text-lg flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Finale 3°/4° posto
            </h3>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Perdenti Semi
            </span>
          </header>
          <div className="max-w-md mx-auto">
            <PlacementMatchCard
              abstract={{
                key: "third-place",
                bandStart: 3,
                bandEnd: 4,
                tcRound: topCutFinalRound - 1,
                groupPath: "root",
                groupSize: 2,
                bracketIndex: 0,
                level: 1,
                isFinal: true,
                placementWinner: 3,
                placementLoser: 4,
                slot1: { kind: "loser-tc", label: "Perdente Semi #1" },
                slot2: { kind: "loser-tc", label: "Perdente Semi #2" },
              }}
              real={thirdPlaceMatch}
              p1Id={thirdPlaceMatch.player1_id}
              p2Id={thirdPlaceMatch.player2_id}
              p1Name={thirdPlaceMatch.player1_id ? playerMap.get(thirdPlaceMatch.player1_id) || "TBD" : "Perdente Semi #1"}
              p2Name={thirdPlaceMatch.player2_id ? playerMap.get(thirdPlaceMatch.player2_id) || "TBD" : "Perdente Semi #2"}
              p1Avatar={thirdPlaceMatch.player1_id ? avatarMap?.get(thirdPlaceMatch.player1_id) : null}
              p2Avatar={thirdPlaceMatch.player2_id ? avatarMap?.get(thirdPlaceMatch.player2_id) : null}
              isStaff={isStaff}
              scoringPolicy={scoringPolicy}
              currentUserId={currentUserId}
              userHasRefereeBadge={userHasRefereeBadge}
              isParticipant={isParticipant}
              onOpenScoring={() => setScoringMatch(thirdPlaceMatch)}
              onUndoMatch={onUndoMatch}
              onNotifyPlayers={onNotifyPlayers}
            />
          </div>
        </section>
      )}

      {scoringMatch && (() => {
        // Only the 3rd/4th place match uses the late threshold (7 pts).
        // All other positional tiebreakers use the early threshold (4 pts).
        const isThirdPlace = !!thirdPlaceMatch && scoringMatch.id === thirdPlaceMatch.id;
        const threshold = isThirdPlace ? (winThresholdLate ?? 7) : (winThresholdEarly ?? 4);
        return (
          <MatchScoringDialog
            open={!!scoringMatch}
            onOpenChange={(v) => { if (!v) setScoringMatch(null); }}
            matchId={scoringMatch.id}
            matchNumber={scoringMatch.match_number}
            player1Id={scoringMatch.player1_id}
            player2Id={scoringMatch.player2_id}
            player1Name={
              scoringMatch.player1_id
                ? playerMap.get(scoringMatch.player1_id) || "TBD"
                : "TBD"
            }
            player2Name={
              scoringMatch.player2_id
                ? playerMap.get(scoringMatch.player2_id) || "TBD"
                : "TBD"
            }
            player1Avatar={scoringMatch.player1_id ? avatarMap?.get(scoringMatch.player1_id) : null}
            player2Avatar={scoringMatch.player2_id ? avatarMap?.get(scoringMatch.player2_id) : null}
            onResult={(matchId, winnerId, p1Score, p2Score) => {
              onResult(matchId, winnerId, p1Score, p2Score);
              setScoringMatch(null);
            }}
            winThreshold={threshold}
          />
        );
      })()}
    </div>
  );
};

// =============================================================
// Match Card

const PlacementMatchCard = ({
  abstract,
  real,
  p1Id,
  p2Id,
  p1Name,
  p2Name,
  p1Avatar,
  p2Avatar,
  isStaff,
  scoringPolicy,
  currentUserId,
  userHasRefereeBadge,
  isParticipant,
  onOpenScoring,
  onUndoMatch,
  onNotifyPlayers,
}: {
  abstract: AbstractMatch;
  real?: Match;
  p1Id: string | null;
  p2Id: string | null;
  p1Name: string;
  p2Name: string;
  p1Avatar?: string | null;
  p2Avatar?: string | null;
  isStaff: boolean;
  scoringPolicy?: string;
  currentUserId?: string;
  userHasRefereeBadge?: boolean;
  isParticipant?: boolean;
  onOpenScoring: () => void;
  onUndoMatch?: (matchId: string) => void;
  onNotifyPlayers?: (playerIds: string[]) => void;
}) => {
  const isCompleted = real?.status === "completed";
  const policy = scoringPolicy || "staff_only";
  const bothReady = !!p1Id && !!p2Id && !!real;
  let canScore = false;
  if (real && !isCompleted && bothReady) {
    if (isStaff) canScore = true;
    else if (policy === "staff_and_referees" && userHasRefereeBadge) canScore = true;
    else if (policy === "staff_referees_players" && (userHasRefereeBadge || isParticipant)) canScore = true;
  }

  const winnerIsP1 = real && real.winner_id && real.winner_id === real.player1_id;
  const winnerIsP2 = real && real.winner_id && real.winner_id === real.player2_id;

  const placementBadge = abstract.isFinal && abstract.placementWinner
    ? `${ord(abstract.placementWinner)}/${ord(abstract.placementLoser!)} posto`
    : null;

  return (
    <Card
      className={`border-border overflow-hidden ${isCompleted ? "bg-card" : "bg-card/50"} ${
        canScore ? "cursor-pointer hover:border-primary/40 transition-colors" : ""
      } ${!real ? "border-dashed opacity-80" : ""}`}
      onClick={canScore ? onOpenScoring : undefined}
    >
      <CardContent className="p-0">
        {placementBadge && (
          <div className="px-2 pt-1.5 pb-1 text-center">
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
              {placementBadge}
            </span>
          </div>
        )}
        <div className="p-2 space-y-1">
          <PlayerRow name={p1Name} avatarUrl={p1Avatar} score={real?.player1_score ?? 0} isWinner={!!winnerIsP1} isCompleted={!!isCompleted} hasPlayer={!!p1Id} />
          <div className="text-center text-[8px] font-medium text-muted-foreground uppercase tracking-[0.25em]">
            VS
          </div>
          <PlayerRow name={p2Name} avatarUrl={p2Avatar} score={real?.player2_score ?? 0} isWinner={!!winnerIsP2} isCompleted={!!isCompleted} hasPlayer={!!p2Id} />
        </div>
        <div className="flex items-center justify-center gap-1 px-1 pb-1.5">
          {isCompleted ? (
            <>
              <Badge className="bg-primary/10 text-primary border-0 text-[8px] h-4 px-1.5">✓</Badge>
              {isStaff && onUndoMatch && real && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 text-destructive hover:bg-destructive/10"
                      onClick={(e) => e.stopPropagation()}
                      title="Annulla"
                    >
                      <Undo2 size={9} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Annullare il risultato?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Il risultato del match verrà annullato.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onUndoMatch(real.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sì, annulla
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          ) : canScore ? (
            <Badge variant="outline" className="text-[8px] h-4 px-1.5 text-muted-foreground">
              Gestisci
            </Badge>
          ) : !real ? (
            <Badge variant="outline" className="text-[8px] h-4 px-1.5 text-muted-foreground border-dashed">
              In attesa
            </Badge>
          ) : !bothReady ? (
            <Badge variant="outline" className="text-[8px] h-4 px-1.5 text-muted-foreground">
              TBD
            </Badge>
          ) : null}
          {isStaff && onNotifyPlayers && real && !isCompleted && p1Id && p2Id && (
            <Button
              size="sm"
              variant="ghost"
              className="h-4 w-4 p-0 text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                onNotifyPlayers([p1Id!, p2Id!]);
              }}
              title="Notifica"
            >
              <Bell size={9} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const PlayerRow = ({
  name,
  avatarUrl,
  score,
  isWinner,
  isCompleted,
  hasPlayer,
}: {
  name: string;
  avatarUrl?: string | null;
  score: number;
  isWinner: boolean;
  isCompleted: boolean;
  hasPlayer: boolean;
}) => {
  return (
    <div
      className={`flex items-center gap-1.5 py-1.5 px-2 rounded-md ${
        isWinner ? "bg-primary/10" : "bg-secondary/30"
      }`}
    >
      <Avatar className="h-5 w-5 shrink-0">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="bg-muted text-muted-foreground">
          <User size={10} />
        </AvatarFallback>
      </Avatar>
      <span
        className={`flex-1 min-w-0 text-[11px] sm:text-xs leading-tight break-words [overflow-wrap:anywhere] ${
          isWinner ? "font-semibold text-primary" : hasPlayer ? "font-medium text-foreground" : "italic text-muted-foreground"
        }`}
      >
        {name}
      </span>

      <span
        className={`text-[11px] sm:text-xs font-mono font-semibold min-w-[0.5rem] text-right ${
          isWinner ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {isCompleted ? score : ""}
      </span>
    </div>
  );
};
