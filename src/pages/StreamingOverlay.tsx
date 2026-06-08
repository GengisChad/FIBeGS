import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardStreamManager, ScoreMessage, SCORE_BROADCAST_CHANNEL } from "@/lib/streamingPeer";
import { useStreamingSettings } from "@/hooks/useStreamingSettings";
import { VideoOff, Camera, MessageSquare, Circle, Wifi } from "lucide-react";

interface Match {
  id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
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

const StreamingOverlay = () => {
  const { id } = useParams<{ id: string }>();
  const { settings } = useStreamingSettings(id);

  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<string, string>>(new Map());
  const [avatarMap, setAvatarMap] = useState<Map<string, string | null>>(new Map());

  const [varStreams, setVarStreams] = useState<Map<string, MediaStream>>(new Map());
  const [liveScores, setLiveScores] = useState<Map<string, ScoreMessage>>(new Map());
  const managerRef = useRef<DashboardStreamManager | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [tRes, mRes] = await Promise.all([
      supabase.from("tournaments").select("id, title, clubs(name)").eq("id", id).single(),
      supabase
        .from("tournament_matches")
        .select("id, round, match_number, player1_id, player2_id, player1_score, player2_score, status, phase, group_number")
        .eq("tournament_id", id)
        .order("round")
        .order("match_number"),
    ]);
    if (tRes.data) setTournament(tRes.data);
    const all = (mRes.data ?? []) as Match[];
    setMatches(all);
    const ids = new Set<string>();
    all.forEach((m) => {
      if (m.player1_id) ids.add(m.player1_id);
      if (m.player2_id) ids.add(m.player2_id);
    });
    if (ids.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", [...ids]);
      const pm = new Map<string, string>();
      const am = new Map<string, string | null>();
      (profs ?? []).forEach((p: any) => {
        pm.set(p.user_id, p.display_name || p.username || "?");
        am.set(p.user_id, p.avatar_url);
      });
      const missing = [...ids].filter((x) => !pm.has(x));
      if (missing.length) {
        const { data: kids } = await (supabase as any)
          .from("child_profiles")
          .select("id, display_name, avatar_url")
          .in("id", missing);
        (kids ?? []).forEach((c: any) => {
          pm.set(c.id, c.display_name);
          am.set(c.id, c.avatar_url);
        });
      }
      setPlayerMap(pm);
      setAvatarMap(am);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`overlay-matches-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${id}` },
        () => fetchData()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, fetchData]);

  // VAR streams via signaling
  useEffect(() => {
    if (!id) return;
    const mgr = new DashboardStreamManager(id);
    mgr.onStream = (matchId, stream) =>
      setVarStreams((prev) => new Map(prev).set(matchId, stream));
    mgr.onScore = (data) => setLiveScores((prev) => new Map(prev).set(data.matchId, data));
    mgr.onPeerState = (matchId, state) => {
      if (state === "failed" || state === "closed") {
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

  // Listen to same-device score broadcasts
  useEffect(() => {
    const bc = new BroadcastChannel(SCORE_BROADCAST_CHANNEL);
    bc.onmessage = (e) => {
      const data = e.data as ScoreMessage;
      if (data?.matchId) setLiveScores((prev) => new Map(prev).set(data.matchId, data));
    };
    return () => bc.close();
  }, []);

  const highlight = useMemo(
    () => matches.find((m) => m.id === settings?.highlighted_match_id) ?? null,
    [matches, settings?.highlighted_match_id]
  );

  // "In corso" = matches in the same phase/round/group as the highlighted one
  // (or, if no highlight, the latest round of the latest phase) that aren't completed yet.
  const activeMatches = useMemo(() => {
    const notDone = matches.filter((m) => m.status !== "completed" && m.player1_id && m.player2_id);
    if (notDone.length === 0) return [];
    let phase = highlight?.phase ?? null;
    let round = highlight?.round ?? null;
    let group = highlight?.group_number ?? null;
    if (!highlight) {
      // pick the most advanced round currently in play
      const sorted = [...notDone].sort((a, b) => (b.round ?? 0) - (a.round ?? 0));
      phase = sorted[0].phase;
      round = sorted[0].round;
      group = sorted[0].group_number;
    }
    return notDone.filter(
      (m) =>
        m.phase === phase &&
        m.round === round &&
        (group == null || m.group_number === group)
    );
  }, [matches, highlight]);

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((m) => m.status === "pending" && m.player1_id && m.player2_id)
        .filter((m) => !activeMatches.some((a) => a.id === m.id))
        .slice(0, 24),
    [matches, activeMatches]
  );

  const nameOf = (uid: string | null) => (uid ? playerMap.get(uid) ?? "TBD" : "TBD");

  if (!settings?.enabled) {
    return (
      <div className="min-h-screen w-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <Circle size={48} className="mx-auto text-zinc-700" />
          <p className="text-zinc-500 text-sm uppercase tracking-[0.3em]">Streaming non attivo</p>
        </div>
      </div>
    );
  }

  // Marquee scrolls only when there are enough upcoming matches to overflow
  const upcomingShouldScroll = upcomingMatches.length > 4;
  const activeShouldScroll = activeMatches.length > 5;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#05060a] text-white flex flex-col font-sans">
      {/* Top marquee — upcoming matches */}
      <div className="shrink-0 h-14 border-b border-[#AAFF00]/15 bg-black/70 backdrop-blur flex items-stretch">
        <div className="shrink-0 flex items-center px-4 bg-gradient-to-r from-[#AAFF00] to-[#7acc00] text-black font-black text-[11px] uppercase tracking-widest">
          ⚡ In Arrivo
        </div>
        <div className="flex-1 min-w-0 overflow-hidden relative">
          {upcomingMatches.length === 0 ? (
            <div className="h-full flex items-center px-4 text-zinc-600 text-xs">Nessun match in coda</div>
          ) : (
            <div
              className={`flex items-center h-full gap-3 px-4 whitespace-nowrap ${
                upcomingShouldScroll ? "animate-[scroll-x_45s_linear_infinite]" : ""
              }`}
            >
              {(upcomingShouldScroll ? [...upcomingMatches, ...upcomingMatches] : upcomingMatches).map((m, i) => (
                <div
                  key={`${m.id}-${i}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs shrink-0"
                >
                  <span className="text-[#AAFF00] font-bold">{phaseLabel(m.phase)}</span>
                  <span className="text-zinc-500">R{m.round}</span>
                  {m.group_number ? <span className="text-zinc-500">G{groupLabel(m.group_number)}</span> : null}
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-300">
                    {nameOf(m.player1_id)} <span className="text-zinc-600">vs</span> {nameOf(m.player2_id)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main — VAR highlight + cam/chat slots */}
      <div className="flex-1 grid grid-cols-[1fr_360px] gap-4 p-4 overflow-hidden">
        <VarHighlight
          match={highlight}
          stream={highlight ? varStreams.get(highlight.id) : undefined}
          liveScore={highlight ? liveScores.get(highlight.id) : undefined}
          playerMap={playerMap}
          avatarMap={avatarMap}
          tournamentTitle={tournament?.title}
        />

        <div className="flex flex-col gap-4 min-h-0">
          <div className="w-full aspect-video shrink-0">
            <SlotFrame title="CAM" icon={<Camera size={14} />} className="w-full h-full" />
          </div>
          <SlotFrame title="CHAT" icon={<MessageSquare size={14} />} className="flex-1 min-h-0" />
        </div>
      </div>

      {/* Bottom — active matches */}
      <div className="shrink-0 border-t border-[#AAFF00]/15 bg-black/70 backdrop-blur">
        <div className="h-6 flex items-center px-3 text-[10px] uppercase tracking-widest text-[#AAFF00]/80">
          <Circle size={6} className="fill-red-500 text-red-500 animate-pulse mr-1.5" />
          Match in Corso · {activeMatches.length}
        </div>
        <div className="h-28 overflow-hidden">
          {activeMatches.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
              Nessun match in corso
            </div>
          ) : (
            <div
              className={`flex h-full gap-2 px-3 pb-2 ${
                activeShouldScroll ? "animate-[scroll-x_35s_linear_infinite] whitespace-nowrap" : "justify-start"
              }`}
            >
              {(activeShouldScroll ? [...activeMatches, ...activeMatches] : activeMatches).map((m, i) => {
                const ls = liveScores.get(m.id);
                const p1s = ls?.p1Score ?? m.player1_score;
                const p2s = ls?.p2Score ?? m.player2_score;
                return (
                  <div
                    key={`${m.id}-${i}`}
                    className="flex flex-col justify-between min-w-[220px] shrink-0 h-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5"
                  >
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-zinc-500">
                      <span className="text-[#AAFF00] font-bold">{phaseLabel(m.phase)}</span>
                      <span>R{m.round}</span>
                      {m.group_number ? <span>G{groupLabel(m.group_number)}</span> : null}
                      <span>T{m.match_number}</span>
                      {varStreams.has(m.id) && (
                        <span className="ml-auto text-green-400 flex items-center gap-0.5">
                          <Wifi size={9} /> VAR
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-300 truncate flex-1">{nameOf(m.player1_id)}</span>
                      <span className={`text-lg font-black tabular-nums ${p1s > p2s ? "text-[#AAFF00]" : ""}`}>{p1s}</span>
                      <span className="text-zinc-700">-</span>
                      <span className={`text-lg font-black tabular-nums ${p2s > p1s ? "text-[#AAFF00]" : ""}`}>{p2s}</span>
                      <span className="text-xs text-zinc-300 truncate flex-1 text-right">{nameOf(m.player2_id)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scroll-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

const VarHighlight = ({
  match,
  stream,
  liveScore,
  playerMap,
  avatarMap,
  tournamentTitle,
}: {
  match: Match | null;
  stream?: MediaStream;
  liveScore?: ScoreMessage;
  playerMap: Map<string, string>;
  avatarMap: Map<string, string | null>;
  tournamentTitle?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  if (!match) {
    return (
      <div className="relative rounded-2xl border border-[#AAFF00]/15 bg-zinc-950/60 flex items-center justify-center">
        <div className="text-center">
          <VideoOff size={64} className="mx-auto text-zinc-800 mb-3" />
          <p className="text-zinc-600 uppercase tracking-[0.3em] text-xs">
            Nessun match in evidenza
          </p>
          {tournamentTitle && (
            <p className="text-zinc-700 text-[10px] mt-2">{tournamentTitle}</p>
          )}
        </div>
      </div>
    );
  }

  const p1Name = liveScore?.p1Name || playerMap.get(match.player1_id || "") || "TBD";
  const p2Name = liveScore?.p2Name || playerMap.get(match.player2_id || "") || "TBD";
  const p1Score = liveScore?.p1Score ?? match.player1_score;
  const p2Score = liveScore?.p2Score ?? match.player2_score;
  const p1Avatar = liveScore?.p1Avatar ?? avatarMap.get(match.player1_id || "") ?? null;
  const p2Avatar = liveScore?.p2Avatar ?? avatarMap.get(match.player2_id || "") ?? null;
  const p1Fouls = liveScore?.p1Fouls ?? 0;
  const p2Fouls = liveScore?.p2Fouls ?? 0;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#AAFF00]/25 bg-black shadow-[0_0_60px_rgba(170,255,0,0.08)] flex flex-col">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
          <Circle size={6} className="fill-white" /> LIVE
        </span>
        <span className="bg-black/70 text-[#AAFF00] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
          {phaseLabel(match.phase)} · R{match.round}
          
        </span>
      </div>

      <div className="flex-1 relative bg-black">
        {stream ? (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <VideoOff size={48} className="text-zinc-800" />
            <p className="text-xs text-zinc-600 uppercase tracking-widest">VAR non connesso</p>
          </div>
        )}
      </div>

      {/* Score banner */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-zinc-950 to-[#0a0a0f] border-t border-[#AAFF00]/20 px-6 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <PlayerBanner name={p1Name} avatar={p1Avatar} fouls={p1Fouls} align="left" />
        <div className="flex items-center gap-4">
          <span className={`text-6xl font-black tabular-nums ${p1Score > p2Score ? "text-[#AAFF00]" : "text-white"}`}>
            {p1Score}
          </span>
          <span className="text-zinc-700 text-2xl font-thin">·</span>
          <span className={`text-6xl font-black tabular-nums ${p2Score > p1Score ? "text-[#AAFF00]" : "text-white"}`}>
            {p2Score}
          </span>
        </div>
        <PlayerBanner name={p2Name} avatar={p2Avatar} fouls={p2Fouls} align="right" />
      </div>
    </div>
  );
};

const PlayerBanner = ({
  name,
  avatar,
  fouls,
  align,
}: {
  name: string;
  avatar: string | null;
  fouls: number;
  align: "left" | "right";
}) => (
  <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
    {avatar ? (
      <img src={avatar} alt={name} className="w-14 h-14 rounded-full object-cover border-2 border-[#AAFF00]/40" />
    ) : (
      <div className="w-14 h-14 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-xl font-black text-zinc-500">
        {name.charAt(0).toUpperCase()}
      </div>
    )}
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-lg font-bold text-white truncate max-w-[260px]">{name}</p>
      {fouls > 0 && (
        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
          ⚠ {fouls} fallo{fouls > 1 ? "s" : ""}
        </span>
      )}
    </div>
  </div>
);

const SlotFrame = ({
  title,
  icon,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`relative rounded-2xl border-2 border-dashed border-[#AAFF00]/30 bg-zinc-950/40 flex items-center justify-center min-h-0 ${className ?? ""}`}
    style={{ boxShadow: "inset 0 0 60px rgba(170,255,0,0.04)" }}
  >
    <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[#AAFF00]/70 font-bold">
      {icon}
      {title}
    </div>
    <div className="text-center text-zinc-600">
      <p className="text-[10px] uppercase tracking-widest">Sovrapponi qui</p>
      <p className="text-[10px] uppercase tracking-widest">Browser/Window Source OBS</p>
    </div>
  </div>
);

export default StreamingOverlay;
