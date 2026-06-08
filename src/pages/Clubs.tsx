import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRegions, useMunicipalities, useClubMemberCounts } from "@/hooks/useCachedQuery";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { PageShell } from "@/components/layout/PageShell";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserClubs } from "@/hooks/useClubRole";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Shield, MapPin, Users, Plus, ChevronRight, ChevronLeft, MessageCircle, Hash, Gamepad2, Camera, Facebook, Search, LayoutGrid, List, Trophy, Calendar, Info, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateClubRequestDialog } from "@/components/clubs/CreateClubRequestDialog";
import { ClubsMap, type PlayerMapData } from "@/components/clubs/ClubsMap";
import { ClubInviteBanner } from "@/components/clubs/ClubInviteBanner";
import { HomeClubBanner } from "@/components/HomeClubBanner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { sanitizeUserHtml } from "@/lib/sanitizeUserHtml";

interface Club {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  city: string | null;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  region_id: string | null;
  regions: { name: string; code: string } | null;
  social_whatsapp_group: string | null;
  social_whatsapp_channel: string | null;
  social_discord: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_tiktok: string | null;
}

interface Region {
  id: string;
  name: string;
  code: string;
}

const CLUB_INFO_KEY = "club_info_html";
const DEFAULT_CLUB_INFO = `<h4>Cos'è un Club?</h4>
<p>Un club è un punto di ritrovo locale per i blader. Ogni club può organizzare tornei, gestire ordini di gruppo e creare una community nella propria zona.</p>
<h4>Requisiti per creare un Club</h4>
<ul>
<li>Avere un account registrato sulla piattaforma</li>
<li>Indicare un indirizzo completo e valido come sede</li>
<li>La sede deve trovarsi ad almeno <strong>10 km</strong> da qualsiasi altro club esistente</li>
<li>In caso di vicinanza, è possibile inviare una richiesta speciale con motivazione</li>
</ul>
<h4>Tornei Ranked</h4>
<ul>
<li>Per ospitare tornei <strong>Ranked</strong> servono almeno <strong>8 membri</strong> nel club</li>
<li>Ogni club può organizzare al massimo <strong>3 tornei Ranked al mese</strong></li>
<li>Un torneo Ranked richiede un minimo di <strong>8 giocatori</strong> iscritti per iniziare</li>
<li>Nei tornei Ranked non sono ammessi giocatori fittizi (BOT)</li>
</ul>
<h4>Appartenenza</h4>
<p>Ogni giocatore può far parte di <strong>un solo club</strong> alla volta, ma può seguire (Follow) altri club per restare aggiornato sui loro eventi.</p>`;

const Clubs = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [lastTournaments, setLastTournaments] = useState<Record<string, string>>({});
  const [players, setPlayers] = useState<PlayerMapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [showClubInfo, setShowClubInfo] = useState(false);
  const [rankedOnly, setRankedOnly] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [clubPage, setClubPage] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [clubInfoHtml, setClubInfoHtml] = useState(DEFAULT_CLUB_INFO);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editInfoValue, setEditInfoValue] = useState("");
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { clubs: userClubMemberships } = useUserClubs();
  const isMobile = useIsMobile();
  const carouselRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);

  // Use cached regions, municipalities and member counts
  const { data: cachedRegions } = useRegions();
  const { data: cachedMunicipalities } = useMunicipalities();
  const { data: cachedMemberCounts } = useClubMemberCounts();
  useEffect(() => { if (cachedRegions) setRegions(cachedRegions as Region[]); }, [cachedRegions]);
  useEffect(() => {
    if (!cachedMemberCounts) return;
    const counts: Record<string, number> = {};
    (cachedMemberCounts as any[]).forEach((m: any) => { counts[m.club_id] = Number(m.member_count); });
    setMemberCounts(counts);
  }, [cachedMemberCounts]);

  // Load club info from site_settings
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", CLUB_INFO_KEY).maybeSingle();
      if (data?.value) setClubInfoHtml(data.value);
    })();
  }, []);

  const saveClubInfo = async () => {
    await (supabase as any).from("site_settings").upsert(
      { key: CLUB_INFO_KEY, value: editInfoValue, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setClubInfoHtml(editInfoValue);
    setEditingInfo(false);
  };

  useEffect(() => {
    if (cachedMunicipalities) fetchAll();
  }, [cachedMunicipalities]);

  const fetchAll = async () => {
    const [clubsRes, tourneysRes] = await Promise.all([
      supabase.from("clubs").select("id, name, description, logo_url, banner_url, city, is_active, latitude, longitude, region_id, social_whatsapp_group, social_whatsapp_channel, social_discord, social_instagram, social_facebook, social_tiktok, regions(name, code)").eq("is_active", true).order("name"),
      supabase.from("tournaments").select("club_id, event_date").not("club_id", "is", null).eq("status", "completed").order("event_date", { ascending: false }),
    ]);

    // Build city→province/region lookup from cached municipalities (regions joined client-side)
    const regionNameById = new Map<string, string>((cachedRegions ?? []).map((r: any) => [r.id, r.name]));
    const cityLookup: Record<string, { province: string; region_name: string }> = {};
    (cachedMunicipalities ?? []).forEach((m: any) => {
      cityLookup[m.name.toLowerCase().trim()] = {
        province: m.province,
        region_name: regionNameById.get(m.region_id) || "",
      };
    });

    // Fetch ALL profiles with city (paginate to bypass 1000-row limit)
    const profileFields = "id, user_id, display_name, username, city, avatar_url, points, wins, last_seen_at";
    let allProfiles: any[] = [];
    const PAGE_SIZE = 1000;
    for (let page = 0; ; page++) {
      const { data } = await supabase
        .from("profiles")
        .select(profileFields)
        .not("city", "is", null)
        .order("points", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (!data || data.length === 0) break;
      allProfiles = allProfiles.concat(data);
      if (data.length < PAGE_SIZE) break;
    }

    if (!clubsRes.error && clubsRes.data) setClubs(clubsRes.data as any);

    const ltMap: Record<string, string> = {};
    tourneysRes.data?.forEach((t: any) => { if (t.club_id && !ltMap[t.club_id]) ltMap[t.club_id] = t.event_date; });
    setLastTournaments(ltMap);

    const realProfiles = allProfiles.filter(p =>
      (p.display_name || p.username) &&
      !p.display_name?.startsWith("[Guest]") && !p.display_name?.startsWith("[BOT]")
    );

    if (realProfiles.length > 0) {
      const userIds = realProfiles.map(p => p.user_id);
      const clubMap: Record<string, { clubName: string; role: string }> = {};
      const BATCH = 500;
      for (let i = 0; i < userIds.length; i += BATCH) {
        const batch = userIds.slice(i, i + BATCH);
        const { data: clubMembers } = await supabase.from("club_members").select("user_id, role, clubs:club_id(name)").in("user_id", batch);
        clubMembers?.forEach((cm: any) => { clubMap[cm.user_id] = { clubName: cm.clubs?.name || "Club", role: cm.role }; });
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      setPlayers(realProfiles.map((p) => {
        const club = clubMap[p.user_id];
        const lastSeen = p.last_seen_at ? new Date(p.last_seen_at as string) : null;
        const cityKey = (p.city || "").toLowerCase().trim();
        const geo = cityLookup[cityKey];
        return {
          id: p.id, user_id: p.user_id, display_name: p.display_name, username: p.username,
          city: p.city, avatar_url: p.avatar_url, points: p.points || 0, wins: p.wins || 0,
          season_points: 0, season_wins: 0, club_name: club?.clubName || null,
          club_role: club?.role || null, is_admin: false,
          is_active: lastSeen ? lastSeen >= sevenDaysAgo : false,
          last_seen_at: lastSeen ? lastSeen.toISOString() : null, collection_pct: 0,
          province: geo?.province || null,
          region_name: geo?.region_name || null,
        };
      }));
    } else {
      setPlayers([]);
    }

    setLoading(false);
  };



  // User's club
  const userClub = useMemo(() => {
    if (!userClubMemberships.length) return null;
    const membership = userClubMemberships[0];
    const club = clubs.find((c) => c.id === membership.club_id);
    if (!club) return null;
    return { ...club, role: membership.role };
  }, [userClubMemberships, clubs]);

  const regionClubCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    clubs.forEach((c) => {
      if (c.region_id) {
        counts[c.region_id] = (counts[c.region_id] || 0) + 1;
      }
    });
    return counts;
  }, [clubs]);

  const filteredClubs = useMemo(() => {
    let result = clubs;
    if (selectedRegion) result = result.filter((c) => c.region_id === selectedRegion);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q));
    }
    if (rankedOnly) result = result.filter((c) => (memberCounts[c.id] || 0) >= 8);
    return result;
  }, [clubs, selectedRegion, searchQuery, rankedOnly, memberCounts]);

  const perPage = viewMode === "list" ? (isMobile ? 3 : 4) : (isMobile ? 4 : 6);
  const totalPages = Math.max(1, Math.ceil(filteredClubs.length / perPage));
  const pagedClubs = useMemo(() => {
    const start = clubPage * perPage;
    return filteredClubs.slice(start, start + perPage);
  }, [filteredClubs, clubPage, perPage]);

  // Reset page when filters change
  useEffect(() => { setClubPage(0); }, [selectedRegion, searchQuery, viewMode]);

  const goPage = useCallback((dir: number) => {
    setClubPage(prev => Math.max(0, Math.min(totalPages - 1, prev + dir)));
  }, [totalPages]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) goPage(diff > 0 ? 1 : -1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = dragStartX.current - e.clientX;
    if (Math.abs(diff) > 60) goPage(diff > 0 ? 1 : -1);
  };
  const handleMouseLeave = () => { isDragging.current = false; };

  const roleLabel = (role: string) => {
    switch (role) {
      case "leader": return "Fondatore";
      case "staff": return "Staff";
      default: return "Membro";
    }
  };

  return (
    <PageShell ambient="subtle"><div className="min-h-screen text-foreground">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="min-w-0">
              <span className="text-primary font-medium uppercase tracking-wider text-sm">Comunità</span>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <h1 className="section-title">
                  I NOSTRI <span className="gradient-text">CLUB</span>
                </h1>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => setShowClubInfo(true)}
                  aria-label="Informazioni sui club"
                >
                  <Info size={16} />
                </Button>
              </div>
              <p className="text-muted-foreground mt-4 max-w-xl">
                Unisciti a un club o creane uno per organizzare tornei nella tua zona.
              </p>
            </div>
            {user && !userClub && (
              <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                <Button variant="hero" className="flex-1 sm:flex-initial" onClick={() => setShowRequest(true)}>
                  <Plus size={18} />
                  Richiedi Club
                </Button>
              </div>
            )}
          </div>

          {/* User's Club Banner — same as homepage */}
          {userClub && <HomeClubBanner />}

          {/* Club invite banners (above filters; founder banner hidden if user already in a club) */}
          <div className="mb-6">
            <ClubInviteBanner hasClub={!!userClub} />
          </div>

          {/* Region Filter Dropdown */}
          <div className="mb-8">
            <Select value={selectedRegion || "all"} onValueChange={(v) => setSelectedRegion(v === "all" ? null : v)}>
              <SelectTrigger className="w-full max-w-xs rounded-xl bg-card border-border text-sm font-medium">
                <MapPin size={14} className="text-primary mr-1.5 shrink-0" />
                <SelectValue placeholder="Tutte le regioni" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Tutte le regioni ({clubs.length})</SelectItem>
                {regions
                  .filter((r) => regionClubCounts[r.id])
                  .map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name} ({regionClubCounts[region.id]})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca club per nome o città..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ranked-filter" checked={rankedOnly} onCheckedChange={setRankedOnly} />
              <Label htmlFor="ranked-filter" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                <Trophy size={12} className="inline mr-1 text-primary" />Ranked (8+)
              </Label>
            </div>
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                aria-label="Vista griglia"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                aria-label="Vista lista"
              >
                <List size={18} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Caricamento club...</div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {selectedRegion ? "Nessun club in questa regione." : "Nessun club registrato. Sii il primo a crearne uno!"}
            </div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-6 items-start">
              {/* Map - LEFT */}
              <div className="lg:col-span-2 lg:sticky lg:top-24 lg:self-start h-[500px] order-2 lg:order-1">
              <ClubsMap
                  clubs={filteredClubs.map((c) => ({
                    id: c.id,
                    name: c.name,
                    city: c.city,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    memberCount: memberCounts[c.id] || 0,
                    logo_url: c.logo_url,
                    banner_url: c.banner_url,
                    description: c.description,
                    region_name: c.regions?.name || null,
                    last_tournament_date: lastTournaments[c.id] || null,
                    social_instagram: c.social_instagram,
                    social_discord: c.social_discord,
                    social_whatsapp_group: c.social_whatsapp_group,
                  }))}
                  players={players}
                />
              </div>

              {/* Club cards carousel - RIGHT */}
              <div className="lg:col-span-3 order-1 lg:order-2">

                {/* Swipeable area */}
                <div
                  ref={carouselRef}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  className={`grid gap-4 md:gap-6 transition-opacity duration-300 cursor-grab active:cursor-grabbing select-none ${viewMode === "grid" ? "grid-cols-2" : "grid-cols-1"}`}
                >
                  {pagedClubs.map((club) => (
                    <Link
                      key={club.id}
                      to={`/clubs/${club.id}`}
                      className={`rounded-2xl border border-border overflow-hidden card-glow block group select-none pointer-events-auto [&_*]:select-none [&_img]:pointer-events-none [&_img]:draggable-none ${viewMode === "list" ? "relative bg-card" : "bg-card"}`}
                      draggable={false}
                    >
                      {viewMode === "list" && (
                        <div className="absolute inset-0 overflow-hidden">
                          {club.banner_url ? (
                            <img src={club.banner_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
                          )}
                          <div className="absolute inset-0 bg-background/85" />
                        </div>
                      )}
                      {viewMode === "grid" && (
                        <div className="h-20 md:h-24 relative overflow-hidden">
                          {club.banner_url ? (
                            <img src={club.banner_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
                          )}
                        </div>
                      )}
                      <div className={`p-4 md:p-6 min-w-0 ${viewMode === "list" ? "relative" : ""}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                            {club.logo_url ? (
                              <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
                            ) : (
                              <Shield size={20} className="text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-base md:text-xl truncate">{club.name}</h3>
                            {club.regions && (
                              <span className="text-xs text-muted-foreground">{club.regions.name}</span>
                            )}
                          </div>
                        </div>

                        {club.description && (
                          <p className={`text-muted-foreground text-xs md:text-sm mb-3 ${viewMode === "list" ? "line-clamp-3" : "line-clamp-2"}`}>{club.description}</p>
                        )}

                        <div className="flex items-center flex-wrap gap-3 text-xs md:text-sm text-muted-foreground">
                          {club.city && (
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-primary" />
                              <span>{club.city}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users size={12} className="text-primary" />
                            <span>{memberCounts[club.id] || 0} membri</span>
                          </div>
                          {viewMode === "list" && lastTournaments[club.id] && (
                            <div className="flex items-center gap-1">
                              <Trophy size={12} className="text-primary" />
                              <span>Ultimo torneo: {new Date(lastTournaments[club.id]).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          )}
                        </div>

                        {viewMode === "list" && (() => {
                          const socials = [
                            { url: club.social_whatsapp_group, icon: <MessageCircle size={14} />, label: "WhatsApp", bg: "bg-green-600" },
                            { url: club.social_whatsapp_channel, icon: <Hash size={14} />, label: "Canale WA", bg: "bg-green-500" },
                            { url: club.social_discord, icon: <Gamepad2 size={14} />, label: "Discord", bg: "bg-indigo-600" },
                            { url: club.social_instagram, icon: <Camera size={14} />, label: "Instagram", bg: "bg-pink-600" },
                            { url: club.social_facebook, icon: <Facebook size={14} />, label: "Facebook", bg: "bg-blue-600" },
                          ].filter(s => s.url);
                          return socials.length > 0 ? (
                            <div className="flex items-center gap-1.5 mt-3">
                              {socials.map((s, i) => (
                                <a
                                  key={i}
                                  href={s.url!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`w-7 h-7 rounded-md flex items-center justify-center text-white hover:opacity-80 transition-opacity ${s.bg}`}
                                >
                                  {s.icon}
                                </a>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={clubPage === 0} onClick={() => goPage(-1)}>
                      <ChevronLeft size={16} />
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums px-2">
                      {clubPage + 1} <span className="opacity-60">/ {totalPages}</span>
                    </span>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={clubPage === totalPages - 1} onClick={() => goPage(1)}>
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <CreateClubRequestDialog open={showRequest} onOpenChange={setShowRequest} />

      <Dialog open={showClubInfo} onOpenChange={(o) => { setShowClubInfo(o); if (!o) setEditingInfo(false); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield size={20} className="text-primary" /> Come funzionano i Club
              {isAdmin && !editingInfo && (
                <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => { setEditInfoValue(clubInfoHtml); setEditingInfo(true); }}>
                  <Pencil size={14} />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {editingInfo ? (
            <div className="space-y-3">
              <Textarea
                value={editInfoValue}
                onChange={(e) => setEditInfoValue(e.target.value)}
                rows={16}
                className="font-mono text-xs"
                placeholder="HTML content..."
              />
              <p className="text-xs text-muted-foreground">Usa tag HTML: &lt;h4&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingInfo(false)}>Annulla</Button>
                <Button size="sm" onClick={saveClubInfo}>Salva</Button>
              </div>
            </div>
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground [&_h4]:text-foreground [&_h4]:font-semibold [&_h4]:mb-1 [&_h4]:mt-3 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1"
              dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(clubInfoHtml) }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div></PageShell>
  );
};

export default Clubs;
