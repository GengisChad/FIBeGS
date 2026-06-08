import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export interface ScoreMessage {
  matchId: string;
  p1Score: number;
  p2Score: number;
  p1Fouls: number;
  p2Fouls: number;
  p1Name: string;
  p2Name: string;
  p1Avatar?: string | null;
  p2Avatar?: string | null;
}

export const SCORE_BROADCAST_CHANNEL = "match-live-scores";
export const STREAMING_HEARTBEAT_CHANNEL = "streaming-dashboard-heartbeat";

export function broadcastScore(data: ScoreMessage) {
  try {
    const bc = new BroadcastChannel(SCORE_BROADCAST_CHANNEL);
    bc.postMessage(data);
    bc.close();
  } catch {}
}

/* ── Dashboard-side signaling manager ── */
export class DashboardStreamManager {
  private channel: any;
  private peers = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private tournamentId: string;
  private destroyed = false;

  onStream: ((matchId: string, stream: MediaStream) => void) | null = null;
  onScore: ((data: ScoreMessage) => void) | null = null;
  onPeerState: ((matchId: string, state: string) => void) | null = null;

  constructor(tournamentId: string) {
    this.tournamentId = tournamentId;
  }

  async start() {
    this.channel = supabase.channel(`stream-${this.tournamentId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel.on("broadcast", { event: "sig" }, async ({ payload: p }: any) => {
      if (this.destroyed || p.role === "dashboard") return;
      try {
        if (p.type === "offer") await this.handleOffer(p.matchId, p.sdp);
        if (p.type === "ice") await this.handleIce(p.matchId, p.candidate);
      } catch (err) {
        console.error("[Dashboard] signaling error:", err);
      }
    });

    await this.channel.subscribe();
  }

  private async handleOffer(matchId: string, sdp: RTCSessionDescriptionInit) {
    // Close previous peer for this match
    const existing = this.peers.get(matchId);
    if (existing) { try { existing.close(); } catch {} }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peers.set(matchId, pc);
    this.pendingIce.set(matchId, []);

    const remoteStream = new MediaStream();
    this.remoteStreams.set(matchId, remoteStream);

    // Track handler - fire onStream on every track add
    pc.ontrack = (e) => {
      console.log("[Dashboard] ontrack", matchId, e.track.kind);
      e.streams?.[0]?.getTracks().forEach((t) => {
        if (!remoteStream.getTrackById(t.id)) remoteStream.addTrack(t);
      });
      if (e.track && !remoteStream.getTrackById(e.track.id)) {
        remoteStream.addTrack(e.track);
      }
      // Always fire to ensure UI picks it up
      this.onStream?.(matchId, remoteStream);
    };

    pc.ondatachannel = (e) => {
      e.channel.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed.type === "score") this.onScore?.(parsed.data);
        } catch {}
      };
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal("ice", matchId, { candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("[Dashboard] peer state", matchId, state);
      this.onPeerState?.(matchId, state);
      if (state === "connected") {
        // Re-fire stream in case tracks arrived before connection
        const stream = this.remoteStreams.get(matchId);
        if (stream && stream.getTracks().length > 0) {
          this.onStream?.(matchId, stream);
        }
      }
      if (["failed", "closed"].includes(state)) {
        this.peers.delete(matchId);
        this.remoteStreams.delete(matchId);
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Flush pending ICE
    const pending = this.pendingIce.get(matchId) ?? [];
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    this.pendingIce.set(matchId, []);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendSignal("answer", matchId, { sdp: answer });
  }

  private async handleIce(matchId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peers.get(matchId);
    if (pc && pc.remoteDescription) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    } else {
      // Buffer ICE candidates until remote description is set
      const pending = this.pendingIce.get(matchId) ?? [];
      pending.push(candidate);
      this.pendingIce.set(matchId, pending);
    }
  }

  private sendSignal(type: string, matchId: string, payload: any) {
    this.channel?.send({
      type: "broadcast",
      event: "sig",
      payload: { type, matchId, role: "dashboard", ...payload },
    });
  }

  disconnectMatch(matchId: string) {
    const pc = this.peers.get(matchId);
    if (pc) { try { pc.close(); } catch {} this.peers.delete(matchId); }
    this.remoteStreams.delete(matchId);
  }

  destroy() {
    this.destroyed = true;
    this.peers.forEach((pc) => { try { pc.close(); } catch {} });
    this.peers.clear();
    this.remoteStreams.clear();
    this.pendingIce.clear();
    this.channel?.unsubscribe();
  }
}

/* ── Sender-side (referee VAR bridge) ── */
export const WEBRTC_BITRATE_STORAGE_KEY = "var-webrtc-max-bitrate";
export const WEBRTC_BITRATE_EVENT = "var-webrtc-bitrate-change";
export const DEFAULT_WEBRTC_MAX_BITRATE = 16_000_000;

const readStoredBitrate = (): number => {
  try {
    const raw = localStorage.getItem(WEBRTC_BITRATE_STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= 500_000 && n <= 50_000_000) return n;
  } catch {}
  return DEFAULT_WEBRTC_MAX_BITRATE;
};

export class SenderStreamPeer {
  private pc!: RTCPeerConnection;
  private dc!: RTCDataChannel;
  private channel: any;
  private retryTimer: number | null = null;
  private tournamentId: string;
  private matchId: string;
  private stream: MediaStream | null = null;
  private connected = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private latestScore: ScoreMessage | null = null;
  private destroyed = false;
  private maxBitrate = readStoredBitrate();
  private bitrateListener = (e: Event) => {
    const detail = (e as CustomEvent<number>).detail;
    if (typeof detail === "number") this.setMaxBitrate(detail);
  };

  onState: ((state: string) => void) | null = null;

  constructor(tournamentId: string, matchId: string) {
    this.tournamentId = tournamentId;
    this.matchId = matchId;
    if (typeof window !== "undefined") {
      window.addEventListener(WEBRTC_BITRATE_EVENT, this.bitrateListener as EventListener);
    }
  }

  addStream(stream: MediaStream) {
    this.stream = stream;
  }

  /** Replace the active video track (used for replay) */
  replaceVideoTrack(track: MediaStreamTrack) {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    const videoSender = senders.find((s) => s.track?.kind === "video");
    if (videoSender) {
      videoSender.replaceTrack(track).catch(() => {});
    }
  }

  /** Replace the active audio track (used for replay) */
  replaceAudioTrack(track: MediaStreamTrack | null) {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    const audioSender = senders.find((s) => s.track?.kind === "audio");
    if (audioSender) {
      audioSender.replaceTrack(track).catch(() => {});
    }
  }

  sendScore(data: ScoreMessage) {
    this.latestScore = data;
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify({ type: "score", data }));
    }
  }

  /** Update max video bitrate (bps) on the active sender, if any. */
  setMaxBitrate(bitrate: number) {
    this.maxBitrate = bitrate;
    try { localStorage.setItem(WEBRTC_BITRATE_STORAGE_KEY, String(bitrate)); } catch {}
    if (!this.pc) return;
    const videoSender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    if (videoSender) this.applyBitrateToSender(videoSender);
  }

  private applyBitrateToSender(sender: RTCRtpSender) {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = this.maxBitrate;
      params.encodings[0].maxFramerate = 60;
      sender.setParameters(params).catch((e) =>
        console.warn("[Sender] setParameters failed:", e),
      );
    } catch (e) {
      console.warn("[Sender] could not set video bitrate:", e);
    }
  }

  private clearRetry() {
    if (this.retryTimer) { window.clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  private scheduleRetry(delay = 3000) {
    if (this.destroyed) return;
    this.clearRetry();
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      if (!this.destroyed) void this.sendOffer();
    }, delay);
  }

  private flushLatestScore() {
    if (this.latestScore && this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify({ type: "score", data: this.latestScore }));
    }
  }

  private createPeerConnection() {
    if (this.pc) { try { this.pc.close(); } catch {} }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.dc = pc.createDataChannel("scores");
    this.dc.onopen = () => this.flushLatestScore();
    this.pendingCandidates = [];

    if (this.stream) {
      this.stream.getTracks().forEach((t) => {
        const sender = pc.addTrack(t, this.stream!);
        if (t.kind === "video") {
          this.applyBitrateToSender(sender);
        }
      });
    }

    pc.onicecandidate = (e) => {
      if (this.pc !== pc || this.destroyed) return;
      if (e.candidate) {
        this.channel?.send({
          type: "broadcast",
          event: "sig",
          payload: { type: "ice", matchId: this.matchId, role: "sender", candidate: e.candidate.toJSON() },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.pc !== pc || this.destroyed) return;
      const state = pc.connectionState;
      console.log("[Sender] peer state", state);
      this.onState?.(state);
      if (state === "connected") {
        this.connected = true;
        this.clearRetry();
        this.flushLatestScore();
      }
      if (state === "failed" || state === "disconnected") {
        this.connected = false;
        this.scheduleRetry();
      }
      if (state === "closed") {
        this.connected = false;
      }
    };

    this.pc = pc;
    return pc;
  }

  private async sendOffer() {
    if (this.connected || this.destroyed) return;
    try {
      this.createPeerConnection();
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.channel?.send({
        type: "broadcast",
        event: "sig",
        payload: { type: "offer", matchId: this.matchId, role: "sender", sdp: offer },
      });
      console.log("[Sender] offer sent for", this.matchId);
    } catch (err) {
      console.error("[Sender] offer error:", err);
      this.scheduleRetry(5000);
    }
  }

  async start() {
    this.channel = supabase.channel(`stream-${this.tournamentId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel.on("broadcast", { event: "sig" }, async ({ payload: p }: any) => {
      if (this.destroyed || p.role === "sender" || p.matchId !== this.matchId) return;
      try {
        if (p.type === "answer") {
          if (this.pc.signalingState === "have-local-offer") {
            await this.pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
            for (const c of this.pendingCandidates) {
              await this.pc.addIceCandidate(new RTCIceCandidate(c));
            }
            this.pendingCandidates = [];
          }
        }
        if (p.type === "ice") {
          if (this.pc.remoteDescription) {
            await this.pc.addIceCandidate(new RTCIceCandidate(p.candidate));
          } else {
            this.pendingCandidates.push(p.candidate);
          }
        }
      } catch (err) {
        console.error("[Sender] signaling error:", err);
      }
    });

    await this.channel.subscribe();
    await this.sendOffer();
  }

  destroy() {
    this.destroyed = true;
    this.clearRetry();
    if (typeof window !== "undefined") {
      window.removeEventListener(WEBRTC_BITRATE_EVENT, this.bitrateListener as EventListener);
    }
    try { this.dc?.close(); } catch {}
    try { this.pc?.close(); } catch {}
    this.channel?.unsubscribe();
  }
}
