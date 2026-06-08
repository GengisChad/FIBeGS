/**
 * WebCodecs-based video recorder for high-fps capture on Chrome Android.
 *
 * Bypasses MediaRecorder (which uses software encoder + aggressive compression
 * on mobile) by encoding frames directly with VideoEncoder + hardware acceleration
 * and muxing to MP4 in-browser.
 *
 * Falls back gracefully when WebCodecs / mp4-muxer is unavailable.
 */

export interface WebCodecsRecorderOptions {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
  codec?: string; // default: avc1.640033 (H.264 High@5.1)
  audioBitrate?: number; // bps, default 128_000
}

export const isWebCodecsSupported = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    "VideoEncoder" in window &&
    "VideoFrame" in window &&
    "MediaStreamTrackProcessor" in window
  );
};

const isAudioEncoderSupported = (): boolean => {
  if (typeof window === "undefined") return false;
  return "AudioEncoder" in window && "AudioData" in window && "MediaStreamTrackProcessor" in window;
};

export const probeHardwareEncoder = async (
  width: number,
  height: number,
  frameRate: number,
  bitrate: number,
): Promise<string | null> => {
  if (!isWebCodecsSupported()) return null;
  const candidates = [
    "avc1.640033", // H.264 High@5.1
    "avc1.640028", // H.264 High@4.0
    "avc1.42E01E", // H.264 Baseline (last resort)
  ];
  for (const codec of candidates) {
    try {
      const support = await (VideoEncoder as any).isConfigSupported({
        codec,
        width,
        height,
        bitrate,
        framerate: frameRate,
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "avc" },
      });
      if (support?.supported) return codec;
    } catch {
      /* try next */
    }
  }
  return null;
};

export class WebCodecsRecorder {
  private encoder: VideoEncoder | null = null;
  private audioEncoder: any = null;
  private muxer: any = null;
  private processor: any = null;
  private audioProcessor: any = null;
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private audioReader: any = null;
  private readonly opts: WebCodecsRecorderOptions;
  private frameCount = 0;
  private startTime = 0;
  private stopped = false;
  private audioConfigured = false;

  constructor(opts: WebCodecsRecorderOptions) {
    this.opts = opts;
  }

  /**
   * Start encoding. If `audioTrack` is provided AND AudioEncoder is supported,
   * AAC audio will be muxed alongside the H.264 video.
   */
  async start(track: MediaStreamTrack, audioTrack?: MediaStreamTrack | null): Promise<void> {
    if (!isWebCodecsSupported()) {
      throw new Error("WebCodecs not supported on this browser");
    }

    // Lazy-load mp4-muxer (small ~50KB)
    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

    const codec = this.opts.codec || (await probeHardwareEncoder(
      this.opts.width, this.opts.height, this.opts.frameRate, this.opts.bitrate,
    )) || "avc1.640028";

    // Sniff audio params from the track BEFORE building the muxer so we can declare audio.
    let audioSampleRate = 48000;
    let audioChannels = 1;
    let includeAudio = false;
    if (audioTrack && isAudioEncoderSupported()) {
      try {
        const s = audioTrack.getSettings?.() ?? {};
        if (typeof (s as any).sampleRate === "number") audioSampleRate = (s as any).sampleRate;
        if (typeof (s as any).channelCount === "number") audioChannels = (s as any).channelCount;
        includeAudio = true;
      } catch {
        includeAudio = false;
      }
    }

    const target = new ArrayBufferTarget();
    const muxerConfig: any = {
      target,
      video: {
        codec: codec.startsWith("avc1") ? "avc" : "hevc",
        width: this.opts.width,
        height: this.opts.height,
        frameRate: this.opts.frameRate,
      },
      fastStart: "in-memory",
      // VideoFrame timestamps from MediaStreamTrackProcessor are relative to the
      // document's age, not the recording start. Without this offset, mp4-muxer
      // throws "first chunk must have timestamp of 0" and recording fails.
      firstTimestampBehavior: "offset",
    };
    if (includeAudio) {
      muxerConfig.audio = {
        codec: "aac",
        numberOfChannels: audioChannels,
        sampleRate: audioSampleRate,
      };
    }
    this.muxer = new Muxer(muxerConfig);

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        this.muxer?.addVideoChunk(chunk, meta);
      },
      error: (e) => console.error("[WebCodecs] encoder error:", e),
    });

    this.encoder.configure({
      codec,
      width: this.opts.width,
      height: this.opts.height,
      bitrate: this.opts.bitrate,
      framerate: this.opts.frameRate,
      hardwareAcceleration: "prefer-hardware",
      latencyMode: "realtime",
      avc: { format: "avc" },
    } as VideoEncoderConfig);

    // @ts-ignore - MediaStreamTrackProcessor is not in lib.dom yet
    this.processor = new MediaStreamTrackProcessor({ track });
    this.reader = this.processor.readable.getReader();

    this.startTime = performance.now();
    this.frameCount = 0;
    this.stopped = false;

    // --- Audio path ---
    if (includeAudio && audioTrack) {
      try {
        await this.startAudio(audioTrack, audioSampleRate, audioChannels);
      } catch (err) {
        console.warn("[WebCodecs] audio path failed, continuing video-only:", err);
        this.audioConfigured = false;
      }
    }

    void this.pumpFrames();
  }

  private async startAudio(track: MediaStreamTrack, sampleRate: number, channels: number): Promise<void> {
    const AudioEncoderCtor: any = (window as any).AudioEncoder;
    const bitrate = this.opts.audioBitrate ?? 128_000;

    this.audioEncoder = new AudioEncoderCtor({
      output: (chunk: any, meta: any) => {
        this.muxer?.addAudioChunk(chunk, meta);
      },
      error: (e: any) => console.error("[WebCodecs] audio encoder error:", e),
    });

    this.audioEncoder.configure({
      codec: "mp4a.40.2", // AAC-LC
      sampleRate,
      numberOfChannels: channels,
      bitrate,
    });

    // @ts-ignore - MediaStreamTrackProcessor not in lib.dom
    this.audioProcessor = new MediaStreamTrackProcessor({ track });
    this.audioReader = this.audioProcessor.readable.getReader();
    this.audioConfigured = true;

    void this.pumpAudio();
  }

  private async pumpAudio(): Promise<void> {
    while (!this.stopped && this.audioReader && this.audioEncoder) {
      try {
        const { done, value } = await this.audioReader.read();
        if (done || !value) break;
        try {
          this.audioEncoder.encode(value);
        } catch (err) {
          console.warn("[WebCodecs] audio encode failed:", err);
        } finally {
          try { value.close(); } catch {}
        }
      } catch {
        break;
      }
    }
  }

  private async pumpFrames(): Promise<void> {
    const keyFrameInterval = Math.max(1, this.opts.frameRate * 2); // every ~2s
    while (!this.stopped && this.reader && this.encoder) {
      const { done, value: frame } = await this.reader.read();
      if (done || !frame) break;
      try {
        const insertKeyframe = this.frameCount % keyFrameInterval === 0;
        this.encoder.encode(frame, { keyFrame: insertKeyframe });
        this.frameCount++;
      } catch (err) {
        console.warn("[WebCodecs] encode failed:", err);
      } finally {
        frame.close();
      }
    }
  }

  /** Stop and return the muxed MP4 as a Blob. */
  async stop(): Promise<Blob> {
    this.stopped = true;
    try { await this.reader?.cancel(); } catch {}
    try { await this.audioReader?.cancel(); } catch {}
    if (this.encoder && this.encoder.state !== "closed") {
      try { await this.encoder.flush(); } catch {}
      try { this.encoder.close(); } catch {}
    }
    if (this.audioEncoder && this.audioEncoder.state !== "closed") {
      try { await this.audioEncoder.flush(); } catch {}
      try { this.audioEncoder.close(); } catch {}
    }
    this.muxer?.finalize();
    const buffer = this.muxer?.target?.buffer;
    return new Blob([buffer], { type: "video/mp4" });
  }
}
