// Recalculate final tournament standings from imported match data.
//
// Rules (per FIBeGS BFL):
//  - Per-tournament points = PARTICIPATION_BONUS (2)
//                          + totalWins * POINTS_PER_WIN (4)
//  - "totalWins" includes Swiss wins AND top-cut wins (tiebreakers excluded)
//  - Final positions are unique (no ties). Ordering:
//      1) Players who reached top cut: ordered by their bracket finish
//         (winner of final = 1, loser of final = 2, losers of semis = 3-4, ...).
//         Ties within the same elimination round are broken by Swiss tiebreakers.
//      2) Players who did NOT reach top cut: ordered by Swiss tiebreakers
//         (wins desc, OMW% desc, game diff desc, game wins desc, name asc).

export interface StagingParticipantInput {
  externalName?: string | null;
  matchedUserId?: string | null;
  matchedDisplayName?: string | null;
  placement?: number | null;
  totalPoints?: number | null;
  tournamentsPlayed?: number | null;
  isChild?: boolean;
  [k: string]: any;
}

export interface StagingMatchInput {
  team1Name?: string | null;
  team2Name?: string | null;
  player1?: string | null;
  player2?: string | null;
  winnerName?: string | null;
  score1?: number | null;
  score2?: number | null;
  phase?: string | null;
  bracket?: string | null;
  round?: number | null;
  [k: string]: any;
}

const PARTICIPATION_BONUS = 2;
const POINTS_PER_WIN = 4;

const cleanName = (s: any) => {
  if (s == null) return "";
  return String(s)
    .replace(/[\u2018\u2019\u02BC\u201B]/g, "'")
    .replace(/'s?\s+(party|team|squad|lineup|roster)\s*$/i, "")
    .replace(/'\s*$/g, "")
    .trim();
};

const norm = (s: any) => cleanName(s).toLowerCase();

type Phase = "swiss" | "top_cut" | "tiebreaker";

const phaseOf = (m: StagingMatchInput): Phase => {
  const explicit = (m.phase || "").toString().toLowerCase();
  if (explicit === "tiebreaker" || explicit === "spareggio" || explicit === "placement") return "tiebreaker";
  if (explicit === "top_cut" || explicit === "top-cut" || explicit === "elimination") return "top_cut";
  if (explicit === "swiss" || explicit === "group") return "swiss";
  const bracket = (m.bracket || "").toString().toLowerCase();
  if (/(lower|loser|losers|perdenti|consolation|repechage)/.test(bracket)) return "tiebreaker";
  if (/final|semi|quarter|round.*16|top|elim|upper|winner/.test(bracket)) return "top_cut";
  return "swiss";
};

// Top-cut wins now contribute equally to per-win points; no separate finish bonus.

interface PlayerStats {
  externalName: string;
  matchedUserId: string | null;
  matchedDisplayName: string | null;
  isChild: boolean;
  swissWins: number;
  losses: number;
  draws: number;
  gamesWon: number;
  gamesLost: number;
  opponents: string[]; // normalized names of swiss opponents
  topCutLastRound: number | null; // highest top-cut round they played
  topCutLostInRound: number | null; // round in which they were eliminated; null if undefeated in top cut
  raw: StagingParticipantInput;
}

export interface StagingStandingRow {
  position: number;
  externalName: string;
  matchedUserId: string | null;
  matchedDisplayName: string | null;
  isChild: boolean;
  wins: number;
  losses: number;
  draws: number;
  totalPoints: number;
  omwPercent: number;
  gameDiff: number;
  topCutFinish: number | null;
}

export const computeStagingStandings = (
  participants: StagingParticipantInput[],
  matches: StagingMatchInput[],
): { standings: StagingStandingRow[]; participants: StagingParticipantInput[] } => {
  const sheet = new Map<string, PlayerStats>();
  for (const p of participants) {
    const key = norm(p.externalName);
    if (!key) continue;
    sheet.set(key, {
      externalName: p.externalName || "",
      matchedUserId: p.matchedUserId || null,
      matchedDisplayName: p.matchedDisplayName || null,
      isChild: !!p.isChild,
      swissWins: 0,
      losses: 0,
      draws: 0,
      gamesWon: 0,
      gamesLost: 0,
      opponents: [],
      topCutLastRound: null,
      topCutLostInRound: null,
      raw: p,
    });
  }

  // Walk matches: skip tiebreakers for win counting; track top-cut progression.
  let topCutMaxRound = 0;
  for (const m of matches) {
    const ph = phaseOf(m);
    if (ph === "tiebreaker") continue;

    const p1 = norm(m.team1Name || m.player1);
    const p2 = norm(m.team2Name || m.player2);
    const winner = norm(m.winnerName);
    const s1 = typeof m.score1 === "number" ? m.score1 : null;
    const s2 = typeof m.score2 === "number" ? m.score2 : null;
    const round = typeof m.round === "number" && m.round > 0 ? m.round : 1;

    const a = p1 ? sheet.get(p1) : null;
    const b = p2 ? sheet.get(p2) : null;

    // game points (informational, used for tiebreakers)
    if (a) { if (s1 != null) a.gamesWon += s1; if (s2 != null) a.gamesLost += s2; }
    if (b) { if (s2 != null) b.gamesWon += s2; if (s1 != null) b.gamesLost += s1; }

    let winnerSide: "a" | "b" | "draw" | null = null;
    // Prefer the actual score when available: old ChallengerMode imports could
    // mark the wrong winner because series placements use 0/1 while matches use 1/2.
    if (s1 != null && s2 != null) {
      if (s1 > s2) winnerSide = "a";
      else if (s2 > s1) winnerSide = "b";
      else winnerSide = "draw";
    }
    if ((winnerSide == null || winnerSide === "draw") && winner) {
      if (winner === p1) winnerSide = "a";
      else if (winner === p2) winnerSide = "b";
    }

    if (ph === "swiss" || ph === "top_cut") {
      if (ph === "swiss" && a && b) { a.opponents.push(p2); b.opponents.push(p1); }
      if (winnerSide === "a") { if (a) a.swissWins++; if (b) b.losses++; }
      else if (winnerSide === "b") { if (b) b.swissWins++; if (a) a.losses++; }
      else if (winnerSide === "draw") { if (a) a.draws++; if (b) b.draws++; }
    }
    if (ph === "top_cut") {
      topCutMaxRound = Math.max(topCutMaxRound, round);
      if (a) {
        a.topCutLastRound = Math.max(a.topCutLastRound ?? 0, round);
        if (winnerSide === "b") a.topCutLostInRound = Math.max(a.topCutLostInRound ?? 0, round);
      }
      if (b) {
        b.topCutLastRound = Math.max(b.topCutLastRound ?? 0, round);
        if (winnerSide === "a") b.topCutLostInRound = Math.max(b.topCutLostInRound ?? 0, round);
      }
    }
  }

  // OMW% (Swiss only)
  const winRate = (st: PlayerStats) => {
    const tot = st.swissWins + st.losses + st.draws;
    if (tot === 0) return 0;
    return Math.max(st.swissWins / tot, 0.33);
  };
  const stats = Array.from(sheet.values());
  const omw = new Map<string, number>();
  for (const st of stats) {
    if (st.opponents.length === 0) { omw.set(norm(st.externalName), 0); continue; }
    let sum = 0; let n = 0;
    for (const opKey of st.opponents) {
      const op = sheet.get(opKey);
      if (!op) continue;
      sum += winRate(op); n++;
    }
    omw.set(norm(st.externalName), n > 0 ? sum / n : 0);
  }

  // Determine top-cut finish per player (single-elimination assumption).
  // finishGroupSize: round R (with R = topCutMaxRound being the final) →
  //   losers in round R: finish 2 (or 1 for the winner)
  //   losers in round R-1: finish 3-4
  //   losers in round R-2: finish 5-8, ...
  const topCutFinish = new Map<string, number>();
  if (topCutMaxRound > 0) {
    for (const st of stats) {
      if (st.topCutLastRound == null) continue;
      const key = norm(st.externalName);
      if (st.topCutLostInRound == null && st.topCutLastRound >= topCutMaxRound) {
        topCutFinish.set(key, 1); // undefeated → champion
      } else {
        const lost = st.topCutLostInRound ?? st.topCutLastRound;
        const roundsFromFinal = topCutMaxRound - lost; // 0 = final, 1 = semis, 2 = QF
        // group starts at 2^roundsFromFinal + 1 ; e.g. 0→2, 1→3, 2→5, 3→9
        const groupStart = roundsFromFinal === 0 ? 2 : Math.pow(2, roundsFromFinal) + 1;
        topCutFinish.set(key, groupStart);
      }
    }
  }

  // Sort: top-cut players first by finish (with Swiss tiebreakers within same finish group),
  // then non-top-cut players by Swiss tiebreakers.
  const swissCmp = (a: PlayerStats, b: PlayerStats) => {
    if (b.swissWins !== a.swissWins) return b.swissWins - a.swissWins;
    const oa = omw.get(norm(a.externalName)) || 0;
    const ob = omw.get(norm(b.externalName)) || 0;
    if (ob !== oa) return ob - oa;
    const da = a.gamesWon - a.gamesLost;
    const db = b.gamesWon - b.gamesLost;
    if (db !== da) return db - da;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return (a.externalName || "").localeCompare(b.externalName || "");
  };

  const sorted = [...stats].sort((a, b) => {
    const fa = topCutFinish.get(norm(a.externalName)) ?? null;
    const fb = topCutFinish.get(norm(b.externalName)) ?? null;
    if (fa != null && fb == null) return -1;
    if (fa == null && fb != null) return 1;
    if (fa != null && fb != null && fa !== fb) return fa - fb;
    return swissCmp(a, b);
  });

  const standings: StagingStandingRow[] = sorted.map((st, i) => {
    const finish = topCutFinish.get(norm(st.externalName)) ?? null;
    const points = PARTICIPATION_BONUS + st.swissWins * POINTS_PER_WIN;
    return {
      position: i + 1,
      externalName: st.externalName,
      matchedUserId: st.matchedUserId,
      matchedDisplayName: st.matchedDisplayName,
      isChild: st.isChild,
      wins: st.swissWins,
      losses: st.losses,
      draws: st.draws,
      totalPoints: points,
      omwPercent: Math.round((omw.get(norm(st.externalName)) || 0) * 1000) / 10,
      gameDiff: st.gamesWon - st.gamesLost,
      topCutFinish: finish,
    };
  });

  const byKey = new Map(standings.map((s) => [norm(s.externalName), s]));
  const updatedParticipants = participants.map((p) => {
    const s = byKey.get(norm(p.externalName));
    if (!s) return p;
    return { ...p, placement: s.position, totalPoints: s.totalPoints };
  });

  return { standings, participants: updatedParticipants };
};
