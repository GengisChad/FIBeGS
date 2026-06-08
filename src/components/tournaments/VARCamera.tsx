import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  VideoOff,
  Circle,
  Square,
  Play,
  Pause,
  SkipBack,
  Download,
  ChevronDown,
  ChevronUp,
  Settings,
  Camera,
  X,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  Sun,
  Focus,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import VARNativeCamera, { type VARCameraInfo, type VARCameraCapabilities } from "@/plugins/VARNativeCamera";
import { WebCodecsRecorder, isWebCodecsSupported, probeHardwareEncoder } from "@/lib/webCodecsRecorder";
import { ReplayLandscapeOverlay } from "./ReplayLandscapeOverlay";
import { useVarLandscapeOverride } from "@/hooks/useVarLandscapeOverride";

interface VARCameraProps {
  matchLabel: string;
  onStreamReady?: (stream: MediaStream | null) => void;
  /** Landscape fullscreen mode: video full-bleed, vertical floating controls on the right. */
  landscapeMode?: boolean;
  /** Slot rendered as a floating button in the right control bar (used for the score popover trigger). */
  rightBarSlot?: React.ReactNode;
}

interface LocalCapabilities {
  resolutions: { label: string; width: number; height: number }[];
  frameRates: number[];
}

interface VideoDevice {
  deviceId: string;
  label: string;
}

const COMMON_RESOLUTIONS = [
  { label: "4K", width: 3840, height: 2160 },
  { label: "1440p", width: 2560, height: 1440 },
  { label: "1080p", width: 1920, height: 1080 },
  { label: "720p", width: 1280, height: 720 },
  { label: "480p", width: 640, height: 480 },
  { label: "360p", width: 480, height: 360 },
];

const COMMON_FRAMERATES = [240, 120, 60, 30, 24, 15];

const VAR_BUILD_VERSION = "2026-03-18-v2";
const STORAGE_KEY = "var-camera-settings";
const VAR_DISABLED_KEY = "var-camera-disabled";

const loadVarDisabled = (): boolean => {
  try { return localStorage.getItem(VAR_DISABLED_KEY) === "1"; } catch { return false; }
};
const persistVarDisabled = (disabled: boolean) => {
  try {
    if (disabled) localStorage.setItem(VAR_DISABLED_KEY, "1");
    else localStorage.removeItem(VAR_DISABLED_KEY);
  } catch {}
};

interface SavedCameraSettings {
  resolution?: string;
  frameRate?: string;
  deviceId?: string;
  nativeCameraId?: string;
}

const loadSavedSettings = (): SavedCameraSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const persistSettings = (settings: Partial<SavedCameraSettings>) => {
  try {
    const current = loadSavedSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
  } catch {}
};

const computeBitrate = (width: number, height: number, fps: number): number => {
  // Broadcast-quality targets, scaled higher for high-fps motion content (VAR replays).
  // At >=60fps we bump bits/pixel because software encoders (browser MediaRecorder)
  // over-compress fast motion otherwise → looks like fps is being dropped.
  //  720p60 ~12 Mbps  | 1080p60 ~28 Mbps | 1440p60 ~50 Mbps | 4K60 ~110 Mbps (capped)
  const bpp = fps >= 60 ? 0.13 : fps >= 48 ? 0.11 : 0.10;
  const computed = width * height * fps * bpp;
  return Math.max(6_000_000, Math.min(computed, 100_000_000));
};

const isNative = () => Capacitor.isNativePlatform();

export const VARCamera = ({ matchLabel, onStreamReady, landscapeMode = false, rightBarSlot }: VARCameraProps) => {
  const [expanded, setExpanded] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [varDisabled, setVarDisabled] = useState<boolean>(loadVarDisabled);
  const [recording, setRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [lastNativeError, setLastNativeError] = useState<string | null>(null);

  // Modalità VAR manuale: verticale/orizzontale, senza auto-switch dalla rotazione del telefono.
  const { forced: forceLandscape, toggle: toggleForceLandscape } = useVarLandscapeOverride();
  const [needsCssRotate, setNeedsCssRotate] = useState(false);

  // Gestione lock landscape (best-effort: Screen Orientation API + fallback CSS rotate)
  useEffect(() => {
    if (!forceLandscape) {
      try { (screen.orientation as any)?.unlock?.(); } catch {}
      setNeedsCssRotate(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await (screen.orientation as any)?.lock?.("landscape");
        if (!cancelled) setNeedsCssRotate(false);
      } catch {
        // Lock non disponibile (es. iOS PWA o blocco rotazione sistema): fallback CSS
        if (!cancelled) {
          const portrait = window.innerHeight > window.innerWidth;
          setNeedsCssRotate(portrait);
        }
      }
    })();
    const onResize = () => {
      if ((screen.orientation as any)?.type?.startsWith?.("landscape")) {
        setNeedsCssRotate(false);
      } else {
        setNeedsCssRotate(window.innerHeight > window.innerWidth);
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      try { (screen.orientation as any)?.unlock?.(); } catch {}
    };
  }, [forceLandscape]);

  // Settings
  const [capabilities, setCapabilities] = useState<LocalCapabilities>({ resolutions: [], frameRates: [] });
  const [selectedResolution, setSelectedResolution] = useState<string>("");
  const [selectedFrameRate, setSelectedFrameRate] = useState<string>("");
  const [currentResLabel, setCurrentResLabel] = useState("");
  const [currentFps, setCurrentFps] = useState(0);

  // Device selection (web only)
  const [videoDevices, setVideoDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Native-specific state
  const [nativeVideoUrl, setNativeVideoUrl] = useState<string | null>(null);
  const [nativeCameraFacing, setNativeCameraFacing] = useState<"rear" | "front">("rear");
  const [cameraBackend, setCameraBackend] = useState<"native" | "webrtc" | null>(null);
  const usingNativeBackend = isNative() && cameraBackend === "native";
  const usingWebRtcBackend = cameraBackend === "webrtc" || (!isNative() && cameraBackend !== "native");

  // Native advanced controls
  const [nativeCameras, setNativeCameras] = useState<VARCameraInfo[]>([]);
  const [selectedNativeCameraId, setSelectedNativeCameraId] = useState<string>("");
  const [nativeZoom, setNativeZoom] = useState(1.0);
  const [nativeMaxZoom, setNativeMaxZoom] = useState(1.0);
  const [nativeTorch, setNativeTorch] = useState(false);
  const [nativeHasFlash, setNativeHasFlash] = useState(false);
  const [nativeExposure, setNativeExposure] = useState(0);
  const [nativeExposureMin, setNativeExposureMin] = useState(0);
  const [nativeExposureMax, setNativeExposureMax] = useState(0);
  const [nativeSupportsTapFocus, setNativeSupportsTapFocus] = useState(false);

  // WebRTC (web) advanced controls — populated from MediaStreamTrack capabilities
  const [webZoomMin, setWebZoomMin] = useState(1);
  const [webZoomMax, setWebZoomMax] = useState(1);
  const [webZoomStep, setWebZoomStep] = useState(0.1);
  const [webZoom, setWebZoom] = useState(1);
  const [webExposureMin, setWebExposureMin] = useState(0);
  const [webExposureMax, setWebExposureMax] = useState(0);
  const [webExposureStep, setWebExposureStep] = useState(1);
  const [webExposure, setWebExposure] = useState(0);
  const [webSupportsFocusPoint, setWebSupportsFocusPoint] = useState(false);
  const [webBitrate, setWebBitrate] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("var-webrtc-max-bitrate");
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n)) return n;
    } catch {}
    return 16_000_000;
  });

  // Tap to focus indicator
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  // Debug log for diagnosing native camera issues
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const addDebug = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev.slice(-30), `[${ts}] ${msg}`]);
    console.log(`VAR-DBG: ${msg}`);
  }, []);

  const withTimeout = useCallback(async <T,>(promise: Promise<T>, label: string, ms = 10000): Promise<T> => {
    let timeoutId: number | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error(`${label} timeout dopo ${Math.round(ms / 1000)}s`));
          }, ms);
        }),
      ]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const webCodecsRecorderRef = useRef<WebCodecsRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobUrlRef = useRef<string | null>(null);
  const recordingExtRef = useRef<string>("mp4");
  const recordingStartTimeRef = useRef<number>(0);
  const nativePreviewContainerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameRef = useRef<string>("");

  // Auto-start camera when expanded (skipped if user disabled VAR)
  useEffect(() => {
    if (expanded && !cameraActive && !reviewing && !varDisabled) {
      addDebug(`Auto-start: isNative=${isNative()}, platform=${Capacitor.getPlatform()}`);
      const timer = setTimeout(() => {
        startCamera();
      }, isNative() ? 300 : 50);
      return () => clearTimeout(timer);
    }
  }, [expanded, varDisabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle persistent VAR disable
  const enableVar = useCallback(() => {
    setVarDisabled(false);
    persistVarDisabled(false);
  }, []);
  const disableVar = useCallback(() => {
    setVarDisabled(true);
    persistVarDisabled(true);
    // also stop any running camera
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    onStreamReady?.(null);
    setCameraActive(false);
  }, [onStreamReady]);

  useEffect(() => {
    return () => {
      if (usingNativeBackend) {
        VARNativeCamera.destroy().catch(() => {});
      } else {
        stopCamera();
      }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // ─── Release microphone & camera when the app/page is hidden ───
  // Su Android (WebView + Chrome) e iOS PWA, se l'utente abbassa l'app o
  // cambia tab, le tracce di getUserMedia restano "live" e bloccano il
  // microfono per altre app (fotocamera nativa, WhatsApp, ecc.).
  // Forziamo lo stop di tutte le tracce quando la pagina è nascosta.
  const releaseMediaRef = useRef<() => void>(() => {});
  useEffect(() => {
    releaseMediaRef.current = () => {
      try {
        // Se è in corso una registrazione, fermala prima così il blob viene salvato.
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          try { recorderRef.current.stop(); } catch {}
        }
        // Stoppa esplicitamente TUTTE le tracce (audio + video) per liberare il mic.
        streamRef.current?.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        if (usingNativeBackend) {
          VARNativeCamera.destroy().catch(() => {});
        }
        onStreamReady?.(null);
        setCameraActive(false);
        setRecording(false);
      } catch {}
    };
  }, [usingNativeBackend, onStreamReady]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        releaseMediaRef.current?.();
      }
    };
    const onPageHide = () => releaseMediaRef.current?.();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, []);

  // Su Capacitor (Android nativo) reagisci anche all'evento di pausa dell'app
  useEffect(() => {
    if (!isNative()) return;
    let remove: (() => void) | null = null;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) releaseMediaRef.current?.();
        });
        remove = () => { try { handle.remove(); } catch {} };
      } catch {}
    })();
    return () => { remove?.(); };
  }, []);

  // ─── NATIVE helpers ───

  const getNativeFrameConfig = useCallback(() => {
    const container = nativePreviewContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      borderRadius: 8,
    };
  }, []);

  // RAF-based frame tracking for native preview - much more reliable than scroll events
  useEffect(() => {
    if (!usingNativeBackend || !cameraActive || reviewing) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    const tick = () => {
      const frame = getNativeFrameConfig();
      if (frame) {
        const key = `${frame.x},${frame.y},${frame.width},${frame.height}`;
        if (key !== lastFrameRef.current) {
          lastFrameRef.current = key;
          VARNativeCamera.updateFrame(frame).catch(() => {});
        }
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [cameraActive, reviewing, getNativeFrameConfig, usingNativeBackend]);

  const fetchNativeCapabilities = useCallback(async () => {
    try {
      addDebug("getCapabilities() chiamato...");
      const caps = await withTimeout(VARNativeCamera.getCapabilities(), "getCapabilities", 4000);
      addDebug(`getCapabilities OK: maxZoom=${caps.maxZoom}, flash=${caps.hasFlash}, expMin=${caps.exposureCompensationMin}, expMax=${caps.exposureCompensationMax}, tapFocus=${caps.supportsTapFocus}, camId=${caps.currentCameraId}, resolutions=${(caps.resolutions||[]).length}`);

      const nativeRes = (caps.resolutions || [])
        .map((r: any) => ({ width: r.width, height: r.height, label: r.label || `${r.width}x${r.height}` }));
      const hwFps = (caps.supportedFps || [60, 30]) as number[];

      setCapabilities({
        resolutions: nativeRes.length > 0 ? nativeRes : [
          { label: "1080p", width: 1920, height: 1080 },
          { label: "720p", width: 1280, height: 720 },
        ],
        frameRates: hwFps.length > 0 ? hwFps : [60, 30],
      });

      setNativeMaxZoom(caps.maxZoom || 1);
      setNativeZoom(caps.currentZoom || 1);
      setNativeHasFlash(caps.hasFlash || false);
      setNativeTorch(caps.torchOn || false);
      setNativeExposureMin(caps.exposureCompensationMin || 0);
      setNativeExposureMax(caps.exposureCompensationMax || 0);
      setNativeExposure(caps.exposureCompensation || 0);
      setNativeSupportsTapFocus(caps.supportsTapFocus || false);
      if (caps.currentCameraId) setSelectedNativeCameraId(caps.currentCameraId);
    } catch (capErr: any) {
      addDebug(`getCapabilities ERRORE: ${capErr?.message || capErr}`);
      setCapabilities({
        resolutions: COMMON_RESOLUTIONS.slice(2, 5),
        frameRates: [60, 30],
      });
    }
  }, [addDebug, withTimeout]);

  const fetchNativeCameraList = useCallback(async () => {
    try {
      addDebug("listCameras() chiamato...");
      const result = await withTimeout(VARNativeCamera.listCameras(), "listCameras", 4000);
      const cams = result.cameras || [];
      addDebug(`listCameras OK: ${cams.length} moduli trovati: ${cams.map(c => `${c.id}(${c.facing}/${c.lensType})`).join(", ")}`);
      setNativeCameras(cams);
    } catch (err: any) {
      addDebug(`listCameras ERRORE: ${err?.message || err}`);
    }
  }, [addDebug, withTimeout]);

  const startCameraNative = useCallback(async () => {
    try {
      setLastNativeError(null);
      const saved = loadSavedSettings();
      const fps = saved.frameRate ? parseInt(saved.frameRate, 10) : 60;
      const resKey = saved.resolution || "1920x1080";
      const [wStr, hStr] = resKey.split("x");
      const w = parseInt(wStr, 10);
      const h = parseInt(hStr, 10);

      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const frame = getNativeFrameConfig() || {
        x: 8, y: 80, width: 300, height: 225, borderRadius: 8,
      };

      const initOptions: any = {
        camera: nativeCameraFacing === "front" ? "front" : "back",
        frame,
        width: w,
        height: h,
        fps,
      };

      if (saved.nativeCameraId) {
        initOptions.cameraId = saved.nativeCameraId;
      }

      addDebug(`initialize() ${w}x${h}@${fps}fps facing=${initOptions.camera} cameraId=${saved.nativeCameraId || "auto"} frame=${JSON.stringify(frame)}`);
      await withTimeout(VARNativeCamera.initialize(initOptions), "initialize", 12000);
      addDebug("initialize() OK — camera aperta con successo");

      setCameraActive(true);
      setCameraBackend("native");
      setCurrentFps(fps);
      setSelectedResolution(resKey);
      setSelectedFrameRate(String(fps));
      const matched = COMMON_RESOLUTIONS.find(r => `${r.width}x${r.height}` === resKey);
      setCurrentResLabel(matched?.label || resKey);

      await new Promise(r => setTimeout(r, 500));

      const fetchAll = async () => {
        addDebug("Caricamento capabilities e lista camere...");
        await Promise.all([fetchNativeCapabilities(), fetchNativeCameraList()]);
      };
      try {
        await fetchAll();
        addDebug("Post-init fetch completato");
      } catch (capErr: any) {
        addDebug(`Post-init fetch tentativo 1 ERRORE: ${capErr?.message || capErr} — ritento...`);
        await new Promise(r => setTimeout(r, 800));
        try {
          await fetchAll();
          addDebug("Post-init fetch (retry) completato");
        } catch (retryErr: any) {
          addDebug(`Post-init fetch (retry) ERRORE: ${retryErr?.message || retryErr}`);
        }
      }
    } catch (err: any) {
      const nativeMessage = err?.message || String(err);
      setLastNativeError(nativeMessage);

      if (isNative()) {
        addDebug(`initialize() ERRORE: ${nativeMessage}. Blocco fallback WebRTC su Android nativo.`);
        setCameraBackend(null);
        setCameraActive(false);
        return;
      }

      addDebug(`initialize() ERRORE: ${nativeMessage}. Fallback WebRTC...`);
      try {
        addDebug("Tentativo fallback WebRTC...");
        const saved = loadSavedSettings();
        const resKey = saved.resolution || "1920x1080";
        const fps = saved.frameRate ? parseInt(saved.frameRate, 10) : 30;
        const [wStr, hStr] = resKey.split("x");
        const w = parseInt(wStr, 10);
        const h = parseInt(hStr, 10);

        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevices = devices.filter(d => d.kind === "videoinput")
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        if (vDevices.length > 0) setVideoDevices(vDevices);
        addDebug(`WebRTC: ${vDevices.length} dispositivi video trovati`);

        const fallbacks: MediaStreamConstraints[] = [
          { video: { facingMode: "environment", width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: fps } }, audio: true },
          { video: { facingMode: "environment" }, audio: true },
          { video: true, audio: true },
          { video: { facingMode: "environment" }, audio: false },
          { video: true, audio: false },
        ];

        let stream: MediaStream | null = null;
        for (const c of fallbacks) {
          try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch { continue; }
        }
        if (!stream) throw new Error("All getUserMedia fallbacks failed");

        addDebug("WebRTC stream ottenuto");
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        } else {
          addDebug("ATTENZIONE: videoRef.current è null - il video non sarà visibile nel path nativo!");
        }
        setLastNativeError(null);
        setCameraBackend("webrtc");
        setCameraActive(true);
        setCurrentFps(fps);
        const matched2 = COMMON_RESOLUTIONS.find(r => `${r.width}x${r.height}` === resKey);
        setCurrentResLabel(matched2?.label || resKey);
        setSelectedResolution(resKey);
        setSelectedFrameRate(String(fps));

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          const capabilitiesApi = typeof videoTrack.getCapabilities === "function" ? videoTrack.getCapabilities() : null;
          const supportedResolutions: { label: string; width: number; height: number }[] = [];
          const maxW = capabilitiesApi?.width ? (capabilitiesApi.width as any).max : settings.width || 1920;
          const maxH = capabilitiesApi?.height ? (capabilitiesApi.height as any).max : settings.height || 1080;
          for (const res of COMMON_RESOLUTIONS) {
            if (res.width <= maxW && res.height <= maxH) supportedResolutions.push(res);
          }
          if (supportedResolutions.length === 0) supportedResolutions.push({ label: "Default", width: settings.width || 640, height: settings.height || 480 });

          let maxHwFps = 30;
          if (capabilitiesApi && (capabilitiesApi as any).frameRate) {
            maxHwFps = (capabilitiesApi as any).frameRate.max || 30;
          }
          const supportedFrameRates = COMMON_FRAMERATES.filter(f => f <= Math.ceil(maxHwFps));
          if (supportedFrameRates.length === 0) supportedFrameRates.push(30);
          setCapabilities({ resolutions: supportedResolutions, frameRates: supportedFrameRates });
          if (settings.deviceId) setSelectedDeviceId(settings.deviceId);
        }
      } catch (webErr: any) {
        const webMessage = webErr?.message || String(webErr);
        addDebug(`WebRTC fallback ERRORE: ${webMessage}`);
        setLastNativeError(webMessage);
        setCameraBackend(null);
        setCameraActive(false);
      }
    }
  }, [nativeCameraFacing, getNativeFrameConfig, fetchNativeCapabilities, fetchNativeCameraList, addDebug, withTimeout]);

  const stopCameraNative = useCallback(async () => {
    try { await VARNativeCamera.destroy(); } catch {}
    onStreamReady?.(null);
    setCameraActive(false);
    setCameraBackend(null);
    setRecording(false);
    setShowSettings(false);
    setNativeTorch(false);
    setNativeZoom(1.0);
  }, [onStreamReady]);

  const startRecordingNative = useCallback(async () => {
    try {
      await VARNativeCamera.startRecording();
      setRecording(true);
      setHasRecording(false);
      setReviewing(false);
    } catch (err) {
      console.error("Native recording start failed:", err);
    }
  }, []);

  const stopRecordingNative = useCallback(async () => {
    try {
      const result = await VARNativeCamera.stopRecording();
      if (result?.videoUrl) {
        setNativeVideoUrl(Capacitor.convertFileSrc(result.videoUrl));
        setHasRecording(true);
      }
    } catch (err) {
      console.error("Native recording stop failed:", err);
    }
    setRecording(false);
  }, []);

  const flipCameraNative = useCallback(async () => {
    try {
      const newFacing = nativeCameraFacing === "rear" ? "front" : "rear";
      await VARNativeCamera.destroy();

      const saved = loadSavedSettings();
      const fps = saved.frameRate ? parseInt(saved.frameRate, 10) : 60;
      const resKey = saved.resolution || "1920x1080";
      const [wStr, hStr] = resKey.split("x");

      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const frame = getNativeFrameConfig() || { x: 8, y: 80, width: 300, height: 225, borderRadius: 8 };

      await VARNativeCamera.initialize({
        camera: newFacing === "front" ? "front" : "back",
        frame,
        width: parseInt(wStr, 10),
        height: parseInt(hStr, 10),
        fps,
      });

      setNativeCameraFacing(newFacing);
      setNativeTorch(false);
      setNativeZoom(1.0);

      // Refresh capabilities for new camera
      await Promise.all([fetchNativeCapabilities(), fetchNativeCameraList()]);
    } catch (err) {
      console.error("Flip camera failed:", err);
      alert("Impossibile cambiare fotocamera. Riprova.");
    }
  }, [nativeCameraFacing, getNativeFrameConfig, fetchNativeCapabilities, fetchNativeCameraList]);

  const handleNativeCameraSelect = useCallback(async (cameraId: string) => {
    try {
      setSelectedNativeCameraId(cameraId);
      persistSettings({ nativeCameraId: cameraId });

      await VARNativeCamera.selectCamera({ cameraId });
      setNativeTorch(false);
      setNativeZoom(1.0);

      // Update facing based on camera info
      const cam = nativeCameras.find(c => c.id === cameraId);
      if (cam) {
        setNativeCameraFacing(cam.facing === "front" ? "front" : "rear");
      }

      // Refresh capabilities for new camera module
      await fetchNativeCapabilities();
    } catch (err) {
      console.error("selectCamera failed:", err);
    }
  }, [nativeCameras, fetchNativeCapabilities]);

  const handleNativeZoomChange = useCallback(async (value: number) => {
    setNativeZoom(value);
    try {
      const result = await VARNativeCamera.setZoom({ zoom: value });
      setNativeZoom(result.zoom);
    } catch (err) {
      console.warn("setZoom failed:", err);
    }
  }, []);

  const handleNativeTorchToggle = useCallback(async () => {
    const newVal = !nativeTorch;
    setNativeTorch(newVal);
    try {
      await VARNativeCamera.setTorch({ enabled: newVal });
    } catch (err) {
      console.warn("setTorch failed:", err);
      setNativeTorch(!newVal);
    }
  }, [nativeTorch]);

  const handleNativeExposureChange = useCallback(async (value: number) => {
    setNativeExposure(value);
    try {
      await VARNativeCamera.setExposureCompensation({ value });
    } catch (err) {
      console.warn("setExposureCompensation failed:", err);
    }
  }, []);

  // Tap to focus handler
  const handleTapToFocus = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!usingNativeBackend || !cameraActive || !nativeSupportsTapFocus) return;

    const container = nativePreviewContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    // Show focus indicator
    setFocusPoint({ x: normX * 100, y: normY * 100 });
    setTimeout(() => setFocusPoint(null), 1500);

    // Send to native
    VARNativeCamera.tapToFocus({ x: normX, y: normY }).catch(err => {
      console.warn("tapToFocus failed:", err);
    });
  }, [cameraActive, nativeSupportsTapFocus, usingNativeBackend]);

  // ─── WEB (WebRTC) advanced controls ───

  const handleWebZoomChange = useCallback(async (value: number) => {
    setWebZoom(value);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: value } as any] } as any);
    } catch (err) {
      console.warn("[VAR] web zoom failed:", err);
    }
  }, []);

  const handleWebExposureChange = useCallback(async (value: number) => {
    setWebExposure(value);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    // IMPORTANT: do NOT set exposureMode: "manual" — many browsers (Chrome Android)
    // then interpret exposureCompensation as absolute exposureTime, blacking out the feed.
    // Keep exposureMode "continuous" so AE stays active and we only bias it via EV compensation.
    try {
      await track.applyConstraints({
        advanced: [{ exposureMode: "continuous", exposureCompensation: value } as any],
      } as any);
    } catch {
      // Fallback: just exposureCompensation alone
      try {
        await track.applyConstraints({
          advanced: [{ exposureCompensation: value } as any],
        } as any);
      } catch (err) {
        console.warn("[VAR] web exposure failed:", err);
      }
    }
  }, []);

  const handleWebBitrateChange = useCallback((value: number) => {
    setWebBitrate(value);
    try { localStorage.setItem("var-webrtc-max-bitrate", String(value)); } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("var-webrtc-bitrate-change", { detail: value }));
    }
  }, []);

  const handleWebTapToFocus = useCallback(async (
    e: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>,
  ) => {
    if (!usingWebRtcBackend || !cameraActive || !webSupportsFocusPoint) return;
    const video = e.currentTarget as HTMLVideoElement;
    const rect = video.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    setFocusPoint({ x: normX * 100, y: normY * 100 });
    setTimeout(() => setFocusPoint(null), 1500);

    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [
          { focusMode: "manual", pointsOfInterest: [{ x: normX, y: normY }] } as any,
        ],
      } as any);
    } catch (err) {
      console.warn("[VAR] web tapToFocus failed:", err);
    }
  }, [cameraActive, usingWebRtcBackend, webSupportsFocusPoint]);

  // ─── WEB (WebRTC) implementation ───

  const enumerateVideoDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vDevices = devices.filter(d => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      setVideoDevices(vDevices);
      return vDevices;
    } catch { return []; }
  }, []);

  const detectCapabilities = useCallback(async (stream: MediaStream) => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    const capabilitiesApi = typeof videoTrack.getCapabilities === "function" ? videoTrack.getCapabilities() : null;

    const supportedResolutions: { label: string; width: number; height: number }[] = [];
    if (capabilitiesApi && capabilitiesApi.width && capabilitiesApi.height) {
      const maxW = (capabilitiesApi.width as any).max || settings.width || 1920;
      const maxH = (capabilitiesApi.height as any).max || settings.height || 1080;
      for (const res of COMMON_RESOLUTIONS) {
        if (res.width <= maxW && res.height <= maxH) supportedResolutions.push(res);
      }
    }
    if (supportedResolutions.length === 0) {
      const curW = settings.width || 1920;
      const curH = settings.height || 1080;
      for (const res of COMMON_RESOLUTIONS) {
        if (res.width <= curW && res.height <= curH) supportedResolutions.push(res);
      }
    }
    if (supportedResolutions.length === 0) {
      supportedResolutions.push({ label: "Default", width: settings.width || 640, height: settings.height || 480 });
    }

    let maxHwFps = 30;
    if (capabilitiesApi && (capabilitiesApi as any).frameRate) {
      maxHwFps = (capabilitiesApi as any).frameRate.max || 30;
    }
    const supportedFrameRates = COMMON_FRAMERATES.filter(f => f <= Math.ceil(maxHwFps));
    if (supportedFrameRates.length === 0) supportedFrameRates.push(30);

    setCapabilities({ resolutions: supportedResolutions, frameRates: supportedFrameRates });

    const curW = settings.width || 0;
    const curH = settings.height || 0;
    const matched = supportedResolutions.find(r => r.width === curW && r.height === curH);
    const resKey = matched ? `${matched.width}x${matched.height}` : (supportedResolutions[0] ? `${supportedResolutions[0].width}x${supportedResolutions[0].height}` : "");
    setSelectedResolution(resKey);
    setCurrentResLabel(matched?.label || supportedResolutions[0]?.label || `${curW}x${curH}`);

    const curFps = Math.round(settings.frameRate || 30);
    const matchedFps = supportedFrameRates.includes(curFps) ? curFps : supportedFrameRates[0];
    setSelectedFrameRate(String(matchedFps));
    setCurrentFps(curFps);

    if (settings.deviceId) setSelectedDeviceId(settings.deviceId);

    // ─── Advanced web capabilities (zoom / exposure / focus point) ───
    const caps: any = capabilitiesApi || {};
    if (caps.zoom && typeof caps.zoom === "object") {
      const min = caps.zoom.min ?? 1;
      const max = caps.zoom.max ?? 1;
      const step = caps.zoom.step ?? 0.1;
      const cur = (settings as any).zoom ?? min;
      setWebZoomMin(min);
      setWebZoomMax(max);
      setWebZoomStep(step > 0 ? step : 0.1);
      setWebZoom(cur);
    } else {
      setWebZoomMin(1); setWebZoomMax(1); setWebZoom(1);
    }
    if (caps.exposureCompensation && typeof caps.exposureCompensation === "object") {
      const min = caps.exposureCompensation.min ?? 0;
      const max = caps.exposureCompensation.max ?? 0;
      const step = caps.exposureCompensation.step ?? 1;
      const cur = (settings as any).exposureCompensation ?? 0;
      setWebExposureMin(min);
      setWebExposureMax(max);
      setWebExposureStep(step > 0 ? step : 1);
      setWebExposure(cur);
    } else {
      setWebExposureMin(0); setWebExposureMax(0); setWebExposure(0);
    }
    const focusModes: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
    const hasPOI = !!caps.pointsOfInterest;
    setWebSupportsFocusPoint(hasPOI || focusModes.includes("manual") || focusModes.includes("single-shot"));
  }, []);

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    onStreamReady?.(stream);
    if (videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
      video.setAttribute("autoplay", "true");
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("muted", "true");
      video.muted = true;
      (video as any).disableRemotePlayback = true;
      (video as any).disablePictureInPicture = true;
      video.srcObject = stream;

      let played = false;
      const tryPlay = () => {
        if (played) return;
        played = true;
        video.play().catch(e => {
          console.warn("VAR play attempt failed:", e);
          setTimeout(() => { video.play().catch(() => {}); }, 500);
        });
      };
      video.onloadedmetadata = tryPlay;
      video.onloadeddata = tryPlay;
      video.oncanplay = tryPlay;
      setTimeout(() => { if (!played && video.srcObject) tryPlay(); }, 2000);
      if (video.readyState >= 1) tryPlay();
    }
  }, [onStreamReady]);

  const forceTrackSettings = useCallback(async (track: MediaStreamTrack, width: number, height: number, frameRate: number) => {
    // For VAR we need REAL high fps. Browsers will silently downgrade fps
    // when both width AND height are set with `exact` (sensor mode mismatch).
    // Strategy:
    //   - if user asked >=60fps → LOCK framerate exact, keep resolution as ideal
    //   - otherwise prioritise resolution
    const highFps = frameRate >= 60;
    const attempts: MediaTrackConstraints[] = highFps
      ? [
          { frameRate: { exact: frameRate }, width: { ideal: width }, height: { ideal: height } },
          { frameRate: { min: frameRate, ideal: frameRate }, width: { ideal: width }, height: { ideal: height } },
          { frameRate: { exact: frameRate } },
          { frameRate: { ideal: frameRate }, width: { ideal: width }, height: { ideal: height } },
          { width: { ideal: width }, height: { ideal: height } },
        ]
      : [
          { width: { exact: width }, height: { exact: height }, frameRate: { ideal: frameRate } },
          { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: frameRate } },
          { width: { min: width }, height: { min: height }, frameRate: { ideal: frameRate } },
          { width: { exact: width }, height: { exact: height } },
          { width: { ideal: width }, height: { ideal: height } },
          { frameRate: { ideal: frameRate } },
        ];
    for (let i = 0; i < attempts.length; i++) {
      try {
        await track.applyConstraints(attempts[i]);
        const s = track.getSettings();
        const gotFps = Math.round(s.frameRate || 0);
        const gotW = s.width || 0;
        // For high-fps, accept once we hit fps target; otherwise verify width.
        if (highFps ? gotFps >= frameRate - 2 : gotW >= width - 16) break;
      } catch {}
    }
    // Hint encoders that this is fast motion content → keep frames over fidelity.
    try { (track as any).contentHint = "motion"; } catch {}
    // Best-effort: enable continuous autofocus, white balance and exposure.
    try {
      const caps: any = track.getCapabilities?.() ?? {};
      const advanced: any[] = [];
      if (caps.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
      if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
      if (caps.exposureMode?.includes?.("continuous")) advanced.push({ exposureMode: "continuous" });
      if (advanced.length > 0) await track.applyConstraints({ advanced } as any).catch(() => {});
    } catch {}
  }, []);

  const applyVideoSettings = useCallback(async (resKey: string, fpsStr: string, deviceId?: string) => {
    if (isNative()) {
      persistSettings({ resolution: resKey, frameRate: fpsStr });
      setSelectedResolution(resKey);
      setSelectedFrameRate(fpsStr);
      const [wStr, hStr] = resKey.split("x");
      const w = parseInt(wStr, 10);
      const h = parseInt(hStr, 10);
      const fps = parseInt(fpsStr, 10);
      const matched = COMMON_RESOLUTIONS.find(r => `${r.width}x${r.height}` === resKey);
      setCurrentResLabel(matched?.label || resKey);
      setCurrentFps(fps);
      try {
        await VARNativeCamera.updateSettings({ width: w, height: h, fps });
      } catch (err) {
        console.error("VAR native: updateSettings failed:", err);
      }
      return;
    }

    streamRef.current?.getTracks().forEach(t => t.stop());
    const [wStr, hStr] = resKey.split("x");
    const width = parseInt(wStr, 10);
    const height = parseInt(hStr, 10);
    const frameRate = parseInt(fpsStr, 10);
    const devId = deviceId || selectedDeviceId;
    const deviceConstraint = devId
      ? { deviceId: { exact: devId } }
      : { facingMode: { ideal: "environment" } };

    const highFps = frameRate >= 60;
    // When user wants high fps, ASK the camera for that fps with `min` so the
    // browser is forced to pick a sensor mode that supports it (it may downgrade
    // resolution, which is the correct trade-off for VAR replays).
    const fallbackConstraints: MediaStreamConstraints[] = highFps
      ? [
          { video: { ...deviceConstraint, frameRate: { min: frameRate, ideal: frameRate }, width: { ideal: width }, height: { ideal: height } }, audio: true },
          { video: { ...deviceConstraint, frameRate: { ideal: frameRate }, width: { ideal: width }, height: { ideal: height } }, audio: true },
          { video: { ...deviceConstraint, frameRate: { ideal: frameRate } }, audio: true },
          { video: { ...deviceConstraint, width: { ideal: width }, height: { ideal: height } }, audio: true },
          { video: devId ? { deviceId: { exact: devId } } : true, audio: true },
          { video: { ...deviceConstraint, frameRate: { ideal: frameRate } }, audio: false },
          { video: devId ? { deviceId: { exact: devId } } : true, audio: false },
        ]
      : [
          { video: { ...deviceConstraint, width: { min: width, ideal: width }, height: { min: height, ideal: height }, frameRate: { ideal: frameRate } }, audio: true },
          { video: { ...deviceConstraint, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: frameRate } }, audio: true },
          { video: { ...deviceConstraint, width: { ideal: width }, height: { ideal: height } }, audio: true },
          { video: devId ? { deviceId: { exact: devId } } : true, audio: true },
          { video: true, audio: true },
          { video: true, audio: false },
        ];

    let stream: MediaStream | null = null;
    for (const c of fallbackConstraints) {
      try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch { continue; }
    }
    if (!stream) {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
      catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) await forceTrackSettings(videoTrack, width, height, frameRate);

    attachStream(stream);
    const settings = videoTrack?.getSettings();
    const matched = COMMON_RESOLUTIONS.find(r => r.width === (settings?.width || width) && r.height === (settings?.height || height));
    setCurrentResLabel(matched?.label || `${settings?.width}x${settings?.height}`);
    setCurrentFps(settings?.frameRate ? Math.round(settings.frameRate) : frameRate);
    persistSettings({ resolution: resKey, frameRate: fpsStr });
  }, [selectedDeviceId, attachStream, forceTrackSettings, usingNativeBackend]);

  const handleResolutionChange = useCallback((value: string) => {
    setSelectedResolution(value);
    applyVideoSettings(value, selectedFrameRate);
  }, [selectedFrameRate, applyVideoSettings]);

  const handleFrameRateChange = useCallback((value: string) => {
    setSelectedFrameRate(value);
    applyVideoSettings(selectedResolution, value);
  }, [selectedResolution, applyVideoSettings]);

  const startCameraWithDevice = useCallback(async (deviceId?: string, savedRes?: string, savedFps?: string) => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    const w = savedRes ? parseInt(savedRes.split("x")[0], 10) : 1920;
    const h = savedRes ? parseInt(savedRes.split("x")[1], 10) : 1080;
    const fps = savedFps ? parseInt(savedFps, 10) : 60;
    const deviceConstraint = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: "environment" } };

    const highFps = fps >= 60;
    // When user wants high fps, prioritise framerate (browser may pick a
    // lower-res sensor mode that actually supports 60fps).
    const constraintsList: MediaStreamConstraints[] = highFps
      ? [
          { video: { ...deviceConstraint, frameRate: { min: fps, ideal: fps }, width: { ideal: w }, height: { ideal: h } }, audio: true },
          { video: { ...deviceConstraint, frameRate: { ideal: fps }, width: { ideal: w }, height: { ideal: h } }, audio: true },
          { video: { ...deviceConstraint, frameRate: { ideal: fps } }, audio: true },
          { video: { ...deviceConstraint, width: { ideal: w }, height: { ideal: h } }, audio: true },
          { video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: true },
          { video: { ...deviceConstraint, frameRate: { ideal: fps } }, audio: false },
          { video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false },
        ]
      : [
          { video: { ...deviceConstraint, width: { min: w, ideal: w }, height: { min: h, ideal: h }, frameRate: { ideal: fps } }, audio: true },
          { video: { ...deviceConstraint, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: fps } }, audio: true },
          { video: { ...deviceConstraint, width: { ideal: w }, height: { ideal: h } }, audio: true },
          { video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }, audio: true },
          { video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: true },
          { video: true, audio: false },
        ];

    let stream: MediaStream | null = null;
    for (const c of constraintsList) {
      try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch { continue; }
    }
    if (!stream) throw new Error("All getUserMedia constraints failed");

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) await forceTrackSettings(videoTrack, w, h, fps);
    return stream;
  }, [forceTrackSettings]);

  const startCamera = useCallback(async () => {
    // VARNativeCamera non è disponibile su Android (plugin non implementato lato
    // nativo) — usiamo direttamente il backend WebRTC (getUserMedia) che
    // funziona perfettamente nel WebView Capacitor. Su iOS l'app è una PWA,
    // quindi anche lì si usa WebRTC.
    if (isNative() && Capacitor.getPlatform() === "ios") return startCameraNative();


    try {
      const saved = loadSavedSettings();
      const stream = await startCameraWithDevice(saved.deviceId, saved.resolution, saved.frameRate);
      attachStream(stream);
      await detectCapabilities(stream);
      const devices = await enumerateVideoDevices();
      if (devices.length > 0) {
        const settings = stream.getVideoTracks()[0]?.getSettings();
        if (settings?.deviceId) {
          setSelectedDeviceId(settings.deviceId);
          persistSettings({ deviceId: settings.deviceId });
        }
      }
      if (saved.resolution) setSelectedResolution(saved.resolution);
      if (saved.frameRate) setSelectedFrameRate(saved.frameRate);
      setCameraBackend("webrtc");
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Impossibile accedere alla fotocamera. Verifica i permessi del browser e ricarica la pagina.");
    }
  }, [startCameraWithDevice, attachStream, detectCapabilities, enumerateVideoDevices, startCameraNative]);

  const handleDeviceChange = useCallback(async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    persistSettings({ deviceId });
    try {
      const stream = await startCameraWithDevice(deviceId, selectedResolution, selectedFrameRate);
      attachStream(stream);
      await detectCapabilities(stream);
    } catch (err) {
      console.error("Failed to switch camera:", err);
    }
  }, [startCameraWithDevice, attachStream, detectCapabilities, selectedResolution, selectedFrameRate]);

  const stopCamera = useCallback(() => {
    if (usingNativeBackend) { stopCameraNative(); onStreamReady?.(null); return; }
    if (isNative()) {
      VARNativeCamera.destroy().catch(() => {});
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    onStreamReady?.(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraBackend(null);
    setCameraActive(false);
    setRecording(false);
    setShowSettings(false);
    setCapabilities({ resolutions: [], frameRates: [] });
  }, [stopCameraNative, usingNativeBackend, onStreamReady]);

  const startRecording = useCallback(async () => {
    if (usingNativeBackend) { startRecordingNative(); return; }
    if (!streamRef.current) return;
    chunksRef.current = [];
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }

    const videoTrack = streamRef.current.getVideoTracks()[0];
    const trackSettings = videoTrack?.getSettings();
    const realFps = Math.round(trackSettings?.frameRate || 30);
    const realW = trackSettings?.width || 1920;
    const realH = trackSettings?.height || 1080;
    const bitrate = computeBitrate(realW, realH, realFps);

    // ─── Path 1: WebCodecs (Chrome Android, hardware encoder, no MediaRecorder) ───
    // Best quality on mobile because it bypasses the browser's software fallback.
    if (videoTrack && isWebCodecsSupported()) {
      try {
        const codec = await probeHardwareEncoder(realW, realH, realFps, bitrate);
        if (codec) {
          const audioTrack = streamRef.current.getAudioTracks()[0] ?? null;
          const rec = new WebCodecsRecorder({
            width: realW, height: realH, frameRate: realFps, bitrate, codec,
          });
          // Passiamo anche la traccia audio (se presente) per includerla nell'MP4 risultante
          await rec.start(videoTrack, audioTrack);
          webCodecsRecorderRef.current = rec;
          recordingExtRef.current = "mp4";
          recordingStartTimeRef.current = Date.now();
          setRecording(true);
          setHasRecording(false);
          setReviewing(false);
          console.log("[VAR] Recording with WebCodecs hardware encoder", { codec, realW, realH, realFps, bitrate, hasAudio: !!audioTrack });
          return;
        }
      } catch (err) {
        console.warn("[VAR] WebCodecs path failed, falling back to MediaRecorder:", err);
      }
    }

    // ─── Path 2: MediaRecorder fallback ───
    const mimeTypes = [
      'video/mp4;codecs="avc1.640033,mp4a.40.2"', // H.264 High@L5.1 + AAC LC
      'video/mp4;codecs="avc1.640028"',           // H.264 High@L4
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs="h264,opus"',
      'video/webm;codecs=h264',
      'video/webm;codecs="vp9,opus"',
      'video/webm;codecs="vp8,opus"',
      'video/webm',
      '',
    ];
    const mimeType = mimeTypes.find(m => {
      if (m === "") return true;
      try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
    }) || "";
    const isMP4 = mimeType.startsWith("video/mp4");

    try {
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: 128_000,
      };
      if (mimeType) options.mimeType = mimeType;
      const mr = new MediaRecorder(streamRef.current, options);
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        blobUrlRef.current = URL.createObjectURL(blob);
        recordingExtRef.current = isMP4 ? "mp4" : "webm";
        setHasRecording(true);
      };
      mr.onerror = () => setRecording(false);
      mr.start(1500);
      recordingStartTimeRef.current = Date.now();
      recorderRef.current = mr;
      setRecording(true);
      setHasRecording(false);
      setReviewing(false);
    } catch (err) {
      console.error("MediaRecorder init failed:", err);
      alert("Registrazione non supportata su questo dispositivo.");
    }
  }, [startRecordingNative, usingNativeBackend]);

  const stopRecording = useCallback(async () => {
    if (usingNativeBackend) { stopRecordingNative(); return; }
    // WebCodecs path
    if (webCodecsRecorderRef.current) {
      try {
        const blob = await webCodecsRecorderRef.current.stop();
        blobUrlRef.current = URL.createObjectURL(blob);
        recordingExtRef.current = "mp4";
        setHasRecording(true);
      } catch (err) {
        console.error("WebCodecs stop failed:", err);
      } finally {
        webCodecsRecorderRef.current = null;
        setRecording(false);
      }
      return;
    }
    // MediaRecorder path
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    setRecording(false);
  }, [stopRecordingNative, usingNativeBackend]);

  const openReview = useCallback(async () => {
    const videoUrl = usingNativeBackend ? nativeVideoUrl : blobUrlRef.current;
    if (!videoUrl) return;
    setPlaybackRate(1);
    setPlaying(false);

    // IMPORTANT: Hide native preview BEFORE setting reviewing state
    if (usingNativeBackend) {
      try {
        await VARNativeCamera.setPreviewVisible({ visible: false });
      } catch {}
    }

    setReviewing(true);

    setTimeout(() => {
      const video = playbackRef.current;
      if (!video || !videoUrl) return;
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.preload = "auto";
      video.playbackRate = 1;
      video.src = videoUrl;
      video.load();

      // Fix WebM duration bug: seek to infinity to force browser to compute real duration
      const fixDuration = () => {
        if (video.duration === Infinity || isNaN(video.duration) || video.duration < 0.1) {
          video.currentTime = 1e101; // seek to absurdly large number
          video.addEventListener("timeupdate", function onTimeUpdate() {
            video.removeEventListener("timeupdate", onTimeUpdate);
            video.currentTime = 0; // reset to start
          }, { once: true });
        }
      };
      video.addEventListener("loadedmetadata", fixDuration, { once: true });

      if (!usingNativeBackend) {
        video.onerror = () => {
          if (chunksRef.current.length > 0) {
            for (const type of ["video/webm", "video/mp4", ""]) {
              try {
                const blob = new Blob(chunksRef.current, type ? { type } : undefined);
                const url = URL.createObjectURL(blob);
                if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = url;
                video.src = url;
                video.load();
                return;
              } catch { continue; }
            }
          }
        };
      }
    }, 150);
  }, [nativeVideoUrl, usingNativeBackend]);

  const togglePlay = useCallback(() => {
    if (!playbackRef.current) return;
    if (playbackRef.current.paused) { playbackRef.current.play(); setPlaying(true); }
    else { playbackRef.current.pause(); setPlaying(false); }
  }, []);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 0.5, 0.25, 0.1];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (playbackRef.current) playbackRef.current.playbackRate = next;
  }, [playbackRate]);

  const skipBack5 = useCallback(() => {
    if (playbackRef.current) playbackRef.current.currentTime = Math.max(0, playbackRef.current.currentTime - 5);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (playbackRef.current) setCurrentTime(playbackRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (playbackRef.current) setDuration(playbackRef.current.duration);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (playbackRef.current) playbackRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const downloadFull = useCallback(() => {
    const url = usingNativeBackend ? nativeVideoUrl : blobUrlRef.current;
    if (!url) return;
    const ext = usingNativeBackend ? "mp4" : recordingExtRef.current;
    // Timestamp basato sull'inizio EFFETTIVO della registrazione (non sull'istante del download)
    // e in ora locale del dispositivo (evita lo sfasamento UTC nel nome file).
    const startMs = recordingStartTimeRef.current || Date.now();
    const d = new Date(startMs);
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    const safeLabel = (matchLabel || "match").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VAR_${safeLabel}_${stamp}.${ext}`;
    a.click();
  }, [matchLabel, nativeVideoUrl, usingNativeBackend]);

  const handleBackToLive = useCallback(async () => {
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current.removeAttribute("src");
      playbackRef.current.load();
    }
    setReviewing(false);
    setPlaying(false);

    if (usingNativeBackend) {
      // Full destroy and reinitialize for clean state
      try { await VARNativeCamera.destroy(); } catch {}
      setCameraBackend(null);
      setCameraActive(false);
      lastFrameRef.current = ""; // Reset frame tracking
      setTimeout(() => { void startCameraNative(); }, 140);
      return;
    }

    const stream = streamRef.current;
    const tracksAlive = stream && stream.getTracks().some(t => t.readyState === "live");
    if (tracksAlive && videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
      await new Promise(r => setTimeout(r, 50));
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      video.play().catch(() => { setTimeout(() => video.play().catch(() => {}), 300); });
    } else {
      setCameraActive(false);
      setTimeout(() => { void startCamera(); }, 100);
    }
  }, [startCamera, startCameraNative, usingNativeBackend]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ─── Settings panel content ───

  const renderSettingsContent = (isMobileOverlay = false, twoCol = false) => (
    <div className={twoCol ? "grid grid-cols-2 gap-x-3 gap-y-2.5" : "space-y-2.5"}>
      {isMobileOverlay && (
        <div className={`flex items-center justify-between ${twoCol ? "col-span-2" : ""}`}>
          <span className="text-xs font-semibold text-foreground">Impostazioni Camera</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowSettings(false)}>
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Native camera module selector - always show when cameras available */}
      {usingNativeBackend && nativeCameras.length > 0 && (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1">
            <Camera size={10} /> Modulo Fotocamera ({nativeCameras.length} disponibili)
          </label>
          <Select value={selectedNativeCameraId} onValueChange={handleNativeCameraSelect}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Seleziona modulo..." />
            </SelectTrigger>
            <SelectContent>
              {nativeCameras.map(cam => (
                <SelectItem key={cam.id} value={cam.id} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    {cam.label}
                    <span className="text-muted-foreground text-[9px]">
                      {cam.maxResolution} · max {cam.maxFps}fps
                      {cam.focalLength > 0 ? ` · ${cam.focalLength.toFixed(1)}mm` : ""}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {nativeCameras.length > 0 && (
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 mt-1" onClick={flipCameraNative}>
              <Camera size={12} /> Inverti ({nativeCameraFacing === "rear" ? "Post." : "Front."})
            </Button>
          )}
        </div>
      )}

      {/* Web: device selector */}
      {videoDevices.length > 1 && usingWebRtcBackend && (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1">
            <Camera size={10} /> Dispositivo Video
          </label>
          <Select value={selectedDeviceId} onValueChange={handleDeviceChange}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Seleziona camera..." />
            </SelectTrigger>
            <SelectContent>
              {videoDevices.map(d => (
                <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Resolution & FPS */}
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Risoluzione</label>
          <Select value={selectedResolution} onValueChange={handleResolutionChange}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {capabilities.resolutions.map(res => (
                <SelectItem key={`${res.width}x${res.height}`} value={`${res.width}x${res.height}`} className="text-xs">
                  {res.label} ({res.width}×{res.height})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Frame Rate</label>
          <Select value={selectedFrameRate} onValueChange={handleFrameRateChange}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {capabilities.frameRates.map(fps => (
                <SelectItem key={fps} value={String(fps)} className="text-xs">{fps} fps</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Native advanced controls: Zoom, Torch, Exposure */}
      {usingNativeBackend && nativeMaxZoom > 1.1 && (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1">
            <ZoomIn size={10} /> Zoom ({nativeZoom.toFixed(1)}x)
          </label>
          <input
            type="range"
            min={1}
            max={nativeMaxZoom}
            step={0.1}
            value={nativeZoom}
            onChange={e => handleNativeZoomChange(parseFloat(e.target.value))}
            className="w-full h-2 accent-primary rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>1x</span>
            <span>{nativeMaxZoom.toFixed(0)}x</span>
          </div>
        </div>
      )}

      {usingNativeBackend && nativeHasFlash && (
        <Button
          variant={nativeTorch ? "default" : "outline"}
          size="sm"
          className="w-full h-9 text-xs gap-1.5"
          onClick={handleNativeTorchToggle}
        >
          {nativeTorch ? <Flashlight size={12} /> : <FlashlightOff size={12} />}
          {nativeTorch ? "Torcia ON" : "Torcia OFF"}
        </Button>
      )}

      {usingNativeBackend && (nativeExposureMin !== 0 || nativeExposureMax !== 0) && (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1">
            <Sun size={10} /> Esposizione ({nativeExposure > 0 ? "+" : ""}{nativeExposure})
          </label>
          <input
            type="range"
            min={nativeExposureMin}
            max={nativeExposureMax}
            step={1}
            value={nativeExposure}
            onChange={e => handleNativeExposureChange(parseInt(e.target.value, 10))}
            className="w-full h-2 accent-primary rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{nativeExposureMin}</span>
            <span>0</span>
            <span>+{nativeExposureMax}</span>
          </div>
        </div>
      )}

      {/* Tap to focus info */}
      {usingNativeBackend && nativeSupportsTapFocus && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Focus size={10} />
          <span>Tocca il video per mettere a fuoco</span>
        </div>
      )}

      {/* ─── WebRTC advanced controls ─── */}
      {usingWebRtcBackend && webZoomMax > 1.05 && (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1">
            <ZoomIn size={10} /> Zoom ({webZoom.toFixed(1)}x)
          </label>
          <input
            type="range"
            min={webZoomMin}
            max={webZoomMax}
            step={webZoomStep}
            value={webZoom}
            onChange={e => handleWebZoomChange(parseFloat(e.target.value))}
            className="w-full h-2 accent-primary rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{webZoomMin.toFixed(1)}x</span>
            <span>{webZoomMax.toFixed(1)}x</span>
          </div>
        </div>
      )}

      {usingWebRtcBackend && (webExposureMin !== 0 || webExposureMax !== 0) && (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1">
            <Sun size={10} /> Esposizione ({webExposure > 0 ? "+" : ""}{webExposure})
          </label>
          <input
            type="range"
            min={webExposureMin}
            max={webExposureMax}
            step={webExposureStep}
            value={webExposure}
            onChange={e => handleWebExposureChange(parseFloat(e.target.value))}
            className="w-full h-2 accent-primary rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{webExposureMin}</span>
            <span>0</span>
            <span>+{webExposureMax}</span>
          </div>
        </div>
      )}

      {usingWebRtcBackend && webSupportsFocusPoint && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Focus size={10} />
          <span>Tocca il video per mettere a fuoco</span>
        </div>
      )}

      {usingWebRtcBackend && (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1">
            <Video size={10} /> Bitrate Streaming ({(webBitrate / 1_000_000).toFixed(1)} Mbps)
          </label>
          <input
            type="range"
            min={1_000_000}
            max={30_000_000}
            step={500_000}
            value={webBitrate}
            onChange={e => handleWebBitrateChange(parseInt(e.target.value, 10))}
            className="w-full h-2 accent-primary rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>1 Mbps</span>
            <span>30 Mbps</span>
          </div>
        </div>
      )}

      {/* Debug panel - always visible on native */}
      {isNative() && (
        <div className={`space-y-1 border-t border-border/50 pt-2 mt-2 ${twoCol ? "col-span-2" : ""}`}>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1 w-full"
          >
            🔧 Debug Log ({debugLog.length}) {showDebug ? "▲" : "▼"}
          </button>
          {showDebug && (
            <div className="bg-black/80 text-green-400 rounded p-2 text-[9px] font-mono max-h-40 overflow-y-auto space-y-0.5">
              {debugLog.length === 0 ? (
                <span className="text-muted-foreground">Nessun log ancora. Attendi avvio camera...</span>
              ) : (
                debugLog.map((line, i) => <div key={i}>{line}</div>)
              )}
            </div>
          )}
          <div className="text-[9px] text-muted-foreground space-y-0.5">
            <div>isNative: {String(isNative())} | backend: {cameraBackend || "none"} | cameraActive: {String(cameraActive)}</div>
            <div>cameras: {nativeCameras.length} | maxZoom: {nativeMaxZoom.toFixed(1)} | flash: {String(nativeHasFlash)}</div>
            <div>exp: {nativeExposureMin}/{nativeExposureMax} | tapFocus: {String(nativeSupportsTapFocus)}</div>
            {debugLog.length > 0 && (
              <div className={debugLog[debugLog.length - 1]?.includes('ERRORE') ? 'text-destructive font-semibold' : 'text-green-500'}>
                Last: {debugLog[debugLog.length - 1]?.substring(debugLog[debugLog.length - 1].indexOf(']') + 2) || '—'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ─── LANDSCAPE FULLSCREEN MODE ───
  if (landscapeMode) {
    const rotateStyle: React.CSSProperties = needsCssRotate
      ? {
          transform: "rotate(90deg)",
          transformOrigin: "center center",
          width: "100vh",
          height: "100vw",
          position: "absolute",
          top: "50%",
          left: "50%",
          marginTop: "-50vw",
          marginLeft: "-50vh",
        }
      : {};
    return (
      <div className="relative w-full h-full bg-black overflow-hidden select-none" style={rotateStyle}>
        {/* Full-bleed live feed */}
        {!reviewing && (
          <div
            className="absolute inset-0"
            onClick={isNative() ? handleTapToFocus : undefined}
            onTouchStart={isNative() ? handleTapToFocus : undefined}
          >
            {isNative() ? (
              <div
                id="var-preview"
                ref={nativePreviewContainerRef}
                className="w-full h-full relative"
                style={{ backgroundColor: "transparent" }}
              >
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain" />
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain ${webSupportsFocusPoint ? "cursor-crosshair" : ""}`}
                style={{ willChange: "transform", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                onClick={handleWebTapToFocus}
                onTouchStart={handleWebTapToFocus}
              />
            )}
            {focusPoint && (
              <div
                className="absolute pointer-events-none z-20"
                style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%`, transform: "translate(-50%, -50%)" }}
              >
                <div className="w-14 h-14 rounded-full border-2 border-primary animate-ping" />
                <div className="absolute inset-0 w-14 h-14 rounded-full border border-primary/60" />
              </div>
            )}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm p-6">
                {varDisabled ? (
                  <>
                    <p className="text-center text-sm text-white/80 max-w-sm">
                      VAR disabilitata. Non riceverai più richieste di attivare la fotocamera per questo dispositivo.
                    </p>
                    <Button variant="outline" size="lg" onClick={enableVar} className="gap-2 h-14 px-6 text-base shadow-2xl">
                      <Video size={20} /> Riabilita VAR
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="lg" onClick={startCamera} className="gap-2 h-14 px-6 text-base shadow-2xl">
                      <Video size={20} /> Attiva Camera
                    </Button>
                    <button
                      onClick={disableVar}
                      className="text-[11px] text-white/60 hover:text-white/90 underline underline-offset-2 transition-colors"
                      title="Non userai la fotocamera su questo dispositivo"
                    >
                      Non ho una fotocamera · disabilita VAR
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toggle modalità manuale */}
        {!reviewing && (
          <button
            type="button"
            onClick={() => toggleForceLandscape()}
            className={`absolute top-3 right-3 z-40 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider backdrop-blur-md border shadow-lg transition-colors ${forceLandscape ? "bg-primary text-primary-foreground border-primary" : "bg-black/60 text-white/90 border-white/15 hover:bg-black/80"}`}
            title={forceLandscape ? "Passa alla modalità verticale" : "Passa alla modalità orizzontale"}
          >
            {forceLandscape ? "↕ VERTICALE" : "↔ ORIZZONTALE"}
          </button>
        )}

        {/* Top-left status bar (REC + info) */}
        {!reviewing && (
          <div className="absolute top-3 left-14 z-30 flex items-center gap-1.5 pointer-events-none">
            {recording && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/95 text-destructive-foreground shadow-lg backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-bold tracking-wider">REC</span>
              </div>
            )}
            {cameraActive && (
              <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                <span className="text-[9px] font-mono text-white/90">
                  {currentResLabel}·{currentFps}fps
                  {usingWebRtcBackend && webZoom > 1.05 ? ` · ${webZoom.toFixed(1)}x` : ""}
                  {usingNativeBackend && nativeZoom > 1.05 ? ` · ${nativeZoom.toFixed(1)}x` : ""}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Right vertical floating control bar */}
        {!reviewing && cameraActive && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2">
            {!recording ? (
              <button
                onClick={startRecording}
                className="group w-14 h-14 rounded-full bg-background/30 hover:bg-background/40 backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center transition-all active:scale-90"
                title="Registra"
              >
                <span className="w-9 h-9 rounded-full bg-destructive group-hover:scale-110 transition-transform shadow-lg" />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="group w-14 h-14 rounded-full bg-background/30 hover:bg-background/40 backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center transition-all active:scale-90"
                title="Stop"
              >
                <span className="w-7 h-7 rounded-md bg-destructive animate-pulse shadow-lg" />
              </button>
            )}

            {hasRecording && !recording && (
              <button
                onClick={openReview}
                className="w-12 h-12 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground shadow-xl backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90"
                title="Replay"
              >
                <Play size={18} fill="currentColor" />
              </button>
            )}

            {/* Divider */}
            <div className="w-8 h-px bg-white/15 my-0.5" />

            {rightBarSlot}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`w-12 h-12 rounded-full shadow-xl backdrop-blur-md border flex items-center justify-center transition-all active:scale-90 ${
                showSettings
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/40 hover:bg-background/60 text-white border-white/15"
              }`}
              title="Impostazioni"
            >
              <Settings size={17} />
            </button>

            {usingNativeBackend && nativeHasFlash && (
              <button
                onClick={handleNativeTorchToggle}
                className={`w-12 h-12 rounded-full shadow-xl backdrop-blur-md border flex items-center justify-center transition-all active:scale-90 ${
                  nativeTorch
                    ? "bg-yellow-400 text-black border-yellow-300"
                    : "bg-background/40 hover:bg-background/60 text-white border-white/15"
                }`}
                title="Torcia"
              >
                {nativeTorch ? <Flashlight size={17} /> : <FlashlightOff size={17} />}
              </button>
            )}

            <button
              onClick={stopCamera}
              className="w-12 h-12 rounded-full bg-background/40 hover:bg-background/60 backdrop-blur-md border border-white/15 text-white/80 shadow-xl flex items-center justify-center transition-all active:scale-90"
              title="Spegni camera"
            >
              <VideoOff size={17} />
            </button>
          </div>
        )}

        {/* Floating settings panel — modern card */}
        {showSettings && cameraActive && !reviewing && (
          <>
            <div
              className="absolute inset-0 z-20 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-150"
              onClick={() => setShowSettings(false)}
            />
            <div className="absolute right-20 top-1/2 -translate-y-1/2 z-30 w-[min(640px,calc(100vw-6rem))] max-h-[88vh] overflow-y-auto bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border animate-in fade-in slide-in-from-right-3 duration-200">
              <div className="sticky top-0 z-10 flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-background/95 backdrop-blur-xl rounded-t-2xl">
                <div className="flex items-center gap-1.5">
                  <Settings size={13} className="text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Impostazioni</span>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title="Chiudi"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-3">
                {renderSettingsContent(false, true)}
              </div>
            </div>
          </>
        )}

        {/* Replay overlay — modern fullscreen with zoom + pan */}
        {reviewing && (
          <ReplayLandscapeOverlay
            playbackRef={playbackRef}
            playing={playing}
            duration={duration}
            currentTime={currentTime}
            playbackRate={playbackRate}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setPlaying(false)}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onSkipBack={skipBack5}
            onCycleSpeed={cycleSpeed}
            onDownload={downloadFull}
            onBackToLive={handleBackToLive}
            formatTime={formatTime}
          />
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-border lg:border-b-0 lg:border-r">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Video size={14} className="text-destructive" />
          <span className="text-xs font-medium uppercase tracking-[0.15em]">VAR Camera</span>
          {recording && (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[9px] animate-pulse">
              ● REC
            </Badge>
          )}
          {isNative() && (
            <Badge variant="outline" className="text-[8px] border-primary/30 text-primary">{cameraBackend === "webrtc" ? "FALLBACK" : "NATIVO"}</Badge>
          )}
          <Badge variant="outline" className="text-[7px] border-muted-foreground/30 text-muted-foreground">{VAR_BUILD_VERSION}</Badge>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 relative">
          {/* Live feed */}
          {!reviewing && (
            <>
              <div
                className="relative rounded-lg overflow-hidden w-full"
                style={{ aspectRatio: "4/3", maxHeight: "50vh", backgroundColor: isNative() && cameraActive ? "transparent" : "hsl(var(--secondary))" }}
              >
                {isNative() ? (
                  <div
                    id="var-preview"
                    ref={nativePreviewContainerRef}
                    className="w-full h-full relative"
                    style={{ backgroundColor: "transparent" }}
                    onClick={handleTapToFocus}
                    onTouchStart={handleTapToFocus}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Focus indicator */}
                    {focusPoint && (
                      <div
                        className="absolute pointer-events-none z-20 animate-ping"
                        style={{
                          left: `${focusPoint.x}%`,
                          top: `${focusPoint.y}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="w-10 h-10 rounded-full border-2 border-primary" />
                      </div>
                    )}
                    {focusPoint && (
                      <div
                        className="absolute pointer-events-none z-20"
                        style={{
                          left: `${focusPoint.x}%`,
                          top: `${focusPoint.y}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="w-10 h-10 rounded-full border-2 border-primary" />
                      </div>
                    )}
                    {!cameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary/80 p-4">
                        {varDisabled ? (
                          <>
                            <p className="max-w-xs text-center text-[11px] text-muted-foreground">VAR disabilitata su questo dispositivo.</p>
                            <Button variant="outline" size="sm" onClick={enableVar} className="gap-1.5">
                              <Video size={14} /> Riabilita VAR
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={startCamera} className="gap-1.5">
                              <Video size={14} /> Attiva Camera
                            </Button>
                            {isNative() && (
                              <p className="max-w-xs text-center text-[11px] text-muted-foreground">
                                {lastNativeError || "Avvio camera in corso o bloccato: riapri con Attiva Camera se necessario."}
                              </p>
                            )}
                            <button onClick={disableVar} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                              Non ho una fotocamera · disabilita VAR
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${webSupportsFocusPoint ? "cursor-crosshair" : ""}`}
                      style={{ willChange: "transform", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                      onClick={handleWebTapToFocus}
                      onTouchStart={handleWebTapToFocus}
                    />
                    {/* Web focus indicator */}
                    {focusPoint && usingWebRtcBackend && (
                      <div
                        className="absolute pointer-events-none z-20 animate-ping"
                        style={{
                          left: `${focusPoint.x}%`,
                          top: `${focusPoint.y}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="w-10 h-10 rounded-full border-2 border-primary" />
                      </div>
                    )}
                    {!cameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary/80 p-3">
                        {varDisabled ? (
                          <Button variant="outline" size="sm" onClick={enableVar} className="gap-1.5">
                            <Video size={14} /> Riabilita VAR
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={startCamera} className="gap-1.5">
                              <Video size={14} /> Attiva Camera
                            </Button>
                            <button onClick={disableVar} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                              Disabilita VAR
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
                {/* Overlays */}
                {recording && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge className="bg-destructive text-destructive-foreground text-[9px] animate-pulse">● REC</Badge>
                  </div>
                )}
                {cameraActive && (
                  <div className="absolute bottom-1 right-1 z-10">
                    <Badge variant="outline" className="bg-black/60 text-white border-white/20 text-[8px] font-mono">
                      {currentResLabel} · {currentFps}fps
                      {usingNativeBackend && nativeZoom > 1.05 ? ` · ${nativeZoom.toFixed(1)}x` : ""}
                      {usingNativeBackend ? " · Nativo" : cameraBackend === "webrtc" && isNative() ? " · WebRTC" : ""}
                    </Badge>
                  </div>
                )}
                {/* Toggle modalità manuale (anche da browser) */}
                <button
                  type="button"
                  onClick={() => toggleForceLandscape()}
                  className={`absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider backdrop-blur-md border shadow transition-colors ${forceLandscape ? "bg-primary text-primary-foreground border-primary" : "bg-black/60 text-white/90 border-white/15 hover:bg-black/80"}`}
                  title={forceLandscape ? "Passa alla modalità verticale" : "Passa alla modalità orizzontale"}
                >
                  {forceLandscape ? "↕ VERTICALE" : "↔ ORIZZONTALE"}
                </button>
                {/* Quick torch toggle while recording */}
                {usingNativeBackend && nativeHasFlash && cameraActive && recording && (
                  <button
                    onClick={handleNativeTorchToggle}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/50 text-white"
                  >
                    {nativeTorch ? <Flashlight size={14} /> : <FlashlightOff size={14} />}
                  </button>
                )}
              </div>
            </>
          )}

          {/* Camera controls */}
          {!reviewing && cameraActive && (
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              {!recording ? (
                <>
                  <Button
                    variant="outline"
                    className="h-11 text-sm gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={startRecording}
                  >
                    <Circle size={14} fill="currentColor" /> Registra
                  </Button>
                  <Button
                    variant="ghost"
                    className={`lg:hidden h-11 w-11 p-0 ${showSettings ? "text-primary" : "text-muted-foreground"}`}
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings size={16} />
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="h-11 text-sm gap-1.5 col-span-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={stopRecording}
                >
                  <Square size={14} fill="currentColor" /> Stop
                </Button>
              )}
              <Button variant="ghost" className="h-11 w-11 p-0 text-muted-foreground" onClick={stopCamera}>
                <VideoOff size={16} />
              </Button>
            </div>
          )}

          {/* Settings panel */}
          {cameraActive && !reviewing && !recording && (
            <>
              {showSettings && (
                <div className="lg:hidden bg-background/95 backdrop-blur-md rounded-xl p-3 shadow-lg border border-border animate-in fade-in slide-in-from-top-2 duration-200 max-h-[50vh] overflow-y-auto">
                  {renderSettingsContent(true)}
                </div>
              )}
              <div className="hidden lg:block bg-secondary/50 rounded-lg p-3">
                {renderSettingsContent(false)}
              </div>
            </>
          )}

          {!reviewing && cameraActive && hasRecording && !recording && (
            <Button variant="outline" className="w-full h-10 text-sm gap-1.5" onClick={openReview}>
              <Play size={14} /> Rivedi registrazione
            </Button>
          )}

          {/* Playback review */}
          {reviewing && (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
                <video
                  ref={playbackRef}
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setPlaying(false)}
                  className="w-full h-full object-cover"
                  style={{ position: "relative", zIndex: 5 }}
                />
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">REPLAY</Badge>
                </div>
              </div>

              <div className="space-y-1 px-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 accent-primary rounded-full cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 px-1">
                <Button variant="outline" className="h-11 p-0" onClick={skipBack5}>
                  <SkipBack size={18} />
                </Button>
                <Button variant="outline" className="h-11 p-0" onClick={togglePlay}>
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </Button>
                <Button variant="outline" className="h-11 text-xs font-mono font-bold" onClick={cycleSpeed}>
                  {playbackRate}x
                </Button>
                <Button variant="outline" className="h-11 gap-1 text-xs" onClick={downloadFull}>
                  <Download size={14} /> Salva
                </Button>
              </div>

              <Button variant="ghost" className="w-full h-9 text-xs text-muted-foreground" onClick={handleBackToLive}>
                ← Torna al live
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
