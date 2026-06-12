import { useEffect, useState, useRef, useCallback, TouchEvent as ReactTouchEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useRegions } from "@/hooks/useCachedQuery";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Clock, Filter, Share2, Copy, Plus, ChevronLeft, ChevronRight, LayoutList, LayoutGrid, Search, ArrowUpDown, Star, Info, X, Users, Shield, User } from "lucide-react";
import { BncIcon } from "@/components/icons/BncIcon";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CreateTournamentDialog } from "@/components/tournaments/CreateTournamentDialog";
import { TournamentRulesInfo } from "@/components/tournaments/TournamentRulesInfo";
import { useAdmin } from "@/hooks/useAdmin";

interface Tournament {
  id: string;
  title: string;
  description: string | null;
  location: string;
  city: string;
  event_date: string;
  registration_deadline: string;
  max_participants: number;
  prize_description: string | null;
  is_active: boolean;
  is_ranked: boolean;
  image_url: string | null;
  region_id: string | null;
  status: string;
  team_mode: string | null;
  format: string | null;
  top_cut_size: number | null;
  swiss_rounds: number | null;
  championship_id: string | null;
  entry_fee: number | null;
  payment_method: string | null;
  has_waitlist: boolean;
  created_by: string | null;
  clubs: { id: string; name: string; logo_url: string | null; banner_url: string | null } | null;
}

const teamModeLabel = (mode: string | null) => {
  if (!mode || mode === "solo") return null;
  if (mode === "teams") return "SQUADRE";
  if (mode === "clubs") return "CLUBS";
  return null;
};

const formatLabel = (t: { swiss_rounds?: number | null; top_cut_size?: number | null; format?: string | null }) => {
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

interface Registration {
  tournament_id: string;
}

interface Region {
  id: string;
  name: string;
}

interface ChampionshipFilter {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
}

const ITEMS_PER_PAGE = 6;
const COMPLETED_PER_PAGE = 12;

const Tournaments = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [championships, setChampionships] = useState<ChampionshipFilter[]>([]);
  const [filterChampionship, setFilterChampionship] = useState<string>("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("date_asc");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [filterClubs, setFilterClubs] = useState<string[]>([]);
  const [clubsList, setClubsList] = useState<{ id: string; name: string }[]>([]);
  const [clubSearchQuery, setClubSearchQuery] = useState("");
  const [showClubDropdown, setShowClubDropdown] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Active tab
  const [activeTab, setActiveTab] = useState<"upcoming" | "ongoing" | "completed" | "standby" | "cancelled">("upcoming");

  // View mode & pagination
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentPage, setCurrentPage] = useState(0);

  // Completed tournaments state
  const [completedTournaments, setCompletedTournaments] = useState<Tournament[]>([]);
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedPage, setCompletedPage] = useState(0);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedSortBy, setCompletedSortBy] = useState<string>("date_desc");

  // Cancelled tournaments state
  const [cancelledTournaments, setCancelledTournaments] = useState<Tournament[]>([]);
  const [cancelledCounts, setCancelledCounts] = useState<Record<string, number>>({});
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [cancelledPage, setCancelledPage] = useState(0);
  const [cancelledTotal, setCancelledTotal] = useState(0);

  // Mobile swipe
  const swipeRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // User's club for create tournament
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createAsIbna, setCreateAsIbna] = useState(false);
  const [showRulesInfo, setShowRulesInfo] = useState(false);
  const { isAdmin } = useAdmin();

  // Featured tournaments (user's club + followed clubs)
  const [featuredTournaments, setFeaturedTournaments] = useState<Tournament[]>([]);
  const [featuredCounts, setFeaturedCounts] = useState<Record<string, number>>({});

  const clubDropdownRef = useRef<HTMLDivElement>(null);

  // Close club dropdown on outside click
  useEffect(() => {
    if (!showClubDropdown) return;
    const handler = (e: MouseEvent) => {
      if (clubDropdownRef.current && !clubDropdownRef.current.contains(e.target as Node)) {
        setShowClubDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showClubDropdown]);

  const fetchClubsList = async () => {
    const { data } = await supabase.from("clubs").select("id, name").eq("is_active", true).order("name");
    if (data) setClubsList(data);
  };

  useEffect(() => {
    fetchTournaments();
    fetchChampionships();
    fetchClubsList();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserRegistrations();
      fetchUserClub();
      fetchFeaturedTournaments();
    }
  }, [user]);

  // Fetch completed tournaments with pagination
  useEffect(() => {
    if (activeTab === "completed") {
      fetchCompletedTournaments();
    } else if (activeTab === "cancelled") {
      fetchCancelledTournaments();
    }
  }, [activeTab, completedPage, cancelledPage, completedSortBy, filterRegion, filterType, filterChampionship, searchQuery, dateFrom, dateTo, filterClubs, onlyMine]);

  const fetchUserClub = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("club_members")
      .select("club_id, role")
      .eq("user_id", user.id)
      .in("role", ["leader", "staff"])
      .limit(1)
      .maybeSingle();
    if (data) setUserClubId(data.club_id);
  };

  const fetchFeaturedTournaments = async () => {
    if (!user) return;
    const cachedClubs = sessionStorage.getItem(`user_clubs_${user.id}`);
    let clubIds = new Set<string>();
    if (cachedClubs) {
      try { JSON.parse(cachedClubs).forEach((c: any) => clubIds.add(c.club_id)); } catch {}
    }
    const [membershipRes, { data: follows }] = await Promise.all([
      clubIds.size === 0 ? supabase.from("club_members").select("club_id").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      (supabase as any).from("club_follows").select("club_id").eq("user_id", user.id),
    ]);
    if (membershipRes?.data?.club_id) clubIds.add(membershipRes.data.club_id);
    (follows ?? []).forEach((f: any) => clubIds.add(f.club_id));
    if (clubIds.size === 0) return;
    const { data } = await supabase
      .from("tournaments")
      .select("id, title, description, location, city, event_date, registration_deadline, max_participants, prize_description, is_active, is_ranked, image_url, region_id, status, team_mode, format, top_cut_size, swiss_rounds, championship_id, entry_fee, payment_method, has_waitlist, created_by, clubs(id, name, logo_url, banner_url)")
      .eq("is_active", true).neq("status", "completed").filter("is_external", "eq", false)
      .or("event_type.eq.tournament,event_type.is.null")
      .in("club_id", Array.from(clubIds)).order("event_date", { ascending: true }).limit(10);
    if (data && data.length > 0) {
      setFeaturedTournaments(data as any);
      const tIds = data.map((t: any) => t.id);
      const { data: countData } = await supabase.rpc("get_tournament_registration_counts", { _tournament_ids: tIds } as any);
      const counts: Record<string, number> = {};
      ((countData as any[]) ?? []).forEach((r: any) => { counts[r.tournament_id] = Number(r.reg_count); });
      setFeaturedCounts(counts);
    }
  };

  const fetchChampionships = async () => {
    const { data } = await supabase.from("championships").select("id, name, slug, logo_url, primary_color").eq("is_active", true).order("name");
    setChampionships((data as any) ?? []);
  };

  const { data: regionsData } = useRegions();
  useEffect(() => { if (regionsData) setRegions(regionsData); }, [regionsData]);

  const fetchTournaments = async () => {
    const selectFields = "id, title, description, location, city, event_date, registration_deadline, max_participants, prize_description, is_active, is_ranked, image_url, region_id, status, team_mode, format, top_cut_size, swiss_rounds, championship_id, entry_fee, payment_method, has_waitlist, created_by, clubs(id, name, logo_url, banner_url, latitude, longitude)";
    const { data, error } = await supabase
      .from("tournaments").select(selectFields)
      .eq("is_active", true).neq("status", "completed").filter("is_external", "eq", false)
      .or("event_type.eq.tournament,event_type.is.null")
      .is("parent_event_id", null)
      .order("event_date", { ascending: true });
    if (!error && data) {
      setTournaments(data as any);
      if (data.length > 0) {
        const tournamentIds = data.map((t: any) => t.id);
        const { data: countData } = await supabase.rpc("get_tournament_registration_counts", { _tournament_ids: tournamentIds } as any);
        const counts: Record<string, number> = {};
        ((countData as any[]) ?? []).forEach((r: any) => { counts[r.tournament_id] = Number(r.reg_count); });
        setRegistrationCounts(counts);
      }
    }
    setLoading(false);
  };

  const fetchCompletedTournaments = async () => {
    setCompletedLoading(true);
    const selectFields = "id, title, description, location, city, event_date, registration_deadline, max_participants, prize_description, is_active, is_ranked, image_url, region_id, status, team_mode, format, top_cut_size, swiss_rounds, championship_id, entry_fee, payment_method, has_waitlist, created_by, clubs(id, name, logo_url, banner_url)";
    
    let query = supabase
      .from("tournaments").select(selectFields, { count: "exact" })
      .eq("is_active", true).eq("status", "completed").filter("is_external", "eq", false)
      .or("event_type.eq.tournament,event_type.is.null")
      .is("parent_event_id", null);

    // Apply same filters
    if (filterRegion !== "all") query = query.eq("region_id", filterRegion);
    if (searchQuery.trim()) query = query.or(`title.ilike.%${searchQuery.trim()}%,city.ilike.%${searchQuery.trim()}%`);
    if (dateFrom) query = query.gte("event_date", dateFrom);
    if (dateTo) query = query.lte("event_date", dateTo + "T23:59:59");
    if (filterClubs.length > 0) query = query.in("club_id", filterClubs);
    if (onlyMine && user && isAdmin) query = query.is("club_id", null);

    query = query.order("event_date", { ascending: completedSortBy === "date_asc" })
      .range(completedPage * COMPLETED_PER_PAGE, (completedPage + 1) * COMPLETED_PER_PAGE - 1);

    const { data, count } = await query;
    if (data) {
      setCompletedTournaments(data as any);
      setCompletedTotal(count ?? 0);
      if (data.length > 0) {
        const tIds = data.map((t: any) => t.id);
        const { data: countData } = await supabase.rpc("get_tournament_registration_counts", { _tournament_ids: tIds } as any);
        const counts: Record<string, number> = {};
        ((countData as any[]) ?? []).forEach((r: any) => { counts[r.tournament_id] = Number(r.reg_count); });
        setCompletedCounts(counts);
      }
    }
    setCompletedLoading(false);
  };

  const fetchCancelledTournaments = async () => {
    setCancelledLoading(true);
    const selectFields = "id, title, description, location, city, event_date, registration_deadline, max_participants, prize_description, is_active, is_ranked, image_url, region_id, status, team_mode, format, top_cut_size, swiss_rounds, championship_id, entry_fee, payment_method, has_waitlist, created_by, clubs(id, name, logo_url, banner_url)";

    let query = supabase
      .from("tournaments").select(selectFields, { count: "exact" })
      .eq("is_active", false).filter("is_external", "eq", false)
      .or("event_type.eq.tournament,event_type.is.null")
      .is("parent_event_id", null);

    if (filterRegion !== "all") query = query.eq("region_id", filterRegion);
    if (searchQuery.trim()) query = query.or(`title.ilike.%${searchQuery.trim()}%,city.ilike.%${searchQuery.trim()}%`);
    if (dateFrom) query = query.gte("event_date", dateFrom);
    if (dateTo) query = query.lte("event_date", dateTo + "T23:59:59");
    if (filterClubs.length > 0) query = query.in("club_id", filterClubs);
    if (onlyMine && user && isAdmin) query = query.is("club_id", null);

    query = query.order("event_date", { ascending: false })
      .range(cancelledPage * COMPLETED_PER_PAGE, (cancelledPage + 1) * COMPLETED_PER_PAGE - 1);

    const { data, count } = await query;
    if (data) {
      setCancelledTournaments(data as any);
      setCancelledTotal(count ?? 0);
      if (data.length > 0) {
        const tIds = data.map((t: any) => t.id);
        const { data: countData } = await supabase.rpc("get_tournament_registration_counts", { _tournament_ids: tIds } as any);
        const counts: Record<string, number> = {};
        ((countData as any[]) ?? []).forEach((r: any) => { counts[r.tournament_id] = Number(r.reg_count); });
        setCancelledCounts(counts);
      } else {
        setCancelledCounts({});
      }
    }
    setCancelledLoading(false);
  };

  const fetchUserRegistrations = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("tournament_registrations").select("tournament_id").eq("user_id", user.id).neq("status", "cancelled");
    if (!error && data) setRegistrations(data);
  };

  const handleRegister = async (tournamentId: string) => {
    if (!user) { toast.error("Devi effettuare l'accesso per iscriverti"); return; }
    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) { toast.error("Torneo non trovato"); return; }

    // Fresh occupied count to avoid race conditions. In paid tournaments,
    // pending-payment players reserve a slot until staff confirms/removes them.
    const isPaidTournament = (tournament.entry_fee ?? 0) > 0 || !!tournament.payment_method?.trim();
    const occupiedStatuses = isPaidTournament ? ["confirmed", "pending_payment"] : ["confirmed"];
    const { count: freshOccupied } = await supabase
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .in("status", occupiedStatuses);
    const occupiedCount = freshOccupied ?? 0;
    const hasWaitlist = tournament.has_waitlist !== false;
    const isFull = occupiedCount >= tournament.max_participants;

    if (isFull && !hasWaitlist) {
      toast.error("Posti esauriti! Le iscrizioni sono chiuse.");
      return;
    }

    const status = isPaidTournament
      ? (isFull ? "waitlist" : "pending_payment")
      : (isFull ? "waitlist" : "confirmed");
    const { error } = await supabase.from("tournament_registrations").insert({ tournament_id: tournamentId, user_id: user.id, status });
    if (error) { toast.error(error.code === "23505" ? "Sei già iscritto a questo torneo" : "Errore durante l'iscrizione"); }
    else {
      toast.success(isPaidTournament ? "Iscrizione registrata! In attesa di conferma pagamento." : (isFull ? "Sei in lista d'attesa!" : "Iscrizione completata!"));
      fetchUserRegistrations();
      fetchTournaments();
    }
  };

  const handleUnregister = async (tournamentId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("tournament_registrations")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("user_id", user.id)
      .is("child_profile_id", null);
    if (error) {
      console.error("Unregister error", error);
      toast.error(`Impossibile annullare l'iscrizione: ${error.message}`);
      return;
    }
    toast.success("Iscrizione annullata");
    fetchUserRegistrations();
    fetchTournaments();
  };

  const isRegistered = (tournamentId: string) => registrations.some((r) => r.tournament_id === tournamentId);
  const isDeadlinePassed = (deadline: string) => new Date(deadline) < new Date();

  useEffect(() => {
    if (sortBy === "distance" && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { toast.error("Impossibile ottenere la posizione"); setSortBy("date_asc"); }
      );
    }
  }, [sortBy, userLocation]);

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Split tournaments into upcoming, ongoing, standby
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const applyFilters = (list: Tournament[]) =>
    list.filter((t: any) => {
      if (filterChampionship === "main" && t.championship_id) return false;
      if (filterChampionship !== "main" && filterChampionship !== "all" && t.championship_id !== filterChampionship) return false;
      if (filterRegion !== "all" && t.region_id !== filterRegion) return false;
      if (filterType === "ranked" && !t.is_ranked) return false;
      if (filterType === "normal" && t.is_ranked) return false;
      if (dateFrom && t.event_date < dateFrom) return false;
      if (dateTo && t.event_date > dateTo + "T23:59:59") return false;
      if (filterClubs.length > 0 && !filterClubs.includes(t.clubs?.id)) return false;
      if (onlyMine && isAdmin && t.clubs?.id) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.city || "").toLowerCase().includes(q) && !(t.clubs?.name || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });

  const sortTournaments = (list: Tournament[], sort: string) =>
    [...list].sort((a: any, b: any) => {
      if (sort === "date_asc") return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      if (sort === "date_desc") return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
      if (sort === "participants") return (registrationCounts[b.id] || 0) - (registrationCounts[a.id] || 0);
      if (sort === "distance" && userLocation) {
        const distA = (a.clubs?.latitude && a.clubs?.longitude) ? haversineDistance(userLocation.lat, userLocation.lng, a.clubs.latitude, a.clubs.longitude) : 99999;
        const distB = (b.clubs?.latitude && b.clubs?.longitude) ? haversineDistance(userLocation.lat, userLocation.lng, b.clubs.latitude, b.clubs.longitude) : 99999;
        return distA - distB;
      }
      return 0;
    });

  // Categorize non-completed tournaments
  // Upcoming = tornei pending/attivi con data futura, inclusi quelli più tardi oggi
  // Ongoing = tornei avviati con data odierna
  // Standby = tornei pending già scaduti oppure tornei avviati nei giorni precedenti e mai chiusi
  const isOngoingStatus = (s: string) => s === "swiss" || s === "top_cut" || s === "in_progress";
  const isLiveOrPending = (s: string) => s === "pending" || isOngoingStatus(s);

  const upcomingRaw = tournaments.filter(t => {
    const d = new Date(t.event_date);
    return isLiveOrPending(t.status) && d >= now;
  });
  // In-corso: solo tornei effettivamente AVVIATI (status started) e con data odierna
  const ongoingRaw = tournaments.filter(t => {
    const d = new Date(t.event_date);
    return isOngoingStatus(t.status) && d >= todayStart && d < todayEnd;
  });
  // Stand-By: pending già scaduti oggi/nei giorni precedenti, oppure avviati nei giorni precedenti e non chiusi
  const standbyRaw = tournaments.filter(t => {
    const d = new Date(t.event_date);
    return (t.status === "pending" && d < now) || (isOngoingStatus(t.status) && d < todayStart);
  });

  const filteredUpcoming = sortTournaments(applyFilters(upcomingRaw), sortBy);
  const filteredOngoing = sortTournaments(applyFilters(ongoingRaw), sortBy);
  const filteredStandby = sortTournaments(applyFilters(standbyRaw), "date_desc");
  const filteredAdminTournaments = sortTournaments(applyFilters(tournaments.filter(t => isLiveOrPending(t.status))), "date_desc");

  // Current tab's filtered list (for upcoming/ongoing/standby client-side pagination)
  const currentFiltered = onlyMine && isAdmin
    ? filteredAdminTournaments
    : activeTab === "upcoming" ? filteredUpcoming : activeTab === "ongoing" ? filteredOngoing : filteredStandby;

  useEffect(() => { setCurrentPage(0); }, [filterRegion, filterType, filterChampionship, searchQuery, sortBy, dateFrom, dateTo, filterClubs, onlyMine]);
  useEffect(() => { setCompletedPage(0); setCancelledPage(0); }, [filterRegion, filterType, filterChampionship, searchQuery, completedSortBy, dateFrom, dateTo, filterClubs, onlyMine]);

  const totalPages = Math.max(1, Math.ceil(currentFiltered.length / ITEMS_PER_PAGE));
  const paginatedTournaments = currentFiltered.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  const completedTotalPages = Math.max(1, Math.ceil(completedTotal / COMPLETED_PER_PAGE));
  const cancelledTotalPages = Math.max(1, Math.ceil(cancelledTotal / COMPLETED_PER_PAGE));

  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(0, Math.min(page, totalPages - 1));
    if (clamped === currentPage) return;
    setIsAnimating(true);
    setSwipeOffset(clamped > currentPage ? -100 : 100);
    setTimeout(() => {
      setCurrentPage(clamped);
      setSwipeOffset(clamped > currentPage ? 100 : -100);
      setTimeout(() => { setIsAnimating(false); setSwipeOffset(0); }, 20);
    }, 200);
  }, [currentPage, totalPages]);

  const handleTouchStart = (e: ReactTouchEvent) => { touchStartX.current = e.touches[0].clientX; touchDeltaX.current = 0; };
  const handleTouchMove = (e: ReactTouchEvent) => { touchDeltaX.current = e.touches[0].clientX - touchStartX.current; setSwipeOffset(Math.max(-60, Math.min(60, touchDeltaX.current * 0.3))); };
  const handleTouchEnd = () => {
    if (touchDeltaX.current < -50 && currentPage < totalPages - 1) goToPage(currentPage + 1);
    else if (touchDeltaX.current > 50 && currentPage > 0) goToPage(currentPage - 1);
    else setSwipeOffset(0);
    touchDeltaX.current = 0;
  };

  const hasActiveFilters = filterRegion !== "all" || filterType !== "all" || dateFrom || dateTo || filterClubs.length > 0 || searchQuery.trim() || onlyMine;
  const clearAllFilters = () => {
    setFilterRegion("all");
    setFilterType("all");
    setDateFrom("");
    setDateTo("");
    setFilterClubs([]);
    setSearchQuery("");
    setOnlyMine(false);
  };

  // Shared filter UI — mobile: search + sort + collapsible "Filtri" toggle. Desktop: single row.
  const activeFilterCount =
    (filterRegion !== "all" ? 1 : 0) +
    (filterType !== "all" ? 1 : 0) +
    (filterClubs.length > 0 ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (onlyMine ? 1 : 0);

  const renderFilters = (sort: string, onSortChange: (v: string) => void) => (
    <div className="max-w-5xl mx-auto mb-6 space-y-2">
      {/* Top row: always visible — Search + Sort + (mobile) Filtri toggle + Create */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[110px] sm:min-w-[180px] sm:max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca blader..."
            className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        {/* Mobile filter toggle (compact, next to search) */}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 sm:hidden relative"
          onClick={() => setShowMobileFilters(v => !v)}
          aria-label="Filtri"
        >
          <Filter size={14} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </Button>
        {activeTab !== "completed" && activeTab !== "standby" && (userClubId || isAdmin) && (
          <div className="flex gap-1 shrink-0 sm:ml-auto">
            {userClubId && (
              <Button className="gap-1.5 h-9 w-9 sm:w-auto px-0 sm:px-3 text-xs" size="sm" onClick={() => { setCreateAsIbna(false); setCreateOpen(true); }} aria-label="Crea evento">
                <Plus size={14} /> <span className="hidden sm:inline">Crea Evento</span>
              </Button>
            )}
            {isAdmin && (
              <Button variant={userClubId ? "outline" : "default"} className="gap-1.5 h-9 w-9 sm:w-auto px-0 sm:px-3 text-xs" size="sm" onClick={() => { setCreateAsIbna(true); setCreateOpen(true); }} aria-label="Crea evento FIB">
                <Plus size={14} /> <span className="hidden sm:inline">Crea come FIB</span>
              </Button>
            )}
          </div>
        )}
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="hidden sm:flex w-[140px] h-9 text-xs shrink-0">
            <ArrowUpDown size={11} className="mr-1 shrink-0" />
            <SelectValue placeholder="Ordina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_asc">Data (prossimi)</SelectItem>
            <SelectItem value="date_desc">Data (recenti)</SelectItem>
            <SelectItem value="participants">Più iscritti</SelectItem>
            {activeTab === "upcoming" && <SelectItem value="distance">Più vicini</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced filters: always shown on sm+, toggleable on mobile */}
      <div className={`${showMobileFilters ? "grid" : "hidden"} sm:flex grid-cols-2 gap-2 sm:flex-wrap sm:items-center sm:gap-2`}>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="sm:hidden col-span-2 h-9 text-xs">
            <ArrowUpDown size={11} className="mr-1 shrink-0" />
            <SelectValue placeholder="Ordina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_asc">Data (prossimi)</SelectItem>
            <SelectItem value="date_desc">Data (recenti)</SelectItem>
            <SelectItem value="participants">Più iscritti</SelectItem>
            {activeTab === "upcoming" && <SelectItem value="distance">Più vicini</SelectItem>}
          </SelectContent>
        </Select>
        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs shrink-0">
            <SelectValue placeholder="Regione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le regioni</SelectItem>
            {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center h-9 rounded-md border border-input bg-background p-0.5 shrink-0 col-span-2 sm:col-span-1 justify-center">
          <button onClick={() => setFilterType(filterType === "ranked" ? "all" : "ranked")}
            className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${filterType === "ranked" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Ranked
          </button>
          <button onClick={() => setFilterType(filterType === "normal" ? "all" : "normal")}
            className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${filterType === "normal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Normal
          </button>
        </div>
        <div className="relative shrink-0 col-span-2 sm:col-span-1" ref={clubDropdownRef}>
          <button onClick={() => setShowClubDropdown(!showClubDropdown)}
            className="flex h-9 w-full sm:w-[130px] items-center rounded-md border border-input bg-background px-2.5 text-xs gap-1.5">
            <BncIcon name="club" size={20} className="text-primary shrink-0" />
            <span className="truncate">{filterClubs.length === 0 ? "Tutti i club" : `${filterClubs.length} club`}</span>
          </button>
          {showClubDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 w-[240px] max-h-[260px] overflow-y-auto bg-popover border border-border rounded-lg shadow-lg p-2">
              <input type="text" placeholder="Cerca club..." value={clubSearchQuery} onChange={(e) => setClubSearchQuery(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs mb-2" autoFocus />
              {filterClubs.length > 0 && (
                <button onClick={() => setFilterClubs([])} className="w-full text-left px-2 py-1 text-xs text-primary hover:bg-accent rounded mb-1">✕ Deseleziona tutti</button>
              )}
              {clubsList.filter(c => !clubSearchQuery.trim() || c.name.toLowerCase().includes(clubSearchQuery.toLowerCase())).map(c => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded cursor-pointer text-xs">
                  <input type="checkbox" checked={filterClubs.includes(c.id)}
                    onChange={(e) => { if (e.target.checked) setFilterClubs(prev => [...prev, c.id]); else setFilterClubs(prev => prev.filter(id => id !== c.id)); }}
                    className="rounded border-border" />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Data da"
          className="flex h-9 w-full sm:w-[120px] rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm shrink-0" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Data a"
          className="flex h-9 w-full sm:w-[120px] rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm shrink-0" />
        {isAdmin && (
          <button
            onClick={() => setOnlyMine(v => !v)}
            className={`flex items-center gap-1.5 h-9 px-2.5 rounded-md border text-xs font-medium transition-colors shrink-0 col-span-2 sm:col-span-1 justify-center ${onlyMine ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}
            title="Mostra solo i tornei creati come FIB"
          >
            <Star size={11} /> Tornei Admin
          </button>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 shrink-0 px-2 col-span-2 sm:col-span-1" onClick={clearAllFilters}>
            <X size={12} /> Reset
          </Button>
        )}
      </div>
    </div>
  );

  // Shared tournament card
  const renderTournamentCard = (tournament: Tournament, counts: Record<string, number>, isCompletedView = false) => {
    const deadlinePassed = isDeadlinePassed(tournament.registration_deadline);
    const registered = isRegistered(tournament.id);
    const spotsLeft = tournament.max_participants - (counts[tournament.id] || 0);

    if (viewMode === "grid") {
      return (
        <Link key={tournament.id} to={`/tournaments/${tournament.id}`}
          className="bg-card rounded-xl border border-border overflow-hidden card-glow relative group flex flex-col">
          {tournament.clubs?.banner_url && (
            <div className="absolute inset-0 z-0"><img src={tournament.clubs.banner_url} alt="" className="w-full h-full object-cover brightness-[0.2] group-hover:brightness-[0.25] transition-all" /></div>
          )}
          <div className="relative z-10 p-3 flex flex-col flex-1 justify-between min-h-[180px]">
            <div>
              <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                {tournament.clubs?.logo_url && <img src={tournament.clubs.logo_url} alt="" className="w-4 h-4 rounded-full object-cover border border-primary/30" />}
                <Badge className={tournament.is_ranked ? "bg-green-500/20 text-green-400 border-green-500/30 text-[9px] px-1 py-0" : "bg-muted/50 text-muted-foreground border-border text-[9px] px-1 py-0"}>
                  {tournament.is_ranked ? "RANKED" : "NORMAL"}
                </Badge>
                {isCompletedView && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted/30">Concluso</Badge>}
              </div>
              <h3 className="font-display text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">{tournament.title}</h3>
              {tournament.clubs && <p className="text-[10px] text-primary mb-1.5">{tournament.clubs.name}</p>}
            </div>
            <div className="space-y-0.5 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1"><BncIcon name="calendar" size={10} className="text-primary" /><span>{format(new Date(tournament.event_date), "d MMM yyyy", { locale: it })}</span></div>
              <div className="flex items-center gap-1"><MapPin size={10} className="text-primary" /><span className="truncate">{tournament.city}</span></div>
              <div className="flex items-center gap-1"><BncIcon name="community" size={10} className="text-primary" /><span>{counts[tournament.id] || 0}/{tournament.max_participants}</span></div>
            </div>
          </div>
        </Link>
      );
    }

    // List view
    return (
      <div key={tournament.id} className="bg-card rounded-2xl border border-border overflow-hidden card-glow relative">
        {tournament.clubs?.banner_url && (
          <div className="absolute inset-0 z-0"><img src={tournament.clubs.banner_url} alt="" className="w-full h-full object-cover blur-sm brightness-[0.25]" /></div>
        )}
        <div className="p-4 md:p-6 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1 flex gap-3">
              {tournament.clubs?.logo_url && (
                <Link to={`/clubs/${tournament.clubs.id}`} className="shrink-0">
                  <img src={tournament.clubs.logo_url} alt={tournament.clubs.name} className="w-12 h-12 rounded-full object-cover border-2 border-primary/30" />
                </Link>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className={tournament.is_ranked ? "bg-green-500/20 text-green-400 border-green-500/30 text-xs px-2 py-0.5" : "bg-muted/50 text-muted-foreground border-border text-xs px-2 py-0.5"}>
                    {tournament.is_ranked ? "RANKED" : "NORMAL"}
                  </Badge>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-2 py-0.5">
                    {tournament.team_mode === "teams" ? (
                      <><Users size={11} aria-hidden="true" /> SQUADRE</>
                    ) : tournament.team_mode === "clubs" ? (
                      <><Shield size={11} aria-hidden="true" /> CLUB</>
                    ) : (
                      <><User size={11} aria-hidden="true" /> SOLO</>
                    )}
                  </Badge>
                  {formatLabel(tournament) && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs px-2 py-0.5">{formatLabel(tournament)}</Badge>}
                  {isCompletedView && <Badge variant="outline" className="text-xs bg-muted/30">Concluso</Badge>}
                  {!isCompletedView && deadlinePassed && <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium">Chiuso</span>}
                </div>
                <h2 className="font-display text-xl md:text-2xl mb-1">
                  <Link to={`/tournaments/${tournament.id}`} className="hover:text-primary transition-colors">{tournament.title}</Link>
                </h2>
                {tournament.clubs && (
                  <Link to={`/clubs/${tournament.clubs.id}`} className="inline-flex items-center gap-1 text-primary text-xs hover:underline mb-2">
                    <BncIcon name="club" size={20} className="text-primary" />{tournament.clubs.name}
                  </Link>
                )}
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><BncIcon name="calendar" size={20} className="text-primary" /><span>{format(new Date(tournament.event_date), "d MMMM yyyy, HH:mm", { locale: it })}</span></div>
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={14} className="text-primary" /><span>{tournament.location}, {tournament.city}</span></div>
                  <div className="flex items-center gap-2 text-muted-foreground"><BncIcon name="community" size={20} className="text-primary" /><span>{counts[tournament.id] || 0}/{tournament.max_participants} iscritti</span></div>
                  {!isCompletedView && <div className="flex items-center gap-2 text-muted-foreground"><Clock size={14} className="text-primary" /><span>Entro: {format(new Date(tournament.registration_deadline), "d MMM", { locale: it })}</span></div>}
                </div>
                {tournament.prize_description && (
                  <div className="flex items-center gap-2 mt-2 text-sm"><BncIcon name="podium" size={20} className="text-primary" /><span className="font-medium">{tournament.prize_description}</span></div>
                )}
              </div>
            </div>
            {!isCompletedView && (
              <div className="lg:text-right space-y-2 shrink-0">
                {registered ? (
                  <div className="space-y-2">
                    <p className="text-primary font-medium text-sm">Sei iscritto!</p>
                    <Button variant="outline" size="sm" onClick={() => handleUnregister(tournament.id)}>Annulla</Button>
                  </div>
                ) : deadlinePassed ? (
                  <Button variant="secondary" size="sm" disabled>Chiuso</Button>
                ) : spotsLeft <= 0 ? (
                  <Button variant="secondary" size="sm" disabled>Esaurito</Button>
                ) : tournament.team_mode && tournament.team_mode !== "solo" ? (
                  <Link to={`/tournaments/${tournament.id}`}><Button variant="hero" size="sm">Crea Squadra</Button></Link>
                ) : (
                  <Button variant="hero" size="sm" onClick={() => handleRegister(tournament.id)}>Iscriviti</Button>
                )}
              </div>
            )}
            {isCompletedView && (
              <Link to={`/tournaments/${tournament.id}`} className="shrink-0">
                <Button variant="outline" size="sm">Vedi risultati</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Pagination component
  const renderPagination = (page: number, total: number, onPageChange: (p: number) => void) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={14} />
        </Button>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(total, 7) }, (_, i) => {
            let pageNum = i;
            if (total > 7) {
              if (page <= 3) pageNum = i;
              else if (page >= total - 4) pageNum = total - 7 + i;
              else pageNum = page - 3 + i;
            }
            return (
              <button key={pageNum} onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 rounded text-xs font-medium transition-colors ${pageNum === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                {pageNum + 1}
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= total - 1} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={14} />
        </Button>
      </div>
    );
  };

  return (
    <PageShell ambient="subtle"><div className="min-h-screen text-foreground">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="text-primary font-medium uppercase tracking-wider text-sm">Eventi</span>
            <h1 className="section-title mt-2">CALENDARIO <span className="gradient-text">TORNEI</span></h1>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-sm">
              Iscriviti ai prossimi tornei e sfida i migliori blader d'Italia.
            </p>
            <div className="mt-3">
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setShowRulesInfo(true)}>
                <Info size={12} /> Sistema competitivo
              </Button>
            </div>
            {showRulesInfo && <TournamentRulesInfo externalOpen={showRulesInfo} onExternalClose={() => setShowRulesInfo(false)} />}
          </div>

          {/* Championship tabs */}
          {championships.length > 0 && (
            <div className="max-w-5xl mx-auto mb-4 -mx-4 px-4">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 sm:justify-center sm:flex-wrap">
                <button onClick={() => setFilterChampionship("main")}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium border whitespace-nowrap ${filterChampionship === "main" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  Stagione principale
                </button>
                {championships.map((c) => (
                  <Link key={c.id} to={`/campionati/${c.slug}`}
                    className="shrink-0 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium border bg-card border-border text-muted-foreground hover:text-foreground flex items-center gap-1.5 whitespace-nowrap">
                    {c.logo_url && <img src={c.logo_url} alt="" className="w-3.5 h-3.5 rounded object-contain" />}
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Featured tournaments */}
          {featuredTournaments.length > 0 && activeTab === "upcoming" && (
            <div className="max-w-5xl mx-auto mb-6">
              <h2 className="font-display text-base mb-2 flex items-center gap-2">
                <BncIcon name="star-hex" size={16} className="text-primary" /> I tuoi tornei in evidenza
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {featuredTournaments.map((t) => (
                  <Link key={t.id} to={`/tournaments/${t.id}`} className="bg-card border border-primary/20 rounded-lg p-2.5 hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge className={t.is_ranked ? "bg-green-500/20 text-green-400 border-green-500/30 text-[9px]" : "bg-muted/50 text-muted-foreground text-[9px]"}>
                        {t.is_ranked ? "RANKED" : "NORMAL"}
                      </Badge>
                      {t.clubs && <span className="text-[9px] text-muted-foreground truncate">{t.clubs.name}</span>}
                    </div>
                    <h3 className="font-medium text-xs truncate">{t.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><BncIcon name="calendar" size={9} /> {format(new Date(t.event_date), "dd MMM", { locale: it })}</span>
                      <span className="flex items-center gap-0.5"><MapPin size={9} /> {t.city}</span>
                      <span className="flex items-center gap-0.5"><BncIcon name="community" size={9} /> {featuredCounts[t.id] || 0}/{t.max_participants}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="max-w-5xl mx-auto">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setCurrentPage(0); setCompletedPage(0); setCancelledPage(0); }} className="w-full">
              <TabsList className="w-full max-w-2xl mx-auto mb-4 grid grid-cols-5 h-auto p-1 gap-1">
                {[
                  { v: "upcoming", label: "NUOVI", n: filteredUpcoming.length },
                  { v: "ongoing", label: "IN CORSO", n: filteredOngoing.length },
                  { v: "standby", label: "PAUSA", n: filteredStandby.length },
                  { v: "completed", label: "CONCLUSI", n: completedTotal },
                  { v: "cancelled", label: "ANNULLATI", n: cancelledTotal },
                ].map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="flex flex-col items-center justify-center py-1.5 px-1 leading-tight gap-0.5 h-auto"
                  >
                    <span className="text-[10px] sm:text-[11px] font-bold tracking-wider whitespace-nowrap">{t.label}</span>
                    <span className="text-[10px] tabular-nums opacity-70">{t.n}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Upcoming */}
              <TabsContent value="upcoming">
                {renderFilters(sortBy, setSortBy)}
                <div className="max-w-5xl mx-auto mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{currentFiltered.length} tornei</span>
                  <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                    <button onClick={() => setViewMode("list")} className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutList size={14} /></button>
                    <button onClick={() => setViewMode("grid")} className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
                {loading ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Caricamento tornei...</div>
                ) : currentFiltered.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Nessun torneo in programma.</div>
                ) : (
                  <>
                    <div ref={swipeRef} onTouchStart={isMobile ? handleTouchStart : undefined} onTouchMove={isMobile ? handleTouchMove : undefined} onTouchEnd={isMobile ? handleTouchEnd : undefined} className="overflow-hidden">
                      <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-4"}
                        style={{ transform: `translateX(${swipeOffset}px)`, transition: isAnimating ? "transform 0.2s ease-out" : swipeOffset === 0 ? "transform 0.15s ease-out" : "none" }}>
                        {paginatedTournaments.map((t) => renderTournamentCard(t, registrationCounts))}
                      </div>
                    </div>
                    {renderPagination(currentPage, totalPages, (p) => { setCurrentPage(p); setSwipeOffset(0); })}
                  </>
                )}
              </TabsContent>

              {/* Ongoing */}
              <TabsContent value="ongoing">
                {renderFilters(sortBy, setSortBy)}
                <div className="max-w-5xl mx-auto mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{currentFiltered.length} tornei in corso</span>
                  <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                    <button onClick={() => setViewMode("list")} className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutList size={14} /></button>
                    <button onClick={() => setViewMode("grid")} className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
                {loading ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Caricamento...</div>
                ) : currentFiltered.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Nessun torneo in corso oggi.</div>
                ) : (
                  <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-4"}>
                    {currentFiltered.map((t) => renderTournamentCard(t, registrationCounts))}
                  </div>
                )}
              </TabsContent>

              {/* Completed */}
              <TabsContent value="completed">
                {renderFilters(completedSortBy, setCompletedSortBy)}
                <div className="max-w-5xl mx-auto mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{completedTotal} tornei conclusi</span>
                  <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                    <button onClick={() => setViewMode("list")} className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutList size={14} /></button>
                    <button onClick={() => setViewMode("grid")} className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
                {completedLoading ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Caricamento...</div>
                ) : completedTournaments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Nessun torneo concluso trovato.</div>
                ) : (
                  <>
                    <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-4"}>
                      {completedTournaments.map((t) => renderTournamentCard(t, completedCounts, true))}
                    </div>
                    {renderPagination(completedPage, completedTotalPages, setCompletedPage)}
                  </>
                )}
              </TabsContent>

              {/* Stand-By */}
              <TabsContent value="standby">
                {renderFilters(sortBy, setSortBy)}
                <div className="max-w-5xl mx-auto mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{currentFiltered.length} tornei in stand-by</span>
                  <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                    <button onClick={() => setViewMode("list")} className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutList size={14} /></button>
                    <button onClick={() => setViewMode("grid")} className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
                {loading ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Caricamento...</div>
                ) : currentFiltered.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Nessun torneo in stand-by.</div>
                ) : (
                  <>
                    <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-4"}>
                      {paginatedTournaments.map((t) => renderTournamentCard(t, registrationCounts))}
                    </div>
                    {renderPagination(currentPage, totalPages, (p) => { setCurrentPage(p); setSwipeOffset(0); })}
                  </>
                )}
              </TabsContent>

              {/* Cancelled */}
              <TabsContent value="cancelled">
                {renderFilters(completedSortBy, setCompletedSortBy)}
                <div className="max-w-5xl mx-auto mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{cancelledTotal} tornei annullati</span>
                  <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                    <button onClick={() => setViewMode("list")} className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutList size={14} /></button>
                    <button onClick={() => setViewMode("grid")} className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
                {cancelledLoading ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Caricamento...</div>
                ) : cancelledTournaments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">Nessun torneo annullato.</div>
                ) : (
                  <>
                    <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-4"}>
                      {cancelledTournaments.map((t) => renderTournamentCard(t, cancelledCounts, true))}
                    </div>
                    {renderPagination(cancelledPage, cancelledTotalPages, setCancelledPage)}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <Footer />
      {createOpen && (createAsIbna || userClubId) && (
        <CreateTournamentDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          clubId={createAsIbna ? null : userClubId}
          onCreated={fetchTournaments}
        />
      )}
    </div></PageShell>
  );
};

export default Tournaments;
