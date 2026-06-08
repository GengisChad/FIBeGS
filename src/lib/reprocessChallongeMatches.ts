// Re-extracts matches from a saved Challonge raw_data JSON payload using the
// same logic as the manual import in ExternalImportsAdminTab. Used by the
// "Riprocessa tutto" button to repair staging rows imported with older parsing.

interface ParsedImportMatch {
  externalId?: string | number | null;
  team1Name: string;
  team2Name: string;
  winnerName?: string | null;
  score1?: number | null;
  score2?: number | null;
  phase?: string;
  bracket?: string;
  round?: number;
  state?: string | null;
}

export const reprocessChallongeMatches = (rawData: any): ParsedImportMatch[] => {
  if (!rawData) return [];
  const raw = rawData;
  const tournamentNode = raw.tournament || raw;

  // Collect participants (for name resolution by id)
  let pList: any[] = [];
  const candidates = [
    tournamentNode?.participants,
    tournamentNode?.players,
    raw?.participants,
    Array.isArray(raw) ? raw : null,
  ].filter(Boolean);
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) { pList = c; break; }
  }

  // Collect matches deeply
  const rawMatches: any[] = [];
  const seenMatchIds = new Set<string>();
  const collectMatches = (node: any, depth = 0) => {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) {
      node.forEach((item) => collectMatches(item, depth + 1));
      return;
    }
    if (typeof node !== "object") return;
    const match = node.match || node;
    if (match && typeof match === "object" && match.player1 && match.player2) {
      const id = String(
        match.id ??
          `${match.player1?.id ?? match.player1?.display_name}-${match.player2?.id ?? match.player2?.display_name}-${match.identifier ?? match.raw_identifier ?? rawMatches.length}`,
      );
      if (!seenMatchIds.has(id)) {
        seenMatchIds.add(id);
        rawMatches.push(match);
      }
    }
    Object.values(node).forEach((value) => collectMatches(value, depth + 1));
  };
  collectMatches(raw);

  // Fallback: gather players from match objects when participants list is empty
  if (pList.length === 0) {
    const playersById = new Map<string, any>();
    const addMatchPlayer = (player: any) => {
      if (!player || typeof player !== "object") return;
      const playerName = player.name || player.display_name || player.username || player.challonge_username;
      const playerId = String(player.id ?? player.participant_id ?? playerName ?? "");
      if (!playerName || !playerId) return;
      playersById.set(playerId, { id: playerId, name: playerName });
    };
    const scanForMatches = (node: any, depth = 0) => {
      if (!node || depth > 8) return;
      if (Array.isArray(node)) { node.forEach((item) => scanForMatches(item, depth + 1)); return; }
      if (typeof node !== "object") return;
      const match = node.match || node;
      addMatchPlayer(match.player1);
      addMatchPlayer(match.player2);
      Object.values(node).forEach((value) => scanForMatches(value, depth + 1));
    };
    scanForMatches(raw);
    pList = Array.from(playersById.values());
  }

  const nameById = new Map<string, string>();
  pList.forEach((p: any) => {
    const inner = p.participant || p;
    const nm = inner.name || inner.display_name || inner.username || inner.challonge_username;
    if (nm) nameById.set(String(inner.id ?? inner.participant_id ?? nm), String(nm).trim());
  });

  const playerName = (player: any) =>
    String(
      player?.name ||
        player?.display_name ||
        player?.username ||
        player?.challonge_username ||
        nameById.get(String(player?.id ?? player?.participant_id ?? "")) ||
        "",
    ).trim();

  const tType = String(tournamentNode?.tournament_type || tournamentNode?.type || "").toLowerCase();
  let isSwissTournament = tType.includes("swiss");
  let isElimTournament = tType.includes("elimination");

  // Heuristic: detect Swiss-shaped brackets even when Challonge reports
  // "single elimination" (some organizers misconfigure or use staged events).
  // In a true single-elim, each round halves the number of matches; in Swiss
  // each round has roughly N/2 matches throughout.
  if (!isSwissTournament) {
    const roundCounts = new Map<number, number>();
    for (const m of rawMatches) {
      const r = Number(m.round ?? 0);
      if (r > 0) roundCounts.set(r, (roundCounts.get(r) || 0) + 1);
    }
    const sortedRounds = Array.from(roundCounts.keys()).sort((a, b) => a - b);
    if (sortedRounds.length >= 2) {
      const first = roundCounts.get(sortedRounds[0]) || 0;
      const second = roundCounts.get(sortedRounds[1]) || 0;
      // Single-elim: round 2 ≈ round 1 / 2. Swiss: round 2 ≈ round 1.
      if (first > 0 && second / first > 0.65) {
        isSwissTournament = true;
        isElimTournament = false;
      }
    }
  }

  return rawMatches
    .map((m: any) => {
      const p1 = playerName(m.player1);
      const p2 = playerName(m.player2);
      const games = Array.isArray(m.games) ? m.games : [];
      const score1 = games.reduce(
        (sum: number, g: any) => sum + (Number(Array.isArray(g) ? g[0] : g?.[0]) || 0),
        0,
      );
      const score2 = games.reduce(
        (sum: number, g: any) => sum + (Number(Array.isArray(g) ? g[1] : g?.[1]) || 0),
        0,
      );
      const winnerName =
        String(m.winner_id ?? "") === String(m.player1?.id ?? m.player1?.participant_id ?? "")
          ? p1
          : String(m.winner_id ?? "") === String(m.player2?.id ?? m.player2?.participant_id ?? "")
            ? p2
            : null;
      const bracketText = String(m.raw_identifier || m.identifier || m.round || "");
      const roundNum = Number(m.round ?? 0);
      const isLoserBracket = roundNum < 0;
      let phase: string;
      let bracket: string;
      if (isSwissTournament) {
        phase = isLoserBracket ? "tiebreaker" : "swiss";
        bracket = isLoserBracket ? `Challonge Tiebreaker ${bracketText}` : `Swiss Round ${Math.abs(roundNum) || 1}`;
      } else if (isElimTournament) {
        phase = isLoserBracket ? "tiebreaker" : "top_cut";
        bracket = isLoserBracket ? "Challonge Loser Bracket" : "Challonge Top Cut";
      } else {
        phase = roundNum > 0 ? "top_cut" : "tiebreaker";
        bracket = roundNum > 0 ? "Challonge Top Cut" : `Challonge Placement ${bracketText}`;
      }
      return {
        externalId: m.id ?? null,
        team1Name: p1,
        team2Name: p2,
        winnerName,
        score1: games.length > 0 ? score1 : null,
        score2: games.length > 0 ? score2 : null,
        phase,
        bracket,
        round: Math.abs(roundNum) || 1,
        state: m.state ?? null,
      };
    })
    .filter((m) => m.team1Name && m.team2Name);
};
