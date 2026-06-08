import { Badge } from "@/components/ui/badge";
import { Info, ArrowLeftRight } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { StandingsInfoDialog } from "./StandingsInfoDialog";

interface Standing {
  id: string;
  user_id: string;
  wins: number;
  losses: number;
  draws: number;
  game_wins: number;
  game_losses: number;
  points: number;
  resistance: number;
  seed?: number | null;
  dropped: boolean;
}

interface Match {
  id: string;
  round: number;
  match_number: number;
  phase: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  status: string;
}

interface RankingResult {
  user_id: string;
  placement: number;
  scaled_points: number | null;
  base_points: number | null;
  participants_count: number | null;
}

export interface EnabledTiebreakers {
  head_to_head: boolean;
  omw: boolean;
  buchholz: boolean;
  /** Point Win % — % di punti partita vinti dal giocatore (es. 6-2 → 75%) */
  gw?: boolean;
  /** Opponents' Point Win % — media PW% degli avversari */
  ogw?: boolean;
  /** Differenza punti partita cumulativa */
  gw_diff?: boolean;
  resistance?: boolean;
}

export const DEFAULT_ENABLED_TIEBREAKERS: EnabledTiebreakers = {
  head_to_head: true,
  omw: true,
  buchholz: true,
  gw: true,
  ogw: true,
  gw_diff: true,
  resistance: true,
};

interface Props {
  standings: Standing[];
  playerMap: Map<string, string>;
  matches?: Match[];
  /** Hide the Completa/Swiss toggle (e.g. when shown in a dedicated Swiss-only card) */
  hidePhaseToggle?: boolean;
  /** Finalized ranking results (tournament_results). Used in "Completa" view. */
  results?: RankingResult[];
  /** Whether the tournament awards ranking points (is_ranked). */
  tournamentRanked?: boolean;
  /** Which tiebreakers are enabled (affects standings ordering AND tiebreaker view columns). */
  enabledTiebreakers?: EnabledTiebreakers;
}

interface TiebreakerData {
  /** Head-to-head match points scored vs all opponents currently tied with this player */
  headToHead: number;
  /** Opponents' Match Win % (avg, min 33%) */
  omw: number;
  /** Game Win % */
  gw: number;
  /** Opponents' Game Win % (avg) */
  ogw: number;
  /** Game points differential (sum of (score - WIN_THRESHOLD) for own matches) */
  gwDiff: number;
  /** Median Buchholz on weighted points */
  medianBuchholz: number;
  /** Resistance % (kept for compatibility/display) */
  resistance: number;
  /** Number of swiss matches actually played (BYEs excluded) */
  matchesPlayed: number;
}

const SWISS_WIN_THRESHOLD = 4;
const WIN_POINTS = 4;
const BYE_POINTS = 4;
const MIN_WIN_PCT = 1 / 3; // TCG-style floor for OMW% / OGW%

/** Compute "weighted" Swiss points per user: base 3 per win + bonus for game points above SWISS_WIN_THRESHOLD,
 *  +1 per draw, +BYE_POINTS per BYE. */
const calcWeightedPoints = (matches: Match[]): Map<string, number> => {
  const swissCompleted = matches.filter(m => m.phase === "swiss" && m.status === "completed");
  const out = new Map<string, number>();
  const add = (id: string | null | undefined, v: number) => {
    if (!id) return;
    out.set(id, (out.get(id) ?? 0) + v);
  };
  swissCompleted.forEach(m => {
    if (m.player1_id && !m.player2_id) { add(m.player1_id, BYE_POINTS); return; }
    if (!m.player1_id || !m.player2_id) return;
    const bonus1 = Math.max(0, m.player1_score - SWISS_WIN_THRESHOLD);
    const bonus2 = Math.max(0, m.player2_score - SWISS_WIN_THRESHOLD);
    if (m.winner_id === m.player1_id) { add(m.player1_id, WIN_POINTS + bonus1); add(m.player2_id, bonus2); }
    else if (m.winner_id === m.player2_id) { add(m.player2_id, WIN_POINTS + bonus2); add(m.player1_id, bonus1); }
    else { add(m.player1_id, 1 + bonus1); add(m.player2_id, 1 + bonus2); }
  });
  return out;
};

interface PlayerRecord {
  matchPoints: number;     // 3·W + 1·D (BYE counts as W)
  matchesPlayed: number;   // BYEs excluded
  matchWins: number;       // includes BYE
  matchDraws: number;
  gameWinPts: number;      // sum of own scores in completed swiss matches
  gameTotalPts: number;    // sum of (own + opp) in those matches
  opponents: string[];     // opponents faced (BYEs excluded)
}

const buildSwissRecords = (matches: Match[]): Map<string, PlayerRecord> => {
  const swissCompleted = matches.filter(m => m.phase === "swiss" && m.status === "completed");
  const map = new Map<string, PlayerRecord>();
  const ensure = (id: string): PlayerRecord => {
    let r = map.get(id);
    if (!r) {
      r = { matchPoints: 0, matchesPlayed: 0, matchWins: 0, matchDraws: 0, gameWinPts: 0, gameTotalPts: 0, opponents: [] };
      map.set(id, r);
    }
    return r;
  };
  swissCompleted.forEach(m => {
    if (m.player1_id && !m.player2_id) {
      const r = ensure(m.player1_id);
      r.matchPoints += WIN_POINTS;
      r.matchWins += 1;
      // BYE not counted in matchesPlayed / opponents / game stats
      return;
    }
    if (!m.player1_id || !m.player2_id) return;
    const r1 = ensure(m.player1_id);
    const r2 = ensure(m.player2_id);
    r1.matchesPlayed++; r2.matchesPlayed++;
    r1.opponents.push(m.player2_id); r2.opponents.push(m.player1_id);
    r1.gameWinPts += m.player1_score; r1.gameTotalPts += m.player1_score + m.player2_score;
    r2.gameWinPts += m.player2_score; r2.gameTotalPts += m.player1_score + m.player2_score;
    if (m.winner_id === m.player1_id) { r1.matchPoints += WIN_POINTS; r1.matchWins++; }
    else if (m.winner_id === m.player2_id) { r2.matchPoints += WIN_POINTS; r2.matchWins++; }
    else { r1.matchPoints += 1; r2.matchPoints += 1; r1.matchDraws++; r2.matchDraws++; }
  });
  return map;
};

const calcTiebreakers = (standings: Standing[], matches: Match[]): Map<string, TiebreakerData> => {
  const swissCompleted = matches.filter(m => m.phase === "swiss" && m.status === "completed");
  const records = buildSwissRecords(matches);
  const weightedPoints = calcWeightedPoints(matches);
  const pointsByUser = new Map(standings.map(s => [s.user_id, s.points]));

  // Per-player MW% and GW% with the standard TCG floor of 33%
  const matchWinPct = new Map<string, number>();
  const gameWinPct = new Map<string, number>();
  records.forEach((r, id) => {
    const mwBase = r.matchesPlayed > 0 ? r.matchPoints / (r.matchesPlayed * WIN_POINTS) : 0;
    matchWinPct.set(id, Math.max(mwBase, MIN_WIN_PCT));
    const gwBase = r.gameTotalPts > 0 ? r.gameWinPts / r.gameTotalPts : 0;
    gameWinPct.set(id, Math.max(gwBase, MIN_WIN_PCT));
  });

  const result = new Map<string, TiebreakerData>();

  for (const s of standings) {
    const userId = s.user_id;
    const rec = records.get(userId) ?? { matchPoints: 0, matchesPlayed: 0, matchWins: 0, matchDraws: 0, gameWinPts: 0, gameTotalPts: 0, opponents: [] };

    let gwDiff = 0;
    swissCompleted.forEach(m => {
      if (m.player1_id === userId && m.player2_id) gwDiff += Math.max(0, m.player1_score - SWISS_WIN_THRESHOLD);
      else if (m.player2_id === userId && m.player1_id) gwDiff += Math.max(0, m.player2_score - SWISS_WIN_THRESHOLD);
    });

    const opps = rec.opponents;
    const omw = opps.length > 0
      ? opps.reduce((sum, id) => sum + (matchWinPct.get(id) ?? MIN_WIN_PCT), 0) / opps.length
      : 0;
    const ogw = opps.length > 0
      ? opps.reduce((sum, id) => sum + (gameWinPct.get(id) ?? MIN_WIN_PCT), 0) / opps.length
      : 0;
    const gwTotal = s.game_wins + s.game_losses;
    const gw = gwTotal > 0 ? s.game_wins / gwTotal : (gameWinPct.get(userId) ?? 0);

    // Median Buchholz on weighted points
    const oppPoints = opps.map(id => weightedPoints.get(id) ?? 0).sort((a, b) => a - b);
    const medianBuchholz = oppPoints.length > 2
      ? oppPoints.slice(1, -1).reduce((a, b) => a + b, 0)
      : oppPoints.reduce((a, b) => a + b, 0);

    // Head-to-head: match points scored against opponents tied (in standings.points) with this player
    const myPts = pointsByUser.get(userId) ?? 0;
    let headToHead = 0;
    opps.forEach(oppId => {
      if ((pointsByUser.get(oppId) ?? -1) !== myPts) return;
      swissCompleted.forEach(m => {
        if (m.status !== "completed") return;
        const isP1 = m.player1_id === userId && m.player2_id === oppId;
        const isP2 = m.player2_id === userId && m.player1_id === oppId;
        if (!isP1 && !isP2) return;
        if (m.winner_id === userId) headToHead += WIN_POINTS;
        else if (!m.winner_id) headToHead += 1;
      });
    });

    // DB recalc_tournament_standings is the source of truth for resistance/OMW.
    const resistance = Number(s.resistance ?? 0);

    result.set(userId, {
      headToHead,
      omw: resistance / 100,
      gw,
      ogw,
      gwDiff,
      medianBuchholz,
      resistance,
      matchesPlayed: rec.matchesPlayed,
    });
  }

  return result;
};

/** Compute swiss-only standings from match data */
const computeSwissStandings = (standings: Standing[], matches: Match[]): Standing[] => {
  const swissCompleted = matches.filter(m => m.phase === "swiss" && m.status === "completed");
  const statsMap = new Map<string, { w: number; l: number; d: number; gw: number; gl: number; byes: number }>();

  standings.forEach(s => {
    statsMap.set(s.user_id, { w: 0, l: 0, d: 0, gw: 0, gl: 0, byes: 0 });
  });

  swissCompleted.forEach(m => {
    if (m.player1_id && !m.player2_id) {
      const st = statsMap.get(m.player1_id);
      if (st) { st.w++; st.byes++; st.gw += 2; }
      return;
    }
    if (!m.player1_id || !m.player2_id) return;

    const st1 = statsMap.get(m.player1_id);
    const st2 = statsMap.get(m.player2_id);
    if (st1) { st1.gw += m.player1_score; st1.gl += m.player2_score; }
    if (st2) { st2.gw += m.player2_score; st2.gl += m.player1_score; }

    if (m.winner_id === m.player1_id) {
      if (st1) st1.w++;
      if (st2) st2.l++;
    } else if (m.winner_id === m.player2_id) {
      if (st2) st2.w++;
      if (st1) st1.l++;
    } else {
      if (st1) st1.d++;
      if (st2) st2.d++;
    }
  });

  return standings.map(s => {
    const st = statsMap.get(s.user_id);
    if (!st) return s;
    return {
      ...s,
      wins: st.w,
      losses: st.l,
      draws: st.d,
      game_wins: st.gw,
      game_losses: st.gl,
      points: (st.w - st.byes) * WIN_POINTS + st.d + st.byes * BYE_POINTS,
    };
  });
};

interface PlacementInfo {
  rank: number;
  /** Italian label of where the player exited the bracket */
  exitLabel: string;
}

/** Compute bracket placement ordering + exit labels for the "Completa" view */
const computePlacementInfo = (matches: Match[]): Map<string, PlacementInfo> => {
  const info = new Map<string, PlacementInfo>();
  const setBest = (userId: string | null | undefined, rank: number, exitLabel: string) => {
    if (!userId) return;
    const current = info.get(userId);
    if (current === undefined || rank < current.rank) info.set(userId, { rank, exitLabel });
  };

  const eliminationPhase = matches.some(m => m.phase === "top_cut")
    ? "top_cut"
    : matches.some(m => m.phase === "u12_top_cut")
      ? "u12_top_cut"
      : null;

  if (!eliminationPhase) return info;

  const eliminationMatches = matches.filter(m => m.phase === eliminationPhase);
  if (eliminationMatches.length === 0) return info;

  const hasPlayedEliminationMatch = eliminationMatches.some(
    m => m.status === "completed" && !!m.winner_id
  );
  if (!hasPlayedEliminationMatch) return info;

  const finalRound = Math.max(...eliminationMatches.map(m => m.round));
  const thirdPlaceMatch = eliminationMatches.find(m => m.round === finalRound && m.match_number === 2);
  const mainBracketMatches = thirdPlaceMatch
    ? eliminationMatches.filter(m => m.id !== thirdPlaceMatch.id)
    : eliminationMatches;

  const finalMatch = mainBracketMatches.find(m => m.round === finalRound && m.match_number === 1);
  if (finalMatch) {
    if (finalMatch.status === "completed" && finalMatch.winner_id) {
      const runnerUpId = finalMatch.player1_id === finalMatch.winner_id ? finalMatch.player2_id : finalMatch.player1_id;
      setBest(finalMatch.winner_id, 1, "Campione");
      setBest(runnerUpId, 2, "Finale");
    } else {
      setBest(finalMatch.player1_id, 2, "Finale");
      setBest(finalMatch.player2_id, 2, "Finale");
    }
  }

  if (thirdPlaceMatch) {
    if (thirdPlaceMatch.status === "completed" && thirdPlaceMatch.winner_id) {
      const fourthId = thirdPlaceMatch.player1_id === thirdPlaceMatch.winner_id ? thirdPlaceMatch.player2_id : thirdPlaceMatch.player1_id;
      setBest(thirdPlaceMatch.winner_id, 3, "Semifinale");
      setBest(fourthId, 4, "Semifinale");
    } else {
      setBest(thirdPlaceMatch.player1_id, 3, "Semifinale");
      setBest(thirdPlaceMatch.player2_id, 3, "Semifinale");
    }
  } else if (finalRound > 1) {
    const semiLosers = new Set<string>();
    mainBracketMatches
      .filter(m => m.round === finalRound - 1 && m.status === "completed" && m.winner_id)
      .forEach(m => {
        const loserId = m.player1_id === m.winner_id ? m.player2_id : m.player1_id;
        if (loserId) { semiLosers.add(loserId); setBest(loserId, 3, "Semifinale"); }
      });

    matches
      .filter(m => m.phase === "tiebreaker")
      .forEach(m => {
        if (!m.player1_id || !m.player2_id) return;
        if (!semiLosers.has(m.player1_id) || !semiLosers.has(m.player2_id)) return;
        if (m.status === "completed" && m.winner_id) {
          const loserId = m.player1_id === m.winner_id ? m.player2_id : m.player1_id;
          setBest(m.winner_id, 3, "Semifinale");
          setBest(loserId, 4, "Semifinale");
        }
      });
  }

  const quarterFinalRound = finalRound - 2;
  if (quarterFinalRound >= 1) {
    const quarterLosers = new Set<string>();
    mainBracketMatches
      .filter(m => m.round === quarterFinalRound && m.status === "completed" && m.winner_id)
      .forEach(m => {
        const loserId = m.player1_id === m.winner_id ? m.player2_id : m.player1_id;
        if (loserId) { quarterLosers.add(loserId); setBest(loserId, 5, "Quarti"); }
      });

    matches
      .filter(m => m.phase === "tiebreaker")
      .forEach(m => {
        if (!m.player1_id || !m.player2_id) return;
        if (!quarterLosers.has(m.player1_id) || !quarterLosers.has(m.player2_id)) return;
        if (m.status === "completed" && m.winner_id) {
          const loserId = m.player1_id === m.winner_id ? m.player2_id : m.player1_id;
          setBest(m.winner_id, 5, "Quarti");
          setBest(loserId, 7, "Quarti");
        } else {
          setBest(m.player1_id, 5, "Quarti");
          setBest(m.player2_id, 5, "Quarti");
        }
      });
  }

  // Generic earlier-round fallback
  const labelForRound = (r: number): string => {
    const fromFinal = finalRound - r;
    if (fromFinal === 0) return "Finale";
    if (fromFinal === 1) return "Semifinale";
    if (fromFinal === 2) return "Quarti";
    if (fromFinal === 3) return "Ottavi";
    if (fromFinal === 4) return "Sedicesimi";
    return `Round ${r}`;
  };

  const deepestRoundByUser = new Map<string, number>();
  mainBracketMatches.forEach(m => {
    if (m.player1_id) deepestRoundByUser.set(m.player1_id, Math.max(deepestRoundByUser.get(m.player1_id) ?? 0, m.round));
    if (m.player2_id) deepestRoundByUser.set(m.player2_id, Math.max(deepestRoundByUser.get(m.player2_id) ?? 0, m.round));
  });
  deepestRoundByUser.forEach((round, userId) => {
    if (!info.has(userId)) setBest(userId, 10 + (finalRound - round), labelForRound(round));
  });

  return info;
};

export const getCompleteStandingsOrder = (
  standings: Standing[],
  matches: Match[],
  enabled: EnabledTiebreakers = DEFAULT_ENABLED_TIEBREAKERS,
): string[] => {
  const tiebreakers = calcTiebreakers(standings, matches);
  const placementInfo = computePlacementInfo(matches);
  const hasMatches = matches.length > 0;

  return [...standings]
    .sort((a, b) => {
      const placementA = placementInfo.get(a.user_id)?.rank ?? Number.POSITIVE_INFINITY;
      const placementB = placementInfo.get(b.user_id)?.rank ?? Number.POSITIVE_INFINITY;
      if (placementA !== placementB) return placementA - placementB;

      if (b.points !== a.points) return b.points - a.points;

      if (hasMatches) {
        const ta = tiebreakers.get(a.user_id);
        const tb = tiebreakers.get(b.user_id);
        if (ta && tb) {
          if (enabled.head_to_head && tb.headToHead !== ta.headToHead) return tb.headToHead - ta.headToHead;
          if (enabled.omw && tb.omw !== ta.omw) return tb.omw - ta.omw;
          if (enabled.buchholz && tb.medianBuchholz !== ta.medianBuchholz) return tb.medianBuchholz - ta.medianBuchholz;
          if (enabled.gw && tb.gw !== ta.gw) return tb.gw - ta.gw;
          if (enabled.ogw && tb.ogw !== ta.ogw) return tb.ogw - ta.ogw;
          if (enabled.gw_diff && tb.gwDiff !== ta.gwDiff) return tb.gwDiff - ta.gwDiff;
          if (ta.matchesPlayed !== tb.matchesPlayed) return ta.matchesPlayed - tb.matchesPlayed;
        }
      }

      return (a.seed ?? Number.POSITIVE_INFINITY) - (b.seed ?? Number.POSITIVE_INFINITY);
    })
    .map((s) => s.user_id);
};

export const StandingsTable = ({ standings, playerMap, matches = [], hidePhaseToggle, results = [], tournamentRanked = true, enabledTiebreakers = DEFAULT_ENABLED_TIEBREAKERS }: Props) => {
  const enabled = enabledTiebreakers;
  const hasMatches = matches.length > 0;
  const hasTopCut = matches.some(m => m.phase === "top_cut" || m.phase === "u12_top_cut");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"completa" | "swiss" | "tiebreaker">(
    hasTopCut ? "completa" : "swiss"
  );
  const showTiebreakers = viewMode === "tiebreaker";

  const swissStandings = useMemo(() => computeSwissStandings(standings, matches), [standings, matches]);
  const activeStandings = viewMode === "completa" ? standings : swissStandings;

  const tiebreakers = useMemo(() => calcTiebreakers(activeStandings, matches), [activeStandings, matches]);
  const placementInfo = useMemo(() => viewMode === "completa" ? computePlacementInfo(matches) : new Map<string, PlacementInfo>(), [matches, viewMode]);
  const resultsMap = useMemo(() => {
    const map = new Map<string, RankingResult>();
    results.forEach(r => map.set(r.user_id, r));
    return map;
  }, [results]);

  // In "Completa" mode with a top cut: who actually made the top cut
  const topCutUserIds = useMemo(() => {
    const set = new Set<string>();
    matches.forEach(m => {
      if (m.phase === "top_cut" || m.phase === "u12_top_cut") {
        if (m.player1_id) set.add(m.player1_id);
        if (m.player2_id) set.add(m.player2_id);
      }
    });
    return set;
  }, [matches]);

  // Swiss-only W/L/D per user (excludes tiebreakers/spareggi and top cut).
  // Used both for the "W-L Sw" column in Completa mode and for ranking points.
  const swissRecordByUser = useMemo(() => {
    const map = new Map<string, { w: number; l: number; d: number }>();
    const ensure = (id: string) => {
      let r = map.get(id);
      if (!r) { r = { w: 0, l: 0, d: 0 }; map.set(id, r); }
      return r;
    };
    matches.forEach(m => {
      if (m.phase !== "swiss") return;
      if (m.status !== "completed") return;
      // BYE counts as a win for the present player
      if (m.player1_id && !m.player2_id) { ensure(m.player1_id).w++; return; }
      if (!m.player1_id || !m.player2_id) return;
      if (m.winner_id === m.player1_id) {
        ensure(m.player1_id).w++;
        ensure(m.player2_id).l++;
      } else if (m.winner_id === m.player2_id) {
        ensure(m.player2_id).w++;
        ensure(m.player1_id).l++;
      } else {
        ensure(m.player1_id).d++;
        ensure(m.player2_id).d++;
      }
    });
    return map;
  }, [matches]);

  // Top cut wins per user (tiebreaker matches excluded)
  const topCutWinsByUser = useMemo(() => {
    const map = new Map<string, number>();
    matches.forEach(m => {
      if (m.phase !== "top_cut" && m.phase !== "u12_top_cut") return;
      if (m.status !== "completed") return;
      if (m.player1_id && !m.player2_id) {
        map.set(m.player1_id, (map.get(m.player1_id) ?? 0) + 1);
        return;
      }
      if (!m.winner_id) return;
      map.set(m.winner_id, (map.get(m.winner_id) ?? 0) + 1);
    });
    return map;
  }, [matches]);

  const completaMode = viewMode === "completa" && hasTopCut;

  const sorted = useMemo(() => {
    if (viewMode !== "completa") {
      const tbMap = calcTiebreakers(activeStandings, matches);
      return [...activeStandings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const ta = tbMap.get(a.user_id);
        const tb = tbMap.get(b.user_id);
        if (ta && tb) {
          if (enabled.head_to_head && tb.headToHead !== ta.headToHead) return tb.headToHead - ta.headToHead;
          if (enabled.omw && tb.omw !== ta.omw) return tb.omw - ta.omw;
          if (enabled.buchholz && tb.medianBuchholz !== ta.medianBuchholz) return tb.medianBuchholz - ta.medianBuchholz;
          if (enabled.gw && tb.gw !== ta.gw) return tb.gw - ta.gw;
          if (enabled.ogw && tb.ogw !== ta.ogw) return tb.ogw - ta.ogw;
          if (enabled.gw_diff && tb.gwDiff !== ta.gwDiff) return tb.gwDiff - ta.gwDiff;
          if (ta.matchesPlayed !== tb.matchesPlayed) return ta.matchesPlayed - tb.matchesPlayed;
        }
        return (a.seed ?? Number.POSITIVE_INFINITY) - (b.seed ?? Number.POSITIVE_INFINITY);
      });
    }
    const order = getCompleteStandingsOrder(activeStandings, matches, enabled);
    const indexByUser = new Map(order.map((userId, index) => [userId, index]));
    return [...activeStandings].sort(
      (a, b) => (indexByUser.get(a.user_id) ?? Number.POSITIVE_INFINITY) - (indexByUser.get(b.user_id) ?? Number.POSITIVE_INFINITY)
    );
  }, [activeStandings, matches, viewMode, enabled]);

  // Active tiebreaker columns (only enabled ones shown in tiebreaker view)
  const tbColumns = [
    { key: "head_to_head" as const, label: "H2H", title: "Scontro diretto: punti match contro i pari-punti" },
    { key: "omw" as const, label: "OMW%", title: "Opponents' Match Win % — media match vinti dai tuoi avversari (floor 33%)" },
    { key: "buchholz" as const, label: "Buchholz", title: "Median Buchholz: somma punti finali avversari, scarto il migliore e il peggiore" },
    { key: "gw" as const, label: "PW%", title: "Point Win % — % di punti partita vinti dal giocatore (es. 6-2 → 75%)" },
    { key: "ogw" as const, label: "OPW%", title: "Opponents' Point Win % — media PW% degli avversari" },
    { key: "gw_diff" as const, label: "Diff.", title: "Differenza punti partita cumulativa (vittoria 6-2 = +4)" },
  ].filter((c) => enabled[c.key]);
  const tbColCount = tbColumns.length;

  // Column layout — Tiebreakers view shows only enabled metrics; horizontally scrollable on small viewports.
  const gridStyle: CSSProperties | undefined = showTiebreakers
    ? { gridTemplateColumns: `28px minmax(140px,1fr) ${"minmax(56px,auto) ".repeat(Math.max(tbColCount, 1)).trim()}` }
    : undefined;
  const headerCols = showTiebreakers
    ? "grid"
    : "grid grid-cols-[28px_minmax(0,1fr)_minmax(86px,auto)_minmax(48px,auto)_minmax(56px,auto)]";

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Toolbar */}
      <div className="flex justify-between items-center px-3 pt-3 pb-2 gap-2 flex-wrap border-b border-border/50">
        <Button
          variant="outline"
          size="sm"
          className="text-[11px] h-7 gap-1.5 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary font-semibold"
          onClick={() => setRulesOpen(true)}
        >
          <Info size={13} />
          Come funziona
        </Button>
        
        {!hidePhaseToggle && (hasTopCut || hasMatches) && (
          <div className="flex bg-muted rounded-md p-0.5">
            {hasTopCut && (
              <Button
                variant={viewMode === "completa" ? "default" : "ghost"}
                size="sm"
                className="text-[10px] h-6 px-2.5 rounded-sm"
                onClick={() => setViewMode("completa")}
              >
                Completa
              </Button>
            )}
            <Button
              variant={viewMode === "swiss" ? "default" : "ghost"}
              size="sm"
              className="text-[10px] h-6 px-2.5 rounded-sm"
              onClick={() => setViewMode("swiss")}
            >
              Swiss
            </Button>
            {hasMatches && (
              <Button
                variant={viewMode === "tiebreaker" ? "default" : "ghost"}
                size="sm"
                className="text-[10px] h-6 px-2.5 rounded-sm gap-1"
                onClick={() => setViewMode("tiebreaker")}
              >
                <ArrowLeftRight size={11} />
                Tiebreaker
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center px-3 py-1.5 italic bg-muted/30">
        Aggiornata al completamento di ogni turno
      </p>

      <StandingsInfoDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />

      {/* Header row */}
      <div className={showTiebreakers ? "overflow-x-auto" : ""}>
      <div className={`${headerCols} gap-2 px-3 py-2 border-b border-border bg-muted/20 text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ${showTiebreakers ? "min-w-[640px]" : ""}`} style={gridStyle}>
        <span className="text-center">#</span>
        <span>Giocatore</span>
        {showTiebreakers ? (
          tbColumns.length > 0 ? (
            <>
              {tbColumns.map((c) => (
                <span key={c.key} className="text-center whitespace-nowrap" title={c.title}>{c.label}</span>
              ))}
            </>
          ) : (
            <span className="text-center text-muted-foreground italic col-span-1">Nessun tiebreaker attivo</span>
          )
        ) : completaMode ? (
          <>
            <span className="text-center whitespace-nowrap">Risultato</span>
            <span className="text-center whitespace-nowrap" title="Vittorie / Sconfitte nelle Swiss">W/L Sw</span>
            <span className="text-center whitespace-nowrap" title="Punti ranking guadagnati">Punti</span>
          </>
        ) : (
          <>
            <span className="text-center whitespace-nowrap">Record</span>
            <span className="text-center whitespace-nowrap" title="Vittorie Swiss">Vinte</span>
            <span className="text-center whitespace-nowrap" title="Punti Swiss">Punti</span>
          </>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/60">
        {sorted.map((s, idx) => {
          const tb = tiebreakers.get(s.user_id);
          const isTopCut = completaMode && topCutUserIds.has(s.user_id);
          const exit = placementInfo.get(s.user_id);
          const swissRec = swissRecordByUser.get(s.user_id) ?? { w: 0, l: 0, d: 0 };
          const tcWins = topCutWinsByUser.get(s.user_id) ?? 0;
          const totalWins = swissRec.w + tcWins;
          const rankPoints = tournamentRanked ? totalWins * 4 : 0;
          const isChampion = completaMode && exit?.rank === 1;
          const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

          return (
            <div
              key={s.id}
              className={`${headerCols} gap-2 px-3 py-2.5 items-center transition-colors ${showTiebreakers ? "min-w-[640px]" : ""} ${s.dropped ? "opacity-50" : ""} ${
                isChampion
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : isTopCut
                    ? "bg-primary/5 border-l-2 border-l-primary/60"
                    : "hover:bg-muted/30"
              }`}
              style={gridStyle}
            >
              <span className={`text-center font-mono text-xs ${isChampion ? "text-primary font-bold text-base" : isTopCut ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                {isChampion ? "🏆" : idx + 1}
              </span>
              <span className="marquee-cell min-w-0">
                <span className={`marquee-text text-sm ${isTopCut ? "font-semibold" : "font-medium"}`}>
                  {playerMap.get(s.user_id) || "Sconosciuto"}
                </span>
                {s.dropped && (
                  <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 shrink-0">Rit.</Badge>
                )}
              </span>

              {showTiebreakers ? (
                tb ? (
                  <>
                    {tbColumns.map((c) => {
                      if (c.key === "head_to_head") return <span key={c.key} className="text-center text-xs font-mono tabular-nums">{tb.headToHead}</span>;
                      if (c.key === "omw") return <span key={c.key} className="text-center text-xs font-mono tabular-nums">{pct(tb.omw)}</span>;
                      if (c.key === "buchholz") return <span key={c.key} className="text-center text-xs font-mono tabular-nums">{tb.medianBuchholz}</span>;
                      if (c.key === "gw") return <span key={c.key} className="text-center text-xs font-mono tabular-nums">{pct(tb.gw)}</span>;
                      if (c.key === "ogw") return <span key={c.key} className="text-center text-xs font-mono tabular-nums">{pct(tb.ogw)}</span>;
                      if (c.key === "gw_diff") return (
                        <span key={c.key} className={`text-center text-xs font-mono tabular-nums ${tb.gwDiff > 0 ? "text-primary font-semibold" : tb.gwDiff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {tb.gwDiff > 0 ? "+" : ""}{tb.gwDiff}
                        </span>
                      );
                      return null;
                    })}
                  </>
                ) : (
                  <>
                    {tbColumns.map((c) => (
                      <span key={c.key} className="text-center text-xs text-muted-foreground">—</span>
                    ))}
                  </>
                )
              ) : completaMode ? (
                <>
                  <span className="text-center">
                    {isTopCut ? (
                      <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 whitespace-nowrap font-semibold">
                        {exit?.exitLabel ?? "Top cut"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 whitespace-nowrap text-muted-foreground border-muted-foreground/30">
                        Fuori top
                      </Badge>
                    )}
                  </span>
                  <span className="text-center text-xs font-mono tabular-nums whitespace-nowrap">
                    <span className="text-primary font-semibold">{swissRec.w}</span>
                    <span className="text-muted-foreground/60 mx-0.5">/</span>
                    <span className="text-destructive font-semibold">{swissRec.l}</span>
                  </span>
                  <span className={`text-center text-xs font-bold tabular-nums whitespace-nowrap ${rankPoints > 0 ? "text-primary" : "text-muted-foreground/60"}`}>
                    {tournamentRanked ? (rankPoints > 0 ? `+${rankPoints}` : "0") : "—"}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-center">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 whitespace-nowrap font-mono font-semibold">
                      <span className="text-primary">{s.wins}</span>
                      <span className="text-muted-foreground/60 mx-0.5">–</span>
                      <span className="text-destructive">{s.losses}</span>
                      {s.draws > 0 && (
                        <>
                          <span className="text-muted-foreground/60 mx-0.5">–</span>
                          <span className="text-muted-foreground">{s.draws}</span>
                        </>
                      )}
                    </Badge>
                  </span>
                  <span className="text-center text-xs font-mono font-medium tabular-nums text-primary">{s.wins}</span>
                  <span className="text-center text-sm font-bold tabular-nums">{s.points}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};
