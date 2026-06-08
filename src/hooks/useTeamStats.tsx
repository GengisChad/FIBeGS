import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MemberStat = {
  user_id: string;
  tournaments: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  bestPlacement: number | null;
  totalPoints: number;
};

export type PerTournamentMemberStat = {
  wins: number;
  losses: number;
  draws: number;
  placement: number | null;
  points: number;
};

export type TeamTournament = {
  tournament_id: string;
  name: string;
  date: string | null;
  members_played: string[];
  best_placement: number | null;
  perUser: Record<string, PerTournamentMemberStat>;
};

export type TeamAggregate = {
  totalTournaments: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  bestPlacement: number | null;
};

export type TeamModeTournament = {
  tournament_id: string;
  name: string;
  date: string | null;
  placement: number | null;
  member_ids: string[];
  perUser: Record<string, PerTournamentMemberStat>;
};

export const useTeamStats = (memberIds: string[]) => {
  const [memberStats, setMemberStats] = useState<Record<string, MemberStat>>({});
  const [tournaments, setTournaments] = useState<TeamTournament[]>([]);
  const [teamModeTournaments, setTeamModeTournaments] = useState<TeamModeTournament[]>([]);
  const [teamModeAggregate, setTeamModeAggregate] = useState<TeamAggregate>({
    totalTournaments: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, winRate: 0, bestPlacement: null,
  });
  const [aggregate, setAggregate] = useState<TeamAggregate>({
    totalTournaments: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, winRate: 0, bestPlacement: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberIds.length) {
      setMemberStats({}); setTournaments([]);
      setAggregate({ totalTournaments: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, winRate: 0, bestPlacement: null });
      return;
    }

    (async () => {
      setLoading(true);

      // Tournament registrations
      const { data: regs } = await supabase
        .from("tournament_registrations")
        .select("tournament_id, user_id")
        .in("user_id", memberIds);

      const regList = (regs || []) as { tournament_id: string; user_id: string }[];
      const tournamentIds = Array.from(new Set(regList.map(r => r.tournament_id)));

      // Tournament details
      let tInfo: Record<string, { name: string; date: string | null }> = {};
      if (tournamentIds.length) {
        const { data: ts } = await supabase
          .from("tournaments")
          .select("id, title, event_date")
          .in("id", tournamentIds);
        (ts || []).forEach((t: any) => { tInfo[t.id] = { name: t.title, date: t.event_date }; });
      }

      // Match aggregation
      const { data: matches } = tournamentIds.length ? await supabase
        .from("tournament_matches")
        .select("tournament_id, player1_id, player2_id, winner_id, player1_score, player2_score")
        .in("tournament_id", tournamentIds)
        .not("winner_id", "is", null) : { data: [] as any[] };

      // Results (placements)
      const { data: results } = tournamentIds.length ? await supabase
        .from("tournament_results")
        .select("tournament_id, user_id, placement, scaled_points")
        .in("tournament_id", tournamentIds)
        .in("user_id", memberIds) : { data: [] as any[] };

      // Member stats
      const stats: Record<string, MemberStat> = {};
      memberIds.forEach(id => {
        stats[id] = { user_id: id, tournaments: 0, wins: 0, losses: 0, draws: 0, winRate: 0, bestPlacement: null, totalPoints: 0 };
      });

      regList.forEach(r => { if (stats[r.user_id]) stats[r.user_id].tournaments++; });

      (matches || []).forEach((m: any) => {
        const pids = [m.player1_id, m.player2_id].filter(Boolean);
        pids.forEach((pid: string) => {
          if (!stats[pid]) return;
          if (m.winner_id === pid) stats[pid].wins++;
          else if (m.winner_id) stats[pid].losses++;
          else stats[pid].draws++;
        });
      });

      (results || []).forEach((r: any) => {
        const s = stats[r.user_id];
        if (!s) return;
        s.totalPoints += Number(r.scaled_points || 0);
        if (s.bestPlacement === null || r.placement < s.bestPlacement) s.bestPlacement = r.placement;
      });

      Object.values(stats).forEach(s => {
        const g = s.wins + s.losses + s.draws;
        s.winRate = g ? Math.round((s.wins / g) * 100) : 0;
      });

      setMemberStats(stats);

      // Per-tournament + per-user breakdown
      const perTU: Record<string, Record<string, PerTournamentMemberStat>> = {};
      const ensure = (tid: string, uid: string) => {
        if (!perTU[tid]) perTU[tid] = {};
        if (!perTU[tid][uid]) perTU[tid][uid] = { wins: 0, losses: 0, draws: 0, placement: null, points: 0 };
        return perTU[tid][uid];
      };
      (matches || []).forEach((m: any) => {
        [m.player1_id, m.player2_id].filter(Boolean).forEach((pid: string) => {
          if (!memberIds.includes(pid)) return;
          const s = ensure(m.tournament_id, pid);
          if (m.winner_id === pid) s.wins++;
          else if (m.winner_id) s.losses++;
          else s.draws++;
        });
      });
      (results || []).forEach((r: any) => {
        if (!memberIds.includes(r.user_id)) return;
        const s = ensure(r.tournament_id, r.user_id);
        s.placement = r.placement;
        s.points = Number(r.scaled_points || 0);
      });

      // Per-tournament view
      const byT: Record<string, TeamTournament> = {};
      regList.forEach(r => {
        const info = tInfo[r.tournament_id];
        if (!byT[r.tournament_id]) {
          byT[r.tournament_id] = {
            tournament_id: r.tournament_id,
            name: info?.name || "Torneo",
            date: info?.date || null,
            members_played: [],
            best_placement: null,
            perUser: perTU[r.tournament_id] || {},
          };
        }
        byT[r.tournament_id].members_played.push(r.user_id);
      });
      (results || []).forEach((r: any) => {
        const t = byT[r.tournament_id];
        if (t && (t.best_placement === null || r.placement < t.best_placement)) t.best_placement = r.placement;
      });
      const tList = Object.values(byT).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setTournaments(tList);

      // Aggregate
      const totals = Object.values(stats).reduce((acc, s) => ({
        wins: acc.wins + s.wins,
        losses: acc.losses + s.losses,
        draws: acc.draws + s.draws,
      }), { wins: 0, losses: 0, draws: 0 });
      const totalGames = totals.wins + totals.losses + totals.draws;
      const bestPlacement = tList.reduce<number | null>((acc, t) => {
        if (t.best_placement === null) return acc;
        return acc === null ? t.best_placement : Math.min(acc, t.best_placement);
      }, null);
      setAggregate({
        totalTournaments: tList.length,
        totalWins: totals.wins,
        totalLosses: totals.losses,
        totalDraws: totals.draws,
        winRate: totalGames ? Math.round((totals.wins / totalGames) * 100) : 0,
        bestPlacement,
      });

      // Team-mode tournaments: tournament_teams where ALL our team members are linked together
      const { data: ttm } = await (supabase as any)
        .from("tournament_team_members")
        .select("team_id, user_id")
        .in("user_id", memberIds);
      const ttmList = (ttm || []) as { team_id: string; user_id: string }[];
      const byTTeam: Record<string, Set<string>> = {};
      ttmList.forEach(r => {
        if (!byTTeam[r.team_id]) byTTeam[r.team_id] = new Set();
        byTTeam[r.team_id].add(r.user_id);
      });
      // keep only tournament_teams that contain ALL current members
      const validTTeamIds = Object.entries(byTTeam)
        .filter(([_, set]) => memberIds.every(id => set.has(id)))
        .map(([id]) => id);

      let teamModeList: TeamModeTournament[] = [];
      if (validTTeamIds.length) {
        const { data: tts } = await (supabase as any)
          .from("tournament_teams")
          .select("id, tournament_id, team_name")
          .in("id", validTTeamIds);
        const ttList = (tts || []) as { id: string; tournament_id: string; team_name: string }[];
        const tournIds = Array.from(new Set(ttList.map(t => t.tournament_id)));
        let tournMap: Record<string, { name: string; date: string | null }> = {};
        if (tournIds.length) {
          const { data: ts } = await supabase
            .from("tournaments")
            .select("id, title, event_date")
            .in("id", tournIds);
          (ts || []).forEach((t: any) => { tournMap[t.id] = { name: t.title, date: t.event_date }; });
        }
        // best member placement per tournament as team placement proxy
        const placementByTournament: Record<string, number | null> = {};
        (results || []).forEach((r: any) => {
          if (!tournIds.includes(r.tournament_id)) return;
          const cur = placementByTournament[r.tournament_id];
          if (cur == null || r.placement < cur) placementByTournament[r.tournament_id] = r.placement;
        });
        teamModeList = ttList.map(tt => ({
          tournament_id: tt.tournament_id,
          name: tournMap[tt.tournament_id]?.name || tt.team_name || "Torneo",
          date: tournMap[tt.tournament_id]?.date || null,
          placement: placementByTournament[tt.tournament_id] ?? null,
          member_ids: Array.from(byTTeam[tt.id] || []),
          perUser: perTU[tt.tournament_id] || {},
        })).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      }
      setTeamModeTournaments(teamModeList);

      // team-mode aggregate: sum wins/losses/draws only from matches in those tournaments
      const teamTIds = new Set(teamModeList.map(t => t.tournament_id));
      const tmTotals = { wins: 0, losses: 0, draws: 0 };
      (matches || []).forEach((m: any) => {
        if (!teamTIds.has(m.tournament_id)) return;
        [m.player1_id, m.player2_id].filter(Boolean).forEach((pid: string) => {
          if (!memberIds.includes(pid)) return;
          if (m.winner_id === pid) tmTotals.wins++;
          else if (m.winner_id) tmTotals.losses++;
          else tmTotals.draws++;
        });
      });
      const tmGames = tmTotals.wins + tmTotals.losses + tmTotals.draws;
      const tmBest = teamModeList.reduce<number | null>((acc, t) => {
        if (t.placement == null) return acc;
        return acc == null ? t.placement : Math.min(acc, t.placement);
      }, null);
      setTeamModeAggregate({
        totalTournaments: teamModeList.length,
        totalWins: tmTotals.wins,
        totalLosses: tmTotals.losses,
        totalDraws: tmTotals.draws,
        winRate: tmGames ? Math.round((tmTotals.wins / tmGames) * 100) : 0,
        bestPlacement: tmBest,
      });

      setLoading(false);
    })();
  }, [memberIds.join(",")]);

  return { memberStats, tournaments, aggregate, teamModeTournaments, teamModeAggregate, loading };
};
