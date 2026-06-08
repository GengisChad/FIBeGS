import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClubRole } from "@/hooks/useClubRole";
import { useAdmin } from "@/hooks/useAdmin";
import { useStreamingSettings } from "@/hooks/useStreamingSettings";
import { DashboardStreamManager, ScoreMessage } from "@/lib/streamingPeer";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ExternalLink,
  Star,
  Radio,
  Circle,
  Trophy,
  LayoutGrid,
  CheckCircle2,
  Clock,
  QrCode,
  Wifi,
} from "lucide-react";

/* ─── Types ─── */
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
  phase: string | null;
  group_number: number | null;
}

const groupLabel = (n: number) => String.fromCharCode(64 + n);

const phaseLabel = (phase: string | null) => {
  if (!phase || phase === "swiss") return "Swiss";
  if (phase === "top_cut") return "Top Cut";
  if (phase === "pre_top_cut") return "Spareggi";
  return phase;
};

const statusLabel = (s: string) => {
  if (s === "in_progress") return "In Corso";
  if (s === "completed") return "Completato";
  if (s === "pending") return "In Attesa";
  return s;
};

const StreamingDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [varStreams, setVarStreams] = useState<Map<string, MediaStream>>(new Map());
  const [liveScores, setLiveScores] = useState<Map<string, ScoreMessage>>(new Map());
  const managerRef = useRef<DashboardStreamManager | null>(null);

  const { isStaff } = useClubRole(tournament?.club_id ?? undefined);
  const canAccess = isStaff || isAdmin;

  const { settings: streamSettings, update: updateStreamSettings } = useStreamingSettings(id);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [tRes, mRes] = await Promise.all([
      supabase.from("tournaments").select("*, clubs(id, name)").eq("id", id).single(),
      supabase
        .from("tournament_matches")
        .select("id, round, match_number, player1_id, player2_id, player1_score, player2_score, winner_id, status, phase, group_number")
        .eq("tournament_id", id)
        .order("round")
        .order("match_number"),
    ]);

    if (tRes.data) setTournament(tRes.data);
    const allMatches = (mRes.data ?? []) as Match[];
    setMatches(allMatches);

    const playerIds = new Set<string>();
    allMatches.forEach((m) => {
      if (m.player1_id) playerIds.add(m.player1_id);
      if (m.player2_id) playerIds.add(m.player2_id);
    });

    if (playerIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", [...playerIds]);

      const pm = new Map<string, string>();
      (profiles ?? []).forEach((p: any) => {
        pm.set(p.user_id, p.display_name || p.username || "?");
      });

      const missingIds = [...playerIds].filter((pid) => !pm.has(pid));
      if (missingIds.length > 0) {
        const { data: childProfiles } = await (supabase as any)
          .from("child_profiles")
          .select("id, display_name")
          .in("id", missingIds);
        (childProfiles ?? []).forEach((c: any) => {
          pm.set(c.id, c.display_name);
        });
      }
      setPlayerMap(pm);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime updates from referees
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`streaming-dashboard-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, fetchData]);

  // VAR streams via signaling — collect referee RPC live views per match
  useEffect(() => {
    if (!id) return;
    const mgr = new DashboardStreamManager(id);
    mgr.onStream = (matchId, stream) =>
      setVarStreams((prev) => new Map(prev).set(matchId, stream));
    mgr.onScore = (data) =>
      setLiveScores((prev) => new Map(prev).set(data.matchId, data));
    mgr.onPeerState = (matchId, state) => {
      if (state === "failed" || state === "closed" || state === "disconnected") {
        setVarStreams((prev) => {
          const n = new Map(prev);
          n.delete(matchId);
          return n;
        });
      }
    };
    mgr.start();
    managerRef.current = mgr;
    return () => {
      mgr.destroy();
      managerRef.current = null;
    };
  }, [id]);

  const groupsCount = tournament?.groups_count ?? 0;

  // Active round per group (per swiss); top cut shown separately
  const swissMatches = useMemo(() => matches.filter((m) => m.phase === "swiss" || m.phase === null), [matches]);
  const topCutMatches = useMemo(() => matches.filter((m) => m.phase === "top_cut"), [matches]);
  const tiebreakerMatches = useMemo(() => matches.filter((m) => m.phase === "pre_top_cut"), [matches]);

  const isTopCut = tournament?.status === "top_cut" || tournament?.status === "pre_top_cut";

  // Compute table assignments globally (same logic as in renderGrid).
  const tableAssignments = useMemo(() => {
    const map = new Map<string, number>();
    const tablesPerGroup = Math.max(1, Number(tournament?.matches_per_table ?? 1));
    if (tablesPerGroup <= 1 && !tournament?.table_assignment_enabled) return map;
    const byBucket = new Map<string, Match[]>();
    matches.forEach((m) => {
      const key = `${m.phase ?? "swiss"}|${m.group_number ?? 0}|${m.round}`;
      if (!byBucket.has(key)) byBucket.set(key, []);
      byBucket.get(key)!.push(m);
    });
    byBucket.forEach((arr) => {
      arr.sort((a, b) => a.match_number - b.match_number);
      arr.forEach((m, idx) => map.set(m.id, (idx % tablesPerGroup) + 1));
    });
    return map;
  }, [matches, tournament?.matches_per_table, tournament?.table_assignment_enabled]);

  // For each (phase, group, table) bucket pick the "next to play":
  // any in_progress matches, otherwise the single pending match with lowest (round, match_number).
  const upcomingIds = useMemo(() => {
    const result = new Set<string>();
    const buckets = new Map<string, Match[]>();
    matches.forEach((m) => {
      if (m.status === "completed") return;
      const table = tableAssignments.get(m.id) ?? 0;
      const key = `${m.phase ?? "swiss"}|${m.group_number ?? 0}|${table}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(m);
    });
    buckets.forEach((arr) => {
      const live = arr.filter((m) => m.status === "in_progress");
      if (live.length) {
        live.forEach((m) => result.add(m.id));
      } else {
        const next = [...arr].sort((a, b) =>
          a.round !== b.round ? a.round - b.round : a.match_number - b.match_number
        )[0];
        if (next) result.add(next.id);
      }
    });
    return result;
  }, [matches, tableAssignments]);

  const isUpcomingMatch = useCallback((m: Match) => upcomingIds.has(m.id), [upcomingIds]);

  const matchesForGroup = useCallback(
    (g: number | "all" | "topcut") => {
      if (g === "topcut") return [...tiebreakerMatches, ...topCutMatches];
      if (g === "all") return swissMatches;
      return swissMatches.filter((m) => m.group_number === g);
    },
    [swissMatches, topCutMatches, tiebreakerMatches]
  );

  const getPlayerName = (pid: string | null) => (!pid ? "TBD" : playerMap.get(pid) || "?");

  const onToggleHighlight = (matchId: string) => {
    const isHi = streamSettings?.highlighted_match_id === matchId;
    updateStreamSettings({ highlighted_match_id: isHi ? null : matchId });
    toast.success(isHi ? "Match rimosso dall'overlay" : "Match in evidenza nell'overlay");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-2 border-[#AAFF00] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        <p className="text-[#AAFF00]">⚡ Accesso riservato allo staff del club.</p>
      </div>
    );
  }

  // Tabs
  const groupTabs: Array<{ value: string; label: string }> = [];
  if (groupsCount === 0) groupTabs.push({ value: "all", label: "Tutti i Match" });
  else {
    groupTabs.push({ value: "all", label: "Tutti" });
    for (let i = 1; i <= groupsCount; i++) {
      groupTabs.push({ value: String(i), label: `Gruppo ${groupLabel(i)}` });
    }
  }
  if (topCutMatches.length || tiebreakerMatches.length) {
    groupTabs.push({ value: "topcut", label: "Top Cut" });
  }

  const stats = {
    total: matches.length,
    live: matches.filter((m) => m.status === "in_progress").length,
    pending: matches.filter((m) => m.status === "pending").length,
    done: matches.filter((m) => m.status === "completed").length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white"
      style={{ background: "radial-gradient(ellipse at 20% 0%, rgba(170,255,0,0.04) 0%, transparent 60%), #0a0a0f" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-[#AAFF00]/10 bg-[#0a0a0f]/90 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-[#AAFF00] h-8 w-8" onClick={() => navigate(`/tournaments/${id}`)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Circle size={10} className="text-red-500 fill-red-500 animate-pulse shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate tracking-wide">
              <span className="text-[#AAFF00]">GESTIONALE LIVE</span>
              <span className="text-zinc-500 mx-1.5">·</span>
              <span className="text-white">{tournament?.title}</span>
            </h1>
            <p className="text-[10px] text-zinc-600 truncate">{tournament?.clubs?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${streamSettings?.enabled ? "border-[#AAFF00]/40 bg-[#AAFF00]/10" : "border-zinc-800"}`}>
            <Radio size={12} className={streamSettings?.enabled ? "text-[#AAFF00]" : "text-zinc-600"} />
            <Label htmlFor="stream-enabled" className="text-[10px] uppercase tracking-wider cursor-pointer text-zinc-300">Streaming</Label>
            <Switch
              id="stream-enabled"
              checked={!!streamSettings?.enabled}
              onCheckedChange={(v) => {
                updateStreamSettings({ enabled: v });
                toast.success(v ? "Streaming pubblico attivato" : "Streaming pubblico disattivato");
              }}
              className="data-[state=checked]:bg-[#AAFF00]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px] gap-1 border-[#AAFF00]/30 text-[#AAFF00] hover:bg-[#AAFF00]/10"
            onClick={() => window.open(`/tournaments/${id}/overlay`, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink size={12} />
            Apri Live View
          </Button>
        </div>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-zinc-800/50">
        <StatCard label="Totali" value={stats.total} icon={<LayoutGrid size={14} />} />
        <StatCard label="Live" value={stats.live} icon={<Circle size={10} className="fill-red-500 text-red-500" />} accent="red" />
        <StatCard label="In attesa" value={stats.pending} icon={<Clock size={14} />} />
        <StatCard label="Completati" value={stats.done} icon={<CheckCircle2 size={14} />} accent="green" />
      </div>

      {/* Tabs */}
      <div className="px-4 py-4">
        <Tabs defaultValue={groupTabs[0]?.value} className="w-full">
          <TabsList className="bg-zinc-900/60 border border-zinc-800 flex-wrap h-auto">
            {groupTabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="data-[state=active]:bg-[#AAFF00]/15 data-[state=active]:text-[#AAFF00] text-xs"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {groupTabs.map((t) => {
            const list = matchesForGroup(t.value === "all" ? "all" : t.value === "topcut" ? "topcut" : Number(t.value));
            const sortMatches = (arr: Match[]) =>
              [...arr].sort((a, b) => {
                const rank = (s: string) => (s === "in_progress" ? 0 : s === "pending" ? 1 : 2);
                const r = rank(a.status) - rank(b.status);
                if (r !== 0) return r;
                if (a.round !== b.round) return a.round - b.round;
                return a.match_number - b.match_number;
              });

            const tableEnabled = !!tournament?.table_assignment_enabled;
            const tablesPerGroup = Math.max(1, Number(tournament?.matches_per_table ?? 1));
            const isSingleGroupTab = t.value !== "all" && t.value !== "topcut" && groupsCount > 0;
            const showTableTabs = isSingleGroupTab && (tableEnabled || tablesPerGroup > 1);

            const tableOf = new Map<string, number>();
            if (showTableTabs) {
              const byRound = new Map<number, Match[]>();
              list.forEach((m) => {
                if (!byRound.has(m.round)) byRound.set(m.round, []);
                byRound.get(m.round)!.push(m);
              });
              byRound.forEach((arr) => {
                arr.sort((a, b) => a.match_number - b.match_number);
                arr.forEach((m, idx) => tableOf.set(m.id, (idx % tablesPerGroup) + 1));
              });
            }

            const renderCards = (arr: Match[]) => (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortMatches(arr).map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    tournamentId={id!}
                    getPlayerName={getPlayerName}
                    isHighlighted={streamSettings?.highlighted_match_id === m.id}
                    onToggleHighlight={() => onToggleHighlight(m.id)}
                    varStream={varStreams.get(m.id) ?? null}
                    isUpcoming={isUpcomingMatch(m)}
                  />
                ))}
              </div>
            );

            const renderGrid = (arr: Match[]) => {
              if (arr.length === 0) {
                return <div className="text-center py-12 text-zinc-600 text-sm">Nessun match.</div>;
              }
              const upcoming = arr.filter((m) => isUpcomingMatch(m));
              const others = arr.filter((m) => !isUpcomingMatch(m));
              return (
                <div className="space-y-6">
                  {upcoming.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-2">
                        <Radio size={12} className="text-[#AAFF00]" />
                        <h3 className="text-[11px] uppercase tracking-widest text-[#AAFF00] font-bold">
                          Prossimi da giocare
                        </h3>
                        <span className="text-[10px] text-zinc-600">({upcoming.length})</span>
                      </div>
                      {renderCards(upcoming)}
                    </section>
                  )}
                  {others.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={12} className="text-zinc-500" />
                        <h3 className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">
                          Altri match
                        </h3>
                        <span className="text-[10px] text-zinc-600">({others.length})</span>
                      </div>
                      {renderCards(others)}
                    </section>
                  )}
                </div>
              );
            };

            return (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                {list.length === 0 ? (
                  <div className="text-center py-16 text-zinc-600 text-sm">Nessun match in questa sezione.</div>
                ) : showTableTabs ? (
                  <Tabs defaultValue="all" className="w-full">
                    <TabsList className="bg-zinc-900/40 border border-zinc-800/60 flex-wrap h-auto">
                      <TabsTrigger value="all" className="text-[11px] data-[state=active]:bg-[#AAFF00]/15 data-[state=active]:text-[#AAFF00]">
                        Tutti i tavoli
                      </TabsTrigger>
                      {Array.from({ length: tablesPerGroup }, (_, i) => i + 1).map((tn) => (
                        <TabsTrigger key={tn} value={String(tn)} className="text-[11px] data-[state=active]:bg-[#AAFF00]/15 data-[state=active]:text-[#AAFF00]">
                          Tavolo {tn}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <TabsContent value="all" className="mt-3">{renderGrid(list)}</TabsContent>
                    {Array.from({ length: tablesPerGroup }, (_, i) => i + 1).map((tn) => (
                      <TabsContent key={tn} value={String(tn)} className="mt-3">
                        {renderGrid(list.filter((m) => tableOf.get(m.id) === tn))}
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  renderGrid(list)
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: "red" | "green";
}) => (
  <div className={`flex items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 ${
    accent === "red" ? "border-red-500/20" : accent === "green" ? "border-green-500/20" : ""
  }`}>
    <div className={`shrink-0 ${accent === "red" ? "text-red-400" : accent === "green" ? "text-green-400" : "text-zinc-500"}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="text-xl font-black text-white tabular-nums">{value}</p>
    </div>
  </div>
);

const MatchCard = ({
  match,
  tournamentId,
  getPlayerName,
  isHighlighted,
  onToggleHighlight,
  varStream,
  isUpcoming,
}: {
  match: Match;
  tournamentId: string;
  getPlayerName: (pid: string | null) => string;
  isHighlighted: boolean;
  onToggleHighlight: () => void;
  varStream: MediaStream | null;
  isUpcoming: boolean;
}) => {
  const p1 = getPlayerName(match.player1_id);
  const p2 = getPlayerName(match.player2_id);
  const isLive = match.status === "in_progress";
  const isDone = match.status === "completed";
  const isBye = !match.player2_id || p2 === "TBD" && match.winner_id === match.player1_id;
  const winner = match.winner_id;
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasStream = !!varStream && varStream.getTracks().length > 0;

  useEffect(() => {
    if (videoRef.current && varStream) {
      videoRef.current.srcObject = varStream;
    }
  }, [varStream]);

  const bridgeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/tournaments/${tournamentId}/var-bridge?match=${match.id}`
    : "";

  return (
    <div
      className={`relative rounded-xl border bg-[#0d0d14] p-3 transition-all ${
        isHighlighted
          ? "border-[#AAFF00] shadow-[0_0_20px_rgba(170,255,0,0.2)]"
          : isLive
            ? "border-red-500/40"
            : "border-zinc-800/60"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400 px-1.5 py-0">
            {phaseLabel(match.phase)} · R{match.round}
          </Badge>
          {match.group_number ? (
            <Badge variant="outline" className="text-[9px] border-[#AAFF00]/30 text-[#AAFF00] px-1.5 py-0">
              G{groupLabel(match.group_number)}
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400 px-1.5 py-0">
            Tavolo {match.match_number}
          </Badge>
        </div>
        <button
          onClick={onToggleHighlight}
          title={isHighlighted ? "Rimuovi dall'overlay" : "Metti in evidenza nell'overlay"}
          className={`rounded-md p-1 transition-colors ${
            isHighlighted ? "text-[#AAFF00]" : "text-zinc-600 hover:text-[#AAFF00]"
          }`}
        >
          <Star size={14} className={isHighlighted ? "fill-[#AAFF00]" : ""} />
        </button>
      </div>

      {/* Live VAR view — only for in-progress + next-round matches per group */}
      {isUpcoming && (
        <div className="mb-2 rounded-lg overflow-hidden border border-zinc-800/80 bg-black aspect-video relative">
          {hasStream ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-black/70 border border-[#AAFF00]/40 px-1.5 py-0.5">
                <Wifi size={8} className="text-[#AAFF00]" />
                <span className="text-[8px] uppercase tracking-wider font-bold text-[#AAFF00]">Live VAR</span>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
              <div className="bg-white p-1.5 rounded">
                <QRCodeSVG value={bridgeUrl} size={84} level="M" />
              </div>
              <p className="text-[8px] uppercase tracking-wider text-zinc-500 leading-tight flex items-center gap-1">
                <QrCode size={9} /> {isLive ? "Arbitro non connesso · scansiona" : "Scansiona per abbinare arbitro"}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <PlayerRow name={p1} score={match.player1_score} isWinner={winner === match.player1_id && isDone} isLeader={!isDone && match.player1_score > match.player2_score} />
        <PlayerRow name={p2} score={match.player2_score} isWinner={winner === match.player2_id && isDone} isLeader={!isDone && match.player2_score > match.player1_score} bye={isBye && !match.player2_id} />
      </div>

      <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[9px] uppercase tracking-wider">
        <span
          className={`flex items-center gap-1 ${
            isLive ? "text-red-400" : isDone ? "text-green-400" : "text-zinc-500"
          }`}
        >
          {isLive && <Circle size={6} className="fill-red-500 text-red-500 animate-pulse" />}
          {isDone && <CheckCircle2 size={10} />}
          {!isLive && !isDone && <Clock size={10} />}
          {statusLabel(match.status)}
        </span>
        {isDone && winner && (
          <span className="flex items-center gap-1 text-[#AAFF00]">
            <Trophy size={10} /> {getPlayerName(winner)}
          </span>
        )}
      </div>
    </div>
  );
};

const PlayerRow = ({
  name,
  score,
  isWinner,
  isLeader,
  bye,
}: {
  name: string;
  score: number;
  isWinner?: boolean;
  isLeader?: boolean;
  bye?: boolean;
}) => (
  <div
    className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${
      isWinner ? "bg-[#AAFF00]/10 border border-[#AAFF00]/20" : "bg-zinc-900/40"
    }`}
  >
    <span className={`text-xs truncate ${isWinner || isLeader ? "text-white font-semibold" : "text-zinc-400"}`}>
      {bye ? <span className="italic text-zinc-500">BYE</span> : name}
    </span>
    <span className={`text-base font-black tabular-nums ${isWinner || isLeader ? "text-[#AAFF00]" : "text-zinc-500"}`}>
      {score}
    </span>
  </div>
);

export default StreamingDashboard;
