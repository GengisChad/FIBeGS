import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Nfc, Camera, CameraOff, CheckCircle2, X, Scan, Loader2 } from "lucide-react";

interface CheckinScannerProps {
  tournamentId: string;
  registrations: Array<{
    id: string;
    user_id: string;
    is_ready: boolean;
    child_profile_id: string | null;
  }>;
  profileMap: Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>;
  onCheckinComplete: () => void;
}

const supportsNfc = typeof window !== "undefined" && "NDEFReader" in window;

export const CheckinScanner = ({
  tournamentId,
  registrations,
  profileMap,
  onCheckinComplete,
}: CheckinScannerProps) => {
  const [active, setActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [nfcActive, setNfcActive] = useState(false);
  const [lastCheckedIn, setLastCheckedIn] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [checkedCount, setCheckedCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);

  const processCheckin = useCallback(async (userId: string) => {
    if (processing) return;
    setProcessing(true);

    const reg = registrations.find(r => r.user_id === userId || r.child_profile_id === userId);
    if (!reg) {
      toast.error("Giocatore non iscritto a questo torneo");
      setProcessing(false);
      return;
    }
    if (reg.is_ready) {
      const profile = profileMap.get(reg.user_id);
      toast.info(`${profile?.display_name || "Giocatore"} è già checked-in`);
      setProcessing(false);
      return;
    }

    const { error } = await supabase
      .from("tournament_registrations")
      .update({ is_ready: true })
      .eq("id", reg.id);

    if (error) {
      toast.error("Errore nel check-in");
      console.error(error);
    } else {
      const profile = profileMap.get(reg.user_id);
      const name = profile?.display_name || profile?.username || "Giocatore";
      setLastCheckedIn(name);
      setCheckedCount(prev => prev + 1);
      toast.success(`✅ ${name} - Check-in completato!`);
      onCheckinComplete();
    }
    setProcessing(false);
  }, [processing, registrations, profileMap, onCheckinComplete]);

  // Extract user ID from QR data (URL or raw ID)
  const extractUserId = useCallback((data: string): string | null => {
    // Format: checkin:<tournamentId>:<userId>
    const checkinMatch = data.match(/checkin:([^:]+):([a-f0-9-]{36})/);
    if (checkinMatch && checkinMatch[1] === tournamentId) {
      return checkinMatch[2];
    }
    // Format: profile URL
    const profileMatch = data.match(/\/profilo\/([^/?#]+)/);
    if (profileMatch) {
      // Look up user by username
      const username = profileMatch[1];
      for (const [userId, profile] of profileMap.entries()) {
        if (profile.username === username) return userId;
      }
    }
    // Raw UUID
    if (/^[a-f0-9-]{36}$/.test(data)) return data;
    return null;
  }, [tournamentId, profileMap]);

  // QR code scanning using BarcodeDetector or canvas analysis
  const scanQR = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          const userId = extractUserId(barcodes[0].rawValue);
          if (userId) await processCheckin(userId);
        }
      }
    } catch {
      // BarcodeDetector not available or failed
    }
  }, [extractUserId, processCheckin]);

  const startCamera = useCallback(async () => {
    try {
      // Check permission state when supported (not on iOS Safari, but useful elsewhere)
      if (navigator.permissions && (navigator.permissions as any).query) {
        try {
          const status = await navigator.permissions.query({ name: "camera" as PermissionName });
          if (status.state === "denied") {
            toast.error("Permesso fotocamera negato. Abilitalo dalle Impostazioni di Safari/iOS per questo sito.");
            return;
          }
        } catch {
          // Safari iOS doesn't support permissions.query for camera — proceed
        }
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("La fotocamera non è disponibile. Apri il sito in Safari (non in app come Instagram/Facebook).");
        return;
      }

      // Request the highest practical resolution + continuous autofocus.
      // Using `ideal` (not `exact`) so the browser falls back gracefully
      // on devices that can't deliver 1080p/4K from the rear camera.
      const videoConstraints: any = {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
        focusMode: { ideal: "continuous" },
        advanced: [
          { focusMode: "continuous" },
          { width: 3840, height: 2160 },
          { width: 1920, height: 1080 },
        ],
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      // Try to apply continuous autofocus / higher resolution after the fact
      // (some browsers accept constraints only via applyConstraints).
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps: any = track.getCapabilities?.() ?? {};
          const advanced: any[] = [];
          if (caps.focusMode?.includes?.("continuous")) {
            advanced.push({ focusMode: "continuous" });
          }
          if (caps.whiteBalanceMode?.includes?.("continuous")) {
            advanced.push({ whiteBalanceMode: "continuous" });
          }
          if (caps.exposureMode?.includes?.("continuous")) {
            advanced.push({ exposureMode: "continuous" });
          }
          if (advanced.length > 0) {
            await track.applyConstraints({ advanced } as any).catch(() => {});
          }
        } catch {
          // Capabilities API not supported — ignore
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS requires playsInline + a user-gesture-initiated play()
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      // Start scanning every 500ms
      scanIntervalRef.current = window.setInterval(scanQR, 500);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast.error("Permesso fotocamera negato. Vai in Impostazioni → Safari → Fotocamera e consenti l'accesso.");
      } else if (err?.name === "NotFoundError") {
        toast.error("Nessuna fotocamera trovata sul dispositivo.");
      } else if (err?.name === "NotReadableError") {
        toast.error("Fotocamera in uso da un'altra app. Chiudila e riprova.");
      } else {
        toast.error("Impossibile accedere alla fotocamera");
        console.error("Camera error:", err);
      }
    }
  }, [scanQR]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const startNfc = useCallback(async () => {
    if (!supportsNfc) return;
    try {
      const ndef = new (window as any).NDEFReader();
      const abort = new AbortController();
      nfcAbortRef.current = abort;
      await ndef.scan({ signal: abort.signal });
      setNfcActive(true);

      ndef.addEventListener("reading", ({ message }: any) => {
        for (const record of message.records) {
          if (record.recordType === "url" || record.recordType === "text") {
            const decoder = new TextDecoder();
            const data = decoder.decode(record.data);
            const userId = extractUserId(data);
            if (userId) processCheckin(userId);
          }
        }
      });
    } catch {
      toast.error("Impossibile attivare NFC");
    }
  }, [extractUserId, processCheckin]);

  const stopNfc = useCallback(() => {
    nfcAbortRef.current?.abort();
    nfcAbortRef.current = null;
    setNfcActive(false);
  }, []);

  const startScanning = useCallback(() => {
    setActive(true);
    setCheckedCount(0);
    setLastCheckedIn(null);
    startCamera();
    if (supportsNfc) startNfc();
  }, [startCamera, startNfc]);

  const stopScanning = useCallback(() => {
    stopCamera();
    stopNfc();
    setActive(false);
  }, [stopCamera, stopNfc]);

  useEffect(() => {
    return () => {
      stopCamera();
      stopNfc();
    };
  }, []);

  if (!active) {
    return (
      <Button onClick={startScanning} className="gap-2 w-full">
        <Scan size={16} /> Apri Scanner Check-in
      </Button>
    );
  }

  const readyCount = registrations.filter(r => r.is_ready).length + checkedCount;
  const totalCount = registrations.length;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scan size={18} className="text-primary" />
          <span className="font-semibold text-sm">Scanner Check-in</span>
          <Badge variant="secondary">{readyCount}/{totalCount}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {supportsNfc && (
            <Badge variant={nfcActive ? "default" : "outline"} className="text-xs gap-1">
              <Nfc size={10} /> NFC
            </Badge>
          )}
          <Button size="sm" variant="ghost" onClick={stopScanning}>
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="relative bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-2 border-primary rounded-2xl opacity-60" />
        </div>

        {/* Processing indicator */}
        {processing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 size={32} className="text-primary animate-spin" />
          </div>
        )}

        {/* Last checked in */}
        {lastCheckedIn && !processing && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} />
            <span className="text-sm font-medium">{lastCheckedIn}</span>
          </div>
        )}
      </div>

      <div className="p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Inquadra il QR code del giocatore{supportsNfc ? " o avvicina il suo telefono" : ""}
        </p>
      </div>
    </div>
  );
};
