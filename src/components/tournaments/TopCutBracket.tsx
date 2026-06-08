import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Undo2, Bell, ArrowLeftRight, Zap, Crown } from "lucide-react";

import { MatchScoringDialog } from "./MatchScoringDialog";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
}

const ordinalIt = (n: number) => `${n}°`;

const getPlacementLabel = (match: Match): string | null => {
  const meta = match.pairing_meta;
  if (!meta || !meta.tb_top_cut_round) return null;
  if (meta.tb_is_final && meta.tb_placement_winner != null) {
    return `${ordinalIt(meta.tb_placement_winner)}/${ordinalIt(meta.tb_placement_loser)} posto`;
  }
  const start = meta.tb_placement_start;
  const size = meta.tb_group_size;
  if (start != null && size != null) {
    return `Spareggio ${ordinalIt(start)}–${ordinalIt(start + size - 1)}`;
  }
  return null;
};

interface Props {
  matches: Match[];
  playerMap: Map<string, string>;
  avatarMap?: Map<string, string | null>;
  onResult: (matchId: string, winnerId: string | null, p1Score: number, p2Score: number) => void;
  isStaff: boolean;
  onUndoMatch?: (matchId: string) => void;
  onNotifyPlayers?: (playerIds: string[]) => void;
  isTiebreaker?: boolean;
  tournamentId?: string;
  scoringPolicy?: string;
  currentUserId?: string;
  userHasRefereeBadge?: boolean;
  usernameMap?: Map<string, string>;
  isParticipant?: boolean;
  isAdmin?: boolean;
  onSwapPlayers?: (matchId: string, playerSlot: "player1" | "player2", newPlayerId: string) => void;
  allPlayers?: Array<{ id: string; name: string }>;
  /** Custom win points for early top-cut rounds (default 4). */
  winThresholdEarly?: number;
  /** Custom win points for semifinal/final/3rd place (default 7). */
  winThresholdLate?: number;
}

const getRoundName = (roundMatchCount: number, isTiebreaker?: boolean) => {
  if (isTiebreaker) {
    return "Spareggio";
  }

  const playersInRound = roundMatchCount * 2;

  if (playersInRound === 2) return "Finale";
  if (playersInRound === 4) return "Semi";
  if (playersInRound === 8) return "Quarti";
  if (playersInRound === 16) return "Ottavi";
  if (playersInRound === 32) return "Sedicesimi";

  return `Top ${playersInRound}`;
};

const isThirdPlaceMatch = (match: Match, allMatches: Match[]) => {
  const topCutMatches = allMatches.filter(m => m.round >= 1);
  const maxRound = Math.max(...topCutMatches.map(m => m.round));
  return match.round === maxRound && match.match_number === 2;
};

const getBracketGridRowStart = (roundIndex: number, matchIndex: number) => {
  return 1 + (2 ** roundIndex - 1) + matchIndex * (2 ** (roundIndex + 1));
};

// Size presets based on total rounds
type SizePreset = "lg" | "md" | "sm" | "xs";

const getSizePreset = (totalRounds: number): SizePreset => {
  if (totalRounds <= 2) return "lg";
  if (totalRounds <= 3) return "md";
  if (totalRounds <= 4) return "sm";
  return "xs";
};

const sizeConfig: Record<SizePreset, {
  headerText: string;
  playerText: string;
  scoreText: string;
  vsText: string;
  avatarSize: string;
  avatarIcon: number;
  cardPadding: string;
  gap: string;
  roundGap: string;
  badgeText: string;
  iconSize: number;
  playerRowPy: string;
  colWidth: string;
}> = {
  lg: {
    headerText: "text-sm",
    playerText: "text-sm",
    scoreText: "text-sm",
    vsText: "text-[10px]",
    avatarSize: "h-7 w-7",
    avatarIcon: 14,
    cardPadding: "p-3",
    gap: "gap-4",
    roundGap: "gap-5",
    badgeText: "text-[9px]",
    iconSize: 11,
    playerRowPy: "py-2 px-2.5",
    colWidth: "min-w-[220px]",
  },
  md: {
    headerText: "text-xs",
    playerText: "text-sm",
    scoreText: "text-sm",
    vsText: "text-[9px]",
    avatarSize: "h-6 w-6",
    avatarIcon: 12,
    cardPadding: "p-2.5",
    gap: "gap-3",
    roundGap: "gap-4",
    badgeText: "text-[8px]",
    iconSize: 10,
    playerRowPy: "py-2 px-2",
    colWidth: "min-w-[200px]",
  },
  sm: {
    headerText: "text-[11px]",
    playerText: "text-xs",
    scoreText: "text-xs",
    vsText: "text-[8px]",
    avatarSize: "h-5 w-5",
    avatarIcon: 10,
    cardPadding: "p-2",
    gap: "gap-2.5",
    roundGap: "gap-3",
    badgeText: "text-[7px]",
    iconSize: 9,
    playerRowPy: "py-1.5 px-2",
    colWidth: "min-w-[180px]",
  },
  xs: {
    headerText: "text-[10px]",
    playerText: "text-[11px]",
    scoreText: "text-[11px]",
    vsText: "text-[7px]",
    avatarSize: "h-4 w-4",
    avatarIcon: 8,
    cardPadding: "p-2",
    gap: "gap-2",
    roundGap: "gap-2",
    badgeText: "text-[7px]",
    iconSize: 8,
    playerRowPy: "py-1.5 px-1.5",
    colWidth: "min-w-[160px]",
  },
};

const bracketLayoutConfig: Record<SizePreset, { rowHeight: number; rowGap: number; headerHeight: number; roundGapPx: number; colWidthPx: number }> = {
  lg: { rowHeight: 150, rowGap: 28, headerHeight: 32, roundGapPx: 32, colWidthPx: 240 },
  md: { rowHeight: 140, rowGap: 24, headerHeight: 30, roundGapPx: 28, colWidthPx: 220 },
  sm: { rowHeight: 128, rowGap: 20, headerHeight: 28, roundGapPx: 22, colWidthPx: 200 },
  xs: { rowHeight: 118, rowGap: 18, headerHeight: 26, roundGapPx: 18, colWidthPx: 180 },
};

export const TopCutBracket = ({ matches, playerMap, avatarMap, onResult, isStaff, onUndoMatch, onNotifyPlayers, isTiebreaker, tournamentId, scoringPolicy, currentUserId, userHasRefereeBadge, usernameMap, isParticipant, isAdmin, onSwapPlayers, allPlayers, winThresholdEarly, winThresholdLate }: Props) => {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const totalRounds = rounds.length;
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [swapDialog, setSwapDialog] = useState<{ matchId: string; slot: "player1" | "player2"; currentPlayerId: string | null } | null>(null);
  const preset = useMemo(() => getSizePreset(totalRounds), [totalRounds]);
  const sizes = sizeConfig[preset];
  const layout = bracketLayoutConfig[preset];

  const firstRound = rounds[0];
  const firstRoundMatchCount = useMemo(() => {
    if (!firstRound) return 1;
    return matches.filter((m) => m.round === firstRound).length || 1;
  }, [firstRound, matches]);
  const gridRowCount = Math.max(firstRoundMatchCount * 2 - 1, 1);

  const finalMatch = matches.find((m) => m.round === rounds[rounds.length - 1] && m.match_number === 1);
  const champion = !isTiebreaker && finalMatch?.winner_id ? playerMap.get(finalMatch.winner_id) : null;
  const championAvatar = !isTiebreaker && finalMatch?.winner_id ? avatarMap?.get(finalMatch.winner_id) : null;

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full">
      {/* Champion banner now rendered as podium under tournament phase tabs */}

      {(() => {
        if (!currentUserId) return null;
        const mine = matches.find((m) => m.player1_id === currentUserId || m.player2_id === currentUserId);
        if (!mine) return null;
        const isClosed = mine.status === "completed";
        const tagLabel = isClosed ? "Concluso" : "Prossimo";
        const tagCls = isClosed ? "" : "is-violet";
        return (
          <div className="ibnf-youhead" aria-label="Il tuo match in top cut">
            <Zap size={16} className="ibnf-youhead-ic" />
            <b>Il tuo match</b>
            <span className={`ibnf-youhead-tag ${tagCls}`}>{tagLabel}</span>
          </div>
        );
      })()}




      <div
        className="rounded-xl border border-border bg-secondary/20 overflow-x-auto overscroll-x-contain p-3 pb-4"
        style={{
          WebkitOverflowScrolling: "touch" as any,
          maxWidth: "100%",
          width: "100%",
        }}
      >
        {isTiebreaker ? (() => {
          // Render tiebreaker as a real bracket: one mini-bracket per "fascia"
          // (placement band), using the same grid layout as the main top cut.
          type Fascia = {
            key: string;
            rangeStart: number;
            rangeEnd: number;
            columns: { size: number; matches: Match[] }[];
          };
          const fasceMap = new Map<string | number, Match[]>();
          for (const m of matches) {
            const key = m.pairing_meta?.tb_top_cut_round ?? `r${m.round}`;
            if (!fasceMap.has(key)) fasceMap.set(key, []);
            fasceMap.get(key)!.push(m);
          }
          const fasce: Fascia[] = Array.from(fasceMap.entries()).map(([key, ms]) => {
            const withMeta = ms.filter((m) => m.pairing_meta?.tb_group_size);
            const sizesArr = Array.from(new Set(withMeta.map((m) => m.pairing_meta.tb_group_size as number)))
              .sort((a, b) => b - a);
            const columns = sizesArr.length > 0
              ? sizesArr.map((size) => ({
                  size,
                  matches: withMeta
                    .filter((m) => m.pairing_meta.tb_group_size === size)
                    .sort((a, b) =>
                      (a.pairing_meta.tb_placement_start ?? 0) - (b.pairing_meta.tb_placement_start ?? 0) ||
                      (a.pairing_meta.tb_bracket_index ?? 0) - (b.pairing_meta.tb_bracket_index ?? 0),
                    ),
                }))
              : [{ size: 0, matches: ms.sort((a, b) => a.match_number - b.match_number) }];
            const starts = withMeta.map((m) => m.pairing_meta.tb_placement_start as number);
            const ends = withMeta.map((m) => (m.pairing_meta.tb_placement_start as number) + (m.pairing_meta.tb_group_size as number) - 1);
            const rangeStart = starts.length ? Math.min(...starts) : 0;
            const rangeEnd = ends.length ? Math.max(...ends) : 0;
            return { key: String(key), rangeStart, rangeEnd, columns };
          }).sort((a, b) => a.rangeStart - b.rangeStart);

          return (
            <div className="flex flex-col gap-6">
              {fasce.map((fascia) => {
                const totalCols = fascia.columns.length;
                const firstColMatches = fascia.columns[0]?.matches.length || 1;
                const fasciaRowCount = Math.max(firstColMatches * 2 - 1, 1);
                return (
                  <section key={fascia.key} className="rounded-lg border border-border/60 bg-background/40 p-3">
                    {fascia.rangeStart > 0 && (
                      <header className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
                        <h4 className={`${sizes.headerText} font-semibold uppercase tracking-[0.2em] text-primary`}>
                          Spareggio {ordinalIt(fascia.rangeStart)}–{ordinalIt(fascia.rangeEnd)} posto
                        </h4>
                        <span className={`${sizes.badgeText} text-muted-foreground uppercase tracking-[0.15em]`}>
                          {fascia.columns.reduce((acc, c) => acc + c.matches.length, 0)} match
                        </span>
                      </header>
                    )}
                    <div className={`grid grid-flow-col ${sizes.roundGap} items-start`} style={{ minWidth: totalCols > 2 ? `${totalCols * 190}px` : "100%" }}>
                      {fascia.columns.map((col, colIdx) => {
                        const isFinalCol = col.size === 2;
                        const colTitle = isFinalCol
                          ? "Finali piazzamento"
                          : totalCols === 1
                            ? "Spareggi"
                            : `Turno ${colIdx + 1}`;
                        return (
                          <section key={col.size} className={`grid grid-rows-[auto_1fr] shrink-0 ${sizes.colWidth}`}>
                            <h5 className={`${sizes.headerText} mb-2 font-medium text-muted-foreground text-center uppercase tracking-[0.2em]`}>
                              {colTitle}
                            </h5>
                            <div
                              className="grid"
                              style={{
                                gridTemplateRows: `repeat(${fasciaRowCount}, ${layout.rowHeight}px)`,
                                rowGap: `${layout.rowGap}px`,
                              }}
                            >
                              {col.matches.map((match, matchIndex) => {
                                const span = Math.max(Math.floor(fasciaRowCount / Math.max(col.matches.length, 1)), 1);
                                const startRow = 1 + matchIndex * (fasciaRowCount / Math.max(col.matches.length, 1));
                                const placementLabel = getPlacementLabel(match);
                                const nextCol = fascia.columns[colIdx + 1];
                                const isLastCol = colIdx === fascia.columns.length - 1;
                                // Only draw outgoing connectors when next column has exactly half the matches.
                                const halvedNext = !isLastCol && nextCol && nextCol.matches.length * 2 === col.matches.length;
                                const halvedPrev = colIdx > 0 && fascia.columns[colIdx - 1].matches.length === col.matches.length * 2;
                                return (
                                  <div
                                    key={match.id}
                                    className="space-y-1.5 self-center"
                                    style={{
                                      gridRow: `${Math.round(startRow)} / span ${span}`,
                                    }}
                                  >
                                    {placementLabel && (
                                      <div className={`${sizes.badgeText} font-semibold uppercase tracking-[0.18em] text-primary/80 text-center`}>
                                        {placementLabel}
                                      </div>
                                    )}
                                    <div className="relative">
                                      <BracketMatchCard
                                        match={match}
                                        playerMap={playerMap}
                                        avatarMap={avatarMap}
                                        isStaff={isStaff}
                                        onUndoMatch={onUndoMatch}
                                        onNotifyPlayers={onNotifyPlayers}
                                        onOpenScoring={() => setScoringMatch(match)}
                                        sizes={sizes}
                                        scoringPolicy={scoringPolicy}
                                        currentUserId={currentUserId}
                                        userHasRefereeBadge={userHasRefereeBadge}
                                        usernameMap={usernameMap}
                                        isParticipant={isParticipant}
                                        isAdmin={isAdmin}
                                        onSwapRequest={(slot) => setSwapDialog({ matchId: match.id, slot, currentPlayerId: slot === "player1" ? match.player1_id : match.player2_id })}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          );
        })() : (() => {
          // Pair-packed layout: matches in a pair sit one under the other with a small gap,
          // and next round's match sits centered in front of the pair.
          const ROW_H = layout.rowHeight;
          const INTRA = 20;  // gap inside a pair
          const INTER = 56;  // larger gap between pairs
          const N = firstRoundMatchCount;
          const pairBlock = 2 * ROW_H + INTRA; // height of one pair (two cards stacked)
          const hasThirdPlace = matches.some((m) => isThirdPlaceMatch(m, matches));
          const baseHeight = (N / 2) * pairBlock + Math.max(0, (N / 2) - 1) * INTER;
          // Reserve extra space at the bottom for the 3rd/4th place card so it
          // doesn't overlap with the final (which is centered on the whole bracket).
          const totalHeight = baseHeight + (hasThirdPlace ? ROW_H + INTER : 0);

          // y-center of leaf (round 0) at index i
          const leafCenter = (i: number) => {
            const pair = Math.floor(i / 2);
            const inPair = i % 2;
            const pairTop = pair * (pairBlock + INTER);
            return pairTop + inPair * (ROW_H + INTRA) + ROW_H / 2;
          };

          return (
            <div className={`grid grid-flow-col items-start`} style={{ columnGap: `${layout.roundGapPx}px`, minWidth: totalRounds > 2 ? `${totalRounds * (layout.colWidthPx + layout.roundGapPx)}px` : "100%" }}>
              {rounds.map((round, roundIndex) => {
                const roundMatches = matches
                  .filter((m) => m.round === round)
                  .sort((a, b) => a.match_number - b.match_number);
                const span = Math.pow(2, roundIndex);

                return (
                  <section key={round} className={`flex flex-col shrink-0 ${sizes.colWidth}`}>
                    <h4
                      className={`${sizes.headerText} mb-2 font-medium text-muted-foreground text-center uppercase tracking-[0.2em] flex items-center justify-center`}
                      style={{ height: `${layout.headerHeight}px` }}
                    >
                      {getRoundName(roundMatches.length)}
                    </h4>

                    <div className="relative" style={{ height: `${totalHeight}px` }}>
                      {roundMatches.map((match, matchIndex) => {
                        const is3rdPlace = isThirdPlaceMatch(match, matches);
                        // 3rd/4th place: pin to the bottom of the column.
                        if (is3rdPlace) {
                          return (
                            <div
                              key={match.id}
                              className="absolute left-0 right-0 space-y-1.5"
                              style={{ bottom: 0 }}
                            >
                              <p className={`${sizes.headerText} text-center text-muted-foreground font-medium`}>
                                3°/4° Posto
                              </p>
                              <BracketMatchCard
                                match={match}
                                playerMap={playerMap}
                                avatarMap={avatarMap}
                                isStaff={isStaff}
                                onUndoMatch={onUndoMatch}
                                onNotifyPlayers={onNotifyPlayers}
                                onOpenScoring={() => setScoringMatch(match)}
                                sizes={sizes}
                                scoringPolicy={scoringPolicy}
                                currentUserId={currentUserId}
                                userHasRefereeBadge={userHasRefereeBadge}
                                usernameMap={usernameMap}
                                isParticipant={isParticipant}
                                isAdmin={isAdmin}
                                onSwapRequest={(slot) => setSwapDialog({ matchId: match.id, slot, currentPlayerId: slot === "player1" ? match.player1_id : match.player2_id })}
                              />
                            </div>
                          );
                        }

                        const firstLeaf = matchIndex * span;
                        const lastLeaf = firstLeaf + span - 1;
                        const center = (leafCenter(firstLeaf) + leafCenter(lastLeaf)) / 2;

                        return (
                          <div
                            key={match.id}
                            className="absolute left-0 right-0"
                            style={{ top: `${center}px`, transform: "translateY(-50%)" }}
                          >
                            <BracketMatchCard
                              match={match}
                              playerMap={playerMap}
                              avatarMap={avatarMap}
                              isStaff={isStaff}
                              onUndoMatch={onUndoMatch}
                              onNotifyPlayers={onNotifyPlayers}
                              onOpenScoring={() => setScoringMatch(match)}
                              sizes={sizes}
                              scoringPolicy={scoringPolicy}
                              currentUserId={currentUserId}
                              userHasRefereeBadge={userHasRefereeBadge}
                              usernameMap={usernameMap}
                              isParticipant={isParticipant}
                              isAdmin={isAdmin}
                              onSwapRequest={(slot) => setSwapDialog({ matchId: match.id, slot, currentPlayerId: slot === "player1" ? match.player1_id : match.player2_id })}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          );
        })()}
      </div>

      {scoringMatch && (() => {
        const remainingRounds = totalRounds - scoringMatch.round;
        const earlyDefault = winThresholdEarly ?? 4;
        const lateDefault = winThresholdLate ?? 7;
        // Late threshold for: semifinal (remaining=1), final (remaining=0), and 3rd/4th tiebreaker
        const threshold = remainingRounds <= 1 ? lateDefault : earlyDefault;
        return (
          <MatchScoringDialog
            open={!!scoringMatch}
            onOpenChange={(v) => { if (!v) setScoringMatch(null); }}
            matchId={scoringMatch.id}
            matchNumber={scoringMatch.match_number}
            player1Id={scoringMatch.player1_id}
            player2Id={scoringMatch.player2_id}
            player1Name={scoringMatch.player1_id ? playerMap.get(scoringMatch.player1_id) || "TBD" : "TBD"}
            player2Name={scoringMatch.player2_id ? playerMap.get(scoringMatch.player2_id) || "TBD" : "TBD"}
            player1Avatar={scoringMatch.player1_id ? avatarMap?.get(scoringMatch.player1_id) : null}
            player2Avatar={scoringMatch.player2_id ? avatarMap?.get(scoringMatch.player2_id) : null}
            onResult={onResult}
            winThreshold={threshold}
            tournamentId={tournamentId}
          />
        );
      })()}

      {/* Admin swap player dialog */}
      {swapDialog && isAdmin && onSwapPlayers && allPlayers && (
        <Dialog open={!!swapDialog} onOpenChange={(v) => { if (!v) setSwapDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg">Sostituisci Giocatore</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">
              Seleziona il giocatore da inserire al posto di <strong>{swapDialog.currentPlayerId ? playerMap.get(swapDialog.currentPlayerId) || "TBD" : "TBD"}</strong>
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {allPlayers
                .filter(p => p.id !== swapDialog.currentPlayerId)
                .map(p => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-sm"
                    onClick={() => {
                      onSwapPlayers(swapDialog.matchId, swapDialog.slot, p.id);
                      setSwapDialog(null);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};




const BracketMatchCard = ({
  match,
  playerMap,
  avatarMap,
  isStaff,
  onUndoMatch,
  onNotifyPlayers,
  onOpenScoring,
  sizes,
  scoringPolicy,
  currentUserId,
  userHasRefereeBadge,
  usernameMap,
  isParticipant,
  isAdmin,
  onSwapRequest,
}: {
  match: Match;
  playerMap: Map<string, string>;
  avatarMap?: Map<string, string | null>;
  isStaff: boolean;
  onUndoMatch?: (matchId: string) => void;
  onNotifyPlayers?: (playerIds: string[]) => void;
  onOpenScoring: () => void;
  sizes: typeof sizeConfig[SizePreset];
  scoringPolicy?: string;
  currentUserId?: string;
  userHasRefereeBadge?: boolean;
  usernameMap?: Map<string, string>;
  isParticipant?: boolean;
  isAdmin?: boolean;
  onSwapRequest?: (slot: "player1" | "player2") => void;
}) => {
  const p1Name = match.player1_id ? playerMap.get(match.player1_id) || "TBD" : "TBD";
  const p2Name = match.player2_id ? playerMap.get(match.player2_id) || "TBD" : "TBD";
  const p1Avatar = match.player1_id ? avatarMap?.get(match.player1_id) : null;
  const p2Avatar = match.player2_id ? avatarMap?.get(match.player2_id) : null;
  const bothReady = !!match.player1_id && !!match.player2_id;
  const isCompleted = match.status === "completed";
  const isPlayer = !!currentUserId && (currentUserId === match.player1_id || currentUserId === match.player2_id);
  const policy = scoringPolicy || "staff_only";
  let canOpenScoring = false;
  if (!isCompleted && bothReady) {
    if (isStaff) canOpenScoring = true;
    else if (policy === "staff_and_referees" && userHasRefereeBadge) canOpenScoring = true;
    else if (policy === "staff_referees_players" && (userHasRefereeBadge || isParticipant)) canOpenScoring = true;
  }
  const status = isCompleted ? "closed" : bothReady ? "pending" : "pending";
  const winA = match.winner_id && match.winner_id === match.player1_id;
  const winB = match.winner_id && match.winner_id === match.player2_id;
  const leadA = isCompleted && match.player1_score > match.player2_score;
  const leadB = isCompleted && match.player2_score > match.player1_score;

  const avatar = (name: string, url?: string | null, tone: "acid" | "violet" = "acid") => (
    <span
      className="ibnf-avt"
      style={{ ["--ac" as any]: tone === "violet" ? "var(--ibnf-violet)" : "var(--ibnf-acid)" }}
      aria-label={name}
    >
      {url ? <img src={url} alt={name} /> : <span>{(name || "?").slice(0, 1).toUpperCase()}</span>}
    </span>
  );

  return (
    <div
      className={`ibnf-pair ibnf-compact${isPlayer ? " is-mine" : ""}${canOpenScoring ? " cursor-pointer" : ""}`}
      data-st={status}
      onClick={canOpenScoring ? onOpenScoring : undefined}
    >
      <div className="ibnf-pair-body">
        <div className={`ibnf-pl${winA ? " win" : winB ? " lose" : ""}`}>
          {avatar(p1Name, p1Avatar, "acid")}
          <div className="ibnf-pl-tx">
            <span className="ibnf-pl-name">{p1Name}</span>
            {winA && (
              <span className="ibnf-pl-win-tag"><Crown size={10} /> Vince</span>
            )}
          </div>
        </div>

        <div className="ibnf-pair-mid">
          {isCompleted ? (
            <span className="ibnf-pair-score">
              <span className={`sa${leadA ? " lead" : ""}`}>{match.player1_score}</span>
              <span className="sep">:</span>
              <span className={`sb${leadB ? " lead" : ""}`}>{match.player2_score}</span>
            </span>
          ) : (
            <span className="ibnf-pair-vs">VS</span>
          )}
        </div>

        <div className={`ibnf-pl right${winB ? " win" : winA ? " lose" : ""}`}>
          {avatar(p2Name, p2Avatar, "violet")}
          <div className="ibnf-pl-tx">
            <span className="ibnf-pl-name">{p2Name}</span>
            {winB && (
              <span className="ibnf-pl-win-tag"><Crown size={10} /> Vince</span>
            )}
          </div>
        </div>
      </div>

      {/* Staff/admin footer actions (kept) */}
      {(isCompleted || canOpenScoring || (isStaff && onNotifyPlayers && bothReady) || (isAdmin && !isCompleted && onSwapRequest)) && (
        <div className="flex items-center justify-center gap-1 px-2 pb-1.5">
          {isCompleted ? (
            <>
              <Badge className={`bg-[color:var(--ibnf-acid)]/10 text-[color:var(--ibnf-acid)] border-0 ${sizes.badgeText}`}>✓</Badge>
              {isStaff && onUndoMatch && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-4 w-4 p-0 text-destructive hover:bg-destructive/10"
                      onClick={(e) => e.stopPropagation()} title="Annulla">
                      <Undo2 size={sizes.iconSize} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Annullare il risultato?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Il risultato del match verrà annullato. Questa azione è reversibile.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No, mantieni</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onUndoMatch(match.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Sì, annulla
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          ) : canOpenScoring ? (
            <Badge variant="outline" className={`${sizes.badgeText} h-3.5 text-muted-foreground px-1`}>Gestisci</Badge>
          ) : null}
          {isStaff && onNotifyPlayers && !isCompleted && match.player1_id && match.player2_id && (
            <Button
              size="sm"
              variant="ghost"
              className="h-4 w-4 p-0 text-[color:var(--ibnf-acid)] hover:bg-[color:var(--ibnf-acid)]/10"
              onClick={(e) => { e.stopPropagation(); onNotifyPlayers([match.player1_id!, match.player2_id!]); }}
              title="Notifica"
            >
              <Bell size={sizes.iconSize} />
            </Button>
          )}
          {isAdmin && !isCompleted && onSwapRequest && (
            <>
              {match.player1_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 text-muted-foreground hover:bg-secondary"
                  onClick={(e) => { e.stopPropagation(); onSwapRequest("player1"); }}
                  title="Sostituisci P1"
                >
                  <ArrowLeftRight size={sizes.iconSize} />
                </Button>
              )}
              {match.player2_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 text-muted-foreground hover:bg-secondary"
                  onClick={(e) => { e.stopPropagation(); onSwapRequest("player2"); }}
                  title="Sostituisci P2"
                >
                  <ArrowLeftRight size={sizes.iconSize} />
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

