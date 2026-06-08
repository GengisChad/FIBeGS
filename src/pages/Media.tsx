import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Film, BookOpen, ChevronRight, ChevronLeft, Play, ExternalLink, FileText, ArrowLeft, Layers, Search, X, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { VideoPlayerPage, isDirectVideoUrl } from "@/components/media/VideoPlayerPage";

type Category = { id: string; name: string; type: string; cover_url: string | null; sort_order: number };
type Series = { id: string; category_id: string; title: string; cover_url: string | null; sort_order: number; description: string | null; genre: string | null; year: number | null; episodes_count: number | null };
type Season = { id: string; series_id: string; title: string; sort_order: number; cover_url: string | null; description: string | null };
type StreamingLink = { platform: string; url: string };
type Episode = { id: string; season_id: string; title: string; episode_number: number; video_url: string | null; is_youtube: boolean; platform: string | null; sort_order: number; streaming_links?: StreamingLink[] | null };
type Chapter = { id: string; season_id: string; title: string; chapter_number: number; pdf_url: string | null; sort_order: number };

type LatestEpisode = Episode & { series_title: string; season_title: string; series_cover: string | null; season_cover: string | null; series_id: string; category_type: string };

const extractYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const ScrollRow = ({ children, title }: { children: React.ReactNode; title: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const checkScroll = () => {
    if (!ref.current) return;
    setCanScrollLeft(ref.current.scrollLeft > 10);
    setCanScrollRight(ref.current.scrollLeft + ref.current.clientWidth < ref.current.scrollWidth - 10);
  };
  useEffect(() => {
    checkScroll();
    const el = ref.current;
    el?.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => { el?.removeEventListener("scroll", checkScroll); window.removeEventListener("resize", checkScroll); };
  }, [children]);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  return (
    <div className="relative group/row mb-8 md:mb-10">
      <div className="flex items-center justify-between mb-3 px-4 md:px-8 lg:px-12">
        <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="relative">
        {canScrollLeft && <button onClick={() => scroll(-1)} className="absolute left-0 top-0 bottom-0 w-10 md:w-14 z-10 bg-gradient-to-r from-background/90 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"><ChevronLeft size={28} className="text-foreground" /></button>}
        <div ref={ref} className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-8 lg:px-12 scroll-smooth">{children}</div>
        {canScrollRight && <button onClick={() => scroll(1)} className="absolute right-0 top-0 bottom-0 w-10 md:w-14 z-10 bg-gradient-to-l from-background/90 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"><ChevronRight size={28} className="text-foreground" /></button>}
      </div>
    </div>
  );
};

const PosterCard = ({ imageUrl, title, subtitle, onClick, aspectWide }: { imageUrl: string | null; title: string; subtitle?: string; onClick: () => void; aspectWide?: boolean }) => (
  <button onClick={onClick} className={cn("group/card relative shrink-0 rounded-md overflow-hidden transition-all duration-300 hover:scale-105 hover:z-10 hover:shadow-[0_8px_30px_hsl(0_0%_0%/0.7)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none", aspectWide ? "w-[260px] md:w-[300px] lg:w-[340px]" : "w-[140px] md:w-[170px] lg:w-[200px]")}>
    <div className={cn("relative overflow-hidden rounded-md", aspectWide ? "aspect-video" : "aspect-[2/3]")}>
      {imageUrl ? <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-secondary flex items-center justify-center"><Film size={40} className="text-muted-foreground/40" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 transition-all duration-300">
        <p className="text-sm md:text-base font-semibold text-white leading-tight line-clamp-2">{title}</p>
        {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="mt-1.5 px-0.5 md:hidden">
      <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{title}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  </button>
);

const BackBar = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={onClick} className="absolute top-4 left-4 md:left-8 z-20 flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm">
    <ArrowLeft size={16} /> {label}
  </button>
);

const CrossfadeHero = ({ covers, children }: { covers: string[]; children: React.ReactNode }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => { if (covers.length <= 1) return; const interval = setInterval(() => setActiveIdx(prev => (prev + 1) % covers.length), 6000); return () => clearInterval(interval); }, [covers.length]);
  return (
    <div className="relative h-[50vh] md:h-[55vh] lg:h-[60vh] overflow-hidden">
      {covers.map((url, i) => <img key={url} src={url} alt="" loading="lazy" decoding="async" className={cn("absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-[2000ms] ease-in-out", i === activeIdx ? "opacity-100" : "opacity-0")} />)}
      {covers.length === 0 && <div className="absolute inset-0 bg-gradient-to-br from-secondary to-background" />}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent media-hero-scrim" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
      {children}
    </div>
  );
};

const Media = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["media-catalog"],
    queryFn: async () => {
      const [{ data: cats }, { data: seriesData }, { data: seasonsData }, { data: latestEps }, { data: epSeasonIds }, { data: chSeasonIds }] = await Promise.all([
        supabase.from("media_categories").select("*").order("sort_order"),
        supabase.from("media_series").select("*").order("sort_order"),
        supabase.from("media_seasons").select("*").order("sort_order"),
        supabase.from("media_episodes").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("media_episodes").select("season_id"),
        supabase.from("media_chapters").select("season_id"),
      ]);
      const seasonIdsWithContent = new Set<string>();
      (epSeasonIds || []).forEach((r: any) => seasonIdsWithContent.add(r.season_id));
      (chSeasonIds || []).forEach((r: any) => seasonIdsWithContent.add(r.season_id));
      const filteredSeasons = ((seasonsData as Season[]) || []).filter(s => seasonIdsWithContent.has(s.id));
      const seriesIdsWithContent = new Set(filteredSeasons.map(s => s.series_id));
      const filteredSeries = ((seriesData as Series[]) || []).filter(s => seriesIdsWithContent.has(s.id));
      const catIdsWithContent = new Set(filteredSeries.map(s => s.category_id));
      const filteredCategories = ((cats as Category[]) || []).filter(c => catIdsWithContent.has(c.id));
      return { categories: filteredCategories, allSeries: filteredSeries, allSeasons: filteredSeasons, latestEps: (latestEps as unknown as Episode[]) || [] };
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: true,
  });

  const categories = catalog?.categories || [];
  const allSeries = catalog?.allSeries || [];
  const allSeasons = catalog?.allSeasons || [];
  const loading = catalogLoading;

  const seriesMap = useMemo(() => { const map: Record<string, Series[]> = {}; allSeries.forEach(s => { if (!map[s.category_id]) map[s.category_id] = []; map[s.category_id].push(s); }); return map; }, [allSeries]);
  const seasonsBySeriesId = useMemo(() => { const map = new Map<string, Season[]>(); allSeasons.forEach(s => { const arr = map.get(s.series_id) || []; arr.push(s); map.set(s.series_id, arr); }); return map; }, [allSeasons]);
  const seasonById = useMemo(() => new Map(allSeasons.map(s => [s.id, s])), [allSeasons]);
  const seriesById = useMemo(() => new Map(allSeries.map(s => [s.id, s])), [allSeries]);
  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const latestEpisodes = useMemo(() => {
    if (!catalog) return [];
    return catalog.latestEps.map(ep => {
      const season = seasonById.get(ep.season_id);
      const series = season ? seriesById.get(season.series_id) : undefined;
      const cat = series ? catById.get(series.category_id) : undefined;
      return { ...ep, series_title: series?.title || "", season_title: season?.title || "", series_cover: series?.cover_url || null, season_cover: season?.cover_url || null, series_id: series?.id || "", category_type: cat?.type || "anime" } as LatestEpisode;
    }).filter(ep => ep.series_title);
  }, [catalog, seasonById, seriesById, catById]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ series: any[]; seasons: any[]; episodes: LatestEpisode[]; chapters: any[] }>({ series: [], seasons: [], episodes: [], chapters: [] });
  const [searching, setSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const episodesCacheRef = useRef<Map<string, Episode[]>>(new Map());
  const chaptersCacheRef = useRef<Map<string, Chapter[]>>(new Map());
  const [playingEpisode, setPlayingEpisode] = useState<Episode | null>(null);
  const [readingChapter, setReadingChapter] = useState<Chapter | null>(null);
  const [heroSeriesIdx, setHeroSeriesIdx] = useState(0);

  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSearchResults({ series: [], seasons: [], episodes: [], chapters: [] }); return; }
    setSearching(true);
    const lq = query.trim().toLowerCase();
    const numQ = isNaN(Number(query)) ? -1 : Number(query);
    const q = `%${query.trim()}%`;
    const matchedSeries = allSeries.filter(s => s.title.toLowerCase().includes(lq)).slice(0, 10).map(s => { const cat = catById.get(s.category_id); return { ...s, category_name: cat?.name || "", category_type: cat?.type || "anime" }; });
    const matchedSeasons = allSeasons.filter(s => s.title.toLowerCase().includes(lq)).slice(0, 10).map(s => { const series = seriesById.get(s.series_id); const cat = series ? catById.get(series.category_id) : undefined; return { ...s, series_title: series?.title || "", series_id: series?.id || "", category_type: cat?.type || "anime" }; }).filter(s => s.series_title);
    const [{ data: episodesRes }, { data: chaptersRes }] = await Promise.all([
      supabase.from("media_episodes").select("*").or(`title.ilike.${q},episode_number.eq.${numQ}`).limit(15),
      supabase.from("media_chapters").select("*").or(`title.ilike.${q},chapter_number.eq.${numQ}`).limit(15),
    ]);
    const enrichedEps: LatestEpisode[] = ((episodesRes as unknown as Episode[]) || []).map(ep => { const season = seasonById.get(ep.season_id); const series = season ? seriesById.get(season.series_id) : undefined; const cat = series ? catById.get(series.category_id) : undefined; return { ...ep, series_title: series?.title || "", season_title: season?.title || "", series_cover: series?.cover_url || null, season_cover: season?.cover_url || null, series_id: series?.id || "", category_type: cat?.type || "anime" }; }).filter(ep => ep.series_title);
    const enrichedChapters = ((chaptersRes as Chapter[]) || []).map(ch => { const season = seasonById.get(ch.season_id); const series = season ? seriesById.get(season.series_id) : undefined; const cat = series ? catById.get(series.category_id) : undefined; return { ...ch, series_title: series?.title || "", season_title: season?.title || "", series_id: series?.id || "", season_id_ref: season?.id || "", category_type: cat?.type || "manga" }; }).filter(ch => ch.series_title);
    setSearchResults({ series: matchedSeries, seasons: matchedSeasons, episodes: enrichedEps, chapters: enrichedChapters });
    setSearching(false);
  }, [allSeries, allSeasons, categories, seasonById, seriesById, catById]);

  useEffect(() => { const timer = setTimeout(() => performSearch(searchQuery), 300); return () => clearTimeout(timer); }, [searchQuery, performSearch]);

  const openCategory = (cat: Category) => { setSelectedCategory(cat); setSelectedSeries(null); setSelectedSeason(null); setSearchOpen(false); setSearchQuery(""); };
  const openSeries = (s: Series) => { setSelectedSeries(s); setSelectedSeason(null); setSearchOpen(false); setSearchQuery(""); setSeasons(seasonsBySeriesId.get(s.id) || []); };
  const openSeason = async (s: Season) => {
    setSelectedSeason(s);
    const catType = selectedCategory?.type || catById.get(seriesById.get(s.series_id)?.category_id || "")?.type;
    if (catType === "anime" || catType !== "manga") {
      const cached = episodesCacheRef.current.get(s.id);
      if (cached) { setEpisodes(cached); return; }
      const { data } = await supabase.from("media_episodes").select("*").eq("season_id", s.id).order("sort_order");
      const eps = (data as unknown as Episode[]) || [];
      episodesCacheRef.current.set(s.id, eps);
      setEpisodes(eps);
    } else {
      const cached = chaptersCacheRef.current.get(s.id);
      if (cached) { setChapters(cached); return; }
      const { data } = await supabase.from("media_chapters").select("*").eq("season_id", s.id).order("sort_order");
      const chs = (data as Chapter[]) || [];
      chaptersCacheRef.current.set(s.id, chs);
      setChapters(chs);
    }
  };

  const playEpisode = (ep: Episode) => setPlayingEpisode(ep);
  const readChapter = (ch: Chapter) => setReadingChapter(ch);
  const goBack = () => { if (selectedSeason) setSelectedSeason(null); else if (selectedSeries) setSelectedSeries(null); else if (selectedCategory) setSelectedCategory(null); };

  const heroCovers = useMemo(() => {
    const topSeries = allSeries.filter(s => s.cover_url).slice(0, 5);
    return topSeries.map(s => s.cover_url!);
  }, [allSeries]);

  if (playingEpisode) {
    const catType = selectedCategory?.type || "anime";
    if (playingEpisode.video_url && isDirectVideoUrl(playingEpisode.video_url)) {
      return (
        <VideoPlayerPage
          episode={playingEpisode}
          allEpisodes={episodes}
          seriesTitle={selectedSeries?.title || ""}
          seasonTitle={selectedSeason?.title || ""}
          coverUrl={selectedSeries?.cover_url || null}
          onClose={() => setPlayingEpisode(null)}
          onSelectEpisode={(ep) => setPlayingEpisode(ep)}
        />
      );
    }
    const ytId = playingEpisode.video_url ? extractYouTubeId(playingEpisode.video_url) : null;
    const streamingLinks = (playingEpisode.streaming_links || []) as StreamingLink[];
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-20 pb-16 px-4 max-w-4xl mx-auto">
          <BackBar onClick={() => setPlayingEpisode(null)} label="Torna agli episodi" />
          <div className="mt-14">
            <h1 className="text-2xl md:text-3xl font-bold mb-4">{playingEpisode.title}</h1>
            {ytId ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1`} className="w-full h-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen title={playingEpisode.title} />
              </div>
            ) : playingEpisode.video_url ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <iframe src={playingEpisode.video_url} className="w-full h-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen title={playingEpisode.title} />
              </div>
            ) : null}
            {streamingLinks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Disponibile su:</h3>
                <div className="flex flex-wrap gap-2">
                  {streamingLinks.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-sm transition-colors">
                      <ExternalLink size={14} /> {link.platform}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (readingChapter) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-20 pb-16 px-4 max-w-4xl mx-auto">
          <BackBar onClick={() => setReadingChapter(null)} label="Torna ai capitoli" />
          <div className="mt-14">
            <h1 className="text-2xl md:text-3xl font-bold mb-4">{readingChapter.title}</h1>
            {readingChapter.pdf_url ? (
              <iframe src={readingChapter.pdf_url} className="w-full h-[80vh] rounded-lg border border-border" title={readingChapter.title} />
            ) : (
              <Alert><AlertDescription>PDF non disponibile per questo capitolo.</AlertDescription></Alert>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const currentCatType = selectedCategory?.type || (selectedSeries ? catById.get(selectedSeries.category_id)?.type : null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {selectedSeason && selectedSeries && (
        <div className="pt-20 pb-16">
          <CrossfadeHero covers={[selectedSeason.cover_url || selectedSeries.cover_url || ""].filter(Boolean)}>
            <BackBar onClick={goBack} label={selectedSeries.title} />
            <div className="absolute bottom-8 left-4 md:left-8 lg:left-12 z-10 max-w-xl">
              <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">{selectedSeason.title}</h1>
              {selectedSeason.description && <p className="text-white/70 mt-2 text-sm md:text-base line-clamp-3">{selectedSeason.description}</p>}
            </div>
          </CrossfadeHero>
          <div className="px-4 md:px-8 lg:px-12 mt-6">
            {currentCatType !== "manga" ? (
              episodes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {episodes.map(ep => {
                    const ytId = ep.video_url ? extractYouTubeId(ep.video_url) : null;
                    const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
                    const streamLinks = (ep.streaming_links || []) as StreamingLink[];
                    return (
                      <button key={ep.id} onClick={() => playEpisode(ep)} className="group relative bg-card rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all text-left">
                        <div className="aspect-video bg-secondary relative">
                          {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Play size={32} className="text-muted-foreground/40" /></div>}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Play size={40} className="text-white" /></div>
                        </div>
                        <div className="p-3">
                          <p className="font-medium text-sm line-clamp-2">{ep.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">Episodio {ep.episode_number}</p>
                          {streamLinks.length > 0 && <p className="text-[10px] text-primary mt-1">{streamLinks.map(l => l.platform).join(", ")}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : <p className="text-muted-foreground text-center py-12">Nessun episodio disponibile.</p>
            ) : (
              chapters.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {chapters.map(ch => (
                    <button key={ch.id} onClick={() => readChapter(ch)} className="group bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition-all text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><FileText size={20} className="text-primary" /></div>
                        <div>
                          <p className="font-medium text-sm line-clamp-2">{ch.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Capitolo {ch.chapter_number}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-center py-12">Nessun capitolo disponibile.</p>
            )}
          </div>
        </div>
      )}

      {selectedSeries && !selectedSeason && (
        <div className="pt-20 pb-16">
          <CrossfadeHero covers={[selectedSeries.cover_url || ""].filter(Boolean)}>
            <BackBar onClick={goBack} label={selectedCategory?.name || "Indietro"} />
            <div className="absolute bottom-8 left-4 md:left-8 lg:left-12 z-10 max-w-xl">
              <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">{selectedSeries.title}</h1>
              {selectedSeries.description && <p className="text-white/70 mt-2 text-sm md:text-base line-clamp-3">{selectedSeries.description}</p>}
              <div className="flex gap-2 mt-3 flex-wrap">
                {selectedSeries.genre && <span className="px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs text-white/80">{selectedSeries.genre}</span>}
                {selectedSeries.year && <span className="px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs text-white/80">{selectedSeries.year}</span>}
              </div>
            </div>
          </CrossfadeHero>
          <div className="mt-6">
            {seasons.length > 0 ? (
              <ScrollRow title="Stagioni">
                {seasons.map(s => <PosterCard key={s.id} imageUrl={s.cover_url || selectedSeries.cover_url} title={s.title} onClick={() => openSeason(s)} />)}
              </ScrollRow>
            ) : <p className="text-muted-foreground text-center py-12">Nessuna stagione disponibile.</p>}
          </div>
        </div>
      )}

      {selectedCategory && !selectedSeries && (
        <div className="pt-20 pb-16">
          <div className="px-4 md:px-8 lg:px-12 mb-6">
            <BackBar onClick={goBack} label="Catalogo" />
            <h1 className="text-2xl md:text-3xl font-bold mt-14">{selectedCategory.name}</h1>
          </div>
          {(seriesMap[selectedCategory.id] || []).length > 0 ? (
            <ScrollRow title="Serie">
              {(seriesMap[selectedCategory.id] || []).map(s => <PosterCard key={s.id} imageUrl={s.cover_url} title={s.title} subtitle={s.genre || undefined} onClick={() => openSeries(s)} />)}
            </ScrollRow>
          ) : <p className="text-muted-foreground text-center py-12">Nessuna serie in questa categoria.</p>}
        </div>
      )}

      {!selectedCategory && !selectedSeries && !selectedSeason && (
        <div className="pt-16 pb-16">
          <CrossfadeHero covers={heroCovers}>
            <div className="absolute bottom-8 left-4 md:left-8 lg:left-12 z-10 max-w-lg">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">Media</h1>
              <p className="text-white/70 mt-2 text-sm md:text-base">Anime, manga e contenuti esclusivi per la community.</p>
            </div>
            <button onClick={() => setSearchOpen(true)} className="absolute top-4 right-4 md:right-8 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white/80 hover:text-white transition-colors">
              <Search size={20} />
            </button>
          </CrossfadeHero>

          <div className="mt-6">
            {loading ? <p className="text-muted-foreground text-center py-12">Caricamento catalogo...</p> : (
              <>
                {latestEpisodes.length > 0 && (
                  <ScrollRow title="Ultimi episodi aggiunti">
                    {latestEpisodes.map(ep => {
                      const ytId = ep.video_url ? extractYouTubeId(ep.video_url) : null;
                      const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : ep.series_cover;
                      return <PosterCard key={ep.id} imageUrl={thumb} title={ep.title} subtitle={`${ep.series_title} · EP ${ep.episode_number}`} onClick={() => { const series = seriesById.get(ep.series_id); const season = seasonById.get(ep.season_id); if (series) { const cat = catById.get(series.category_id); if (cat) setSelectedCategory(cat); openSeries(series); if (season) openSeason(season).then(() => playEpisode(ep)); } }} aspectWide />;
                    })}
                  </ScrollRow>
                )}
                {categories.map(cat => (
                  <ScrollRow key={cat.id} title={cat.name}>
                    {(seriesMap[cat.id] || []).map(s => <PosterCard key={s.id} imageUrl={s.cover_url} title={s.title} subtitle={s.genre || undefined} onClick={() => { setSelectedCategory(cat); openSeries(s); }} />)}
                  </ScrollRow>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cerca</DialogTitle></DialogHeader>
          <Input placeholder="Cerca serie, episodi, capitoli..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
          {searching && <p className="text-sm text-muted-foreground">Ricerca...</p>}
          {searchResults.series.length > 0 && (
            <div><h3 className="text-sm font-semibold mb-2">Serie</h3>
              {searchResults.series.map(s => (
                <button key={s.id} onClick={() => { const cat = catById.get(s.category_id); if (cat) setSelectedCategory(cat); openSeries(s); setSearchOpen(false); }} className="w-full text-left p-2 rounded hover:bg-accent text-sm">
                  <p className="font-medium">{s.title}</p><p className="text-xs text-muted-foreground">{s.category_name}</p>
                </button>
              ))}
            </div>
          )}
          {searchResults.episodes.length > 0 && (
            <div><h3 className="text-sm font-semibold mb-2">Episodi</h3>
              {searchResults.episodes.map(ep => (
                <button key={ep.id} onClick={() => { playEpisode(ep); setSearchOpen(false); }} className="w-full text-left p-2 rounded hover:bg-accent text-sm">
                  <p className="font-medium">{ep.title}</p><p className="text-xs text-muted-foreground">{ep.series_title} · EP {ep.episode_number}</p>
                </button>
              ))}
            </div>
          )}
          {searchResults.chapters.length > 0 && (
            <div><h3 className="text-sm font-semibold mb-2">Capitoli</h3>
              {searchResults.chapters.map((ch: any) => (
                <button key={ch.id} onClick={() => { readChapter(ch); setSearchOpen(false); }} className="w-full text-left p-2 rounded hover:bg-accent text-sm">
                  <p className="font-medium">{ch.title}</p><p className="text-xs text-muted-foreground">{ch.series_title} · Cap {ch.chapter_number}</p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Media;
