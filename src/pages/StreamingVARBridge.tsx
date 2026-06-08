import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SenderStreamPeer, SCORE_BROADCAST_CHANNEL, ScoreMessage } from "@/lib/streamingPeer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Video, VideoOff, Wifi, WifiOff, User, RotateCcw, Check, Trophy, Minus, AlertTriangle, Coins, ChevronUp, ChevronDown, Play, Square, Circle } from "lucide-react";

const POINT_ACTIONS = [
  { label: "SPIN", points: 1, color: "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700" },
  { label: "OWN", points: 1, color: "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700" },
  { label: "BURST", points: 2, color: "bg-yellow-900/40 hover:bg-yellow-900/60 text-yellow-400 border border-yellow-700/30" },
  { label: "OVER", points: 2, color: "bg-yellow-900/40 hover:bg-yellow-900/60 text-yellow-400 border border-yellow-700/30" },
  { label: "XTREME", points: 3, color: "bg-green-900/40 hover:bg-green-900/60 text-[#AAFF00] border border-green-700/30" },
];

const DEFAULT_WIN_THRESHOLD = 4;
const StreamingVARBridge = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get("match") || "";

  const [connectionState, setConnectionState] = useState("new");
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoringOpen, setScoringOpen] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<SenderStreamPeer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Replay state
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const replayVideoRef = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayAvailable, setReplayAvailable] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedClipSeconds, setRecordedClipSeconds] = useState(0);
  const replayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const replayStreamRef = useRef<MediaStream | null>(null);

  // Match data
  const [matchData, setMatchData] = useState<any>(null);
  const [player1Name, setPlayer1Name] = useState("Giocatore 1");
  const [player2Name, setPlayer2Name] = useState("Giocatore 2");
  const [player1Avatar, setPlayer1Avatar] = useState<string | null>(null);
  const [player2Avatar, setPlayer2Avatar] = useState<string | null>(null);
  const [winThreshold, setWinThreshold] = useState(DEFAULT_WIN_THRESHOLD);

  // Scoring state
  const storageKey = `match-scoring-${matchId}`;
  const loadSaved = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as { p1: number; p2: number; f1: number; f2: number };
    } catch {}
    return null;
  }, [storageKey]);

  const [p1Score, setP1Score] = useState(() => loadSaved()?.p1 ?? 0);
  const [p2Score, setP2Score] = useState(() => loadSaved()?.p2 ?? 0);
  const [p1Fouls, setP1Fouls] = useState(() => loadSaved()?.f1 ?? 0);
  const [p2Fouls, setP2Fouls] = useState(() => loadSaved()?.f2 ?? 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [coinResult, setCoinResult] = useState<string | null>(null);
  const [resultSubmitted, setResultSubmitted] = useState(false);

  // Fetch match + player data
  useEffect(() => {
    if (!matchId) return;
    const fetchMatch = async () => {
      const { data: match } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("id", matchId)
        .single();
      if (!match) return;
      setMatchData(match);

      const { data: tournament } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", match.tournament_id)
        .single();
      if (tournament) {
        const t = tournament as any;
        const isTop = match.phase === "top_cut";
        const custom = isTop ? t.custom_top_win_points : t.custom_swiss_win_points;
        if (custom != null) setWinThreshold(custom);
        else if (t.win_threshold) setWinThreshold(t.win_threshold);
      }

      const ids = [match.player1_id, match.player2_id].filter(Boolean);
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", ids);

        const pMap = new Map<string, { name: string; avatar: string | null }>();
        (profiles ?? []).forEach((p: any) => pMap.set(p.user_id, { name: p.display_name || p.username || "?", avatar: p.avatar_url }));

        const missingIds = ids.filter((pid) => !pMap.has(pid!));
        if (missingIds.length > 0) {
          const { data: children } = await (supabase as any)
            .from("child_profiles")
            .select("id, display_name, avatar_url")
            .in("id", missingIds);
          (children ?? []).forEach((c: any) => pMap.set(c.id, { name: c.display_name, avatar: c.avatar_url }));
        }

        if (match.player1_id && pMap.has(match.player1_id)) {
          setPlayer1Name(pMap.get(match.player1_id)!.name);
          setPlayer1Avatar(pMap.get(match.player1_id)!.avatar);
        }
        if (match.player2_id && pMap.has(match.player2_id)) {
          setPlayer2Name(pMap.get(match.player2_id)!.name);
          setPlayer2Avatar(pMap.get(match.player2_id)!.avatar);
        }
      }
    };
    fetchMatch();
  }, [matchId]);

  // Broadcast scores via BroadcastChannel + WebRTC
  useEffect(() => {
    if (p1Score === 0 && p2Score === 0 && p1Fouls === 0 && p2Fouls === 0) return;
    localStorage.setItem(storageKey, JSON.stringify({ p1: p1Score, p2: p2Score, f1: p1Fouls, f2: p2Fouls }));
    const scoreData: ScoreMessage = {
      matchId, p1Score, p2Score, p1Fouls, p2Fouls,
      p1Name: player1Name, p2Name: player2Name,
      p1Avatar: player1Avatar, p2Avatar: player2Avatar,
    };
    try {
      const bc = new BroadcastChannel(SCORE_BROADCAST_CHANNEL);
      bc.postMessage(scoreData);
      bc.close();
    } catch {}
    peerRef.current?.sendScore(scoreData);
  }, [p1Score, p2Score, p1Fouls, p2Fouls, matchId, player1Name, player2Name, player1Avatar, player2Avatar, storageKey]);

  const formatDuration = useCallback((totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, []);

  const clearRecordedClip = useCallback(() => {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }

    recordedBlobRef.current = null;
    replayStreamRef.current?.getTracks().forEach((track) => track.stop());
    replayStreamRef.current = null;
    chunksRef.current = [];
    setReplayAvailable(false);
    setRecordedClipSeconds(0);
  }, []);

  const startMatchRecording = useCallback(() => {
    if (!streamRef.current || isRecording || isReplaying) return;

    try {
      clearRecordedClip();
      setError(null);
      setRecordingSeconds(0);

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";

      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });

      chunksRef.current = [];
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const startedAt = recordingStartedAtRef.current;
        recordingStartedAtRef.current = null;
        setIsRecording(false);
        setRecordingSeconds(0);

        if (chunksRef.current.length === 0) return;

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const durationSeconds = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0;

        recordedBlobRef.current = blob;
        recordedUrlRef.current = URL.createObjectURL(blob);
        setRecordedClipSeconds(durationSeconds);
        setReplayAvailable(true);
      };

      recorder.onerror = () => {
        setIsRecording(false);
        setRecordingSeconds(0);
        setError("Registrazione non disponibile su questo dispositivo.");
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Impossibile avviare la registrazione del match.");
    }
  }, [clearRecordedClip, isRecording, isReplaying]);

  const stopMatchRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      if (recordingStartedAtRef.current) {
        setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  const playReplay = useCallback(() => {
    if (!recordedUrlRef.current || isReplaying || isRecording) return;

    setIsReplaying(true);

    const replayVideo = replayVideoRef.current;
    if (!replayVideo) return;

    replayVideo.src = recordedUrlRef.current;
    replayVideo.playbackRate = 1;
    replayVideo.currentTime = 0;

    if (!replayCanvasRef.current) {
      replayCanvasRef.current = document.createElement("canvas");
    }
    const canvas = replayCanvasRef.current;

    replayVideo.onloadedmetadata = () => {
      canvas.width = replayVideo.videoWidth || 640;
      canvas.height = replayVideo.videoHeight || 480;
      // Replay con audio: NON mutiamo il video element, così captureStream() raccoglie anche l'audio.
      replayVideo.muted = false;
      replayVideo.play();

      const canvasStream = canvas.captureStream(30);
      const canvasTrack = canvasStream.getVideoTracks()[0];
      if (canvasTrack) {
        replayStreamRef.current?.getTracks().forEach((track) => track.stop());
        replayStreamRef.current = canvasStream;
        peerRef.current?.replaceVideoTrack(canvasTrack);
      }

      // Estrai la traccia audio dal video element di playback e inviala al peer
      try {
        const mediaStream = (replayVideo as any).captureStream?.() as MediaStream | undefined;
        const audioTrack = mediaStream?.getAudioTracks()[0] ?? null;
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
          peerRef.current?.replaceAudioTrack(audioTrack);
        }
      } catch (err) {
        console.warn("Replay audio capture failed:", err);
      }

      const ctx = canvas.getContext("2d");
      const drawFrame = () => {
        if (replayVideo.paused || replayVideo.ended) return;
        if (ctx) {
          ctx.drawImage(replayVideo, 0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(0, 0, canvas.width, 46);
          ctx.fillStyle = "#d9ff7a";
          ctx.font = "bold 24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("REPLAY MATCH", canvas.width / 2, 30);
        }
        requestAnimationFrame(drawFrame);
      };
      drawFrame();
    };

    replayVideo.onended = () => {
      setIsReplaying(false);
      replayVideo.pause();
      replayVideo.currentTime = 0;
      const liveTrack = streamRef.current?.getVideoTracks()[0];
      if (liveTrack) {
        peerRef.current?.replaceVideoTrack(liveTrack);
      }
      // Ripristina anche la traccia audio live (o null se non presente)
      const liveAudio = streamRef.current?.getAudioTracks()[0] ?? null;
      peerRef.current?.replaceAudioTrack(liveAudio);
      replayStreamRef.current?.getTracks().forEach((track) => track.stop());
      replayStreamRef.current = null;
    };
  }, [isRecording, isReplaying]);

  // WebRTC + Camera init
  useEffect(() => {
    if (!id || !matchId) return;
    let stream: MediaStream | null = null;

    const init = async () => {
      try {
        // Proviamo prima con audio attivo; se fallisce, fallback a solo video.
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraActive(true);

        const peer = new SenderStreamPeer(id, matchId);
        peer.addStream(stream);

        peer.onState = setConnectionState;
        await peer.start();
        peerRef.current = peer;
      } catch (err: any) {
        console.error("VAR Bridge init error:", err);
        setError(err.message || "Impossibile accedere alla fotocamera");
      }
    };

    init();

    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      clearRecordedClip();
      stream?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
    };
  }, [clearRecordedClip, id, matchId]);

  const isConnected = connectionState === "connected";

  const p1Won = p1Score >= winThreshold;
  const p2Won = p2Score >= winThreshold;
  const matchOver = p1Won || p2Won;
  const winnerId = p1Won ? matchData?.player1_id : p2Won ? matchData?.player2_id : null;
  const winnerName = p1Won ? player1Name : p2Won ? player2Name : null;

  const resetFouls = () => { setP1Fouls(0); setP2Fouls(0); };
  const addPointsP1 = (pts: number) => { setP1Score((s) => s + pts); resetFouls(); };
  const addPointsP2 = (pts: number) => { setP2Score((s) => s + pts); resetFouls(); };
  const addFoulP1 = () => {
    const nf = p1Fouls + 1;
    if (nf >= 2) { setP2Score((s) => s + 1); setP1Fouls(0); setP2Fouls(0); }
    else setP1Fouls(nf);
  };
  const addFoulP2 = () => {
    const nf = p2Fouls + 1;
    if (nf >= 2) { setP1Score((s) => s + 1); setP1Fouls(0); setP2Fouls(0); }
    else setP2Fouls(nf);
  };
  const handleReset = () => { setP1Score(0); setP2Score(0); setP1Fouls(0); setP2Fouls(0); localStorage.removeItem(storageKey); };

  const handleConfirm = async () => {
    if (!matchData) return;
    await supabase
      .from("tournament_matches")
      .update({ player1_score: p1Score, player2_score: p2Score, winner_id: winnerId, status: "completed" })
      .eq("id", matchId);
    setConfirmOpen(false);
    setResultSubmitted(true);
    setP1Score(0); setP2Score(0); setP1Fouls(0); setP2Fouls(0);
    localStorage.removeItem(storageKey);
  };

  if (!matchId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p>Parametro match mancante.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(170,255,0,0.04) 0%, transparent 60%), #0a0a0f" }}
    >
      {/* Header */}
      <div className="text-center py-3 px-4 border-b border-zinc-800/50">
        <h1 className="text-white text-sm font-bold flex items-center gap-2 justify-center">
          <Video className="h-4 w-4 text-[#AAFF00]" /> VAR Stream Bridge
        </h1>
        <Badge
          variant={isConnected ? "default" : "secondary"}
          className={`mt-1 text-[10px] ${isConnected ? "bg-green-600 border-green-500" : "bg-zinc-800 border-zinc-700"}`}
        >
          {isConnected ? (
            <><Wifi className="h-3 w-3 mr-1" /> Connesso alla Dashboard</>
          ) : (
            <><WifiOff className="h-3 w-3 mr-1" /> {connectionState === "new" ? "Connessione in corso..." : `Stato: ${connectionState}`}</>
          )}
        </Badge>
      </div>

      {/* Camera Preview */}
      <div className="w-full aspect-video bg-zinc-900 relative max-h-[30vh]">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <video
          ref={replayVideoRef}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${isReplaying ? "block" : "hidden"}`}
        />

        {!cameraActive && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <VideoOff className="h-8 w-8 text-zinc-600" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
        {isReplaying && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1 rounded-full border border-[#AAFF00]/40">
            <span className="text-[#AAFF00] text-xs font-bold animate-pulse">▶ REPLAY IN CORSO</span>
          </div>
        )}

        {cameraActive && (
          <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {isRecording ? (
                <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
                  REC {formatDuration(recordingSeconds)}
                </span>
              ) : replayAvailable ? (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Clip pronto · {formatDuration(recordedClipSeconds)}
                </span>
              ) : (
                <span className="rounded-full border border-border bg-black/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Nessuna registrazione
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {!isRecording ? (
                <button
                  onClick={startMatchRecording}
                  disabled={isReplaying}
                  className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-200 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-1.5">
                    <Circle size={12} className="fill-current" />
                    {replayAvailable ? "NUOVA REC" : "REGISTRA"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={stopMatchRecording}
                  className="rounded-lg border border-foreground/20 bg-black/70 px-3 py-1.5 text-xs font-bold text-foreground transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <Square size={12} className="fill-current" />
                    STOP
                  </span>
                </button>
              )}

              <button
                onClick={playReplay}
                disabled={!replayAvailable || isRecording || isReplaying}
                className="rounded-lg border border-primary/30 bg-black/70 px-3 py-1.5 text-xs font-bold text-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center gap-1.5">
                  <Play size={12} className="fill-current" />
                  AVVIA REPLAY
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scoring Section */}
      <div className="flex-1 flex flex-col">
        <button
          onClick={() => setScoringOpen(!scoringOpen)}
          className="flex items-center justify-center gap-2 py-2 text-zinc-400 hover:text-[#AAFF00] transition-colors border-b border-zinc-800/50"
        >
          <span className="text-[10px] uppercase tracking-wider font-bold">Gestione Punteggi</span>
          {scoringOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {scoringOpen && !resultSubmitted && (
          <div className="flex flex-col px-3 pb-4 overflow-y-auto">
            {/* Scoreboard */}
            <div className="py-3 flex items-center gap-2">
              <div className={`flex-1 rounded-xl p-2 text-center transition-all ${
                p1Won ? "bg-green-900/20 ring-1 ring-[#AAFF00]/40" : p2Won ? "opacity-40 bg-zinc-900" : "bg-zinc-900"
              }`}>
                <Avatar className="h-8 w-8 mx-auto ring-2 ring-zinc-800">
                  <AvatarImage src={player1Avatar || undefined} />
                  <AvatarFallback className="bg-zinc-800 text-zinc-500"><User size={14} /></AvatarFallback>
                </Avatar>
                <p className="text-[10px] font-semibold mt-1 truncate text-zinc-300">{player1Name}</p>
                <div className={`text-3xl font-bold tabular-nums ${p1Won ? "text-[#AAFF00]" : "text-white"}`}>{p1Score}</div>
                {p1Won && <Badge className="bg-[#AAFF00] text-black border-0 text-[8px] px-1 py-0">VINCITORE</Badge>}
              </div>
              <div className="text-[10px] font-bold text-zinc-600 uppercase">vs</div>
              <div className={`flex-1 rounded-xl p-2 text-center transition-all ${
                p2Won ? "bg-green-900/20 ring-1 ring-[#AAFF00]/40" : p1Won ? "opacity-40 bg-zinc-900" : "bg-zinc-900"
              }`}>
                <Avatar className="h-8 w-8 mx-auto ring-2 ring-zinc-800">
                  <AvatarImage src={player2Avatar || undefined} />
                  <AvatarFallback className="bg-zinc-800 text-zinc-500"><User size={14} /></AvatarFallback>
                </Avatar>
                <p className="text-[10px] font-semibold mt-1 truncate text-zinc-300">{player2Name}</p>
                <div className={`text-3xl font-bold tabular-nums ${p2Won ? "text-[#AAFF00]" : "text-white"}`}>{p2Score}</div>
                {p2Won && <Badge className="bg-[#AAFF00] text-black border-0 text-[8px] px-1 py-0">VINCITORE</Badge>}
              </div>
            </div>

            <p className="text-center text-[9px] text-zinc-600 mb-2 uppercase tracking-wider">
              Match M{matchData?.match_number || "?"} · Primo a {winThreshold} pt
            </p>

            {/* Point buttons */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                {POINT_ACTIONS.map((action) => (
                  <Button
                    key={`p1-${action.label}`}
                    variant="ghost"
                    disabled={matchOver}
                    className={`w-full min-h-[2.75rem] text-sm font-bold gap-1 rounded-lg ${action.color} ${matchOver ? "opacity-40" : ""}`}
                    onClick={() => addPointsP1(action.points)}
                  >
                    <span className="opacity-60">+{action.points}</span> {action.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  disabled={matchOver}
                  className={`w-full min-h-[2.75rem] text-sm font-bold gap-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/30 rounded-lg ${matchOver ? "opacity-40" : ""}`}
                  onClick={addFoulP1}
                >
                  <AlertTriangle size={14} /> FALLO {p1Fouls > 0 && <span className="ml-0.5 bg-red-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{p1Fouls}</span>}
                </Button>
                {p1Score > 0 && !matchOver && (
                  <Button variant="ghost" className="w-full min-h-[1.75rem] text-xs text-red-400 hover:bg-red-900/20" onClick={() => setP1Score((s) => Math.max(0, s - 1))}>
                    <Minus size={10} className="mr-0.5" /> -1
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {POINT_ACTIONS.map((action) => (
                  <Button
                    key={`p2-${action.label}`}
                    variant="ghost"
                    disabled={matchOver}
                    className={`w-full min-h-[2.75rem] text-sm font-bold gap-1 rounded-lg ${action.color} ${matchOver ? "opacity-40" : ""}`}
                    onClick={() => addPointsP2(action.points)}
                  >
                    <span className="opacity-60">+{action.points}</span> {action.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  disabled={matchOver}
                  className={`w-full min-h-[2.75rem] text-sm font-bold gap-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/30 rounded-lg ${matchOver ? "opacity-40" : ""}`}
                  onClick={addFoulP2}
                >
                  <AlertTriangle size={14} /> FALLO {p2Fouls > 0 && <span className="ml-0.5 bg-red-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{p2Fouls}</span>}
                </Button>
                {p2Score > 0 && !matchOver && (
                  <Button variant="ghost" className="w-full min-h-[1.75rem] text-xs text-red-400 hover:bg-red-900/20" onClick={() => setP2Score((s) => Math.max(0, s - 1))}>
                    <Minus size={10} className="mr-0.5" /> -1
                  </Button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/50">
              <Button variant="outline" size="sm" className="gap-1 h-8 border-zinc-700 text-zinc-400 hover:text-white" onClick={handleReset}>
                <RotateCcw size={12} /> Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8 border-zinc-700 text-zinc-400 hover:text-white"
                disabled={coinFlipping}
                onClick={() => {
                  setCoinFlipping(true);
                  setCoinResult(null);
                  setTimeout(() => {
                    const winner = Math.random() < 0.5 ? player1Name : player2Name;
                    setCoinResult(winner);
                    setCoinFlipping(false);
                    setTimeout(() => setCoinResult(null), 2500);
                  }, 800);
                }}
              >
                <Coins size={12} className={coinFlipping ? "animate-spin" : ""} />
                {coinFlipping ? "..." : "Moneta"}
              </Button>
              {coinResult && <span className="text-[10px] text-[#AAFF00] font-bold">{coinResult} ↗</span>}
              <div className="flex-1" />
              {matchOver && (
                <Button size="sm" className="gap-1.5 h-8 bg-[#AAFF00] text-black hover:bg-[#88DD00] font-bold" onClick={() => setConfirmOpen(true)}>
                  <Check size={14} /> Conferma
                </Button>
              )}
            </div>
          </div>
        )}

        {resultSubmitted && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Trophy className="h-12 w-12 text-[#AAFF00] mx-auto mb-3" />
              <p className="text-white font-bold text-lg">Risultato inviato!</p>
              <p className="text-zinc-500 text-sm mt-1">Il match è stato registrato nel torneo.</p>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-[#0d0d14] border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Conferma risultato</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              <span className="font-semibold text-white">{winnerName}</span> vince il match M{matchData?.match_number} con il punteggio di{" "}
              <span className="font-mono font-bold text-white">{p1Score} - {p2Score}</span>. Confermare?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-400">Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-[#AAFF00] text-black hover:bg-[#88DD00]" onClick={handleConfirm}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StreamingVARBridge;
