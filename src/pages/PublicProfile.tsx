import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCollectionCatalog } from "@/hooks/useCachedQuery";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, MapPin, Package, CheckCircle2, ExternalLink, Swords, ChevronDown, ChevronUp, Calendar, Award, Zap, ShoppingBag, Shield, Baby, Pencil, Star, RefreshCw, Users, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ProfileBadges } from "@/components/ProfileBadges";
import { RankBadge } from "@/components/RankMedal";
import { DeckCard } from "@/components/decks/DeckCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFriends, getFriendStatus } from "@/hooks/useFriends";
import { useTeam } from "@/hooks/useTeam";
import { useUserClubs } from "@/hooks/useClubRole";
import { useStartPrivateChat } from "@/hooks/useStartPrivateChat";
import { UserPlus, Check, Clock, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import PlayerStatsPanel from "@/components/profile/PlayerStatsPanel";

interface ProfileData {
  user_id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  points: number;
  wins: number;
  points_monthly?: number;
  wins_monthly?: number;
  created_at: string;
  best_launch_speed: number | null;
}

interface TournamentHistory {
  tournament_id: string;
  placement: number;
  scaled_points: number;
  tournament_title: string;
  event_date: string;
  city: string;
  is_ranked?: boolean;
  is_external?: boolean;
  // Conteggio nella vista BFL Stagionale
  bfl_seasonal?: 'monthly' | 'rollover' | null;
  // Conteggio nella vista BFL Mensile + Rollover
  bfl_monthly?: 'monthly' | 'rollover' | null;
}

interface ChildSummary {
  id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
}

const PublicProfile = () => {
  const { username, childId } = useParams<{ username?: string; childId?: string }>();
  const isChildRoute = !!childId;
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isChild, setIsChild] = useState(false);
  const [parentUserId, setParentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [favoriteDeck, setFavoriteDeck] = useState<any>(null);
  const [collectionStats, setCollectionStats] = useState<{
    total: number;
    owned: number;
    categories: { id: string; name: string; total: number; owned: number }[];
  }>({ total: 0, owned: 0, categories: [] });
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [tournamentHistory, setTournamentHistory] = useState<TournamentHistory[]>([]);
  const [allTournamentsOpen, setAllTournamentsOpen] = useState(false);
  const [bflOnly, setBflOnly] = useState(false);
  const [bflView, setBflView] = useState<'seasonal' | 'monthly'>('seasonal');
  const [monthlyEnabledOnSeason, setMonthlyEnabledOnSeason] = useState(false);
  const [seasonStats, setSeasonStats] = useState<{ points: number; wins: number } | null>(null);
  const [marketListings, setMarketListings] = useState<any[]>([]);
  const [club, setClub] = useState<{ id: string; name: string; logo_url: string | null; role: string } | null>(null);
  const [team, setTeam] = useState<{ id: string; name: string; slug: string; logo_url: string | null; role: string } | null>(null);
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isChildRoute && childId) fetchChildProfile(childId);
    else if (username) fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, childId]);

  const fetchChildProfile = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("child_profiles")
        .select("id, parent_user_id, display_name, avatar_url, city, region_id, points, wins, points_monthly, wins_monthly, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        setIsChild(true);
        setParentUserId(data.parent_user_id);
        setProfile({
          user_id: data.id,
          username: null,
          display_name: data.display_name,
          bio: null,
          city: data.city,
          avatar_url: data.avatar_url,
          banner_url: null,
          points: data.points || 0,
          wins: data.wins || 0,
          points_monthly: data.points_monthly || 0,
          wins_monthly: data.wins_monthly || 0,
          created_at: data.created_at,
          best_launch_speed: null,
        });
        await fetchSeasonAndHistory(data.id).catch((e) => console.error("history error", e));
      }
    } catch (e: any) {
      console.error("fetchChildProfile error", e);
      setLoadError(e?.message || "Errore caricamento profilo figlio");
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, username, display_name, avatar_url, banner_url, bio, city, points, wins, points_monthly, wins_monthly, region_id, best_launch_speed, favorite_deck_id, created_at")
        .ilike("username", username ?? "")
        .maybeSingle();
      if (error) throw error;

      if (data) {
        setProfile(data);
        setIsChild(false);
        const historyAndSeasonPromise = fetchSeasonAndHistory(data.user_id).catch((e) => { console.error("history error", e); });
        await Promise.allSettled([
          fetchCollection(data.user_id),
          historyAndSeasonPromise,
          fetchMarketListings(data.user_id),
          fetchClub(data.user_id),
          fetchTeam(data.user_id),
          fetchChildren(data.user_id),
        ]);
        if ((data as any).favorite_deck_id) {
          try {
            const { data: deckData } = await (supabase as any)
              .from("decks")
              .select("id, user_id, name, description, created_at")
              .eq("id", (data as any).favorite_deck_id)
              .maybeSingle();
            setFavoriteDeck(deckData);
          } catch (e) { console.error("favorite deck error", e); }
        }
      }
    } catch (e: any) {
      console.error("fetchProfile error", e);
      setLoadError(e?.message || "Errore caricamento profilo");
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async (parentId: string) => {
    const { data } = await (supabase as any)
      .from("child_profiles")
      .select("id, display_name, avatar_url, points")
      .eq("parent_user_id", parentId)
      .order("created_at");
    setChildren((data || []) as ChildSummary[]);
  };

  const fetchSeasonAndHistory = async (userId: string) => {
    // Fetch standings (tutti i tornei giocati, anche non ranked) + results + season
    const [{ data: standings }, { data: results }, { data: season }] = await Promise.all([
      supabase.from("tournament_standings").select("tournament_id, wins, losses, draws, points").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("tournament_results").select("tournament_id, placement, scaled_points").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      (supabase as any).from("ranking_seasons").select("id, start_date, end_date, bfl, monthly_bfl_enabled, monthly_bfl").eq("is_active", true).maybeSingle(),
    ]);

    const resMap = new Map((results || []).map((r: any) => [r.tournament_id, r]));
    const allTIds = Array.from(new Set([...(standings || []).map((s: any) => s.tournament_id), ...(results || []).map((r: any) => r.tournament_id)]));
    if (allTIds.length === 0) return;

    const { data: tournaments } = await supabase.from("tournaments").select("id, title, event_date, city, is_ranked, is_external, championship_id").in("id", allTIds);
    if (!tournaments) return;
    const tMap = new Map(tournaments.map((t: any) => [t.id, t]));

    // Compute which tournaments count in BFL based on active season config
    const bfl = (season as any)?.bfl ?? 10;
    const monthlyEnabled = !!(season as any)?.monthly_bfl_enabled;
    const monthlyBfl = (season as any)?.monthly_bfl ?? 2;
    setMonthlyEnabledOnSeason(monthlyEnabled);
    // Two independent maps: one for the Seasonal view, one for the Monthly+Rollover view
    const seasonalMap = new Map<string, 'monthly' | 'rollover'>();
    const monthlyMap = new Map<string, 'monthly' | 'rollover'>();
    if (season) {
      const eligible = (results || [])
        .map((r: any) => {
          const t: any = tMap.get(r.tournament_id);
          if (!t) return null;
          if (!t.is_ranked || t.championship_id) return null;
          if (t.event_date < (season as any).start_date || t.event_date > (season as any).end_date) return null;
          return { id: r.tournament_id, pts: r.scaled_points || 0, date: t.event_date };
        })
        .filter(Boolean) as { id: string; pts: number; date: string }[];

      // (A) Seasonal-only BFL: top _bfl tournaments by points
      [...eligible].sort((a, b) => b.pts - a.pts).slice(0, bfl).forEach((e) => seasonalMap.set(e.id, 'monthly'));

      // (B) Monthly + Rollover (only if enabled)
      if (monthlyEnabled) {
        const byMonth = new Map<string, typeof eligible>();
        for (const e of eligible) {
          const key = e.date.slice(0, 7);
          if (!byMonth.has(key)) byMonth.set(key, []);
          byMonth.get(key)!.push(e);
        }
        const monthlyPicks: typeof eligible = [];
        const rolloverCandidates: typeof eligible = [];
        for (const arr of byMonth.values()) {
          arr.sort((a, b) => b.pts - a.pts);
          monthlyPicks.push(...arr.slice(0, monthlyBfl));
          rolloverCandidates.push(...arr.slice(monthlyBfl));
        }
        const sStart = new Date((season as any).start_date);
        const seasonEnd = new Date((season as any).end_date);
        const now = new Date();
        const effective = new Date(Math.min(new Date(seasonEnd.getFullYear(), seasonEnd.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()));
        const monthsElapsed = Math.max(1, (effective.getFullYear() - sStart.getFullYear()) * 12 + (effective.getMonth() - sStart.getMonth()) + 1);
        const monthlyCap = Math.min(bfl, Math.max(monthlyBfl, 1) * monthsElapsed);
        const rolloverCap = Math.max(0, monthlyCap - monthlyPicks.length);
        const rolloverPicks = rolloverCandidates.sort((a, b) => b.pts - a.pts).slice(0, rolloverCap);

        type Pick = { e: { id: string; pts: number; date: string }; kind: 'monthly' | 'rollover' };
        const combined: Pick[] = [
          ...monthlyPicks.map((e) => ({ e, kind: 'monthly' as const })),
          ...rolloverPicks.map((e) => ({ e, kind: 'rollover' as const })),
        ];
        combined.sort((a, b) => {
          if (b.e.pts !== a.e.pts) return b.e.pts - a.e.pts;
          if (a.kind !== b.kind) return a.kind === 'monthly' ? -1 : 1;
          return 0;
        });
        combined.slice(0, bfl).forEach((p) => monthlyMap.set(p.e.id, p.kind));
      }
    }

    setTournamentHistory(
      allTIds.filter((id) => tMap.has(id)).map((id) => {
        const t: any = tMap.get(id)!;
        const r: any = resMap.get(id);
        return {
          tournament_id: id,
          placement: r?.placement ?? null,
          scaled_points: r?.scaled_points ?? 0,
          tournament_title: t.title,
          event_date: t.event_date,
          city: t.city,
          is_ranked: t.is_ranked,
          is_external: !!t.is_external,
          bfl_seasonal: seasonalMap.get(id) ?? null,
          bfl_monthly: monthlyEnabled ? (monthlyMap.get(id) ?? null) : null,
          
        };
      }).sort((a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
    );
    if (season && results) {
      // Season stats: only RANKED tournaments (exclude normal, championship, external)
      const stIds = new Set(
        tournaments
          .filter((t: any) => t.is_ranked === true && !t.championship_id)
          .filter((t: any) => t.event_date >= (season as any).start_date && t.event_date <= (season as any).end_date)
          .map((t: any) => t.id)
      );
      const seasonResults = results.filter((r: any) => stIds.has(r.tournament_id));
      setSeasonStats({
        points: seasonResults.reduce((s: number, r: any) => s + (r.scaled_points || 0), 0),
        wins: seasonResults.filter((r: any) => r.placement === 1).length,
      });
    }
  };

  // Use cached catalog instead of 3 separate queries per visit
  const { data: catalogData } = useCollectionCatalog();

  const fetchClub = async (userId: string) => {
    const { data } = await supabase
      .from("club_members")
      .select("role, clubs(id, name, logo_url)")
      .eq("user_id", userId)
      .maybeSingle();
    if (data && (data as any).clubs) {
      const c: any = (data as any).clubs;
      setClub({ id: c.id, name: c.name, logo_url: c.logo_url, role: (data as any).role });
    } else {
      setClub(null);
    }
  };

  const fetchTeam = async (userId: string) => {
    const { data } = await (supabase as any)
      .from("team_members")
      .select("role, teams(id, name, slug, logo_url)")
      .eq("user_id", userId)
      .maybeSingle();
    if (data && (data as any).teams) {
      const t: any = (data as any).teams;
      setTeam({ id: t.id, name: t.name, slug: t.slug, logo_url: t.logo_url, role: (data as any).role });
    } else {
      setTeam(null);
    }
  };

  const fetchMarketListings = async (userId: string) => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("market_listings")
      .select("id, product_name, price, condition, image_url, created_at")
      .eq("user_id", userId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    setMarketListings(data || []);
  };

  const fetchCollection = async (userId: string) => {
    // Only fetch user's owned items - catalog comes from cache
    const { data: collRow } = await supabase
      .from("user_collection_data").select("items").eq("user_id", userId).maybeSingle();

    const allComps = catalogData?.components ?? [];
    const allVars = catalogData?.variants ?? [];
    const allCats = catalogData?.categories ?? [];
    const ownedRows = (collRow?.items as any[] ?? []).map((i: any) => ({
      component_id: i.c,
      variant_id: i.v ?? null,
    }));
    const ownedBaseSet = new Set(ownedRows.filter((o: any) => !o.variant_id).map((o: any) => o.component_id));
    const ownedVariantSet = new Set(ownedRows.filter((o: any) => o.variant_id).map((o: any) => o.variant_id));

    const categories = allCats
      .map((cat: any) => {
        const catComps = allComps.filter((c: any) => c.category_id === cat.id);
        const catCompIds = new Set(catComps.map((c: any) => c.id));
        const catVars = allVars.filter((v: any) => catCompIds.has(v.component_id));
        return {
          id: cat.id,
          name: cat.name,
          total: catComps.length + catVars.length,
          owned: catComps.filter((c: any) => ownedBaseSet.has(c.id)).length + catVars.filter((v: any) => ownedVariantSet.has(v.id)).length,
        };
      })
      .filter((c: any) => c.total > 0);

    setCollectionStats({ total: allComps.length + allVars.length, owned: ownedBaseSet.size + ownedVariantSet.size, categories });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16 text-center">
          <h1 className="text-2xl font-bold mb-4">{loadError ? "Errore caricamento profilo" : "Profilo non trovato"}</h1>
          <p className="text-muted-foreground">
            {loadError
              ? loadError
              : isChildRoute ? "Il profilo figlio richiesto non esiste." : `L'utente "@${username}" non esiste.`}
          </p>
          {loadError && (
            <Button variant="outline" className="mt-4" onClick={() => { setLoadError(null); setLoading(true); if (isChildRoute && childId) fetchChildProfile(childId); else if (username) fetchProfile(); }}>
              Riprova
            </Button>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  const canEditChild = isChild && user && parentUserId === user.id;

  const collectionPercent = collectionStats.total > 0
    ? Math.round((collectionStats.owned / collectionStats.total) * 100) : 0;

  const placementEmoji = (p: number | null) =>
    p == null ? "—" : <RankBadge rank={p} size={16} className="align-middle text-xs" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-3 sm:px-4 xl:px-6">
          <div className="mx-auto max-w-3xl xl:max-w-7xl">
            {/* Profile Header */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden mb-4 sm:mb-6">
              <div className="h-28 sm:h-40 bg-gradient-to-r from-primary/30 to-primary/10">
                {profile.banner_url && (
                  <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
                )}
              </div>

              <div className="px-4 sm:px-8 pb-5 sm:pb-7">
                {/* Avatar + Name */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">
                  <div className="shrink-0 -mt-12 sm:-mt-16 mx-auto sm:mx-0">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-card overflow-hidden bg-primary/20 flex items-center justify-center shadow-lg bg-card">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display text-4xl text-primary">
                          {(profile.display_name || profile.username || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 w-full text-center sm:text-left sm:pb-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <h1 className="font-display text-2xl sm:text-3xl break-words leading-tight">
                        {profile.display_name || profile.username || "Blader"}
                      </h1>
                      {isChild && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                          <Baby size={10} /> Kids
                        </span>
                      )}
                    </div>
                    {profile.username && <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>}
                    {profile.city && (
                      <p className="flex items-center justify-center sm:justify-start gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin size={14} className="shrink-0" /> <span className="truncate">{profile.city}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {canEditChild && (
                    <Link to="/profile">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5">
                        <Pencil size={14} /> Modifica
                      </Button>
                    </Link>
                  )}
                  {user && profile && user.id !== profile.user_id && !isChild && (
                    <FriendActions
                      otherId={profile.user_id}
                      targetHasTeam={!!team}
                      targetHasClub={!!club}
                    />
                  )}
                </div>

                {/* Club / Team chips */}
                {((club && !isChild) || (team && !isChild)) && (
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                    {club && !isChild && (
                      <Link
                        to={`/clubs/${club.id}`}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-sm max-w-full min-w-0"
                      >
                        {club.logo_url ? (
                          <img src={club.logo_url} alt={club.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                        ) : (
                          <Shield size={14} className="text-primary shrink-0" />
                        )}
                        <span className="font-medium truncate">{club.name}</span>
                      </Link>
                    )}
                    {team && !isChild && (
                      <Link
                        to={user?.id === profile.user_id ? "/squadra" : `/profilo/${profile.username}`}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors text-sm max-w-full min-w-0"
                      >
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                        ) : (
                          <Users size={14} className="text-accent-foreground shrink-0" />
                        )}
                        <span className="font-medium truncate">{team.name}</span>
                        {team.role === "owner" && <Crown size={12} className="text-amber-500 shrink-0" />}
                      </Link>
                    )}
                  </div>
                )}

                {/* Stats grid */}
                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-xl bg-secondary/40 border border-border/40 px-2 py-3 text-center">
                    <Trophy size={16} className="text-primary mx-auto mb-1" />
                    <p className="font-bold text-base sm:text-lg leading-none">{profile.points || 0}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Punti</p>
                  </div>
                  <div className="rounded-xl bg-secondary/40 border border-border/40 px-2 py-3 text-center">
                    <Medal size={16} className="text-primary mx-auto mb-1" />
                    <p className="font-bold text-base sm:text-lg leading-none">{profile.wins || 0}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Vittorie</p>
                  </div>
                  <div className="rounded-xl bg-secondary/40 border border-border/40 px-2 py-3 text-center">
                    <Zap size={16} className="text-primary mx-auto mb-1" />
                    <p className="font-bold text-base sm:text-lg leading-none truncate">
                      {profile.best_launch_speed != null && profile.best_launch_speed > 0 ? profile.best_launch_speed.toLocaleString() : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Shoot</p>
                  </div>
                </div>

                {/* Season stats */}
                {seasonStats && (
                  <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Stagione attiva:</span>
                    <span className="font-semibold">{seasonStats.points} pt</span>
                    <span className="font-semibold">{seasonStats.wins} vittorie</span>
                  </div>
                )}

                {profile.bio && <p className="text-muted-foreground mt-3 text-sm sm:text-base whitespace-pre-line break-words">{profile.bio}</p>}

                <div className="mt-4">
                  <ProfileBadges userId={profile.user_id} inline />
                </div>
              </div>
            </div>

            {/* === Desktop 2-col layout === */}
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6 xl:items-start">
              <div className="min-w-0">

            {/* Favorite Deck */}
            {favoriteDeck && !isChild && (
              <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="font-display text-lg mb-3 flex items-center gap-2">
                  <Swords size={18} className="text-primary" /> Deck preferito
                </h2>
                <DeckCard deck={favoriteDeck} compact />
              </div>
            )}

            {/* Player Stats Overview */}
            <PlayerStatsPanel
              userId={profile.user_id}
              isChild={isChild}
              bflTournamentIds={tournamentHistory.filter((t) => t.bfl_seasonal != null).map((t) => t.tournament_id)}
              bflPoints={profile.points || 0}
            />


            {/* Tournament History */}
            {tournamentHistory.length > 0 && (() => {
              const kindOf = (t: TournamentHistory) => bflView === 'monthly' ? t.bfl_monthly : t.bfl_seasonal;
              const filtered = bflOnly ? tournamentHistory.filter((t) => kindOf(t) != null) : tournamentHistory;
              const totalPts = tournamentHistory.reduce((s, t) => s + (kindOf(t) != null ? (t.scaled_points || 0) : 0), 0);
              return (
              <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <h2 className="font-display text-lg flex items-center gap-2">
                    <Calendar size={18} className="text-primary" /> Cronologia Tornei
                  </h2>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="bfl-only" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                      <Star size={12} className="text-primary fill-primary" /> Solo BFL
                    </Label>
                    <Switch id="bfl-only" checked={bflOnly} onCheckedChange={setBflOnly} />
                  </div>
                </div>
                {monthlyEnabledOnSeason && (
                  <div className="mb-3 inline-flex rounded-lg border border-border p-0.5 bg-secondary/30 text-xs">
                    <button
                      onClick={() => setBflView('seasonal')}
                      className={`px-3 py-1.5 rounded-md transition-colors ${bflView === 'seasonal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      BFL Stagionale · {profile.points || 0} pt
                    </button>
                    <button
                      onClick={() => setBflView('monthly')}
                      className={`px-3 py-1.5 rounded-md transition-colors ${bflView === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Mensile + Rollover · {profile.points_monthly || 0} pt
                    </button>
                  </div>
                )}
                {bflOnly && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Totale tornei conteggiati: <span className="font-semibold text-foreground">{totalPts} pt</span>
                  </p>
                )}
                <div className="space-y-2">
                  {filtered.slice(0, 3).map((t) => {
                    const kind = kindOf(t);
                    const counted = kind != null;
                    const isRollover = kind === 'rollover';
                    const dim = t.is_ranked && t.placement != null && !counted;
                    return (
                    <Link key={t.tournament_id} to={`/tournaments/${t.tournament_id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium truncate">{t.tournament_title}</p>
                          {t.is_external && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                              Importato
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.city} · {new Date(t.event_date).toLocaleDateString("it-IT")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm font-bold">{placementEmoji(t.placement)}</span>
                        {counted && !isRollover && (
                          <Star size={14} className="text-primary fill-primary" aria-label="Conteggiato nel BFL (mensile)" />
                        )}
                        {counted && isRollover && (
                          <RefreshCw size={14} className="text-amber-500" aria-label="Conteggiato nel BFL (rollover mese mancante)" />
                        )}
                        {t.is_ranked ? (
                          t.placement == null
                            ? <Badge variant="secondary" className="text-[10px]">In corso</Badge>
                            : <Badge variant="outline" className={`text-[10px] ${dim ? "opacity-40 line-through" : ""}`}>+{t.scaled_points}pt</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] opacity-60">NORMAL</Badge>
                        )}
                      </div>
                    </Link>
                  );})}
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nessun torneo conteggiato nel BFL.</p>
                  )}
                </div>
                {filtered.length > 3 && (
                  <Button variant="ghost" size="sm" className="w-full mt-3" onClick={() => setAllTournamentsOpen(true)}>
                    Altro ({filtered.length - 3})
                  </Button>
                )}
              </div>
              );
            })()}

            {/* Children Profiles (only on parent profile) */}
            {!isChild && children.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="font-display text-lg mb-3 flex items-center gap-2">
                  <Baby size={18} className="text-primary" /> Profili figli ({children.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {children.map((c) => (
                    <Link
                      key={c.id}
                      to={`/profilo/child/${c.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary font-bold">{c.display_name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{c.display_name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Trophy size={10} /> {c.points || 0} pt
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* All Tournaments Dialog */}
            <Dialog open={allTournamentsOpen} onOpenChange={setAllTournamentsOpen}>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Tutti i tornei</DialogTitle>
                </DialogHeader>
                <div className="flex flex-wrap items-center justify-end gap-3 mb-2">
                  <div className="inline-flex text-xs rounded-lg bg-muted p-0.5">
                    <button
                      type="button"
                      onClick={() => setBflView('seasonal')}
                      className={`px-3 py-1.5 rounded-md transition-colors ${bflView === 'seasonal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Stagionale
                    </button>
                    <button
                      type="button"
                      onClick={() => setBflView('monthly')}
                      className={`px-3 py-1.5 rounded-md transition-colors ${bflView === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Mensile + Rollover
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="bfl-only-dlg" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                      <Star size={12} className="text-primary fill-primary" /> Solo BFL
                    </Label>
                    <Switch id="bfl-only-dlg" checked={bflOnly} onCheckedChange={setBflOnly} />
                  </div>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const kindOf = (t: TournamentHistory) => bflView === 'monthly' ? t.bfl_monthly : t.bfl_seasonal;
                    return (bflOnly ? tournamentHistory.filter((t) => kindOf(t) != null) : tournamentHistory).map((t) => {
                    const kind = kindOf(t);
                    const counted = kind != null;
                    const isRollover = kind === 'rollover';
                    const dim = t.is_ranked && t.placement != null && !counted;
                    return (
                    <Link key={t.tournament_id} to={`/tournaments/${t.tournament_id}`}
                      onClick={() => setAllTournamentsOpen(false)}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium truncate">{t.tournament_title}</p>
                          {t.is_external && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                              Importato
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.city} · {new Date(t.event_date).toLocaleDateString("it-IT")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm font-bold">{placementEmoji(t.placement)}</span>
                        {counted && !isRollover && (
                          <Star size={14} className="text-primary fill-primary" aria-label="Conteggiato nel BFL (mensile)" />
                        )}
                        {counted && isRollover && (
                          <RefreshCw size={14} className="text-amber-500" aria-label="Conteggiato nel BFL (rollover mese mancante)" />
                        )}
                        {t.is_ranked ? (
                          t.placement == null
                            ? <Badge variant="secondary" className="text-[10px]">In corso</Badge>
                            : <Badge variant="outline" className={`text-[10px] ${dim ? "opacity-40 line-through" : ""}`}>+{t.scaled_points}pt</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] opacity-60">NORMAL</Badge>
                        )}
                      </div>
                    </Link>
                  );});
                  })()}
                </div>
              </DialogContent>
            </Dialog>

              </div>{/* /left col */}

              <aside className="space-y-4 sm:space-y-6 xl:sticky xl:top-24">

            {/* Market Listings */}
            {marketListings.length > 0 && !isChild && (
              <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                  <ShoppingBag size={20} className="text-primary" /> Annunci in vendita
                </h2>
                <div className="space-y-2">
                  {marketListings.map((listing) => {
                    const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24)));
                    return (
                      <Link key={listing.id} to="/market"
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors">
                        {listing.image_url && (
                          <img src={listing.image_url} alt={listing.product_name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{listing.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {listing.condition} · {daysLeft}g rimanenti
                          </p>
                        </div>
                        {listing.price != null && (
                          <Badge variant="outline" className="text-xs shrink-0">€{listing.price}</Badge>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collection Summary - Expandable */}
            {collectionStats.total > 0 && !isChild && (
              <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
                <Collapsible open={collectionOpen} onOpenChange={setCollectionOpen}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl flex items-center gap-2">
                      <Package size={20} className="text-primary" /> Collezione
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{collectionStats.owned}/{collectionStats.total} ({collectionPercent}%)</span>
                      {profile.username && (
                        <Link to={`/collezione/${profile.username}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <ExternalLink size={14} />
                          </Button>
                        </Link>
                      )}
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          {collectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Progress value={collectionPercent} className="h-2" />
                  </div>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                      {collectionStats.categories.map(cat => {
                        const pct = cat.total > 0 ? Math.round((cat.owned / cat.total) * 100) : 0;
                        const isComplete = cat.total > 0 && cat.owned === cat.total;
                        return (
                          <div key={cat.id} className="bg-secondary/50 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              {isComplete && <CheckCircle2 size={14} className="text-primary" />}
                              <p className="text-sm font-medium truncate">{cat.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-1.5 flex-1" />
                              <Badge variant={isComplete ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                                {cat.owned}/{cat.total}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
              </aside>
            </div>{/* /xl grid */}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const FriendActions = ({ otherId, targetHasTeam, targetHasClub }: { otherId: string; targetHasTeam: boolean; targetHasClub: boolean }) => {
  const { user } = useAuth();
  const { friends, incoming, outgoing, sendRequest, respond } = useFriends();
  const { team: myTeam, isOwner, members, pendingOutgoing, acceptedOutgoing, inviteUser } = useTeam();
  const { staffClubs } = useUserClubs();
  const startChat = useStartPrivateChat();
  const all = [...friends, ...incoming, ...outgoing];
  const status = user ? getFriendStatus(all, user.id, otherId) : "none";

  const openChat = () => startChat(otherId);


  const slotsUsed = members.length + pendingOutgoing.length + acceptedOutgoing.length;
  const alreadyInvited = pendingOutgoing.some(i => i.invited_user_id === otherId)
    || acceptedOutgoing.some(i => i.invited_user_id === otherId);
  const canInviteTeam = !!myTeam && isOwner && !targetHasTeam && slotsUsed < 3 && !alreadyInvited;

  const sendClubInvite = async (clubId: string, clubName: string) => {
    const { error } = await supabase.from("notifications").insert({
      user_id: otherId,
      type: "club_invite",
      title: "Invito al club",
      message: `Sei stato invitato a unirti al club "${clubName}".`,
      link: `/clubs/${clubId}`,
    });
    if (error) { toast.error("Errore nell'invio dell'invito"); return; }
    supabase.functions.invoke("auto-push-notification").catch(() => {});
    toast.success("Invito al club inviato!");
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {status === "accepted" && (
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={openChat}>
          <MessageCircle size={12} /> Messaggio
        </Button>
      )}
      {status === "pending_out" && (
        <Button size="sm" variant="ghost" disabled className="h-7 gap-1 text-xs"><Clock size={12} /> In attesa</Button>
      )}
      {status === "pending_in" && (() => {
        const row = incoming.find(r => r.user_a === otherId || r.user_b === otherId);
        return (
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => row && respond(row.id, true)}>
            <Check size={12} /> Accetta richiesta
          </Button>
        );
      })()}
      {status === "none" && (
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => sendRequest(otherId)}>
          <UserPlus size={12} /> Aggiungi amico
        </Button>
      )}
      {canInviteTeam && (
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => inviteUser(otherId)}>
          <Users size={12} /> Invita nel team
        </Button>
      )}
      {!targetHasClub && staffClubs.map((c: any) => (
        <Button key={c.club_id} size="sm" variant="outline" className="h-7 gap-1 text-xs"
          onClick={() => sendClubInvite(c.club_id, c.clubs?.name || "il club")}>
          <Shield size={12} /> Invita in {c.clubs?.name}
        </Button>
      ))}
    </div>
  );
};

export default PublicProfile;
