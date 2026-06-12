import { Link } from "react-router-dom";
import { Calendar, MapPin, Users, ChevronRight, ChevronLeft, Zap, Search, X, Shield, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface Tournament {
  id: string;
  title: string;
  city: string;
  event_date: string;
  max_participants: number;
  is_ranked: boolean;
  image_url: string | null;
  status: string;
  team_mode: string | null;
  format: string | null;
  top_cut_size: number | null;
  swiss_rounds: number | null;
  club_id: string | null;
  clubs: { id: string; name: string; logo_url: string | null; banner_url: string | null; latitude: number | null; longitude: number | null } | null;
}

const teamModeLabel = (mode: string | null) => {
  if (!mode || mode === "solo") return null;
  if (mode === "teams") return "SQUADRE";
  if (mode === "clubs") return "CLUBS";
  return null;
};

const formatLabel = (t: Tournament) => {
  const parts: string[] = [];
  if (t.swiss_rounds && t.swiss_rounds > 0) parts.push("Swiss");
  if (t.top_cut_size && t.top_cut_size > 0) parts.push(`Top ${t.top_cut_size}`);
  if (parts.length === 0) {
    if (t.format === "swiss") return "Swiss";
    if (t.format === "round_robin") return "Round Robin";
    return null;
  }
  return parts.join(" + ");
};

const ITEMS_PER_PAGE = 3;

const TournamentCard = ({ tournament, regCount }: { tournament: Tournament; regCount: number }) => {
  const bgImageUrl = tournament.clubs?.banner_url || tournament.image_url;

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className="block w-full h-full glass-card glass-shine overflow-hidden relative tournament-card-dark"
    >

      {bgImageUrl ? (
        <div className="absolute inset-0 z-0">
          <img src={bgImageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover blur-md brightness-[0.2] scale-105" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-zinc-900 to-zinc-800" />
      )}
      <div className="p-3 sm:p-5 relative z-10">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 flex-wrap">
          {tournament.clubs?.logo_url && (
            <img src={tournament.clubs.logo_url} alt={tournament.clubs.name} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-primary/30" />
          )}
          <Badge className={tournament.is_ranked ? "bg-green-500/20 text-green-400 border-green-500/30 text-xs" : "bg-white/10 text-white/80 border-white/20 text-xs"}>
            {tournament.is_ranked ? "RANKED" : "NORMAL"}
          </Badge>
          {teamModeLabel(tournament.team_mode) && (
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">{teamModeLabel(tournament.team_mode)}</Badge>
          )}
          {formatLabel(tournament) && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">{formatLabel(tournament)}</Badge>
          )}
        </div>
        <h3 className="font-display text-lg mb-3 line-clamp-1">{tournament.title}</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-primary" />
            <span>{format(new Date(tournament.event_date), "d MMMM yyyy", { locale: it })}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-primary" />
            <span>{tournament.city}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-primary" />
            <span>{regCount}/{tournament.max_participants} iscritti</span>
          </div>
          <span className="text-xs text-muted-foreground ml-6">
            {tournament.max_participants - regCount > 0
              ? `${tournament.max_participants - regCount} posti rimasti`
              : "Posti esauriti"}
          </span>
        </div>
      </div>
    </Link>
  );
};

const Paginator = ({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 mt-5">
      <button onClick={() => onChange(page - 1)} disabled={page === 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: totalPages }, (_, i) => (
        <button key={i} onClick={() => onChange(i)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${i === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
          {i + 1}
        </button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

const fetchTournamentsData = async () => {
  const now = new Date();
  const nowIso = now.toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
  const selectFields = "id, title, city, event_date, max_participants, is_ranked, image_url, status, team_mode, format, top_cut_size, swiss_rounds, club_id, clubs(id, name, logo_url, banner_url, latitude, longitude)";

  const [upRes, liveRes] = await Promise.all([
    supabase.from("tournaments").select(selectFields).eq("is_active", true).gte("event_date", nowIso).in("status", ["pending"]).or("event_type.eq.tournament,event_type.is.null").order("event_date", { ascending: true }).limit(30),
    supabase.from("tournaments").select(selectFields).eq("is_active", true).in("status", ["swiss", "top_cut"]).gte("event_date", startOfDay).lte("event_date", endOfDay).or("event_type.eq.tournament,event_type.is.null").order("event_date", { ascending: false }).limit(15),
  ]);

  const upcoming = (upRes.data || []) as Tournament[];
  const live = (liveRes.data || []) as Tournament[];
  const allTournaments = [...upcoming, ...live];

  let registrationCounts: Record<string, number> = {};
  if (allTournaments.length > 0) {
    const tournamentIds = allTournaments.map(t => t.id);
    const { data: regData } = await supabase
      .from("tournament_registrations")
      .select("tournament_id")
      .in("tournament_id", tournamentIds);
    for (const r of (regData || [])) {
      registrationCounts[r.tournament_id] = (registrationCounts[r.tournament_id] || 0) + 1;
    }
  }

  return { upcoming, live, registrationCounts };
};

type FilterType = "all" | "my_club" | "nearby";

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const TournamentsPreview = () => {
  const { user } = useAuth();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["homepage-tournaments"],
    queryFn: fetchTournamentsData,
    staleTime: 15 * 60 * 1000,
  });

  // Get user's club membership
  const { data: myMembership } = useQuery({
    queryKey: ["my-club-membership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("club_members")
        .select("club_id, clubs(id, name, latitude, longitude)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
  });

  const upcoming = data?.upcoming ?? [];
  const live = data?.live ?? [];
  const registrationCounts = data?.registrationCounts ?? {};

  const [upcomingPage, setUpcomingPage] = useState(0);
  const [livePage, setLivePage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const myClubId = (myMembership as any)?.club_id as string | undefined;
  const myClubCoords = (myMembership as any)?.clubs as { latitude: number | null; longitude: number | null } | undefined;

  const filteredUpcoming = useMemo(() => {
    let list = [...upcoming];
    const lq = searchQuery.trim().toLowerCase();

    // Search filter
    if (lq) {
      list = list.filter(t =>
        t.title.toLowerCase().includes(lq) ||
        t.city.toLowerCase().includes(lq) ||
        (t.clubs?.name || "").toLowerCase().includes(lq)
      );
    }

    // Club filter
    if (activeFilter === "my_club" && myClubId) {
      list = list.filter(t => t.club_id === myClubId);
    }

    // Nearby: sort by distance from user's club coords
    if (activeFilter === "nearby" && myClubCoords?.latitude && myClubCoords?.longitude) {
      list.sort((a, b) => {
        const aLat = a.clubs?.latitude;
        const aLon = a.clubs?.longitude;
        const bLat = b.clubs?.latitude;
        const bLon = b.clubs?.longitude;
        const aDist = aLat != null && aLon != null ? haversineDistance(myClubCoords.latitude!, myClubCoords.longitude!, aLat, aLon) : 99999;
        const bDist = bLat != null && bLon != null ? haversineDistance(myClubCoords.latitude!, myClubCoords.longitude!, bLat, bLon) : 99999;
        return aDist - bDist;
      });
    }

    return list;
  }, [upcoming, searchQuery, activeFilter, myClubId, myClubCoords]);

  const filteredLive = useMemo(() => {
    let list = [...live];
    const lq = searchQuery.trim().toLowerCase();
    if (lq) {
      list = list.filter(t =>
        t.title.toLowerCase().includes(lq) ||
        t.city.toLowerCase().includes(lq) ||
        (t.clubs?.name || "").toLowerCase().includes(lq)
      );
    }
    if (activeFilter === "my_club" && myClubId) {
      list = list.filter(t => t.club_id === myClubId);
    }
    if (activeFilter === "nearby" && myClubCoords?.latitude && myClubCoords?.longitude) {
      list.sort((a, b) => {
        const aDist = a.clubs?.latitude != null && a.clubs?.longitude != null ? haversineDistance(myClubCoords.latitude!, myClubCoords.longitude!, a.clubs.latitude!, a.clubs.longitude!) : 99999;
        const bDist = b.clubs?.latitude != null && b.clubs?.longitude != null ? haversineDistance(myClubCoords.latitude!, myClubCoords.longitude!, b.clubs.latitude!, b.clubs.longitude!) : 99999;
        return aDist - bDist;
      });
    }
    return list;
  }, [live, searchQuery, activeFilter, myClubId, myClubCoords]);

  // Reset page when filters change
  const upcomingTotalPages = Math.max(1, Math.min(5, Math.ceil(filteredUpcoming.length / ITEMS_PER_PAGE)));
  const safePage = Math.min(upcomingPage, upcomingTotalPages - 1);
  const liveTotalPages = Math.min(5, Math.ceil(filteredLive.length / ITEMS_PER_PAGE));
  const upcomingSlice = filteredUpcoming.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE);
  const safelivePage = Math.min(livePage, Math.max(0, liveTotalPages - 1));
  const liveSlice = filteredLive.slice(safelivePage * ITEMS_PER_PAGE, (safelivePage + 1) * ITEMS_PER_PAGE);

  const handleFilterChange = (f: FilterType) => {
    setActiveFilter(f);
    setUpcomingPage(0);
    setLivePage(0);
  };

  const hasClub = !!myClubId;
  const hasClubCoords = !!(myClubCoords?.latitude && myClubCoords?.longitude);

  return (
    <section id="tournaments-preview" className="space-y-12">
      <div>
        <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
          <div>
            <span className="text-primary font-medium uppercase tracking-[0.3em] text-xs">Prossimi Eventi</span>
            <h2 className="font-display text-3xl md:text-4xl tracking-wide mt-2">
              TORNEI <span className="gradient-text">IN ARRIVO</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Iscriviti alle prossime tappe FIBeGS: ranked, normal, squadre e club.
            </p>
          </div>
          <Link to="/tournaments" className="shrink-0">
            <Button variant="outline" size="sm" className="gap-2 border-border hover:border-primary/50">Tutti i tornei<ChevronRight size={16} /></Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca torneo..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setUpcomingPage(0); }}
              className="pl-9 h-9 text-sm bg-secondary/50 border-border"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setUpcomingPage(0); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={activeFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs"
              onClick={() => handleFilterChange("all")}
            >
              Tutti
            </Button>
            {hasClub && (
              <Button
                variant={activeFilter === "my_club" ? "default" : "outline"}
                size="sm"
                className="h-9 text-xs gap-1"
                onClick={() => handleFilterChange("my_club")}
              >
                <Shield size={12} /> Mio Club
              </Button>
            )}
            {hasClub && hasClubCoords && (
              <Button
                variant={activeFilter === "nearby" ? "default" : "outline"}
                size="sm"
                className="h-9 text-xs gap-1"
                onClick={() => handleFilterChange("nearby")}
              >
                <Navigation size={12} /> Vicini
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-card rounded-2xl animate-pulse" />)}
          </div>
        ) : filteredUpcoming.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery || activeFilter !== "all"
              ? "Nessun torneo trovato con questi filtri."
              : "Nessun torneo in programma. Torna presto!"}
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              {upcomingSlice.map((t) => <TournamentCard key={t.id} tournament={t} regCount={registrationCounts[t.id] || 0} />)}
            </div>
            <Paginator page={safePage} totalPages={upcomingTotalPages} onChange={setUpcomingPage} />
          </>
        )}
      </div>

      {filteredLive.length > 0 && (
        <div>
          <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
            <div>
              <span className="text-destructive font-medium uppercase tracking-[0.3em] text-xs flex items-center gap-2">
                <Zap size={12} className="animate-pulse" /> In Corso
              </span>
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mt-2">
                TORNEI <span className="text-destructive">LIVE</span>
              </h2>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {liveSlice.map((t) => (
              <div key={t.id} className="relative">
                <div className="absolute -top-1 -right-1 z-20">
                  <Badge className="bg-destructive text-destructive-foreground border-destructive text-xs animate-pulse gap-1"><Zap size={10} />LIVE</Badge>
                </div>
                <TournamentCard tournament={t} regCount={registrationCounts[t.id] || 0} />
              </div>
            ))}
          </div>
          <Paginator page={safelivePage} totalPages={liveTotalPages} onChange={setLivePage} />
        </div>
      )}
    </section>
  );
};
