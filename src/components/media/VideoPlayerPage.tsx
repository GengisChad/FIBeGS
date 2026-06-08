import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Anime4KRenderer, type Anime4KError } from "./anime4k-renderer";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Play, Pause, Volume2, VolumeX, Maximize, List, X, SkipBack, SkipForward, RatioIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const isDirectVideoUrl = (url: string) =>
  /\.(mp4|webm|ogg|m3u8|mkv|avi|mov)(\?.*)?$/i.test(url);

export { isDirectVideoUrl };

type StreamingLink = { platform: string; url: string };

type Episode = {
  id: string;
  season_id: string;
  title: string;
  episode_number: number;
  video_url: string | null;
  is_youtube: boolean;
  platform: string | null;
  sort_order: number;
  streaming_links?: StreamingLink[] | null;
};

const STREAMING_PLATFORMS: Record<string, { label: string; color: string; icon: string }> = {
  netflix: { label: "Netflix", color: "bg-red-600 hover:bg-red-700", icon: "🎬" },
  primevideo: { label: "Prime Video", color: "bg-blue-600 hover:bg-blue-700", icon: "📺" },
  crunchyroll: { label: "Crunchyroll", color: "bg-orange-500 hover:bg-orange-600", icon: "🍥" },
  disneyplus: { label: "Disney+", color: "bg-blue-800 hover:bg-blue-900", icon: "✨" },
  other: { label: "Streaming", color: "bg-secondary hover:bg-secondary/80", icon: "🔗" },
};

interface VideoPlayerPageProps {
  episode: Episode;
  allEpisodes: Episode[];
  seriesTitle: string;
  seasonTitle: string;
  coverUrl: string | null;
  onClose: () => void;
  onSelectEpisode: (ep: Episode) => void;
}

const ASPECT_RATIOS = [
  { label: "Auto", value: "contain" },
  { label: "Stretch", value: "fill" },
  { label: "4:3", value: "4/3" },
  { label: "16:9", value: "16/9" },
  { label: "21:9", value: "21/9" },
] as const;

type AspectMode = typeof ASPECT_RATIOS[number]["value"];

const ENHANCE_MODES = [
  { label: "Off", value: "off" },
  { label: "Enhance", value: "basic", description: "Migliora contrasto e nitidezza" },
] as const;

type EnhanceMode = typeof ENHANCE_MODES[number]["value"];

const formatTime = (s: number) => {
  if (!isFinite(s) || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const extractYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

export const VideoPlayerPage = ({
  episode,
  allEpisodes,
  seriesTitle,
  seasonTitle,
  coverUrl,
  onClose,
  onSelectEpisode,
}: VideoPlayerPageProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [aspectMode, setAspectMode] = useState<AspectMode>("contain");
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [enhanceMode, setEnhanceMode] = useState<EnhanceMode>("off");
  const [enhanceFailed, setEnhanceFailed] = useState(false);
  const [enhanceCorsFallback, setEnhanceCorsFallback] = useState(false);
  const [enhanceError, setEnhanceError] = useState<Anime4KError | null>(null);
  const [corsSupported, setCorsSupported] = useState(true);
  const { isAdmin } = useUserRoles();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Anime4KRenderer | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const currentIndex = allEpisodes.findIndex(e => e.id === episode.id);
  const prevEp = currentIndex > 0 ? allEpisodes[currentIndex - 1] : null;
  const nextEp = currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null;

  const isYouTube = episode.is_youtube && episode.video_url;
  const isDirect = episode.video_url && !episode.is_youtube && isDirectVideoUrl(episode.video_url);

  // Anime4K renderer lifecycle — async init
  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new Anime4KRenderer(canvasRef.current);
    rendererRef.current = renderer;
    let cancelled = false;

    renderer.init().then(() => {
      if (cancelled) return;
      if (renderer.failed) {
        setEnhanceFailed(true);
        setEnhanceError(renderer.error);
      }
    });

    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Start/stop renderer based on enhance mode
  useEffect(() => {
    const renderer = rendererRef.current;
    const video = videoRef.current;

    if (!corsSupported || enhanceFailed || enhanceCorsFallback || !renderer || !video || !isDirect || enhanceMode === "off") {
      renderer?.stop();
      return;
    }

    let cancelled = false;

    const doStart = async () => {
      // Wait for video to have metadata so dimensions are known
      if (video.readyState < 1) {
        await new Promise<void>(resolve => {
          const handler = () => { video.removeEventListener("loadedmetadata", handler); resolve(); };
          video.addEventListener("loadedmetadata", handler);
        });
      }
      if (cancelled) return;

      renderer.setStrength(enhanceMode as "basic" | "ai");
      await renderer.start(video);

      if (cancelled) return;
      if (renderer.failed || !renderer.active) {
        const err = renderer.error;
        setEnhanceError(err);

        if (err?.stage === "cors") {
          setEnhanceCorsFallback(true);
          toast.message("Sorgente senza CORS: uso filtro compatibile locale");
          return;
        }

        setEnhanceFailed(true);
        setEnhanceMode("off");
        toast.error("Enhancement non disponibile su questo dispositivo");
      }
    };

    doStart();

    return () => {
      cancelled = true;
      renderer.stop();
    };
  }, [enhanceMode, isDirect, episode.id, enhanceFailed, enhanceCorsFallback]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      try { (screen.orientation as any).unlock?.(); } catch {}
    } else {
      containerRef.current.requestFullscreen().then(() => {
        try { (screen.orientation as any).lock?.("landscape").catch(() => {}); } catch {}
      });
    }
  }, []);

  const handleInteraction = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    setEnhanceFailed(false);
    setEnhanceCorsFallback(false);
    setEnhanceError(null);
    setCorsSupported(true);

    if (videoRef.current && isDirect) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
      setPlaying(true);
      setCurrentTime(0);
    }
  }, [episode.id, isDirect]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setPlaylistOpen(!mq.matches);
  }, []);

  // Compute video style based on aspect mode
  // "contain" = fit inside keeping original ratio
  // "fill" = stretch to fill entire container
  // specific ratios = stretch video to that exact ratio, centered in container
  const getVideoClassName = () => {
    if (aspectMode === "contain") return "w-full h-full object-contain";
    if (aspectMode === "fill") return "w-full h-full object-fill";
    // For specific ratios: use object-fill to stretch into the aspect-ratio box
    return "object-fill max-w-full max-h-full";
  };

  const getVideoStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {};
    if (aspectMode !== "contain" && aspectMode !== "fill") {
      base.aspectRatio = aspectMode;
      base.width = "100%";
      base.height = "100%";
    }

    const useCssFallbackEnhance = enhanceMode !== "off" && (!corsSupported || enhanceCorsFallback);
    if (useCssFallbackEnhance) {
      base.filter = "contrast(1.15) saturate(1.18) brightness(1.04)";
      base.willChange = "filter";
    }

    return base;
  };

  const isEnhanceActive = enhanceMode !== "off" && (!enhanceFailed || enhanceCorsFallback || !corsSupported);
  const isRendererEnhanceActive = isEnhanceActive && !enhanceCorsFallback && corsSupported;
  const isHardEnhanceFailure = enhanceFailed && !enhanceCorsFallback && corsSupported;

  const currentAspectLabel = ASPECT_RATIOS.find(a => a.value === aspectMode)?.label || "Auto";
  const currentEnhanceLabel = ENHANCE_MODES.find(e => e.value === enhanceMode)?.label || "Off";

  return (
    <div className="fixed inset-0 z-[130] bg-background flex flex-col overflow-hidden">
      {/* SVG sharpen filters for CSS filter fallback */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="video-sharpen-light">
            <feConvolveMatrix order="3" kernelMatrix="0 -0.5 0 -0.5 3 -0.5 0 -0.5 0" preserveAlpha="true" />
          </filter>
          <filter id="video-sharpen-strong">
            <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true" />
          </filter>
        </defs>
      </svg>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-card/80 backdrop-blur-sm border-b border-border shrink-0 min-w-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm shrink-0">
          <ChevronLeft size={16} /> <span className="hidden sm:inline">Torna alla lista</span><span className="sm:hidden">Indietro</span>
        </button>
        <div className="text-center flex-1 min-w-0 px-2 sm:px-4">
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{seriesTitle} · {seasonTitle}</p>
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">EP {episode.episode_number} — {episode.title}</p>
        </div>
        <button
          onClick={() => setPlaylistOpen(!playlistOpen)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm shrink-0 md:hidden"
        >
          <List size={18} />
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {/* Video area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div
            ref={containerRef}
            className="flex-1 relative bg-black flex items-center justify-center cursor-pointer min-h-0 overflow-hidden"
            onMouseMove={handleInteraction}
            onTouchStart={handleInteraction}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-controls]") || target.closest("[role='menu']") || target.closest("[data-radix-popper-content-wrapper]")) return;
              if (isDirect) togglePlay();
            }}
          >
            {isDirect ? (
              <>
                <video
                  ref={videoRef}
                  src={episode.video_url!}
                  crossOrigin={corsSupported ? "anonymous" : undefined}
                  playsInline
                  autoPlay
                  className={getVideoClassName()}
                  style={getVideoStyle()}
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                  onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => { if (nextEp) onSelectEpisode(nextEp); }}
                  onError={() => {
                    // If CORS setting causes media load issues, retry playback without CORS mode.
                    if (corsSupported && videoRef.current && !videoRef.current.currentTime) {
                      console.warn("Anime4K: retrying video load without crossOrigin");
                      setCorsSupported(false);
                      setEnhanceCorsFallback(true);
                      setEnhanceError({ stage: "cors", message: "Sorgente senza CORS: fallback locale attivo" });
                      rendererRef.current?.stop();
                      // Force reload after React re-renders without crossOrigin
                      setTimeout(() => {
                        if (videoRef.current) {
                          videoRef.current.load();
                          videoRef.current.play().catch(() => {});
                        }
                      }, 50);
                    }
                  }}
                  muted={muted}
                />

                {/* Anime4K canvas overlay */}
                <canvas
                  ref={canvasRef}
                  className={cn(
                    "absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300",
                    isRendererEnhanceActive ? "opacity-100" : "opacity-0"
                  )}
                  style={{ objectFit: aspectMode === "fill" ? "fill" : "contain" }}
                />

                <div
                  data-controls
                  className={cn(
                    "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 sm:px-4 pb-[84px] md:pb-3 pt-8 transition-opacity duration-300",
                    showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  {/* Progress bar */}
                  <div
                    className="mb-2 sm:mb-3 py-2 -my-2"
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={0.5}
                      onValueChange={([v]) => {
                        if (videoRef.current) videoRef.current.currentTime = v;
                        setCurrentTime(v);
                      }}
                      className="cursor-pointer [&_[role=slider]]:bg-primary [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 sm:[&_[role=slider]]:h-3 sm:[&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_.relative]:h-2 sm:[&_.relative]:h-1 [&_.absolute]:bg-primary [&_.relative]:bg-white/30"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1 sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        onClick={() => prevEp && onSelectEpisode(prevEp)}
                        disabled={!prevEp}
                        className="text-white/70 hover:text-white disabled:text-white/20 transition-colors"
                      >
                        <SkipBack size={16} />
                      </button>
                      <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                        {playing ? <Pause size={20} /> : <Play size={20} fill="white" />}
                      </button>
                      <button
                        onClick={() => nextEp && onSelectEpisode(nextEp)}
                        disabled={!nextEp}
                        className="text-white/70 hover:text-white disabled:text-white/20 transition-colors"
                      >
                        <SkipForward size={16} />
                      </button>
                      <span className="text-[10px] sm:text-xs text-white/60 ml-1 sm:ml-2 font-mono whitespace-nowrap">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      {/* Volume with slider */}
                      <div className="relative flex items-center">
                        <button
                          onClick={() => {
                            // On mobile: toggle volume slider; on all: toggle mute
                            if ('ontouchstart' in window) {
                              setShowVolumeSlider(v => !v);
                            } else {
                              setMuted(!muted);
                            }
                          }}
                          onMouseEnter={() => {
                            if (!('ontouchstart' in window)) {
                              if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
                              setShowVolumeSlider(true);
                            }
                          }}
                          className="text-white/70 hover:text-white transition-colors"
                        >
                          {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <div
                          className={cn(
                            "overflow-hidden transition-all duration-200 flex items-center",
                            showVolumeSlider ? "w-20 sm:w-24 ml-1.5 opacity-100" : "w-0 ml-0 opacity-0"
                          )}
                          onMouseLeave={() => {
                            if (!('ontouchstart' in window)) {
                              volumeTimerRef.current = setTimeout(() => setShowVolumeSlider(false), 500);
                            }
                          }}
                        >
                          <Slider
                            value={[muted ? 0 : volume * 100]}
                            max={100}
                            step={1}
                            onValueChange={([v]) => {
                              const newVol = v / 100;
                              setVolume(newVol);
                              if (newVol > 0 && muted) setMuted(false);
                              if (newVol === 0) setMuted(true);
                            }}
                            className="cursor-pointer [&_[role=slider]]:bg-white [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_.relative]:h-1 [&_.absolute]:bg-white [&_.relative]:bg-white/20"
                          />
                        </div>
                      </div>

                      {/* Enhancement selector */}
                      {isHardEnhanceFailure ? (
                        <button
                          className="transition-colors flex items-center gap-1 text-[10px] sm:text-xs text-red-400/60 cursor-not-allowed"
                          onClick={() => {
                            if (isAdmin && enhanceError) {
                              toast.error(
                                `Anime4K Error [${enhanceError.stage}]: ${enhanceError.message}${enhanceError.details ? `\n\nDetails: ${enhanceError.details}` : ""}`,
                                { duration: 15000 }
                              );
                            } else {
                              toast.error("Enhancement non disponibile su questo dispositivo");
                            }
                          }}
                        >
                          <Sparkles size={14} />
                          <span className="hidden sm:inline line-through">Enhance</span>
                        </button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn(
                              "transition-colors flex items-center gap-1 text-[10px] sm:text-xs",
                              enhanceMode !== "off" ? "text-primary" : "text-white/70 hover:text-white"
                            )}>
                              <Sparkles size={14} />
                              <span className="hidden sm:inline">{currentEnhanceLabel}</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="top" align="end" className="min-w-[140px] z-[140]" container={containerRef.current}>
                            {ENHANCE_MODES.map(em => (
                              <DropdownMenuItem
                                key={em.value}
                                onClick={() => setEnhanceMode(em.value)}
                                className={cn(
                                  "flex flex-col items-start",
                                  enhanceMode === em.value && "bg-primary/10 text-primary font-semibold"
                                )}
                              >
                                <span>{em.label}</span>
                                {"description" in em && em.description && (
                                  <span className="text-[10px] text-muted-foreground font-normal">{em.description}</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {/* Aspect ratio selector */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-white/70 hover:text-white transition-colors flex items-center gap-1 text-[10px] sm:text-xs">
                            <RatioIcon size={14} />
                            <span className="hidden sm:inline">{currentAspectLabel}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="end" className="min-w-[100px] z-[140]" container={containerRef.current}>
                          {ASPECT_RATIOS.map(ar => (
                            <DropdownMenuItem
                              key={ar.value}
                              onClick={() => setAspectMode(ar.value)}
                              className={cn(aspectMode === ar.value && "bg-primary/10 text-primary font-semibold")}
                            >
                              {ar.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Playlist toggle (desktop) */}
                      <button
                        onClick={() => setPlaylistOpen(!playlistOpen)}
                        className="text-white/70 hover:text-white transition-colors hidden md:block"
                      >
                        <List size={16} />
                      </button>
                      {/* Fullscreen */}
                      <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
                        <Maximize size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : isYouTube ? (
              <iframe
                src={`https://www.youtube.com/embed/${extractYouTubeId(episode.video_url!)}?autoplay=1&rel=0`}
                title={episode.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            ) : (
              <div className="text-center p-8 space-y-4">
                <p className="text-muted-foreground mb-4">Video disponibile su piattaforma esterna</p>
                {episode.video_url && (
                  <Button asChild>
                    <a href={episode.video_url} target="_blank" rel="noopener noreferrer">
                      Apri su {episode.platform || "piattaforma esterna"}
                    </a>
                  </Button>
                )}
                {episode.streaming_links && episode.streaming_links.length > 0 && (
                  <div className="flex flex-wrap gap-3 justify-center mt-4">
                    {episode.streaming_links.map((link, i) => {
                      const info = STREAMING_PLATFORMS[link.platform] || STREAMING_PLATFORMS.other;
                      return (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center gap-2 px-5 py-3 rounded-lg text-white font-semibold text-sm transition-colors shadow-lg",
                            info.color
                          )}
                        >
                          <span className="text-lg">{info.icon}</span>
                          Guarda su {info.label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prev/Next buttons bar (below video, for YouTube/external) */}
          {!isDirect && (
            <div className="flex items-center justify-between px-4 py-3 bg-card border-t border-border shrink-0" data-controls>
              <Button
                variant="ghost"
                size="sm"
                disabled={!prevEp}
                onClick={() => prevEp && onSelectEpisode(prevEp)}
                className="gap-1.5"
              >
                <SkipBack size={14} />
                <span className="hidden sm:inline">Ep. precedente</span>
              </Button>
              <span className="text-xs text-muted-foreground">
                Episodio {episode.episode_number} di {allEpisodes.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!nextEp}
                onClick={() => nextEp && onSelectEpisode(nextEp)}
                className="gap-1.5"
              >
                <span className="hidden sm:inline">Ep. successivo</span>
                <SkipForward size={14} />
              </Button>
            </div>
          )}

          {/* Streaming links bar (shown for all episode types when links exist) */}
          {(isDirect || isYouTube) && episode.streaming_links && episode.streaming_links.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-card border-t border-border shrink-0 overflow-x-auto">
              <span className="text-xs text-muted-foreground shrink-0">Disponibile anche su:</span>
              {episode.streaming_links.map((link, i) => {
                const info = STREAMING_PLATFORMS[link.platform] || STREAMING_PLATFORMS.other;
                return (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-medium transition-colors shrink-0",
                      info.color
                    )}
                  >
                    <span>{info.icon}</span>
                    {info.label}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Playlist sidebar */}
        <div
          className={cn(
            "border-l border-border bg-card flex flex-col shrink-0 transition-all duration-300 overflow-hidden",
            playlistOpen ? "w-[85vw] sm:w-72 md:w-80 lg:w-96 max-w-full" : "w-0",
            "absolute md:relative right-0 top-0 bottom-0 z-10 md:z-auto"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Episodi</h3>
            <button onClick={() => setPlaylistOpen(false)} className="text-muted-foreground hover:text-foreground md:hidden">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {allEpisodes.map(ep => {
              const isActive = ep.id === episode.id;
              const hasVideo = !!ep.video_url;
              return (
                <button
                  key={ep.id}
                  onClick={() => { if (hasVideo) onSelectEpisode(ep); }}
                  disabled={!hasVideo}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50",
                    isActive
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-secondary/50",
                    !hasVideo && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div className="relative w-16 aspect-video rounded overflow-hidden bg-secondary shrink-0">
                    {coverUrl ? (
                      <img src={coverUrl} alt="" className="w-full h-full object-cover opacity-60" />
                    ) : (
                      <div className="w-full h-full bg-secondary" />
                    )}
                    {isActive && playing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="flex gap-0.5">
                          <div className="w-0.5 h-3 bg-primary animate-pulse" />
                          <div className="w-0.5 h-3 bg-primary animate-pulse delay-100" />
                          <div className="w-0.5 h-3 bg-primary animate-pulse delay-200" />
                        </div>
                      </div>
                    )}
                    {!isActive && hasVideo && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play size={12} className="text-white/70" fill="white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs font-mono mb-0.5",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      EP {ep.episode_number}
                    </p>
                    <p className={cn(
                      "text-sm leading-tight line-clamp-2",
                      isActive ? "font-semibold text-foreground" : "text-foreground/80"
                    )}>
                      {ep.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
