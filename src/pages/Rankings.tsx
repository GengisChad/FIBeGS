import { useEffect, useState, useCallback, useMemo } from "react";
import { useRegions, useRankingsData, useRankingSeasons, useMunicipalities } from "@/hooks/useCachedQuery";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { PageShell } from "@/components/layout/PageShell";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Trophy, Medal, Award, Search, MapPin, Settings, RotateCcw, XCircle, ChevronDown, ChevronUp, RefreshCw, Info, User } from "lucide-react";
import { BncIcon } from "@/components/icons/BncIcon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TournamentRulesInfo } from "@/components/tournaments/TournamentRulesInfo";

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  city: string | null;
  points: number;
  wins: number;
  match_wins: number;
  tournament_count: number;
  region_id: string | null;
  club_region_id?: string | null;
  club_id?: string | null;
  club_name?: string | null;
  club_logo_url?: string | null;
  is_child?: boolean;
}

interface Region {
  id: string;
  name: string;
  code: string;
}

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  closed_at: string | null;
  bfl: number;
}

interface Snapshot {
  id: string;
  user_id: string;
  display_name: string | null;
  city: string | null;
  points: number;
  wins: number;
  final_rank: number;
}

const ITEMS_PER_PAGE = 25;

const Rankings = () => {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [myRankInfo, setMyRankInfo] = useState<{ rank: number; profile: Profile } | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");

  // Admin season settings
  const [showSettings, setShowSettings] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [seasonBfl, setSeasonBfl] = useState("10");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Region cities mapping for filtering
  const [regionCitiesMap, setRegionCitiesMap] = useState<Record<string, Set<string>>>({});

  // Archived season expansion
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const [archivedSnapshots, setArchivedSnapshots] = useState<Record<string, Snapshot[]>>({});
  const [showRulesInfo, setShowRulesInfo] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  // BFL view: "seasonal" (only seasonal BFL) or "monthly" (monthly+rollover, when enabled on the active season)
  const [bflView, setBflView] = useState<"seasonal" | "monthly">("seasonal");

  // Use cached data hooks
  const { data: rankingsProfiles = [], isLoading: rankingsLoading } = useRankingsData();
  const { data: seasonsData = [] } = useRankingSeasons();
  const rawProfiles = rankingsProfiles as Profile[];

  const monthlyEnabledOnActive = useMemo(
    () => !!(seasonsData as any[]).find((s: any) => s.is_active)?.monthly_bfl_enabled,
    [seasonsData]
  );
  // When the user views the Monthly+Rollover ranking, swap points/wins with their monthly counterparts and re-sort.
  const profiles = useMemo<Profile[]>(() => {
    if (bflView !== "monthly" || !monthlyEnabledOnActive) return rawProfiles;
    const swapped = rawProfiles.map((p: any) => ({
      ...p,
      points: p.points_monthly ?? 0,
      wins: p.wins_monthly ?? 0,
    }));
    swapped.sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if ((b.match_wins ?? 0) !== (a.match_wins ?? 0)) return (b.match_wins ?? 0) - (a.match_wins ?? 0);
      if ((a.tournament_count ?? 0) !== (b.tournament_count ?? 0)) return (a.tournament_count ?? 0) - (b.tournament_count ?? 0);
      return (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
    });
    return swapped;
  }, [rawProfiles, bflView, monthlyEnabledOnActive]);

  const seasons = useMemo(() => seasonsData.filter((s: any) => s.is_active), [seasonsData]);
  const closedSeasons = useMemo(() => seasonsData.filter((s: any) => !s.is_active && s.closed_at), [seasonsData]);

  // Use cached regions
  const { data: cachedRegions } = useRegions();
  useEffect(() => { if (cachedRegions) setRegions(cachedRegions as Region[]); }, [cachedRegions]);

  useEffect(() => {
    setLoading(rankingsLoading);
  }, [rankingsLoading]);

  // Calculate current user's rank when profiles change
  useEffect(() => {
    if (!user || profiles.length === 0) { setMyRankInfo(null); return; }
    const myProfile = profiles.find((p) => p.user_id === user.id && !p.is_child);
    if (myProfile && myProfile.points > 0) {
      const validProfiles = profiles.filter((p) => {
        const name = p.display_name || p.username || "";
        return p.points > 0 && !name.startsWith("[BOT]") && !name.startsWith("[Guest]");
      });
      const rank = validProfiles.findIndex((p) => p.user_id === user.id && !p.is_child) + 1;
      setMyRankInfo(rank > 0 ? { rank, profile: myProfile } : null);
    } else {
      setMyRankInfo(null);
    }
  }, [profiles, user]);

  const invalidateRankings = () => {
    queryClient.invalidateQueries({ queryKey: ["rankings-data-v10"] });
    queryClient.invalidateQueries({ queryKey: ["ranking-seasons"] });
  };

  // Build region->cities map from cached municipalities (no extra DB hit)
  const { data: cachedMunicipalities } = useMunicipalities();
  useEffect(() => {
    if (!cachedMunicipalities) return;
    const map: Record<string, Set<string>> = {};
    (cachedMunicipalities as any[]).forEach((m: any) => {
      if (!m.region_id) return;
      if (!map[m.region_id]) map[m.region_id] = new Set();
      map[m.region_id].add((m.name || "").toLowerCase());
    });
    setRegionCitiesMap(map);
  }, [cachedMunicipalities]);

  // Build the global rank map across all valid profiles (independent of search/filters),
  // sorted explicitly by the currently active view's points.
  const rankedProfiles = useMemo(() => {
    const valid = profiles.filter((profile) => {
      if (profile.points <= 0) return false;
      const name = profile.display_name || profile.username || "";
      if (name.startsWith("[BOT]") || name.startsWith("[Guest]")) return false;
      return true;
    });
    return [...valid].sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if ((b.match_wins ?? 0) !== (a.match_wins ?? 0)) return (b.match_wins ?? 0) - (a.match_wins ?? 0);
      if ((a.tournament_count ?? 0) !== (b.tournament_count ?? 0)) return (a.tournament_count ?? 0) - (b.tournament_count ?? 0);
      return (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
    });
  }, [profiles]);

  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    rankedProfiles.forEach((p, i) => {
      const key = `${p.user_id}_${p.is_child ? "c" : "u"}`;
      map.set(key, i + 1);
    });
    return map;
  }, [rankedProfiles]);

  const getProfileRank = (p: Profile) =>
    rankMap.get(`${p.user_id}_${p.is_child ? "c" : "u"}`) ?? 0;

  const filteredProfiles = useMemo(() => rankedProfiles.filter((profile) => {
    const name = profile.display_name || profile.username || "";
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = !cityFilter || (profile.city?.toLowerCase().includes(cityFilter.toLowerCase()));
    let matchesRegion = regionFilter === "all";
    if (!matchesRegion) {
      if (profile.region_id === regionFilter) matchesRegion = true;
      else if (!profile.region_id && profile.city && regionCitiesMap[regionFilter]) {
        matchesRegion = regionCitiesMap[regionFilter].has(profile.city.toLowerCase());
      }
    }
    return matchesSearch && matchesCity && matchesRegion;
  }), [rankedProfiles, searchQuery, cityFilter, regionFilter, regionCitiesMap]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0); }, [searchQuery, cityFilter, regionFilter]);

  const totalPages = Math.ceil(filteredProfiles.length / ITEMS_PER_PAGE);
  const paginatedProfiles = useMemo(
    () => filteredProfiles.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE),
    [filteredProfiles, currentPage]
  );

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy size={24} className="text-primary" />;
      case 2: return <Medal size={24} className="text-gray-400" />;
      case 3: return <Award size={24} className="text-amber-700" />;
      default: return <span className="text-muted-foreground font-medium text-center whitespace-nowrap tabular-nums text-sm">#{rank}</span>;
    }
  };

  const activeSeason = seasons[0] || null;

  const handleCreateSeason = async () => {
    if (!seasonName || !seasonStart || !seasonEnd) {
      toast.error("Compila tutti i campi");
      return;
    }
    // Deactivate previous active seasons
    await supabase.from("ranking_seasons").update({ is_active: false } as any).eq("is_active", true);

    const { error } = await supabase.from("ranking_seasons").insert({
      name: seasonName,
      start_date: seasonStart,
      end_date: seasonEnd,
      is_active: true,
      bfl: parseInt(seasonBfl) || 10,
    } as any);

    if (error) {
      toast.error("Errore nella creazione della stagione");
    } else {
      toast.success("Stagione creata!");
      setSeasonName("");
      setSeasonStart("");
      setSeasonEnd("");
      setSeasonBfl("10");
      invalidateRankings();
    }
  };

  const handleUpdateBfl = async (newBfl: string) => {
    if (!activeSeason) return;
    const val = parseInt(newBfl);
    if (isNaN(val) || val < 1) return;
    const { error } = await supabase.from("ranking_seasons").update({ bfl: val } as any).eq("id", activeSeason.id);
    if (!error) {
      toast.success(`BFL aggiornato a ${val}`);
      invalidateRankings();
    }
  };

  const handleRecalculate = async () => {
    if (!activeSeason) return;
    setRecalculating(true);
    const { error } = await supabase.rpc("recalculate_all_rankings", {
      _bfl: activeSeason.bfl,
      _monthly_bfl_enabled: !!(activeSeason as any).monthly_bfl_enabled,
      _monthly_bfl: (activeSeason as any).monthly_bfl ?? 2,
    } as any);
    if (error) {
      toast.error("Errore nel ricalcolo");
    } else {
      toast.success("Classifica ricalcolata con BFL!");
      invalidateRankings();
    }
    setRecalculating(false);
  };

  const handleResetRankings = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    // Reset all profile and child profile points and wins
    const [r1, r2] = await Promise.all([
      supabase.from("profiles").update({ points: 0, wins: 0 } as any).not("points", "is", null),
      supabase.from("child_profiles").update({ points: 0, wins: 0 } as any).not("points", "is", null),
    ]);
    if (r1.error || r2.error) {
      toast.error("Errore nel reset");
    } else {
      toast.success("Classifica resettata!");
      setConfirmReset(false);
      invalidateRankings();
    }
  };

  const handleCloseSeason = async () => {
    if (!activeSeason) return;
    if (!confirmClose) { setConfirmClose(true); return; }

    // Snapshot current rankings
    const rankedProfiles = [...profiles].sort((a, b) => b.points - a.points);
    const snapshots = rankedProfiles.map((p, i) => ({
      season_id: activeSeason.id,
      user_id: p.user_id,
      display_name: p.display_name,
      city: p.city,
      region_id: p.region_id,
      points: p.points,
      wins: p.wins,
      final_rank: i + 1,
    }));

    if (snapshots.length > 0) {
      await supabase.from("ranking_snapshots").insert(snapshots as any);
    }

    // Close season
    await supabase.from("ranking_seasons").update({ is_active: false, closed_at: new Date().toISOString() } as any).eq("id", activeSeason.id);

    // Reset points for both profiles and child profiles
    await Promise.all([
      supabase.from("profiles").update({ points: 0, wins: 0 } as any).not("points", "is", null),
      supabase.from("child_profiles").update({ points: 0, wins: 0 } as any).not("points", "is", null),
    ]);

    toast.success("Stagione chiusa e classifica archiviata!");
    setConfirmClose(false);
    setShowSettings(false);
    invalidateRankings();
  };

  const loadArchivedSeason = async (seasonId: string) => {
    if (expandedSeason === seasonId) {
      setExpandedSeason(null);
      return;
    }
    if (!archivedSnapshots[seasonId]) {
      const { data } = await supabase
        .from("ranking_snapshots")
        .select("*")
        .eq("season_id", seasonId)
        .order("final_rank")
        .limit(50);
      if (data) {
        setArchivedSnapshots((prev) => ({ ...prev, [seasonId]: data as any }));
      }
    }
    setExpandedSeason(seasonId);
  };

  return (
    <PageShell ambient="subtle"><div className="min-h-screen text-foreground">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <span className="text-primary font-medium uppercase tracking-wider text-sm">Top Players</span>
            <h1 className="section-title mt-2">
              CLASSIFICA <span className="gradient-text">NAZIONALE</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              I migliori blader italiani in competizione. Scala la classifica partecipando ai tornei ufficiali.
            </p>
            <div className="mt-4">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowRulesInfo(true)}>
                <Info size={14} /> Come funziona il sistema competitivo
              </Button>
            </div>
            {showRulesInfo && <TournamentRulesInfo externalOpen={showRulesInfo} onExternalClose={() => setShowRulesInfo(false)} />}
            {activeSeason && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium max-w-full">
                  <BncIcon name="calendar" size={16} className="shrink-0" />
                  <span className="truncate">{activeSeason.name}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-secondary text-muted-foreground px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium">
                  {activeSeason.start_date} → {activeSeason.end_date}
                </div>
                <div className="inline-flex items-center gap-1.5 bg-secondary text-muted-foreground px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium">
                  <Info size={12} className="shrink-0" />
                  BFL: top {activeSeason.bfl}
                </div>
              </div>
            )}
          </div>

          {/* Filters + Admin */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Mobile: search + toggle row */}
            <div className="flex items-center gap-2 sm:hidden mb-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Cerca blader..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-card border-border text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3 shrink-0"
                onClick={() => setShowMobileFilters((v) => !v)}
              >
                Filtri
              </Button>
              {isAdmin && (
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setShowSettings(true)} aria-label="Impostazioni">
                  <Settings size={16} />
                </Button>
              )}
            </div>
            {showMobileFilters && (
              <div className="sm:hidden flex flex-col gap-2 animate-fade-in">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={16} />
                  <Input
                    placeholder="Filtra per città"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="pl-9 h-10 bg-card border-border text-sm"
                  />
                </div>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="h-10 bg-card border-border text-sm">
                    <SelectValue placeholder="Tutte le regioni" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le regioni</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Desktop layout */}
            <div className="hidden sm:flex flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Cerca blader..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>
              <div className="relative sm:w-48">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={18} />
                <Input
                  placeholder="Filtra per città"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="sm:w-52 bg-card border-border">
                  <SelectValue placeholder="Tutte le regioni" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le regioni</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button variant="outline" size="icon" onClick={() => setShowSettings(true)}>
                  <Settings size={18} />
                </Button>
              )}
            </div>
          </div>

          {/* BFL view switch (only when monthly BFL is enabled on the active season) */}
          {monthlyEnabledOnActive && (
            <div className="max-w-6xl mx-auto mb-4 flex justify-center">
              <div className="inline-flex rounded-full border border-border bg-card p-1">
                <button
                  type="button"
                  onClick={() => setBflView("seasonal")}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors ${
                    bflView === "seasonal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  BFL Stagionale
                </button>
                <button
                  type="button"
                  onClick={() => setBflView("monthly")}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors ${
                    bflView === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  BFL Mensile + Rollover
                </button>
              </div>
            </div>
          )}
          {myRankInfo && (
            <div className="max-w-6xl mx-auto mb-4">
              <div className="bg-primary/5 border border-primary/20 rounded-2xl overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 overflow-hidden">
                    {myRankInfo.profile.avatar_url ? (
                      <img src={myRankInfo.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-base sm:text-lg text-primary">
                        {(myRankInfo.profile.display_name || myRankInfo.profile.username || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary text-sm sm:text-base truncate">
                      {myRankInfo.profile.display_name || myRankInfo.profile.username || "Tu"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{myRankInfo.rank} · {myRankInfo.profile.city || "—"}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm sm:text-base font-bold text-primary">{myRankInfo.profile.points.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Punti</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{myRankInfo.profile.wins}</p>
                      <p className="text-[10px] text-muted-foreground flex justify-end"><Trophy size={11} aria-label="Tornei vinti" /></p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{myRankInfo.profile.match_wins}</p>
                      <p className="text-[10px] text-muted-foreground">Match W</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rankings Table */}
          <div className="max-w-6xl mx-auto">
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/70 overflow-hidden card-glow">
              {/* Desktop Header */}
              <div className="hidden sm:grid grid-cols-[3.5rem_minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_3rem_5rem_5rem_6rem] gap-3 px-6 py-4 bg-secondary/50 border-b border-border text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <div>#</div>
                <div>Blader</div>
                <div>Club</div>
                <div className="text-center">Punti</div>
                <div className="text-center flex justify-center items-center"><Trophy size={14} aria-label="Tornei vinti" /></div>
                <div className="text-center whitespace-nowrap">Match W</div>
                <div className="text-center whitespace-nowrap">Tornei</div>
                <div className="text-right">Città</div>
              </div>
              {/* Mobile Header */}
              <div className="sm:hidden flex items-center gap-2 px-3 py-3 bg-secondary/50 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <span className="w-7 text-center">#</span>
                <span className="flex-1 pl-1">Blader</span>
                <span className="w-10 text-center">Pts</span>
                <span className="w-6 flex justify-center items-center"><Trophy size={12} aria-label="Tornei vinti" /></span>
                <span className="w-6 text-center">W</span>
                <span className="w-6 text-center">T</span>
              </div>

              {loading ? (
                <div className="p-4 space-y-2" aria-busy="true" aria-label="Caricamento classifica">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="h-14 bg-secondary/40 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  {profiles.length === 0 ? "Nessun blader registrato." : "Nessun risultato trovato"}
                </div>
              ) : (
                paginatedProfiles.map((profile, index) => {
                  const globalIndex = currentPage * ITEMS_PER_PAGE + index;
                  // Use original URL (CDN-cached, free) instead of Storage Image Transformations (counts toward Pro plan quota)
                  const bannerThumb = profile.banner_url || null;
                  return (
                  <div key={profile.id} className="relative">
                    {/* Desktop banner: capsule with V-cut on right, inner shadow for depth */}
                    {bannerThumb && (
                      <div
                        className="absolute z-0 overflow-hidden pointer-events-none hidden sm:block"
                        style={{
                          top: "6px",
                          bottom: "6px",
                          left: "3.25rem",
                          right: "calc(6rem + 5rem + 5rem + 3rem + 4.5rem + 4.5rem)",
                          borderRadius: "9999px",
                          clipPath: "polygon(0 0, 100% 0, calc(100% + 22px) 50%, 100% 100%, 0 100%)",
                        }}
                      >
                        <img
                          src={bannerThumb}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover blur-[2px] brightness-[0.4] scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-background/55 via-background/35 to-background/85" />
                        <div
                          className="absolute top-0 bottom-0 right-0 w-10 pointer-events-none"
                          style={{
                            background: "linear-gradient(to right, transparent, hsl(0 0% 0% / 0.65))",
                            clipPath: "polygon(0 0, 100% 0, calc(100% + 22px) 50%, 100% 100%, 0 100%)",
                          }}
                        />
                        {/* Inner shadow */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            boxShadow: "inset 0 2px 8px hsl(0 0% 0% / 0.6), inset 0 -2px 8px hsl(0 0% 0% / 0.5), inset 2px 0 6px hsl(0 0% 0% / 0.4)",
                          }}
                        />
                      </div>
                    )}
                    {/* Mobile banner: full-row background, no rounding, no V-cut */}
                    {bannerThumb && (
                      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none sm:hidden">
                        <img
                          src={bannerThumb}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover blur-[2px] brightness-[0.35] scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/80" />
                        {/* Inner shadow */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            boxShadow: "inset 0 2px 10px hsl(0 0% 0% / 0.6), inset 0 -2px 10px hsl(0 0% 0% / 0.5)",
                          }}
                        />
                      </div>
                    )}
                    {/* Desktop Row */}
                    <div className="hidden sm:grid grid-cols-[3.5rem_minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_3rem_5rem_5rem_6rem] gap-3 px-6 py-5 border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors relative z-10">
                      <div className="flex items-center">{getRankIcon(getProfileRank(profile))}</div>
                      <div className={`flex items-center gap-3 min-w-0 ${bannerThumb ? "ranking-blader-on-banner" : ""}`}>
                        <div
                          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden shrink-0"
                          style={bannerThumb ? { boxShadow: "0 2px 6px hsl(0 0% 0% / 0.6), 0 0 0 1px hsl(0 0% 0% / 0.3)" } : undefined}
                        >
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <span className="font-display text-lg">
                              {(profile.display_name || profile.username || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex items-center gap-2">
                          {profile.is_child ? (
                            <Link to={`/profilo/child/${profile.user_id}`} className="font-medium text-foreground hover:text-primary transition-colors truncate">
                              {profile.display_name || "Blader Anonimo"}
                            </Link>
                          ) : profile.username ? (
                            <Link to={`/profilo/${profile.username}`} className="font-medium text-foreground hover:text-primary transition-colors truncate">
                              {profile.display_name || profile.username || "Blader Anonimo"}
                            </Link>
                          ) : (
                            <span className="font-medium text-foreground truncate">
                              {profile.display_name || "Blader Anonimo"}
                            </span>
                          )}
                          {profile.is_child && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary leading-none shrink-0">Kids</span>
                          )}
                        </div>
                      </div>
                      {/* Club column */}
                      <div className="flex items-center min-w-0">
                        {profile.club_id && profile.club_name ? (
                          <Link
                            to={`/clubs/${profile.club_id}`}
                            className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-background/40 backdrop-blur-sm border border-border/40 hover:border-primary/60 hover:bg-background/60 transition-colors max-w-full"
                            style={{ boxShadow: "0 2px 4px hsl(0 0% 0% / 0.3)" }}
                          >
                            {profile.club_logo_url ? (
                              <img
                                src={profile.club_logo_url}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                                loading="lazy"
                              />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-primary/30 shrink-0" />
                            )}
                            <span className="text-[11px] font-medium text-foreground truncate">{profile.club_name}</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="font-semibold text-primary">{profile.points.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="text-muted-foreground">{profile.wins}</span>
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="text-muted-foreground font-medium">{profile.match_wins}</span>
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="text-muted-foreground">{profile.tournament_count}</span>
                      </div>
                      <div className="flex items-center justify-end">
                        <span className="text-sm text-muted-foreground truncate">{profile.city || "-"}</span>
                      </div>
                    </div>

                    {/* Mobile Row */}
                    <div className="sm:hidden flex items-center gap-2 px-3 py-3 border-b border-border/50 last:border-0 active:bg-secondary/30 transition-colors relative z-10">
                      <span className="min-w-[2.25rem] flex justify-center shrink-0">{getRankIcon(getProfileRank(profile))}</span>
                      <div className={`flex items-center gap-2 flex-1 min-w-0 overflow-hidden ${bannerThumb ? "ranking-blader-on-banner" : ""}`}>
                        <div
                          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden shrink-0"
                          style={bannerThumb ? { boxShadow: "0 2px 5px hsl(0 0% 0% / 0.6), 0 0 0 1px hsl(0 0% 0% / 0.3)" } : undefined}
                        >
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <span className="font-display text-sm">
                              {(profile.display_name || profile.username || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-1 min-w-0">
                            {profile.is_child ? (
                              <Link to={`/profilo/child/${profile.user_id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                                {profile.display_name || "Blader Anonimo"}
                              </Link>
                            ) : profile.username ? (
                              <Link to={`/profilo/${profile.username}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                                {profile.display_name || profile.username || "Blader Anonimo"}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-foreground truncate block">
                                {profile.display_name || "Blader Anonimo"}
                              </span>
                            )}
                            {profile.is_child && (
                              <span className="text-[10px] font-bold uppercase px-1 py-0.5 rounded bg-primary/10 text-primary leading-none shrink-0">Kids</span>
                            )}
                          </div>
                          {profile.city && (
                            <p className="text-[11px] text-muted-foreground truncate">{profile.city}</p>
                          )}
                        </div>
                      </div>
                      <span className="w-10 text-center text-sm font-semibold text-primary shrink-0">{profile.points}</span>
                      <span className="w-6 text-center text-xs text-muted-foreground shrink-0">{profile.wins}</span>
                      <span className="w-6 text-center text-xs text-muted-foreground shrink-0">{profile.match_wins}</span>
                      <span className="w-6 text-center text-xs text-muted-foreground shrink-0">{profile.tournament_count}</span>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 300, behavior: 'smooth' }); }}
                >
                  ← Precedente
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Pagina {currentPage + 1} di {totalPages} · {filteredProfiles.length} blader
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 300, behavior: 'smooth' }); }}
                >
                  Successiva →
                </Button>
              </div>
            )}
          </div>

          {/* Archived Seasons */}
          {closedSeasons.length > 0 && (
            <div className="max-w-6xl mx-auto mt-16">
              <h2 className="font-display text-2xl mb-6">
                STAGIONI <span className="gradient-text">PRECEDENTI</span>
              </h2>
              <div className="space-y-3">
                {closedSeasons.map((season) => (
                  <div key={season.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                    <button
                      onClick={() => loadArchivedSeason(season.id)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <BncIcon name="podium" size={20} className="text-primary" />
                        <span className="font-medium">{season.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {season.start_date} — {season.end_date}
                        </span>
                      </div>
                      {expandedSeason === season.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {expandedSeason === season.id && archivedSnapshots[season.id] && (
                      <div className="border-t border-border">
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-secondary/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <div className="col-span-1">#</div>
                          <div className="col-span-5">Blader</div>
                          <div className="col-span-3 text-center">Punti</div>
                          <div className="col-span-3 text-center">Vittorie</div>
                        </div>
                        {archivedSnapshots[season.id].map((s) => (
                          <div key={s.id} className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border/30 last:border-0 text-sm">
                            <div className="col-span-1 flex items-center">{getRankIcon(s.final_rank)}</div>
                            <div className="col-span-5 flex items-center">
                              <span className="font-medium">{s.display_name || "Blader"}</span>
                            </div>
                            <div className="col-span-3 flex items-center justify-center">
                              <span className="text-primary font-semibold">{s.points.toLocaleString()}</span>
                            </div>
                            <div className="col-span-3 flex items-center justify-center text-muted-foreground">{s.wins}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Admin Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={(o) => { setShowSettings(o); setConfirmReset(false); setConfirmClose(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings size={20} /> Impostazioni Classifica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Create / Update Season */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">Nuova Stagione</h3>
              <div>
                <Label>Nome stagione</Label>
                <Input value={seasonName} onChange={(e) => setSeasonName(e.target.value)} placeholder="es. Stagione 2026" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Inizio</Label>
                  <Input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Fine</Label>
                  <Input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>BFL (Best Finish Limit)</Label>
                <Input type="number" min={1} max={50} value={seasonBfl} onChange={(e) => setSeasonBfl(e.target.value)} placeholder="10" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Numero massimo di migliori risultati conteggiati per giocatore</p>
              </div>
              <Button onClick={handleCreateSeason} className="w-full">
                <BncIcon name="calendar" size={18} /> Crea Stagione
              </Button>
            </div>

            {/* Active season info */}
            {activeSeason && (
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">
                  Stagione attiva: {activeSeason.name}
                </h3>

                {/* BFL setting */}
                <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wider">BFL — Best Finish Limit</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={activeSeason.bfl}
                      onBlur={(e) => handleUpdateBfl(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
                      <RefreshCw size={14} className={recalculating ? "animate-spin" : ""} />
                      Ricalcola
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Conta solo i migliori {activeSeason.bfl} tornei per giocatore. I punti scalano in base ai partecipanti.
                  </p>
                </div>

                {/* Reset */}
                <Button
                  variant={confirmReset ? "destructive" : "outline"}
                  className="w-full"
                  onClick={handleResetRankings}
                >
                  <RotateCcw size={16} />
                  {confirmReset ? "Conferma Reset — Tutti i punti verranno azzerati" : "Reset Classifica"}
                </Button>

                {/* Force close */}
                <Button
                  variant={confirmClose ? "destructive" : "outline"}
                  className="w-full"
                  onClick={handleCloseSeason}
                >
                  <XCircle size={16} />
                  {confirmClose ? "Conferma Chiusura — La stagione verrà archiviata" : "Chiudi Stagione Forzata"}
                </Button>
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>

      <Footer />
    </div></PageShell>
  );
};

export default Rankings;
