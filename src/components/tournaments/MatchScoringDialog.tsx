import { useState, useEffect, useCallback, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, RotateCcw, Check, Trophy, Minus, AlertTriangle, Coins, Wifi, WifiOff, ArrowLeftRight, X, Crown } from "lucide-react";
import { VARCamera } from "./VARCamera";
import { SenderStreamPeer, STREAMING_HEARTBEAT_CHANNEL, ScoreMessage } from "@/lib/streamingPeer";
import { useVarLandscapeOverride } from "@/hooks/useVarLandscapeOverride";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

// IBNF tone mapping: SPIN/OWN → SF (grigio), BURST/OVER → OF (oro), XTREME → XF (viola).
const POINT_ACTIONS = [
  { label: "SPIN",   shortLabel: "SPN", points: 1, color: "ibnf-scbtn t-sf" },
  { label: "OWN",    shortLabel: "OWN", points: 1, color: "ibnf-scbtn t-sf" },
  { label: "BURST",  shortLabel: "BRS", points: 2, color: "ibnf-scbtn t-of" },
  { label: "OVER",   shortLabel: "OVR", points: 2, color: "ibnf-scbtn t-of" },
  { label: "XTREME", shortLabel: "XTR", points: 3, color: "ibnf-scbtn t-xf" },
];

const DEFAULT_WIN_THRESHOLD = 4;

interface DesktopPlayerPanelProps {
  align: "left" | "right";
  name: string;
  avatar?: string | null;
  score: number;
  fouls: number;
  won: boolean;
  otherWon: boolean;
  matchOver: boolean;
  winThreshold: number;
  addPts: (pts: number) => void;
  addFoul: () => void;
  dec: () => void;
}

const DesktopPlayerPanel = ({
  align, name, avatar, score, fouls, won, otherWon, matchOver, winThreshold, addPts, addFoul, dec,
}: DesktopPlayerPanelProps) => {
  const alignText = align === "left" ? "text-left" : "text-right";
  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Player header (IBNF look) */}
      <div className={`ibnf-side relative rounded-xl p-3 transition-all duration-300 overflow-hidden ${
        won ? "win" : otherWon ? "opacity-50" : ""
      }`}>
        <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}>
          <div className="relative">
            <Avatar className="h-12 w-12 ring-2 ring-background">
              <AvatarImage src={avatar || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground"><User size={20} /></AvatarFallback>
            </Avatar>
            {won && (
              <div className="absolute -top-1 -right-1 bg-[color:var(--ibnf-acid)] rounded-full p-1">
                <Trophy size={10} className="text-[#05210a]" />
              </div>
            )}
          </div>
          <div className={`flex-1 min-w-0 ${alignText}`}>
            <p className={`ibnf-side-name truncate ${won ? "text-[color:var(--ibnf-acid)]" : ""}`}>{name}</p>
            {won && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#05210a] bg-[color:var(--ibnf-acid)] rounded-full px-2 py-0.5">
                <Crown size={10} /> Vince
              </span>
            )}
          </div>
        </div>
        <div className={`mt-2 flex items-baseline gap-2 ${align === "right" ? "justify-end" : ""}`}>
          <span key={score} className={`ibnf-side-score-inline fib-pop inline-block ${won ? "text-[color:var(--ibnf-acid)]" : "text-foreground"}`}>
            {matchOver ? Math.min(score, winThreshold) : score}
          </span>
          <span className="text-xs text-muted-foreground">pt</span>
          {fouls > 0 && (
            <span className="text-xs text-destructive font-mono ml-2">{fouls} fallo</span>
          )}
        </div>
      </div>

      {/* Action buttons — IBNF finish look */}
      <div className="flex flex-col gap-1.5 flex-1">
        {POINT_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={matchOver}
            className={`${action.color} ${matchOver ? "opacity-40" : ""}`}
            onClick={() => addPts(action.points)}
          >
            <span className="scbtn-l"><b>{action.label}</b><span>+{action.points} punti</span></span>
            <span className="scbtn-pt">+{action.points}</span>
          </button>
        ))}
        <Button
          variant="ghost"
          disabled={matchOver}
          className={`w-full h-11 text-sm font-bold gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 ${matchOver ? "opacity-40" : ""}`}
          onClick={addFoul}
        >
          <AlertTriangle size={14} /> FALLO
          {fouls > 0 && <span className="ml-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center">{fouls}</span>}
        </Button>
        <Button
          variant="ghost"
          disabled={score <= 0 || matchOver}
          className="w-full h-9 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-30"
          onClick={dec}
        >
          <Minus size={12} className="mr-1" /> Rimuovi 1 punto
        </Button>
      </div>
    </div>
  );
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  matchNumber: number;
  player1Id: string | null;
  player2Id: string | null;
  player1Name: string;
  player2Name: string;
  player1Avatar?: string | null;
  player2Avatar?: string | null;
  onResult: (matchId: string, winnerId: string | null, p1Score: number, p2Score: number) => void;
  winThreshold?: number;
  tournamentId?: string;
}

export const MatchScoringDialog = ({
  open,
  onOpenChange,
  matchId,
  matchNumber,
  player1Id,
  player2Id,
  player1Name,
  player2Name,
  player1Avatar,
  player2Avatar,
  onResult,
  winThreshold = DEFAULT_WIN_THRESHOLD,
  tournamentId,
}: Props) => {
  const storageKey = `match-scoring-${matchId}`;

  const loadSaved = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as { p1: number; p2: number; f1: number; f2: number };
    } catch { /* ignore */ }
    return null;
  }, [storageKey]);

  const [p1Score, setP1Score] = useState(() => loadSaved()?.p1 ?? 0);
  const [p2Score, setP2Score] = useState(() => loadSaved()?.p2 ?? 0);
  const [p1Fouls, setP1Fouls] = useState(() => loadSaved()?.f1 ?? 0);
  const [p2Fouls, setP2Fouls] = useState(() => loadSaved()?.f2 ?? 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coinResult, setCoinResult] = useState<string | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [coinOverlay, setCoinOverlay] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [scorePopoverOpen, setScorePopoverOpen] = useState(false);

  const { forced: forceLandscapeOverride } = useVarLandscapeOverride();
  const isMobileLandscape = forceLandscapeOverride;


  // WebRTC auto-connect to streaming dashboard
  const peerRef = useRef<SenderStreamPeer | null>(null);
  const varStreamRef = useRef<MediaStream | null>(null);
  const [streamingConnected, setStreamingConnected] = useState(false);
  const [dashboardAlive, setDashboardAlive] = useState(false);

  // Detect streaming dashboard heartbeat
  useEffect(() => {
    if (!tournamentId || !open) return;
    const bc = new BroadcastChannel(STREAMING_HEARTBEAT_CHANNEL);
    let timeout: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timeout);
      setDashboardAlive(true);
      timeout = setTimeout(() => setDashboardAlive(false), 5000);
    };
    bc.onmessage = (e) => {
      if (e.data?.tournamentId === tournamentId && e.data?.alive) reset();
    };
    bc.postMessage({ ping: true, tournamentId });
    return () => { clearTimeout(timeout); bc.close(); };
  }, [tournamentId, open]);

  // Connect WebRTC when dashboard is alive and stream is available
  useEffect(() => {
    if (!dashboardAlive || !tournamentId || !open || !varStreamRef.current) return;
    if (peerRef.current) return; // already connected

    const peer = new SenderStreamPeer(tournamentId, matchId);
    peer.addStream(varStreamRef.current);
    peer.onState = (state) => {
      setStreamingConnected(state === "connected");
    };
    peer.start();
    peerRef.current = peer;

    return () => {
      peer.destroy();
      peerRef.current = null;
      setStreamingConnected(false);
    };
  }, [dashboardAlive, tournamentId, matchId, open]);

  // Callback for VARCamera stream
  const handleVarStreamReady = useCallback((stream: MediaStream | null) => {
    varStreamRef.current = stream;
    if (stream && dashboardAlive && tournamentId && !peerRef.current) {
      const peer = new SenderStreamPeer(tournamentId, matchId);
      peer.addStream(stream);
      peer.onState = (state) => {
        setStreamingConnected(state === "connected");
      };
      peer.start();
      peerRef.current = peer;
    }
    if (!stream && peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      setStreamingConnected(false);
    }
  }, [dashboardAlive, tournamentId, matchId]);

  // Cleanup peer on dialog close
  useEffect(() => {
    if (!open && peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      setStreamingConnected(false);
    }
  }, [open]);

  // Persist scores to localStorage on every change + broadcast for streaming
  useEffect(() => {
    if (p1Score === 0 && p2Score === 0 && p1Fouls === 0 && p2Fouls === 0) return;
    localStorage.setItem(storageKey, JSON.stringify({ p1: p1Score, p2: p2Score, f1: p1Fouls, f2: p2Fouls }));
    const scoreData: ScoreMessage = {
      matchId,
      p1Score, p2Score, p1Fouls, p2Fouls,
      p1Name: player1Name, p2Name: player2Name,
      p1Avatar: player1Avatar, p2Avatar: player2Avatar,
    };
    // Broadcast live scores for streaming dashboard (same-device, via BroadcastChannel)
    try {
      const bc = new BroadcastChannel("match-live-scores");
      bc.postMessage(scoreData);
      bc.close();
    } catch {}
    // Also send via WebRTC if connected
    peerRef.current?.sendScore(scoreData);
  }, [p1Score, p2Score, p1Fouls, p2Fouls, storageKey, matchId, player1Name, player2Name, player1Avatar, player2Avatar]);

  // Reload saved scores when dialog opens for this match
  useEffect(() => {
    if (open) {
      const saved = loadSaved();
      if (saved) {
        setP1Score(saved.p1);
        setP2Score(saved.p2);
        setP1Fouls(saved.f1);
        setP2Fouls(saved.f2);
      }
    }
  }, [open, matchId, loadSaved]);

  const p1Won = p1Score >= winThreshold;
  const p2Won = p2Score >= winThreshold;
  const matchOver = p1Won || p2Won;
  const winnerId = p1Won ? player1Id : p2Won ? player2Id : null;
  const winnerName = p1Won ? player1Name : p2Won ? player2Name : null;

  const resetFouls = () => { setP1Fouls(0); setP2Fouls(0); };

  const addPointsP1 = (pts: number) => { setP1Score((s) => s + pts); resetFouls(); };
  const addPointsP2 = (pts: number) => { setP2Score((s) => s + pts); resetFouls(); };

  const addFoulP1 = () => {
    const newFouls = p1Fouls + 1;
    if (newFouls >= 2) { setP2Score((s) => s + 1); setP1Fouls(0); setP2Fouls(0); }
    else setP1Fouls(newFouls);
  };

  const addFoulP2 = () => {
    const newFouls = p2Fouls + 1;
    if (newFouls >= 2) { setP1Score((s) => s + 1); setP1Fouls(0); setP2Fouls(0); }
    else setP2Fouls(newFouls);
  };

  // Derived player order based on swap (visual only, doesn't affect scoring logic)
  const leftName = swapped ? player2Name : player1Name;
  const rightName = swapped ? player1Name : player2Name;
  const leftAvatar = swapped ? player2Avatar : player1Avatar;
  const rightAvatar = swapped ? player1Avatar : player2Avatar;
  const leftScore = swapped ? p2Score : p1Score;
  const rightScore = swapped ? p1Score : p2Score;
  const leftWon = swapped ? p2Won : p1Won;
  const rightWon = swapped ? p1Won : p2Won;
  const leftFouls = swapped ? p2Fouls : p1Fouls;
  const rightFouls = swapped ? p1Fouls : p2Fouls;
  const addPointsLeft = swapped ? addPointsP2 : addPointsP1;
  const addPointsRight = swapped ? addPointsP1 : addPointsP2;
  const addFoulLeft = swapped ? addFoulP2 : addFoulP1;
  const addFoulRight = swapped ? addFoulP1 : addFoulP2;
  const decLeft = swapped ? () => setP2Score((s) => Math.max(0, s - 1)) : () => setP1Score((s) => Math.max(0, s - 1));
  const decRight = swapped ? () => setP1Score((s) => Math.max(0, s - 1)) : () => setP2Score((s) => Math.max(0, s - 1));

  const handleReset = () => { setP1Score(0); setP2Score(0); setP1Fouls(0); setP2Fouls(0); localStorage.removeItem(storageKey); };

  const clearState = () => { setP1Score(0); setP2Score(0); setP1Fouls(0); setP2Fouls(0); localStorage.removeItem(storageKey); };

  const handleConfirm = () => {
    onResult(matchId, winnerId, p1Score, p2Score);
    setConfirmOpen(false);
    onOpenChange(false);
    setTimeout(clearState, 300);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      onOpenChange(false);
      // Don't reset scores — they stay in localStorage
    }
  };

  const ScoringPanel = ({ landscape = false }: { landscape?: boolean }) => (
    <div className={landscape
      ? "flex flex-col h-full"
      : "block lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto"}>
      {/* Header */}
      <DialogHeader className={landscape ? "px-4 pt-3 pb-1" : "px-4 pt-4 pb-0"}>
        <DialogTitle className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Match M{matchNumber} · Primo a <span className="font-bold text-primary">{winThreshold}</span> pt
        </DialogTitle>
      </DialogHeader>

      {/* Body — landscape: scoreboard on top compact, actions in a single tight grid below */}
      {landscape ? (
        <div className="flex-1 flex flex-col gap-2 px-3 py-2 min-h-0">
          {/* Top bar: swap + coin overlay anchor */}
          <div className="relative flex items-center justify-end gap-2">
            <button onClick={() => setSwapped(s => !s)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted" title="Inverti lati">
              <ArrowLeftRight size={12} /> Inverti
            </button>
            {coinOverlay && coinResult && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="animate-scale-in flex flex-col items-center gap-1 bg-background/95 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-2xl border border-primary/30">
                  <Coins size={40} className="text-primary animate-[spin_0.6s_ease-out]" aria-hidden="true" />
                  <p className="text-xs font-bold text-primary-foreground bg-primary rounded-full px-2.5 py-0.5">{coinResult}</p>
                </div>
              </div>
            )}
          </div>

          {/* Per-player rows: [player card | action buttons row] */}
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            {([
              { side: "L", name: leftName, avatar: leftAvatar, won: leftWon, otherWon: rightWon, actions: POINT_ACTIONS, addPts: addPointsLeft, addFoul: addFoulLeft, dec: decLeft, fouls: leftFouls, score: leftScore },
              { side: "R", name: rightName, avatar: rightAvatar, won: rightWon, otherWon: leftWon, actions: POINT_ACTIONS, addPts: addPointsRight, addFoul: addFoulRight, dec: decRight, fouls: rightFouls, score: rightScore },
            ] as const).map((s) => (
              <div key={s.side} className="flex-1 flex items-stretch gap-2 min-h-0">
                {/* Player card on the left */}
                <div className={`w-32 shrink-0 rounded-lg p-2 flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
                  s.won ? "bg-primary/10 ring-2 ring-primary/40" : s.otherWon ? "opacity-50 bg-secondary/20" : "bg-secondary/30"
                }`}>
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    <div className="relative shrink-0">
                      <Avatar className="h-7 w-7 ring-1 ring-background">
                        <AvatarImage src={s.avatar || undefined} />
                        <AvatarFallback className="bg-muted text-muted-foreground"><User size={12} /></AvatarFallback>
                      </Avatar>
                      {s.won && (
                        <div className="absolute -top-0.5 -right-0.5 bg-primary rounded-full p-0.5">
                          <Trophy size={6} className="text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold truncate flex-1 min-w-0">{s.name}</p>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <div key={s.score} className={`fib-pop text-3xl font-display font-bold tabular-nums leading-none ${s.won ? "text-primary" : "text-foreground"}`}>
                      {matchOver ? Math.min(s.score, winThreshold) : s.score}
                    </div>
                    {s.fouls > 0 && (
                      <span className="text-[9px] text-destructive font-mono">{s.fouls}F</span>
                    )}
                  </div>
                  {s.won && <Badge className="bg-primary text-primary-foreground border-0 text-[8px] px-1 py-0">VINCITORE</Badge>}
                </div>

                {/* Action buttons row */}
                <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
                  {s.actions.map((a) => (
                    <Button
                      key={`${s.side}-${a.label}`}
                      variant="ghost"
                      disabled={matchOver}
                      className={`h-full min-h-[48px] px-1 flex flex-col items-center justify-center leading-none ${a.color} ${matchOver ? "opacity-40" : ""}`}
                      onClick={() => s.addPts(a.points)}
                    >
                      <span className="text-xs font-bold tracking-wide w-full text-center">{a.label}</span>
                      <span className="text-[10px] opacity-70 mt-0.5 font-mono">+{a.points}</span>
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    disabled={matchOver}
                    className={`h-full min-h-[48px] px-1 flex flex-col items-center justify-center leading-none gap-0.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 ${matchOver ? "opacity-40" : ""}`}
                    onClick={s.addFoul}
                  >
                    <span className="flex items-center gap-1 text-xs font-bold">
                      <AlertTriangle size={11} /> FALLO
                    </span>
                    {s.fouls > 0 ? (
                      <span className="text-[10px] font-mono opacity-80">×{s.fouls}</span>
                    ) : (
                      <span className="text-[10px] opacity-70 font-mono">+0</span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={s.score <= 0 || matchOver}
                    className="h-full min-h-[48px] px-1 flex flex-col items-center justify-center leading-none text-destructive hover:bg-destructive/10 disabled:opacity-30 border border-destructive/20"
                    onClick={s.dec}
                    title="Rimuovi 1 punto"
                  >
                    <Minus size={14} />
                    <span className="text-[10px] font-mono mt-0.5">-1</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer inline */}
          <div className="border-t border-border pt-2 flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={handleReset}>
              <RotateCcw size={12} /> Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-8 text-xs"
              disabled={coinFlipping}
              onClick={() => {
                setCoinFlipping(true);
                setCoinResult(null);
                setCoinOverlay(false);
                setTimeout(() => {
                  const winner = Math.random() < 0.5 ? player1Name : player2Name;
                  setCoinResult(winner);
                  setCoinFlipping(false);
                  setCoinOverlay(true);
                  setTimeout(() => setCoinOverlay(false), 2500);
                }, 800);
              }}
            >
              <Coins size={12} className={coinFlipping ? "animate-spin" : ""} />
              {coinFlipping ? "..." : "Moneta"}
            </Button>
            <div className="flex-1" />
            {matchOver && (
              <Button size="sm" className="gap-1.5 h-8 text-xs animate-in fade-in duration-300" onClick={() => setConfirmOpen(true)}>
                <Check size={14} /> Conferma
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Scoreboard */}
          <div className="px-4 py-2 flex-shrink-0 relative">
            <div className="flex items-center gap-2">
              {/* Left player */}
              <div className={`flex-1 rounded-lg p-2 text-center transition-all duration-300 ${
                leftWon ? "bg-primary/10 ring-2 ring-primary/40" : rightWon ? "opacity-50 bg-secondary/20" : "bg-secondary/30"
              }`}>
                <div className="relative inline-block">
                  <Avatar className="h-9 w-9 mx-auto ring-2 ring-background">
                    <AvatarImage src={leftAvatar || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground"><User size={16} /></AvatarFallback>
                  </Avatar>
                  {leftWon && (
                    <div className="absolute -top-0.5 -right-0.5 bg-primary rounded-full p-0.5">
                      <Trophy size={8} className="text-primary-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-semibold mt-1 truncate">{leftName}</p>
                <div key={leftScore} className={`fib-pop text-3xl font-display font-bold tabular-nums transition-colors duration-300 ${
                  leftWon ? "text-primary" : "text-foreground"
                }`}>{matchOver ? Math.min(leftScore, winThreshold) : leftScore}</div>
                {matchOver && (
                  <p className={`text-[9px] font-bold ${leftWon ? "text-primary" : "text-muted-foreground"}`}>
                    {leftWon
                      ? leftScore > winThreshold ? `+${leftScore - winThreshold}pts Tiebreaker` : ""
                      : `−${winThreshold - leftScore}pts Tiebreaker`}
                  </p>
                )}
                {leftWon && (
                  <Badge className="bg-primary text-primary-foreground border-0 text-[8px] px-1 py-0">VINCITORE</Badge>
                )}
              </div>

              <button onClick={() => setSwapped(s => !s)} className="p-1 rounded-full hover:bg-muted transition-colors" title="Inverti lati">
                <ArrowLeftRight size={14} className="text-muted-foreground" />
              </button>

              {/* Right player */}
              <div className={`flex-1 rounded-lg p-2 text-center transition-all duration-300 ${
                rightWon ? "bg-primary/10 ring-2 ring-primary/40" : leftWon ? "opacity-50 bg-secondary/20" : "bg-secondary/30"
              }`}>
                <div className="relative inline-block">
                  <Avatar className="h-9 w-9 mx-auto ring-2 ring-background">
                    <AvatarImage src={rightAvatar || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground"><User size={16} /></AvatarFallback>
                  </Avatar>
                  {rightWon && (
                    <div className="absolute -top-0.5 -right-0.5 bg-primary rounded-full p-0.5">
                      <Trophy size={8} className="text-primary-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-semibold mt-1 truncate">{rightName}</p>
                <div key={rightScore} className={`fib-pop text-3xl font-display font-bold tabular-nums transition-colors duration-300 ${
                  rightWon ? "text-primary" : "text-foreground"
                }`}>{matchOver ? Math.min(rightScore, winThreshold) : rightScore}</div>
                {matchOver && (
                  <p className={`text-[9px] font-bold ${rightWon ? "text-primary" : "text-muted-foreground"}`}>
                    {rightWon
                      ? rightScore > winThreshold ? `+${rightScore - winThreshold}pts Tiebreaker` : ""
                      : `−${winThreshold - rightScore}pts Tiebreaker`}
                  </p>
                )}
                {rightWon && (
                  <Badge className="bg-primary text-primary-foreground border-0 text-[8px] px-1 py-0">VINCITORE</Badge>
                )}
              </div>
            </div>

            {/* Coin flip overlay animation */}
            {coinOverlay && coinResult && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="animate-scale-in flex flex-col items-center gap-1 bg-background/95 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-2xl border border-primary/30">
                  <Coins size={48} className="text-primary animate-[spin_0.6s_ease-out]" aria-hidden="true" />
                  <p className="text-sm font-bold text-primary-foreground bg-primary rounded-full px-3 py-1 mt-1">
                    {coinResult}
                  </p>
                  <p className="text-[10px] text-muted-foreground">sceglie il lato!</p>
                </div>
              </div>
            )}
          </div>

          {/* Point buttons */}
          <div className="px-3 pb-4 flex flex-col">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-[3px]">
                {POINT_ACTIONS.map((action) => (
                  <Button
                    key={`left-${action.label}`}
                    variant="ghost"
                    disabled={matchOver}
                    className={`w-full min-h-[2.75rem] sm:min-h-[2rem] text-sm sm:text-[10px] font-bold gap-1 ${action.color} ${matchOver ? "opacity-40" : ""}`}
                    onClick={() => addPointsLeft(action.points)}
                  >
                    <span className="opacity-60">+{action.points}</span> {action.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  disabled={matchOver}
                  className={`w-full min-h-[2.75rem] sm:min-h-[2rem] text-sm sm:text-[10px] font-bold gap-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 ${matchOver ? "opacity-40" : ""}`}
                  onClick={addFoulLeft}
                >
                  <AlertTriangle size={14} /> FALLO {leftFouls > 0 && <span className="ml-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{leftFouls}</span>}
                </Button>
                {leftScore > 0 && !matchOver && (
                  <Button variant="ghost" className="w-full min-h-[2rem] sm:min-h-[1.5rem] text-xs sm:text-[9px] text-destructive hover:bg-destructive/10" onClick={decLeft}>
                    <Minus size={10} className="mr-0.5" /> -1
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-[3px]">
                {POINT_ACTIONS.map((action) => (
                  <Button
                    key={`right-${action.label}`}
                    variant="ghost"
                    disabled={matchOver}
                    className={`w-full min-h-[2.75rem] sm:min-h-[2rem] text-sm sm:text-[10px] font-bold gap-1 ${action.color} ${matchOver ? "opacity-40" : ""}`}
                    onClick={() => addPointsRight(action.points)}
                  >
                    <span className="opacity-60">+{action.points}</span> {action.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  disabled={matchOver}
                  className={`w-full min-h-[2.75rem] sm:min-h-[2rem] text-sm sm:text-[10px] font-bold gap-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 ${matchOver ? "opacity-40" : ""}`}
                  onClick={addFoulRight}
                >
                  <AlertTriangle size={14} /> FALLO {rightFouls > 0 && <span className="ml-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{rightFouls}</span>}
                </Button>
                {rightScore > 0 && !matchOver && (
                  <Button variant="ghost" className="w-full min-h-[2rem] sm:min-h-[1.5rem] text-xs sm:text-[9px] text-destructive hover:bg-destructive/10" onClick={decRight}>
                    <Minus size={10} className="mr-0.5" /> -1
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Footer - Reset, Coin & Confirm */}
          <div className="mt-2 border-t border-border bg-background px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1 h-8" onClick={handleReset}>
                <RotateCcw size={12} /> Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8"
                disabled={coinFlipping}
                onClick={() => {
                  setCoinFlipping(true);
                  setCoinResult(null);
                  setCoinOverlay(false);
                  setTimeout(() => {
                    const winner = Math.random() < 0.5 ? player1Name : player2Name;
                    setCoinResult(winner);
                    setCoinFlipping(false);
                    setCoinOverlay(true);
                    setTimeout(() => setCoinOverlay(false), 2500);
                  }, 800);
                }}
              >
                <Coins size={12} className={coinFlipping ? "animate-spin" : ""} />
                {coinFlipping ? "..." : "Moneta"}
              </Button>
              <div className="flex-1" />
              {matchOver && (
                <Button size="sm" className="gap-1.5 h-8 animate-in fade-in duration-300" onClick={() => setConfirmOpen(true)}>
                  <Check size={14} /> Conferma
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          hideClose
          className={
            isMobileLandscape
              ? "max-w-none w-screen h-[100dvh] p-0 gap-0 rounded-none border-0 bg-black overflow-hidden"
              : "max-w-md lg:max-w-[min(1400px,95vw)] p-0 gap-0 h-[100dvh] overflow-y-auto rounded-none block sm:h-auto sm:max-h-[95vh] sm:rounded-2xl lg:flex lg:flex-row lg:overflow-hidden lg:h-[90vh] lg:max-h-[900px]"
          }
        >
          {isMobileLandscape ? (
            // ─── LANDSCAPE FULLSCREEN VAR ───
            <div className="relative w-full h-full">
              <VARCamera
                matchLabel={`M${matchNumber}`}
                onStreamReady={handleVarStreamReady}
                landscapeMode
                rightBarSlot={
                  <Popover open={scorePopoverOpen} onOpenChange={setScorePopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="w-12 h-12 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground shadow-lg backdrop-blur-md flex items-center justify-center transition-all active:scale-95 relative"
                        title="Punteggi"
                      >
                        <Trophy size={18} />
                        {(p1Score > 0 || p2Score > 0) && (
                          <span className="absolute -top-1 -right-1 bg-background text-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center border border-border">
                            {p1Score}-{p2Score}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="left"
                      align="center"
                      sideOffset={12}
                      collisionPadding={8}
                      className="w-[min(680px,calc(100vw-5.5rem))] h-[min(94vh,420px)] p-0 bg-background/95 backdrop-blur-xl border-border shadow-2xl overflow-hidden"
                    >
                      <ScoringPanel landscape />
                    </PopoverContent>
                  </Popover>
                }
              />
              {dashboardAlive && (
                <div className="absolute top-2 right-1/2 translate-x-1/2 z-40 pointer-events-none">
                  <Badge variant={streamingConnected ? "default" : "secondary"} className={`text-[9px] gap-1 ${streamingConnected ? "bg-green-600 border-green-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                    {streamingConnected ? <><Wifi size={10} /> LIVE</> : <><WifiOff size={10} /> Connessione...</>}
                  </Badge>
                </div>
              )}
              {/* Floating close button */}
              <button
                onClick={() => handleClose(false)}
                className="absolute top-3 left-3 z-40 w-10 h-10 rounded-full bg-background/40 hover:bg-background/60 backdrop-blur-md border border-white/15 text-white shadow-xl flex items-center justify-center transition-all active:scale-90"
                title="Chiudi"
              >
                <X size={17} />
              </button>
            </div>
          ) : (
            <>
              {/* Mobile/tablet: keep stacked legacy layout */}
              <div className="block lg:hidden">
                <div className="relative">
                  <VARCamera matchLabel={`M${matchNumber}`} onStreamReady={handleVarStreamReady} />
                  {dashboardAlive && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge variant={streamingConnected ? "default" : "secondary"} className={`text-[9px] gap-1 ${streamingConnected ? "bg-green-600 border-green-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                        {streamingConnected ? <><Wifi size={10} /> LIVE</> : <><WifiOff size={10} /> Connessione...</>}
                      </Badge>
                    </div>
                  )}
                </div>
                <ScoringPanel />
              </div>

              {/* Desktop: 3-column layout — LEFT player | VAR Camera | RIGHT player */}
              <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
                {/* LEFT player panel */}
                <div className="w-[280px] shrink-0 flex flex-col border-r border-border bg-secondary/10 overflow-y-auto">
                  <DesktopPlayerPanel
                    align="left"
                    name={leftName}
                    avatar={leftAvatar}
                    score={leftScore}
                    fouls={leftFouls}
                    won={leftWon}
                    otherWon={rightWon}
                    matchOver={matchOver}
                    winThreshold={winThreshold}
                    addPts={addPointsLeft}
                    addFoul={addFoulLeft}
                    dec={decLeft}
                  />
                </div>

                {/* CENTER: VAR camera with overlay name+score tags + swap button */}
                <div className="relative flex-1 min-w-0 flex flex-col bg-black">
                  <div className="flex-1 min-h-0 relative overflow-hidden">
                    <VARCamera matchLabel={`M${matchNumber}`} onStreamReady={handleVarStreamReady} />

                    {/* Overlay tags above the video */}
                    <div className="pointer-events-none absolute top-2 left-2 right-2 z-20 flex items-start justify-between gap-2">
                      {/* Left tag */}
                      <div className={`pointer-events-auto flex items-center gap-2 rounded-lg px-2.5 py-1.5 backdrop-blur-md shadow-lg border transition-all ${
                        leftWon ? "bg-primary/90 border-primary text-primary-foreground" : "bg-background/80 border-border text-foreground"
                      }`}>
                        <Avatar className="h-7 w-7 ring-1 ring-background/50">
                          <AvatarImage src={leftAvatar || undefined} />
                          <AvatarFallback className="bg-muted text-muted-foreground"><User size={12} /></AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[10px] font-semibold truncate max-w-[120px]">{leftName}</span>
                          <span key={leftScore} className="fib-pop inline-block text-lg font-display font-bold tabular-nums leading-none">
                            {matchOver ? Math.min(leftScore, winThreshold) : leftScore}
                          </span>
                        </div>
                      </div>

                      {/* Swap button */}
                      <button
                        onClick={() => setSwapped(s => !s)}
                        className="pointer-events-auto mt-1 flex items-center gap-1 rounded-full px-2.5 py-1.5 bg-background/70 hover:bg-background/90 backdrop-blur-md border border-border text-foreground text-[10px] font-medium shadow-lg transition-all"
                        title="Inverti posizioni nel video"
                      >
                        <ArrowLeftRight size={12} /> Inverti
                      </button>

                      {/* Right tag */}
                      <div className={`pointer-events-auto flex items-center gap-2 rounded-lg px-2.5 py-1.5 backdrop-blur-md shadow-lg border transition-all ${
                        rightWon ? "bg-primary/90 border-primary text-primary-foreground" : "bg-background/80 border-border text-foreground"
                      }`}>
                        <div className="flex flex-col leading-tight items-end">
                          <span className="text-[10px] font-semibold truncate max-w-[120px]">{rightName}</span>
                          <span key={rightScore} className="fib-pop inline-block text-lg font-display font-bold tabular-nums leading-none">
                            {matchOver ? Math.min(rightScore, winThreshold) : rightScore}
                          </span>
                        </div>
                        <Avatar className="h-7 w-7 ring-1 ring-background/50">
                          <AvatarImage src={rightAvatar || undefined} />
                          <AvatarFallback className="bg-muted text-muted-foreground"><User size={12} /></AvatarFallback>
                        </Avatar>
                      </div>
                    </div>

                    {dashboardAlive && (
                      <div className="absolute bottom-2 right-2 z-20">
                        <Badge variant={streamingConnected ? "default" : "secondary"} className={`text-[9px] gap-1 ${streamingConnected ? "bg-green-600 border-green-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                          {streamingConnected ? <><Wifi size={10} /> LIVE</> : <><WifiOff size={10} /> Connessione...</>}
                        </Badge>
                      </div>
                    )}

                    {coinOverlay && coinResult && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                        <div className="animate-scale-in flex flex-col items-center gap-1 bg-background/95 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-2xl border border-primary/30">
                          <Coins size={48} className="text-primary animate-[spin_0.6s_ease-out]" aria-hidden="true" />
                          <p className="text-sm font-bold text-primary-foreground bg-primary rounded-full px-3 py-1 mt-1">{coinResult}</p>
                          <p className="text-[10px] text-muted-foreground">sceglie il lato!</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom toolbar: header + reset/coin/confirm */}
                  <div className="border-t border-border bg-background px-4 py-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Match <span className="font-bold text-foreground">M{matchNumber}</span> · Primo a <span className="font-bold text-foreground">{winThreshold}</span> pt
                    </span>
                    <div className="flex-1" />
                    <Button variant="outline" size="sm" className="gap-1 h-8" onClick={handleReset}>
                      <RotateCcw size={12} /> Reset
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 h-8"
                      disabled={coinFlipping}
                      onClick={() => {
                        setCoinFlipping(true);
                        setCoinResult(null);
                        setCoinOverlay(false);
                        setTimeout(() => {
                          const winner = Math.random() < 0.5 ? player1Name : player2Name;
                          setCoinResult(winner);
                          setCoinFlipping(false);
                          setCoinOverlay(true);
                          setTimeout(() => setCoinOverlay(false), 2500);
                        }, 800);
                      }}
                    >
                      <Coins size={12} className={coinFlipping ? "animate-spin" : ""} />
                      {coinFlipping ? "..." : "Moneta"}
                    </Button>
                    {matchOver && (
                      <Button size="sm" className="gap-1.5 h-8 animate-in fade-in duration-300" onClick={() => setConfirmOpen(true)}>
                        <Check size={14} /> Conferma
                      </Button>
                    )}
                    <button
                      onClick={() => handleClose(false)}
                      className="ml-1 inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>

                {/* RIGHT player panel */}
                <div className="w-[280px] shrink-0 flex flex-col border-l border-border bg-secondary/10 overflow-y-auto">
                  <DesktopPlayerPanel
                    align="right"
                    name={rightName}
                    avatar={rightAvatar}
                    score={rightScore}
                    fouls={rightFouls}
                    won={rightWon}
                    otherWon={leftWon}
                    matchOver={matchOver}
                    winThreshold={winThreshold}
                    addPts={addPointsRight}
                    addFoul={addFoulRight}
                    dec={decRight}
                  />
                </div>
              </div>

              {/* Chiudi always at the bottom on mobile only */}
              <div className="px-3 py-3 border-t border-border lg:hidden">
                <button
                  onClick={() => handleClose(false)}
                  className="w-full inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground ring-offset-background transition-colors hover:bg-secondary/80"
                >
                  Chiudi
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma risultato</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{winnerName}</span> vince il match M{matchNumber} con il punteggio di <span className="font-mono font-bold text-foreground">{p1Score} - {p2Score}</span>. Confermare?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
