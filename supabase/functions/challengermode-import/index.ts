// Edge function: importa un torneo da ChallengerMode tramite Client API (GraphQL)
// e lo salva nella tabella imported_tournaments_staging per revisione manuale.
//
// ChallengerMode espone una Client API GraphQL su https://publicapi.challengermode.com/mkiii/graphql
// L'autenticazione è via Bearer token (PAT - Personal Access Token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Extract a real event date (DD/MM/YYYY etc.) from a tournament title; returns ISO or null.
function extractEventDateFromTitle(title: string, fallbackYear?: number): string | null {
  if (!title) return null;
  let m = title.match(/(\b\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  let d: number, mo: number, y: number;
  if (m) {
    d = parseInt(m[1], 10); mo = parseInt(m[2], 10); y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
  } else {
    m = title.match(/(\b\d{1,2})[\/.\-](\d{1,2})(?!\d)/);
    if (!m) return null;
    d = parseInt(m[1], 10); mo = parseInt(m[2], 10);
    y = fallbackYear ?? new Date().getFullYear();
  }
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

const GRAPHQL_ENDPOINTS = [
  "https://publicapi.challengermode.com/mkiii/graphql",
  "https://publicapi.challengermode.com/graphql",
];

const ACCESS_KEY_ENDPOINTS = [
  "https://publicapi.challengermode.com/mk1/v1/auth/access_keys",
];

const getBotAccessToken = async (refreshKey: string) => {
  let lastErr = "";
  for (const url of ACCESS_KEY_ENDPOINTS) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ refreshKey }),
      });
    } catch (e: any) {
      lastErr = `network error su ${url}: ${e.message}`;
      continue;
    }
    const text = await res.text();
    // Skip endpoints that don't actually serve this API (404 or HTML 403 "Web App Unavailable")
    if (res.status === 404 || res.status === 403 || text.trim().startsWith("<")) {
      lastErr = `${res.status} su ${url}: ${text.slice(0, 120)}`;
      continue;
    }
    if (!res.ok) {
      throw new Error(`ChallengerMode auth ${url} → ${res.status}: ${text.slice(0, 300)}`);
    }
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Risposta auth ChallengerMode non-JSON da ${url}: ${text.slice(0, 200)}`);
    }
    if (!json?.value) {
      throw new Error("ChallengerMode auth non ha restituito un access token valido");
    }
    return json.value as string;
  }
  throw new Error(`Endpoint auth ChallengerMode non raggiungibile. Ultimo errore: ${lastErr}`);
};

const extractTournamentId = (input: string): string | null => {
  const trimmed = input.trim();
  const uuidRe =
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
  const m = trimmed.match(uuidRe);
  if (m) return m[0];
  const slashMatch = trimmed.match(/tournaments\/([^/?#]+)/i);
  if (slashMatch) return slashMatch[1];
  if (!trimmed.includes("/") && trimmed.length > 0) return trimmed;
  return null;
};

const gql = async (query: string, variables: Record<string, any>, token: string) => {
  let lastErr: string = "";
  for (const url of GRAPHQL_ENDPOINTS) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (res.status === 404) {
      lastErr = `404 su ${url}`;
      continue; // prova endpoint successivo
    }
    if (!res.ok) {
      throw new Error(`GraphQL ${url} → ${res.status}: ${text.slice(0, 300)}`);
    }
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Risposta GraphQL non-JSON da ${url}: ${text.slice(0, 200)}`);
    }
    if (json.errors?.length) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 400)}`);
    }
    return json.data;
  }
  throw new Error(
    `Tutti gli endpoint GraphQL hanno risposto 404. Ultimo errore: ${lastErr}. ` +
      `La tua API key potrebbe non avere accesso alla Client API, oppure l'URL è cambiato. ` +
      `Verifica su https://www.challengermode.com/developers/docs/client-api/reference/base-url`
  );
};

// Introspect a single type's field names
const introspectType = async (typeName: string, token: string): Promise<{ fields: Set<string>; subtypes: Record<string, string> }> => {
  const q = `
    query Introspect($n: String!) {
      __type(name: $n) {
        fields {
          name
          type {
            name
            kind
            ofType { name kind ofType { name kind ofType { name kind } } }
          }
        }
      }
    }
  `;
  const data = await gql(q, { n: typeName }, token);
  const fields = new Set<string>();
  const subtypes: Record<string, string> = {};
  for (const f of data?.__type?.fields || []) {
    fields.add(f.name);
    // unwrap NON_NULL/LIST to find the named type
    let t: any = f.type;
    while (t && !t.name) t = t.ofType;
    if (t?.name) subtypes[f.name] = t.name;
  }
  return { fields, subtypes };
};

const sel = (cond: boolean, str: string) => (cond ? str : "");

const MATCH_SERIES_SELECTION = `
  id
  title
  ordinal
  state
  bestOf
  startedAt
  scheduledStartTimeAt
  lineups { id name seed placement { bestPlacement worstPlacement displayPlacement } }
  results { final draw lineupResults { lineupNumber score position final } }
  matches(includeFailed: true) {
    id
    name
    state
    lineups { number lineupName position score }
    results { final draw lineupResults { lineupNumber score position final } }
    tournamentContext { stageNumber roundNumber }
  }
`;

const buildTournamentQuery = async (token: string) => {
  const { fields: tFields, subtypes: tSub } = await introspectType("Tournament", token);
  const has = (n: string) => tFields.has(n);

  const dateField = ["scheduledStartTime", "actualStartTime", "startDate", "startTime", "startsAt", "createdAt"]
    .find((f) => has(f)) || "";
  const regField = ["registrationClosingTime", "registrationEndDate", "registrationEndTime", "registrationClosesAt"]
    .find((f) => has(f)) || "";

  let attendanceSel = "";
  if (has("attendance") && tSub.attendance) {
    const { fields: aFields, subtypes: aSub } = await introspectType(tSub.attendance, token);
    if (aFields.has("roster") && aSub.roster) {
      const { fields: rFields, subtypes: rSub } = await introspectType(aSub.roster, token);
      if (rFields.has("lineups") && rSub.lineups) {
        const { fields: lFields } = await introspectType(rSub.lineups, token);
        const idF = lFields.has("id") ? "id" : "";
        const nameF = lFields.has("name") ? "name" : "";
        const placementF = lFields.has("placement") ? "placement { bestPlacement worstPlacement displayPlacement }" : "";
        const seedF = lFields.has("seed") ? "seed" : "";
        attendanceSel = `attendance { roster { lineups { ${idF} ${nameF} ${placementF} ${seedF} } } }`;
      }
    }
  }

  const topLevelSeriesSel = has("matchSeries") ? `matchSeries { ${MATCH_SERIES_SELECTION} }` : "";
  const stagesSel = has("stages") ? `
    stages {
      __typename
      index
      format
      ... on TournamentSwissStage {
        rounds {
          roundNumber
          matchSeries { ${MATCH_SERIES_SELECTION} }
          matchSeriesPage(first: 200) { nodes { ${MATCH_SERIES_SELECTION} } }
        }
      }
      ... on TournamentEliminationStage {
        brackets {
          title
          rounds {
            roundNumber
            matchSeries { ${MATCH_SERIES_SELECTION} }
            matchSeriesPage(first: 200) { nodes { ${MATCH_SERIES_SELECTION} } }
          }
        }
      }
      ... on TournamentGroupStage {
        groups {
          number
          title
          matchSeries { ${MATCH_SERIES_SELECTION} }
          matchSeriesPage(first: 200) { nodes { ${MATCH_SERIES_SELECTION} } }
        }
      }
    }
  ` : "";

  const query = `
    query GetTournament($id: UUID!) {
      tournament(tournamentId: $id) {
        id
        name
        description
        ${sel(has("state"), "state")}
        ${dateField}
        ${regField}
        ${attendanceSel}
        ${topLevelSeriesSel}
        ${stagesSel}
      }
    }
  `;
  return query;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CHALLENGERMODE_API_KEY");
    if (!apiKey) throw new Error("CHALLENGERMODE_API_KEY non configurata");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) throw new Error("Non autenticato");

    const body = await req.json();
    const input: string = body?.tournamentInput || "";
    const regionId: string | null = body?.regionId || null;
    const clubId: string | null = body?.clubId || null;

    const tournamentId = extractTournamentId(input);
    if (!tournamentId) throw new Error("Impossibile estrarre l'ID torneo dall'input");

    const botToken = await getBotAccessToken(apiKey);

    const TOURNAMENT_QUERY = await buildTournamentQuery(botToken);
    const data = await gql(TOURNAMENT_QUERY, { id: tournamentId }, botToken);
    const tournament = data?.tournament;
    if (!tournament) {
      throw new Error(`Torneo ${tournamentId} non trovato o non accessibile con questa API key`);
    }

    // ChallengerMode auto-genera lineup name come "{username}'s party" per tornei 1v1.
    // Strippiamo il suffisso per ricavare lo username reale.
    const cleanLineupName = (raw: any): string | null => {
      if (raw == null) return null;
      let s = String(raw).trim();
      if (!s) return null;
      s = s.replace(/[\u2018\u2019\u02BC\u201B]/g, "'");
      s = s.replace(/['']s?\s+(party|team|squad|lineup|roster)\s*$/i, "").trim();
      s = s.replace(/['']\s*$/g, "").trim();
      return s || null;
    };

    // Estrai partecipanti dai lineups
    const lineups: any[] = tournament.attendance?.roster?.lineups || [];
    const normalizedParticipants = lineups.map((lineup: any, idx: number) => ({
      externalName: cleanLineupName(lineup.name) || `Player${idx + 1}`,
      externalId: lineup.id || null,
      placement: lineup.placement?.bestPlacement ?? lineup.placement?.worstPlacement ?? lineup.seed ?? idx + 1,
      tournamentsPlayed: 1,
      totalPoints: 0,
      matchedUserId: null,
      matchedDisplayName: null,
      isChild: false,
    }));

    // Estrai match reali: ChallengerMode espone le partite come MatchSeries dentro stages/rounds/groups.
    const allMatches: any[] = [];
    const seenMatches = new Set<string>();
    const scoreFromResults = (results: any, lineupNumber: number) =>
      (results?.lineupResults || []).find((r: any) => r.lineupNumber === lineupNumber) || null;
    const fallbackLineup = (series: any, lineupNumber: number) => series?.lineups?.[lineupNumber] || null;
    const lineupName = (lineup: any) => cleanLineupName(lineup?.lineupName || lineup?.name);
    const collectSeries = (series: any, meta: { stage?: number | null; round?: number | null; group?: number | null; bracket?: string | null; phase?: string | null }) => {
      if (!series) return;
      // Una series = un match della Swiss/Bracket. Dedupe per seriesId.
      const seriesKey = series.id || `${meta.stage}-${meta.round}-${series.title}`;
      if (seenMatches.has(seriesKey)) return;

      // ChallengerMode crea più "lobby" per ogni series (rematch, lobby riassegnate ecc).
      // Spesso la PRIMA lobby ha results.final=true ma con score null, e una lobby successiva
      // contiene gli score reali. Selezione: prendiamo il match con punteggi reali (non-null),
      // preferendo quello finale; fallback alla series.results aggregata.
      const rawMatches: any[] = Array.isArray(series.matches) ? series.matches : [];
      const notCancelled = rawMatches.filter((m: any) => {
        const state = (m?.state || "").toString().toUpperCase();
        return state !== "CANCELLED" && state !== "FAILED" && state !== "ABORTED";
      });
      const hasRealScore = (m: any) => {
        const lr = m?.results?.lineupResults || [];
        if (lr.some((r: any) => typeof r?.score === "number" && r.score !== null)) return true;
        const ml = m?.lineups || [];
        return ml.some((l: any) => typeof l?.score === "number" && l.score !== null);
      };
      const hasWinnerPosition = (m: any) => {
        const lr = m?.results?.lineupResults || [];
        return lr.some((r: any) => r?.position === 1);
      };
      // Priority: real-score AND final → real-score → winner position → final flag → last
      const scoredFinal = notCancelled.find((m: any) => m?.results?.final && hasRealScore(m));
      const anyScored = [...notCancelled].reverse().find(hasRealScore);
      const anyWinner = notCancelled.find(hasWinnerPosition);
      const finalOnly = notCancelled.find((m: any) => m?.results?.final);
      const match = scoredFinal || anyScored || anyWinner || finalOnly || notCancelled[notCancelled.length - 1] || null;

      const lineupsInMatch = match?.lineups || [];
      const l1 = lineupsInMatch.find((l: any) => l.number === 0) || fallbackLineup(series, 0);
      const l2 = lineupsInMatch.find((l: any) => l.number === 1) || fallbackLineup(series, 1);
      const matchResults = match?.results || {};
      const seriesResults = series?.results || {};
      const mr1 = scoreFromResults(matchResults, 0);
      const mr2 = scoreFromResults(matchResults, 1);
      const sr1 = scoreFromResults(seriesResults, 0);
      const sr2 = scoreFromResults(seriesResults, 1);
      // Score: match-level lineupResults > match.lineups[].score > series-level (best-of count)
      const pickScore = (mr: any, lineup: any, sr: any) => {
        if (mr && typeof mr.score === "number" && mr.score !== null) return mr.score;
        if (lineup && typeof lineup.score === "number" && lineup.score !== null) return lineup.score;
        if (sr && typeof sr.score === "number" && sr.score !== null) return sr.score;
        return null;
      };
      const s1 = pickScore(mr1, l1, sr1);
      const s2 = pickScore(mr2, l2, sr2);
      // Match-level positions are 1/2; series-level positions may be 0/1.
      // Use scores first, then match-level positions, then series-level fallback.
      const r1 = { score: s1, position: mr1?.position ?? l1?.position ?? null, seriesPosition: sr1?.position ?? null };
      const r2 = { score: s2, position: mr2?.position ?? l2?.position ?? null, seriesPosition: sr2?.position ?? null };
      const isDraw = !!(matchResults.draw || seriesResults.draw);
      // Winner: position === 1 (1-indexed). Fallback: higher score wins.
      let winnerLineup: any = null;
      if (!isDraw) {
        if (typeof s1 === "number" && typeof s2 === "number" && s1 !== s2) {
          winnerLineup = s1 > s2 ? l1 : l2;
        } else if (r1.position === 1) winnerLineup = l1;
        else if (r2.position === 1) winnerLineup = l2;
        else if (r1.seriesPosition === 0) winnerLineup = l1;
        else if (r2.seriesPosition === 0) winnerLineup = l2;
        else if (r1.seriesPosition === 1 && r2.seriesPosition !== 0) winnerLineup = l1;
        else if (r2.seriesPosition === 1 && r1.seriesPosition !== 0) winnerLineup = l2;
      }

      seenMatches.add(seriesKey);
      allMatches.push({
        externalId: match?.id || series.id || null,
        seriesId: series.id || null,
        seriesTitle: series.title || null,
        round: match?.tournamentContext?.roundNumber ?? meta.round ?? null,
        stage: match?.tournamentContext?.stageNumber ?? meta.stage ?? null,
        group: meta.group ?? null,
        bracket: meta.bracket ?? null,
        phase: meta.phase ?? null,
        team1Id: fallbackLineup(series, 0)?.id || null,
        team1Name: lineupName(l1),
        team2Id: fallbackLineup(series, 1)?.id || null,
        team2Name: lineupName(l2),
        score1: r1?.score ?? null,
        score2: r2?.score ?? null,
        winnerId: winnerLineup === l1 ? fallbackLineup(series, 0)?.id || null : winnerLineup === l2 ? fallbackLineup(series, 1)?.id || null : null,
        winnerName: lineupName(winnerLineup),
        state: match?.state || series.state || null,
        isFinal: !!(matchResults.final || seriesResults.final),
        isDraw,
      });
    };

    const stagePhase = (stage: any): string => {
      const tn = (stage?.__typename || "").toString();
      const fmt = (stage?.format || "").toString().toUpperCase();
      if (/Swiss/i.test(tn) || fmt === "SWISS") return "swiss";
      if (/Elimination/i.test(tn) || /ELIM|BRACKET|SINGLE|DOUBLE/.test(fmt)) return "top_cut";
      if (/Group/i.test(tn) || fmt === "GROUP" || fmt === "ROUND_ROBIN") return "group";
      return "swiss";
    };

    (tournament.matchSeries || []).forEach((series: any) => collectSeries(series, { phase: "swiss" }));
    (tournament.stages || []).forEach((stage: any) => {
      const stageIndex = stage.index ?? null;
      const phase = stagePhase(stage);
      if (Array.isArray(stage.rounds)) {
        stage.rounds.forEach((round: any) => {
          const seriesList = round.matchSeries || round.matchesSeries || round.matchSeriesPage?.nodes || [];
          seriesList.forEach((series: any) => collectSeries(series, { stage: stageIndex, round: round.roundNumber, phase }));
        });
      }
      if (Array.isArray(stage.brackets)) {
        const stageFmt = (stage?.format || "").toString().toUpperCase();
        const isDoubleElim = /DOUBLE/.test(stageFmt);
        stage.brackets.forEach((bracket: any) => {
          const t = (bracket.title || "").toString().toLowerCase();
          const isLower =
            (isDoubleElim && /(lower|loser|losers|perdenti|consolation|repechage)/.test(t)) ||
            /(loser bracket|losers bracket|lower bracket|bracket perdenti)/.test(t);
          const bracketPhase = isLower ? "tiebreaker" : "top_cut";
          (bracket.rounds || []).forEach((round: any) => {
            const seriesList = round.matchSeries || round.matchesSeries || round.matchSeriesPage?.nodes || [];
            seriesList.forEach((series: any) => collectSeries(series, { stage: stageIndex, round: round.roundNumber, bracket: bracket.title, phase: bracketPhase }));
          });
        });
      }
      if (Array.isArray(stage.groups)) {
        stage.groups.forEach((group: any) => {
          const seriesList = group.matchSeries || group.matchSeriesPage?.nodes || [];
          seriesList.forEach((series: any) => collectSeries(series, { stage: stageIndex, group: group.number, phase: phase === "swiss" ? "swiss" : "group" }));
        });
      }
    });

    // Standings: ChallengerMode espone il piazzamento finale sui TournamentLineup.
    const normalizedStandings = [...normalizedParticipants]
      .sort((a, b) => (a.placement || 9999) - (b.placement || 9999))
      .map((p, idx) => ({
        position: p.placement || idx + 1,
        placement: p.placement || idx + 1,
        externalName: p.externalName,
        matchedUserId: null,
        matchedDisplayName: null,
        isChild: false,
        totalPoints: 0,
      }));

    const adminClient = createClient(supabaseUrl, serviceRole);
    const { error: insertErr } = await adminClient
      .from("imported_tournaments_staging")
      .insert({
        imported_by: userData.user.id,
        source_platform: "challengermode_api",
        raw_data: { tournament, externalId: tournamentId },
        title: tournament.name || `Torneo ChallengerMode ${tournamentId.slice(0, 6)}`,
        location: "Challengermode",
        city: "Online",
        club_id: clubId,
        region_id: regionId,
        event_date:
          tournament.scheduledStartTime || tournament.actualStartTime || tournament.startDate ||
          tournament.startTime || tournament.startsAt || tournament.createdAt ||
          extractEventDateFromTitle(tournament.name || "") || new Date().toISOString(),
        registration_deadline:
          tournament.registrationClosingTime || tournament.registrationEndDate ||
          tournament.registrationEndTime || tournament.registrationClosesAt ||
          tournament.scheduledStartTime || tournament.actualStartTime ||
          tournament.startDate || new Date().toISOString(),
        is_ranked: true,
        participants: normalizedParticipants,
        matches: allMatches,
        standings: normalizedStandings,
        status: "draft",
      });

    if (insertErr) throw new Error(`Errore salvataggio staging: ${insertErr.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        tournamentId,
        title: tournament.name,
        participantsCount: normalizedParticipants.length,
        matchesCount: allMatches.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("challengermode-import error:", err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
