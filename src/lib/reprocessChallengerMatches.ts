// Re-extracts matches from a saved ChallengerMode raw_data.tournament payload
// using the same logic as the challengermode-import edge function. Used to
// repair staging rows imported with the older score-extraction logic.

const cleanLineupName = (raw: any): string | null => {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[\u2018\u2019\u02BC\u201B]/g, "'");
  s = s.replace(/'s\s+(party|team|squad|lineup|roster)\s*$/i, "").trim();
  return s || null;
};

const stagePhase = (stage: any): "swiss" | "top_cut" | "group" => {
  const tn = (stage?.__typename || "").toString();
  const fmt = (stage?.format || "").toString().toUpperCase();
  if (/Swiss/i.test(tn) || fmt === "SWISS") return "swiss";
  if (/Elimination/i.test(tn) || /ELIM|BRACKET|SINGLE|DOUBLE/.test(fmt)) return "top_cut";
  if (/Group/i.test(tn) || fmt === "GROUP" || fmt === "ROUND_ROBIN") return "group";
  return "swiss";
};

// Double-elim: brackets contain "Lower"/"Loser"/"Perdenti"/"Losers" → spareggio (tiebreaker).
// Grand final and Upper/Winners stay as top_cut.
export const classifyEliminationBracket = (
  bracketTitle?: string | null,
  stageFormat?: string | null,
): "top_cut" | "tiebreaker" => {
  const t = (bracketTitle || "").toString().toLowerCase();
  const fmt = (stageFormat || "").toString().toUpperCase();
  const isDoubleElim = /DOUBLE/.test(fmt);
  if (isDoubleElim && /(lower|loser|losers|perdenti|consolation|repechage)/.test(t)) {
    return "tiebreaker";
  }
  // Even without explicit DOUBLE format, if title clearly says "loser bracket" treat as spareggio
  if (/(loser bracket|losers bracket|lower bracket|bracket perdenti)/.test(t)) {
    return "tiebreaker";
  }
  return "top_cut";
};

const scoreFromResults = (results: any, lineupNumber: number) =>
  (results?.lineupResults || []).find((r: any) => r.lineupNumber === lineupNumber) || null;

const fallbackLineup = (series: any, lineupNumber: number) =>
  series?.lineups?.[lineupNumber] || null;

const lineupName = (lineup: any) =>
  cleanLineupName(lineup?.lineupName || lineup?.name);

const collectSeries = (
  series: any,
  meta: { stage?: number | null; round?: number | null; group?: number | null; bracket?: string | null; phase?: string | null },
  out: any[],
  seen: Set<string>,
) => {
  if (!series) return;
  const seriesKey = series.id || `${meta.stage}-${meta.round}-${series.title}`;
  if (seen.has(seriesKey)) return;

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
  const pickScore = (mr: any, lineup: any, sr: any) => {
    if (mr && typeof mr.score === "number" && mr.score !== null) return mr.score;
    if (lineup && typeof lineup.score === "number" && lineup.score !== null) return lineup.score;
    if (sr && typeof sr.score === "number" && sr.score !== null) return sr.score;
    return null;
  };
  const s1 = pickScore(mr1, l1, sr1);
  const s2 = pickScore(mr2, l2, sr2);
  // ChallengerMode series-level results can expose placement as 0/1 while
  // match-level results use 1/2. Treat only position=1 as winner unless the
  // score already makes the winner obvious.
  const p1 = mr1?.position ?? l1?.position ?? null;
  const p2 = mr2?.position ?? l2?.position ?? null;
  const isDraw = !!(matchResults.draw || seriesResults.draw);
  let winnerLineup: any = null;
  if (!isDraw) {
    if (typeof s1 === "number" && typeof s2 === "number" && s1 !== s2) {
      winnerLineup = s1 > s2 ? l1 : l2;
    } else if (p1 === 1) winnerLineup = l1;
    else if (p2 === 1) winnerLineup = l2;
    else if (sr1?.position === 0) winnerLineup = l1;
    else if (sr2?.position === 0) winnerLineup = l2;
    else if (sr1?.position === 1 && sr2?.position !== 0) winnerLineup = l1;
    else if (sr2?.position === 1 && sr1?.position !== 0) winnerLineup = l2;
  }

  seen.add(seriesKey);
  out.push({
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
    score1: s1,
    score2: s2,
    winnerId: winnerLineup === l1
      ? fallbackLineup(series, 0)?.id || null
      : winnerLineup === l2
      ? fallbackLineup(series, 1)?.id || null
      : null,
    winnerName: lineupName(winnerLineup),
    state: match?.state || series.state || null,
    isFinal: !!(matchResults.final || seriesResults.final),
    isDraw,
  });
};

export const reprocessChallengerMatches = (rawData: any): any[] => {
  const t = rawData?.tournament || rawData;
  if (!t) return [];
  const out: any[] = [];
  const seen = new Set<string>();

  (t.matchSeries || []).forEach((series: any) =>
    collectSeries(series, { phase: "swiss" }, out, seen)
  );
  (t.stages || []).forEach((stage: any) => {
    const stageIndex = stage.index ?? null;
    const phase = stagePhase(stage);
    if (Array.isArray(stage.rounds)) {
      stage.rounds.forEach((round: any) => {
        const seriesList = round.matchSeries || round.matchesSeries || round.matchSeriesPage?.nodes || [];
        seriesList.forEach((series: any) =>
          collectSeries(series, { stage: stageIndex, round: round.roundNumber, phase }, out, seen)
        );
      });
    }
    if (Array.isArray(stage.brackets)) {
      stage.brackets.forEach((bracket: any) => {
        const bracketPhase = classifyEliminationBracket(bracket.title, stage.format);
        (bracket.rounds || []).forEach((round: any) => {
          const seriesList = round.matchSeries || round.matchesSeries || round.matchSeriesPage?.nodes || [];
          seriesList.forEach((series: any) =>
            collectSeries(
              series,
              { stage: stageIndex, round: round.roundNumber, bracket: bracket.title, phase: bracketPhase },
              out,
              seen
            )
          );
        });
      });
    }
    if (Array.isArray(stage.groups)) {
      stage.groups.forEach((group: any) => {
        const seriesList = group.matchSeries || group.matchSeriesPage?.nodes || [];
        seriesList.forEach((series: any) =>
          collectSeries(
            series,
            { stage: stageIndex, group: group.number, phase: phase === "swiss" ? "swiss" : "group" },
            out,
            seen
          )
        );
      });
    }
  });

  return out;
};
