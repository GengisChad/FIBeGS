import { useRef, useState, useCallback, useEffect } from "react";
import { Play, Pause, SkipBack, Download, Video, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface Props {
  playbackRef: React.RefObject<HTMLVideoElement>;
  playing: boolean;
  duration: number;
  currentTime: number;
  playbackRate: number;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onEnded: () => void;
  onTogglePlay: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSkipBack: () => void;
  onCycleSpeed: () => void;
  onDownload: () => void;
  onBackToLive: () => void;
  formatTime: (s: number) => string;
}

export const ReplayLandscapeOverlay = ({
  playbackRef,
  playing,
  duration,
  currentTime,
  playbackRate,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onTogglePlay,
  onSeek,
  onSkipBack,
  onCycleSpeed,
  onDownload,
  onBackToLive,
  formatTime,
}: Props) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  // Pinch / pan tracking
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startPan: { x: number; y: number };
    startMid: { x: number; y: number };
  } | null>(null);
  const dragRef = useRef<{ x: number; y: number; startPan: { x: number; y: number } } | null>(null);

  const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
    // Limit pan so user can't drag the video fully off-screen.
    const maxOffset = 400 * (z - 1);
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, p.x)),
      y: Math.max(-maxOffset, Math.min(maxOffset, p.y)),
    };
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const stepZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const nz = Math.max(1, Math.min(5, z + delta));
      if (nz === 1) setPan({ x: 0, y: 0 });
      else setPan((p) => clampPan(p, nz));
      return nz;
    });
  }, [clampPan]);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2800);
  }, []);

  useEffect(() => {
    setControlsVisible(true);
    scheduleHide();
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [scheduleHide]);

  const handleSurfaceTouchStart = (e: React.TouchEvent) => {
    setControlsVisible(true);
    scheduleHide();
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      pinchRef.current = {
        startDist: dist,
        startZoom: zoom,
        startPan: pan,
        startMid: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
      };
      dragRef.current = null;
    } else if (e.touches.length === 1 && zoom > 1) {
      const t = e.touches[0];
      dragRef.current = { x: t.clientX, y: t.clientY, startPan: pan };
    }
  };

  const handleSurfaceTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const ratio = dist / pinchRef.current.startDist;
      const nz = Math.max(1, Math.min(5, pinchRef.current.startZoom * ratio));
      setZoom(nz);
      setPan(clampPan(pinchRef.current.startPan, nz));
    } else if (e.touches.length === 1 && dragRef.current && zoom > 1) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - dragRef.current.x;
      const dy = t.clientY - dragRef.current.y;
      setPan(clampPan({ x: dragRef.current.startPan.x + dx, y: dragRef.current.startPan.y + dy }, zoom));
    }
  };

  const handleSurfaceTouchEnd = () => {
    pinchRef.current = null;
    dragRef.current = null;
  };

  const lastTapRef = useRef<number>(0);
  const handleVideoClick = () => {
    setControlsVisible(true);
    scheduleHide();
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      // double tap → toggle zoom 1x ↔ 2x
      if (zoom > 1) resetView();
      else setZoom(2);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    onTogglePlay();
  };

  return (
    <div className="absolute inset-0 bg-black flex flex-col animate-in fade-in duration-200">
      {/* Video surface — full bleed, pinch/pan zoomable */}
      <div
        className="flex-1 relative bg-black overflow-hidden touch-none"
        onTouchStart={handleSurfaceTouchStart}
        onTouchMove={handleSurfaceTouchMove}
        onTouchEnd={handleSurfaceTouchEnd}
        onMouseMove={() => { setControlsVisible(true); scheduleHide(); }}
      >
        <video
          ref={playbackRef}
          playsInline
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          onClick={handleVideoClick}
          className="absolute inset-0 w-full h-full object-contain cursor-pointer transition-transform duration-150"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        />

        {/* Top floating bar — overlaid on video, doesn't shrink it.
            Left padding leaves room for the parent dialog's close (X) button. */}
        <div
          className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between pl-16 pr-3 py-2.5 pointer-events-none transition-opacity duration-300 ${
            controlsVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            onClick={onBackToLive}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur-md border border-white/15 text-white shadow-xl transition-all active:scale-95"
            title="Torna al live"
          >
            <Video size={13} />
            <span className="text-[11px] font-semibold tracking-wide">LIVE</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/25 backdrop-blur-md border border-accent/40 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold tracking-[0.18em] text-accent">REPLAY</span>
            {zoom > 1.05 && (
              <span className="text-[10px] font-mono text-accent/90">· {zoom.toFixed(1)}x</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => stepZoom(-0.5)}
              disabled={zoom <= 1.01}
              className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 disabled:opacity-30 backdrop-blur-md border border-white/15 text-white flex items-center justify-center shadow-lg transition-all active:scale-90"
              title="Zoom -"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => stepZoom(0.5)}
              disabled={zoom >= 4.99}
              className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 disabled:opacity-30 backdrop-blur-md border border-white/15 text-white flex items-center justify-center shadow-lg transition-all active:scale-90"
              title="Zoom +"
            >
              <ZoomIn size={14} />
            </button>
            {zoom > 1.01 && (
              <button
                onClick={resetView}
                className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur-md border border-white/15 text-white flex items-center justify-center shadow-lg transition-all active:scale-90"
                title="Reset zoom"
              >
                <Maximize2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Center play overlay when paused */}
        {!playing && duration > 0 && controlsVisible && (
          <button
            onClick={onTogglePlay}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto group z-10"
          >
            <span className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform shadow-2xl">
              <Play size={32} fill="currentColor" className="text-white ml-1" />
            </span>
          </button>
        )}

        {/* Bottom floating control panel — overlaid */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 px-3 pt-3 pb-2 space-y-1.5 bg-gradient-to-t from-black/85 via-black/55 to-transparent transition-opacity duration-300 ${
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Scrubber */}
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] text-white font-mono tabular-nums w-11 text-right drop-shadow">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              onChange={onSeek}
              className="flex-1 h-1.5 accent-primary rounded-full cursor-pointer"
            />
            <span className="text-[10px] text-white/80 font-mono tabular-nums w-11 drop-shadow">{formatTime(duration)}</span>
          </div>
          {/* Buttons */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={onSkipBack}
              className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-90 shadow-lg"
              title="-5s"
            >
              <SkipBack size={16} />
            </button>
            <button
              onClick={onTogglePlay}
              className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all active:scale-90 shadow-xl"
              title={playing ? "Pausa" : "Play"}
            >
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
            <button
              onClick={onCycleSpeed}
              className="h-10 min-w-[3rem] px-3 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-[12px] font-mono font-bold flex items-center justify-center transition-all active:scale-95 shadow-lg"
              title="Velocità"
            >
              {playbackRate}x
            </button>
            <button
              onClick={onDownload}
              className="h-10 px-3.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white flex items-center gap-1.5 transition-all active:scale-95 shadow-lg"
              title="Salva"
            >
              <Download size={14} />
              <span className="text-[11px] font-semibold">Salva</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
