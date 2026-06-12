import { useState, useEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Undo2, Bell, User, Swords, Eye, Zap, Flag, Crown, Phone, Gamepad2, RotateCcw, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MatchScoringDialog } from "./MatchScoringDialog";
import { MatchDeckReportDialog } from "./MatchDeckReportDialog";
import { MatchDeckView } from "./MatchDeckView";
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
  group_number?: number | null;
  scored_by?: string | null;
}

interface TableAssignment {
  enabled: boolean;
  /**
   * When groupsCount > 0: number of tables per group (legacy behaviour, label "T1, T2…").
   * When groupsCount === 0: total number of tables (1-32) over which the round's matches
   * are distributed round-robin sequentially, label "Tavolo A, B, C…".
   */
  matchesPerTable: number;
  /** Total number of Swiss groups for this view. 0 = no groups (single pool). */
  groupsCount?: number;
}

interface Props {
  matches: Match[];
  playerMap: Map<string, string>;
  avatarMap?: Map<string, string | null>;
  usernameMap?: Map<string, string>;
  onResult: (matchId: string, winnerId: string | null, p1Score: number, p2Score: number) => void;
  isStaff: boolean;
  onUndoMatch?: (matchId: string) => void;
  onNotifyPlayers?: (playerIds: string[]) => void;
  currentUserId?: string | null;
  matchDeckReports?: Map<string, Set<string>>;
  tableAssignment?: TableAssignment;
  onAutoCompleteRound?: (matchIds: string[]) => void;
  scoredByMap?: Map<string, string>;
  onForfeitMatch?: (matchId: string, forfeitingPlayerId: string) => void;
  tournamentId?: string;
  scoringPolicy?: string;
  userHasRefereeBadge?: boolean;
  isParticipant?: boolean;
  winThreshold?: number;
}

export const SwissRoundView = ({ matches, playerMap, avatarMap, usernameMap, onResult, isStaff, onUndoMatch, onNotifyPlayers, currentUserId, matchDeckReports, tableAssignment, onAutoCompleteRound, scoredByMap, onForfeitMatch, tournamentId, scoringPolicy, userHasRefereeBadge, isParticipant, winThreshold }: Props) => {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const maxRound = rounds[rounds.length - 1] || 1;
  const [selectedRound, setSelectedRound] = useState(maxRound);
  const prevMaxRound = useRef(maxRound);
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [search, setSearch] = useState("");

  // Auto-focus on new round when generated
  useEffect(() => {
    if (maxRound > prevMaxRound.current) {
      setSelectedRound(maxRound);
    }
    prevMaxRound.current = maxRound;
  }, [maxRound]);

  // Check if selected round has any pending (in-progress) matches
  const roundMatches = matches.filter((m) => m.round === selectedRound);
  const hasInProgress = roundMatches.some((m) => m.status === "pending" && m.player1_id && m.player2_id);
  const allDoneSelected = roundMatches.every((m) => m.status === "completed");

  // Compute table assignment per match (id -> table label) and live status
  const tableLabelByMatch = new Map<string, string>();
  const liveMatchIds = new Set<string>();

  if (tableAssignment?.enabled) {
    const tablesCount = Math.max(1, tableAssignment.matchesPerTable || 1);
    const hasGroups = (tableAssignment.groupsCount ?? 0) > 0;

    if (!hasGroups) {
      // No groups: round-robin distribute the round's matches across N total tables.
      const sorted = [...roundMatches].sort((a, b) => a.match_number - b.match_number);
      const perTable: Match[][] = Array.from({ length: tablesCount }, () => []);
      sorted.forEach((m, idx) => {
        const tableIdx = idx % tablesCount;
        const letter = String.fromCharCode(65 + tableIdx); // A, B, C...
        tableLabelByMatch.set(m.id, `Tavolo ${letter}`);
        perTable[tableIdx].push(m);
      });
      for (const queue of perTable) {
        const next = queue.find((m) => m.status === "pending" && m.player1_id && m.player2_id);
        if (next) liveMatchIds.add(next.id);
      }
    } else {
      // Groups active: matches passed in are already filtered to a single group.
      // Distribute this group's round matches round-robin across `tablesCount` tables labelled T1..Tn.
      const sorted = [...roundMatches].sort((a, b) => a.match_number - b.match_number);
      const perTable: Match[][] = Array.from({ length: tablesCount }, () => []);
      sorted.forEach((m, idx) => {
        const tableIdx = idx % tablesCount;
        tableLabelByMatch.set(m.id, `Tavolo ${tableIdx + 1}`);
        perTable[tableIdx].push(m);
      });
      for (const queue of perTable) {
        const next = queue.find((m) => m.status === "pending" && m.player1_id && m.player2_id);
        if (next) liveMatchIds.add(next.id);
      }
    }
  } else {
    for (const m of roundMatches) {
      if (m.status === "pending" && m.player1_id && m.player2_id) {
        liveMatchIds.add(m.id);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Round selector */}
      <div className="flex gap-2 flex-wrap items-center">
        {rounds.length > 6 ? (
          <Select value={String(selectedRound)} onValueChange={(v) => setSelectedRound(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rounds.map((r) => {
                const rMatches = matches.filter((m) => m.round === r);
                const allDone = rMatches.every((m) => m.status === "completed");
                return (
                  <SelectItem key={r} value={String(r)}>
                    Turno {r} {allDone ? "✓" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        ) : (
          rounds.map((r) => {
            const rMatches = matches.filter((m) => m.round === r);
            const allDone = rMatches.every((m) => m.status === "completed");
            return (
              <Button
                key={r}
                variant={selectedRound === r ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRound(r)}
                className="gap-1"
              >
                Turno {r}
                {allDone && <Check size={12} className={selectedRound === r ? "text-primary-foreground" : "text-primary"} />}
              </Button>
            );
          })
        )}
        {onAutoCompleteRound && hasInProgress && (
          <Button
            size="sm"
            variant="destructive"
            className="gap-1 text-[10px]"
            onClick={() => {
              const pendingIds = roundMatches
                .filter((m) => m.status === "pending" && m.player1_id && m.player2_id)
                .map((m) => m.id);
              if (pendingIds.length > 0) onAutoCompleteRound(pendingIds);
            }}
          >
            <Zap size={12} />
            Auto
          </Button>
        )}
      </div>
      {/* Sticky compact search */}
      <div className="ibnf-swiss-toolbar">
        <div className="ibnf-swiss-search">
          <Search size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca il tuo nick o tavolo…"
            aria-label="Filtra abbinamenti"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Pulisci ricerca" className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      {(() => {
        if (!currentUserId) return null;
        const mine = roundMatches.find((m) => m.player1_id === currentUserId || m.player2_id === currentUserId);
        if (!mine) return null;
        const isClosed = mine.status === "completed" || mine.status === "closed";
        const isLive = !isClosed && liveMatchIds.has(mine.id);
        const tagLabel = isClosed ? "Concluso" : isLive ? "Tocca a te" : "Prossimo";
        const tagCls = isClosed || isLive ? "" : "is-violet";
        return (
          <div className="ibnf-youhead" aria-label="Il tuo match in questo round">
            <Zap size={16} className="ibnf-youhead-ic" />
            <b>Il tuo match</b>
            <span className={`ibnf-youhead-tag ${tagCls}`}>{tagLabel}</span>
          </div>
        );
      })()}

      {(() => {
        const q = search.trim().toLowerCase();
        const matchTextFor = (m: Match) => {
          const p1 = m.player1_id ? (playerMap.get(m.player1_id) || "") : "";
          const p2 = m.player2_id ? (playerMap.get(m.player2_id) || "") : "";
          const u1 = m.player1_id ? (usernameMap?.get(m.player1_id) || "") : "";
          const u2 = m.player2_id ? (usernameMap?.get(m.player2_id) || "") : "";
          const tl = tableLabelByMatch.get(m.id) || `Tavolo ${m.match_number}`;
          return `${p1} ${p2} ${u1} ${u2} ${tl} #${m.match_number}`.toLowerCase();
        };
        const isMyMatch = (m: Match) =>
          !!currentUserId && (m.player1_id === currentUserId || m.player2_id === currentUserId);
        const filterAndSort = (list: Match[]) => {
          const filtered = q ? list.filter((m) => matchTextFor(m).includes(q)) : list;
          return [...filtered].sort((a, b) => {
            const ma = isMyMatch(a) ? 0 : 1;
            const mb = isMyMatch(b) ? 0 : 1;
            if (ma !== mb) return ma - mb;
            return a.match_number - b.match_number;
          });
        };

        const renderCard = (match: Match) => (
          <MatchCard
            key={match.id}
            match={match}
            playerMap={playerMap}
            avatarMap={avatarMap}
            usernameMap={usernameMap}
            isStaff={isStaff}
            onUndoMatch={onUndoMatch}
            onNotifyPlayers={onNotifyPlayers}
            onOpenScoring={() => { setScoringMatch(match); }}
            currentUserId={currentUserId}
            matchDeckReports={matchDeckReports}
            maxRound={maxRound}
            tableAssignment={tableAssignment}
            tableLabel={tableLabelByMatch.get(match.id)}
            isLive={liveMatchIds.has(match.id)}
            scoredByMap={scoredByMap}
            onForfeitMatch={onForfeitMatch}
            scoringPolicy={scoringPolicy}
            userHasRefereeBadge={userHasRefereeBadge}
            isParticipant={isParticipant}
            isMine={isMyMatch(match)}
          />
        );

        // Group by table whenever table assignment is enabled (with or without groups)
        const useTableGrouping = !!tableAssignment?.enabled;
        if (!useTableGrouping) {
          const list = filterAndSort(roundMatches);
          return (
            <div className="ibnf-compact ibnf-grid-compact">
              {list.map(renderCard)}
            </div>
          );
        }

        const grouped = new Map<string, Match[]>();
        for (const m of roundMatches) {
          const lbl = tableLabelByMatch.get(m.id) ?? "—";
          if (!grouped.has(lbl)) grouped.set(lbl, []);
          grouped.get(lbl)!.push(m);
        }
        const orderedLabels = Array.from(grouped.keys()).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        );

        // Find current user's table for this round
        const myMatch = currentUserId
          ? roundMatches.find(
              (m) => (m.player1_id === currentUserId || m.player2_id === currentUserId)
            )
          : null;
        const myTable = myMatch ? tableLabelByMatch.get(myMatch.id) : null;

        return (
          <div className="space-y-3">
            {myTable && (
              <div className="rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 flex items-center gap-3 animate-pulse-slow">
                <span className="text-xl">🪑</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-primary truncate">
                    Giochi al <span className="uppercase">{myTable}</span> in questo turno
                  </p>
                </div>
              </div>
            )}
            {orderedLabels.map((label) => {
              const rawList = grouped.get(label)!;
              const list = filterAndSort(rawList);
              if (q && list.length === 0) return null;
              const isMine = label === myTable;
              const pendingCount = list.filter((m) => m.status === "pending" && m.player1_id && m.player2_id).length;
              return (
                <div
                  key={label}
                  className={`rounded-lg border ${isMine ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border bg-card/40"} p-2 sm:p-3`}
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${isMine ? "text-primary" : "text-foreground"}`}>
                      🪑 {label}
                      {isMine && <Badge variant="default" className="text-[9px]">Il tuo tavolo</Badge>}
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      {list.length} match{pendingCount > 0 ? ` · ${pendingCount} in corso` : ""}
                    </span>
                  </div>
                  <div className="ibnf-compact ibnf-grid-compact">
                    {list.map(renderCard)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {scoringMatch && (
        <MatchScoringDialog
          open={!!scoringMatch}
          onOpenChange={(v) => { if (!v) setScoringMatch(null); }}
          matchId={scoringMatch.id}
          matchNumber={scoringMatch.match_number}
          player1Id={scoringMatch.player1_id}
          player2Id={scoringMatch.player2_id}
          player1Name={scoringMatch.player1_id ? playerMap.get(scoringMatch.player1_id) || "Sconosciuto" : "BYE"}
          player2Name={scoringMatch.player2_id ? playerMap.get(scoringMatch.player2_id) || "Sconosciuto" : "BYE"}
          player1Avatar={scoringMatch.player1_id ? avatarMap?.get(scoringMatch.player1_id) : null}
          player2Avatar={scoringMatch.player2_id ? avatarMap?.get(scoringMatch.player2_id) : null}
          onResult={onResult}
          tournamentId={tournamentId}
          winThreshold={winThreshold}
        />
      )}
    </div>
  );
};

const CompactPlayerRow = ({
  name,
  avatarUrl,
  score,
  isWinner,
  isCompleted,
  showDeckButton,
  onShowDeck,
  playerId,
  playerUsername,
}: {
  name: string;
  avatarUrl?: string | null;
  score: number;
  isWinner: boolean;
  isCompleted: boolean;
  showDeckButton?: boolean;
  onShowDeck?: () => void;
  playerId?: string | null;
  playerUsername?: string | null;
}) => {
  const isBot = name.includes("[BOT]") || name.includes("[Guest]");
  const nameContent = (
    <>
      {name}
      {isWinner && " 🏆"}
    </>
  );

  return (
    <div
      className={`flex items-center gap-1.5 py-1 px-1.5 sm:py-1.5 sm:px-2.5 rounded-md transition-colors ${
        isWinner ? "bg-primary/10" : "bg-secondary/30"
      }`}
    >
      <Avatar className="h-5 w-5 sm:h-6 sm:w-6 shrink-0">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="bg-muted text-muted-foreground text-[8px] sm:text-[10px]">
          <User size={10} />
        </AvatarFallback>
      </Avatar>
      <span className={`flex-1 min-w-0 text-[11px] sm:text-sm leading-tight break-words [overflow-wrap:anywhere] ${
        isWinner ? "font-semibold text-primary" : "font-medium text-foreground"
      }`}>

        {playerId && !isBot && playerUsername ? (
          <Link
            to={`/profilo/${playerUsername}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:underline"
          >
            {nameContent}
          </Link>
        ) : (
          nameContent
        )}
      </span>
      {showDeckButton && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowDeck?.(); }}
          className="shrink-0 flex items-center gap-0.5 text-[8px] sm:text-[9px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded px-1 py-0.5 transition-colors"
          title="Mostra deck"
        >
          <Eye size={8} />
          <span className="hidden sm:inline">DECK</span>
        </button>
      )}
      <span className={`text-[11px] sm:text-sm font-mono font-semibold min-w-[0.75rem] text-right ${isWinner ? "text-primary" : "text-muted-foreground"}`}>
        {isCompleted ? score : "–"}
      </span>
    </div>
  );
};

const MatchCard = ({
  match,
  playerMap,
  avatarMap,
  usernameMap,
  isStaff,
  onUndoMatch,
  onNotifyPlayers,
  onOpenScoring,
  currentUserId,
  matchDeckReports,
  maxRound,
  tableAssignment,
  tableLabel,
  isLive,
  scoredByMap,
  onForfeitMatch,
  scoringPolicy,
  userHasRefereeBadge,
  isParticipant,
  isMine,
}: {
  match: Match;
  playerMap: Map<string, string>;
  avatarMap?: Map<string, string | null>;
  usernameMap?: Map<string, string>;
  isStaff: boolean;
  onUndoMatch?: (matchId: string) => void;
  onNotifyPlayers?: (playerIds: string[]) => void;
  onOpenScoring: () => void;
  currentUserId?: string | null;
  matchDeckReports?: Map<string, Set<string>>;
  maxRound: number;
  tableAssignment?: TableAssignment;
  tableLabel?: string;
  isLive: boolean;
  scoredByMap?: Map<string, string>;
  onForfeitMatch?: (matchId: string, forfeitingPlayerId: string) => void;
  scoringPolicy?: string;
  userHasRefereeBadge?: boolean;
  isParticipant?: boolean;
  isMine?: boolean;
}) => {
  const p1Name = match.player1_id ? playerMap.get(match.player1_id) || "Sconosciuto" : "BYE";
  const p2Name = match.player2_id ? playerMap.get(match.player2_id) || "Sconosciuto" : "BYE";
  const p1Avatar = match.player1_id ? avatarMap?.get(match.player1_id) : null;
  const p2Avatar = match.player2_id ? avatarMap?.get(match.player2_id) : null;
  const isBye = !match.player1_id || !match.player2_id;
  const isCompleted = match.status === "completed";

  // Determine if the current user can score this match based on scoring policy
  const isPlayer = currentUserId && (currentUserId === match.player1_id || currentUserId === match.player2_id);
  const policy = scoringPolicy || "staff_only";
  let canOpenScoring = false;
  if (!isCompleted && !isBye) {
    if (isStaff) {
      canOpenScoring = true;
    } else if (policy === "staff_and_referees" && userHasRefereeBadge) {
      canOpenScoring = true;
    } else if (policy === "staff_referees_players" && (userHasRefereeBadge || isParticipant)) {
      canOpenScoring = true;
    }
  }
  
  // Deck report state
  const [deckReportOpen, setDeckReportOpen] = useState(false);
  const [deckViewOpen, setDeckViewOpen] = useState<{ userId: string; name: string } | null>(null);

  const reports = matchDeckReports?.get(match.id);
  const p1HasDeck = match.player1_id ? reports?.has(match.player1_id) : false;
  const p2HasDeck = match.player2_id ? reports?.has(match.player2_id) : false;
  const currentUserReported = currentUserId ? reports?.has(currentUserId) : false;

  // Decks are visible publicly only when a subsequent round exists (next round started)
  const deckVisible = match.round < maxRound;

  // Table label: prefer the one computed at parent level (round-robin distribution).
  // Fallback to legacy "T{n}" calculation for tables-per-group mode.
  const tablesPerGroup = tableAssignment?.matchesPerTable ?? 1;
  const legacyTableNumber = tableAssignment?.enabled && tablesPerGroup > 0 && !tableLabel
    ? ((match.match_number - 1) % tablesPerGroup) + 1
    : null;
  const displayedTableLabel = tableLabel ?? (legacyTableNumber ? `T${legacyTableNumber}` : null);

  // Map internal status → FIBeGS data-st
  const status: "pending" | "live" | "closed" = isCompleted ? "closed" : isLive ? "live" : "pending";
  const started = match.player1_score > 0 || match.player2_score > 0 || isCompleted;
  const leadA = started && match.player1_score > match.player2_score;
  const leadB = started && match.player2_score > match.player1_score;
  const winnerSide: "a" | "b" | null = isCompleted
    ? match.winner_id === match.player1_id ? "a"
    : match.winner_id === match.player2_id ? "b"
    : null
    : null;
  const statusLabel = status === "live" ? "In corso" : status === "closed" ? "Chiuso" : "In attesa";
  const statusCls = status === "live" ? "s-live" : status === "closed" ? "s-closed" : "";

  // Avatar helper — uses .ibnf-avt + Link to existing /profilo route when available
  const renderAvatar = (
    pid: string | null,
    name: string,
    av: string | null | undefined,
    username: string | null | undefined,
    size = 38,
    tone: "acid" | "violet" = "acid",
  ) => {
    const initial = (name || "?").slice(0, 1).toUpperCase();
    const ac = tone === "violet" ? "var(--ibnf-violet)" : "var(--ibnf-acid)";
    const isBot = name.includes("[BOT]") || name.includes("[Guest]");
    const clickable = !!pid && !isBot && !!username;
    const inner = av
      ? <img src={av} alt={name} />
      : <span>{initial}</span>;
    const style: CSSProperties = {
      // @ts-ignore — CSS custom property
      "--ac": ac, width: size, height: size, fontSize: Math.round(size * 0.42),
    } as CSSProperties;
    if (clickable) {
      return (
        <Link
          to={`/profilo/${username}`}
          onClick={(e) => e.stopPropagation()}
          className="ibnf-avt clk"
          style={style}
          title={`Vedi profilo di ${name}`}
          aria-label={`Profilo di ${name}`}
        >
          {inner}
        </Link>
      );
    }
    return (
      <span className="ibnf-avt" style={style} aria-label={name}>{inner}</span>
    );
  };

  return (
    <>
      <div
        className={`ibnf-pair${isMine ? " is-mine" : ""}`}
        data-st={status}
        onClick={canOpenScoring ? onOpenScoring : undefined}
        style={canOpenScoring ? { cursor: "pointer" } : undefined}
      >
        {/* Top: table number + status pill */}
        <div className="ibnf-pair-top">
          <div className="ibnf-pair-table">
            <span className="ibnf-pair-tnum">{displayedTableLabel ? displayedTableLabel.replace(/^Tavolo\s+/i, "").replace(/^T/i, "") : match.match_number}</span>
            <span className="ibnf-pair-tlabel">
              <b>{displayedTableLabel || `Tavolo ${match.match_number}`}</b>
              <span>Match #{match.match_number}</span>
            </span>
          </div>
          {isMine && (
            <span className="ibnf-mine-chip" title="Il tuo match">
              <Crown size={10} />
              <span className="ibnf-mine-chip-tx">Il tuo match</span>
            </span>
          )}
          <span className={`ibnf-pair-status ${statusCls}`}>
            {status === "live" && <span className="dot" />}
            {status === "closed" && <Check size={13} />}
            {statusLabel}
          </span>
        </div>

        {/* Body: A — score — B */}
        <div className="ibnf-pair-body">
          <div className={`ibnf-pl${winnerSide === "a" ? " win" : winnerSide === "b" ? " lose" : ""}`}>
            {renderAvatar(match.player1_id, p1Name, p1Avatar, match.player1_id ? usernameMap?.get(match.player1_id) : null, 38, "acid")}
            <div className="ibnf-pl-tx">
              <span className="ibnf-pl-name">
                {match.player1_id && !p1Name.includes("[BOT]") && !p1Name.includes("[Guest]") && usernameMap?.get(match.player1_id) ? (
                  <Link to={`/profilo/${usernameMap.get(match.player1_id)}`} onClick={(e) => e.stopPropagation()}>{p1Name}</Link>
                ) : p1Name}
              </span>
              {winnerSide === "a" && (
                <span className="ibnf-pl-win-tag"><Crown size={11} /> Vince</span>
              )}
            </div>
          </div>

          <div className="ibnf-pair-mid">
            {started || isCompleted ? (
              <span className="ibnf-pair-score">
                <span className={`sa${leadA ? " lead" : ""}`}>{match.player1_score}</span>
                <span className="sep">–</span>
                <span className={`sb${leadB ? " lead" : ""}`}>{match.player2_score}</span>
              </span>
            ) : (
              <span className="ibnf-pair-vs">VS</span>
            )}
          </div>

          <div className={`ibnf-pl right${winnerSide === "b" ? " win" : winnerSide === "a" ? " lose" : ""}`}>
            {renderAvatar(match.player2_id, p2Name, p2Avatar, match.player2_id ? usernameMap?.get(match.player2_id) : null, 38, "acid")}
            <div className="ibnf-pl-tx">
              <span className="ibnf-pl-name">
                {match.player2_id && !p2Name.includes("[BOT]") && !p2Name.includes("[Guest]") && usernameMap?.get(match.player2_id) ? (
                  <Link to={`/profilo/${usernameMap.get(match.player2_id)}`} onClick={(e) => e.stopPropagation()}>{p2Name}</Link>
                ) : p2Name}
              </span>
              {winnerSide === "b" && (
                <span className="ibnf-pl-win-tag"><Crown size={11} /> Vince</span>
              )}
            </div>
          </div>
        </div>

        {/* Foot: actions / undo */}
        <div className="ibnf-pair-foot">
          {isCompleted ? (
            <div className="ibnf-pair-result">
              <span className="ibnf-pair-result-tx"><Check size={15} /> Risultato registrato</span>
              {isStaff && onUndoMatch && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="ibnf-btn-undo"
                      onClick={(e) => e.stopPropagation()}
                      title="Annulla risultato"
                    >
                      <RotateCcw size={15} /> Undo
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Annullare il risultato?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Il risultato del match M{match.match_number} verrà annullato. Questa azione è reversibile.
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
            </div>
          ) : isBye ? (
            <div className="ibnf-pair-result">
              <span className="ibnf-pair-result-tx" style={{ color: "var(--ibnf-ink-mute)" }}>
                BYE — passaggio automatico
              </span>
            </div>
          ) : (
            <>
              {isStaff && onNotifyPlayers && match.player1_id && match.player2_id && (
                <button
                  type="button"
                  className="ibnf-btn-call"
                  onClick={(e) => { e.stopPropagation(); onNotifyPlayers([match.player1_id!, match.player2_id!]); }}
                  title="Invia notifica ai giocatori"
                >
                  <Phone size={16} /> Chiama
                </button>
              )}
              {canOpenScoring && (
                <button
                  type="button"
                  className="ibnf-btn-console"
                  onClick={(e) => { e.stopPropagation(); onOpenScoring(); }}
                >
                  <Gamepad2 size={16} /> {status === "live" || started ? "Riprendi" : "Apri console"}
                </button>
              )}
            </>
          )}
        </div>

        {/* Referee, deck-report, forfeit — preserved features */}
        {isCompleted && match.scored_by && scoredByMap?.get(match.scored_by) && (
          <div className="px-3 pb-2 -mt-1">
            <p className="text-[10px] text-muted-foreground truncate">
              Arbitro: {usernameMap?.get(match.scored_by) ? (
                <Link to={`/profilo/${usernameMap.get(match.scored_by)}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{scoredByMap.get(match.scored_by)}</Link>
              ) : (
                <span>{scoredByMap.get(match.scored_by)}</span>
              )}
            </p>
          </div>
        )}

        {/* Visible decks (when next round started) */}
        {deckVisible && (p1HasDeck || p2HasDeck) && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {p1HasDeck && match.player1_id && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeckViewOpen({ userId: match.player1_id!, name: p1Name }); }}
                className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded px-2 py-1 transition-colors"
              >
                <Eye size={10} /> Deck {p1Name.split(" ")[0]}
              </button>
            )}
            {p2HasDeck && match.player2_id && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeckViewOpen({ userId: match.player2_id!, name: p2Name }); }}
                className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded px-2 py-1 transition-colors"
              >
                <Eye size={10} /> Deck {p2Name.split(" ")[0]}
              </button>
            )}
          </div>
        )}

        {isPlayer && isCompleted && !isBye && (
          <div className="px-3 pb-3">
            <Button
              variant={currentUserReported ? "outline" : "default"}
              size="sm"
              className="w-full h-7 text-[10px] gap-1"
              onClick={(e) => { e.stopPropagation(); setDeckReportOpen(true); }}
            >
              <Swords size={10} />
              {currentUserReported ? "Modifica Deck" : "Riporta Deck"}
            </Button>
          </div>
        )}

        {isPlayer && !isCompleted && !isBye && onForfeitMatch && currentUserId && (
          <div className="px-3 pb-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-[10px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Flag size={10} />
                  Forfeit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Dare forfeit a questo match?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Il tuo avversario vincerà automaticamente questo match. Questa azione non può essere annullata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onForfeitMatch(match.id, currentUserId)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Conferma Forfeit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>


      {/* Deck Report Dialog */}
      {deckReportOpen && (
        <MatchDeckReportDialog
          open={deckReportOpen}
          onOpenChange={setDeckReportOpen}
          matchId={match.id}
          onSaved={() => {
            // Trigger refresh via parent - we signal by closing
            setDeckReportOpen(false);
            // Force re-render by dispatching custom event
            window.dispatchEvent(new CustomEvent("match-deck-updated"));
          }}
        />
      )}

      {/* Deck View Dialog */}
      {deckViewOpen && (
        <MatchDeckView
          open={!!deckViewOpen}
          onOpenChange={() => setDeckViewOpen(null)}
          matchId={match.id}
          userId={deckViewOpen.userId}
          playerName={deckViewOpen.name}
        />
      )}
    </>
  );
};
