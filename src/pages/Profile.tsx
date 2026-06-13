import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useParentRole } from "@/hooks/useParentRole";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { useCollectionCatalog } from "@/hooks/useCachedQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { toast } from "sonner";
import { MapPin, Edit2, Save, LogOut, Camera, Package, CheckCircle2, ExternalLink, ImagePlus, Send, ChevronDown, ChevronUp, QrCode, ShieldOff, ShoppingBag, Crown, Medal, Award, Hourglass, ClipboardList, XCircle } from "lucide-react";
import { BncIcon } from "@/components/icons/BncIcon";
import { z } from "zod";
import { CityCombobox } from "@/components/CityCombobox";
import { ProfileBadges } from "@/components/ProfileBadges";
import { ChildProfilesManager } from "@/components/ChildProfilesManager";
import { DeckCard } from "@/components/decks/DeckCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProfileNfcCard } from "@/components/ProfileNfcCard";
import { BattlePassReader } from "@/components/BattlePassReader";
import { ThemeSelector } from "@/components/ThemeSelector";
import ProfileAdvancedSettings from "@/components/ProfileAdvancedSettings";
import { ChatBubbleSettings } from "@/components/settings/ChatBubbleSettings";
import LinkedExternalAccounts from "@/components/LinkedExternalAccounts";
import PasskeysManager from "@/components/profile/PasskeysManager";
import PlayerStatsPanel from "@/components/profile/PlayerStatsPanel";
import BetaEloPanel from "@/components/profile/BetaEloPanel";
import { PageShell } from "@/components/layout/PageShell";

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  points: number;
  wins: number;
  created_at: string;
}

interface Registration {
  id: string;
  status: string;
  tournament_id: string;
  tournaments: {
    title: string;
    event_date: string;
    city: string;
  };
}

interface TournamentHistory {
  tournament_id: string;
  placement: number;
  scaled_points: number;
  tournament_title: string;
  event_date: string;
  city: string;
}

interface CollectionCategory {
  id: string;
  name: string;
  image_url: string | null;
}

const profileSchema = z.object({
  username: z.string().min(3, "Username troppo corto").max(30, "Username troppo lungo").regex(/^[a-zA-Z0-9_]+$/, "Solo lettere, numeri e underscore").optional().nullable(),
  display_name: z.string().min(2, "Nome troppo corto").max(50, "Nome troppo lungo").optional().nullable(),
  bio: z.string().max(500, "Bio troppo lunga").optional().nullable(),
  city: z.string().max(100, "Città troppo lunga").optional().nullable(),
});

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { data: catalogData } = useCollectionCatalog();
  const { isParent } = useParentRole();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [myDecks, setMyDecks] = useState<{ id: string; name: string }[]>([]);
  const [favoriteDeckId, setFavoriteDeckId] = useState<string | null>(null);
  const [favoriteDeck, setFavoriteDeck] = useState<any>(null);

  const [parentRequestStatus, setParentRequestStatus] = useState<string | null>(null);
  const [requestingParent, setRequestingParent] = useState(false);
  const [showParentConfirm, setShowParentConfirm] = useState(false);
  const [deactivatingParent, setDeactivatingParent] = useState(false);

  const [collectionStats, setCollectionStats] = useState<{
    total: number;
    owned: number;
    categories: { id: string; name: string; total: number; owned: number }[];
  }>({ total: 0, owned: 0, categories: [] });
  const [collectionOpen, setCollectionOpen] = useState(false);

  const [tournamentHistory, setTournamentHistory] = useState<TournamentHistory[]>([]);
  const [allTournamentsOpen, setAllTournamentsOpen] = useState(false);
  const [seasonStats, setSeasonStats] = useState<{ points: number; wins: number } | null>(null);
  const [marketListings, setMarketListings] = useState<any[]>([]);
  const [myClub, setMyClub] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);
  const [myTeam, setMyTeam] = useState<{ id: string; name: string; logo_url: string | null; role: string } | null>(null);
  
  const [editForm, setEditForm] = useState({
    username: "",
    display_name: "",
    bio: "",
    city: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      // Batch all profile fetches in parallel
      Promise.all([
        fetchProfile(),
        fetchRegistrations(),
        fetchCollectionStats(),
        fetchMyDecks(),
        fetchParentRequest(),
        fetchSeasonAndHistory(),
        fetchMarketListings(),
        fetchMyClubAndTeam(),
      ]);
    }
  }, [user]);

  const fetchMyClubAndTeam = async () => {
    if (!user) return;
    const [{ data: cm }, { data: tm }] = await Promise.all([
      supabase.from("club_members").select("clubs(id, name, logo_url)").eq("user_id", user.id).limit(1).maybeSingle(),
      (supabase as any).from("team_members").select("role, teams(id, name, logo_url)").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);
    const c: any = cm && (cm as any).clubs;
    setMyClub(c ? { id: c.id, name: c.name, logo_url: c.logo_url } : null);
    const t: any = tm && (tm as any).teams;
    setMyTeam(t ? { id: t.id, name: t.name, logo_url: t.logo_url, role: (tm as any).role } : null);
  };

  const fetchProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, username, display_name, avatar_url, banner_url, bio, city, points, wins, region_id, best_launch_speed, favorite_deck_id, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      setFavoriteDeckId((data as any).favorite_deck_id || null);
      setEditForm({
        username: data.username || "",
        display_name: data.display_name || "",
        bio: data.bio || "",
        city: data.city || "",
      });
      if ((data as any).favorite_deck_id) {
        const { data: deckData } = await (supabase as any)
          .from("decks")
          .select("id, user_id, name, description, created_at")
          .eq("id", (data as any).favorite_deck_id)
          .maybeSingle();
        setFavoriteDeck(deckData);
      } else {
        setFavoriteDeck(null);
      }
    }
    setLoading(false);
  };

  const fetchMyDecks = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("decks")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyDecks(data || []);
  };

  const fetchParentRequest = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("parent_role_requests")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setParentRequestStatus(data?.status || null);
  };

  const fetchSeasonAndHistory = async () => {
    if (!user) return;
    // Fetch standings (tutti i tornei giocati, anche non ranked) + results (per placement/punti) + season
    const [{ data: standings }, { data: results }, { data: season }] = await Promise.all([
      supabase.from("tournament_standings").select("tournament_id, wins, losses, draws, points").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("tournament_results").select("tournament_id, placement, scaled_points").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("ranking_seasons").select("id, start_date, end_date").eq("is_active", true).maybeSingle(),
    ]);

    const resMap = new Map((results || []).map((r: any) => [r.tournament_id, r]));
    const allTIds = Array.from(new Set([...(standings || []).map((s: any) => s.tournament_id), ...(results || []).map((r: any) => r.tournament_id)]));
    if (allTIds.length === 0) return;

    const { data: tournaments } = await supabase.from("tournaments").select("id, title, event_date, city, is_ranked, is_external, championship_id").in("id", allTIds);
    if (tournaments) {
      const tMap = new Map(tournaments.map((t: any) => [t.id, t]));
      setTournamentHistory(
        allTIds.filter((id) => tMap.has(id)).map((id) => {
          const t: any = tMap.get(id)!;
          const r: any = resMap.get(id);
          return { tournament_id: id, placement: r?.placement ?? null, scaled_points: r?.scaled_points ?? 0, tournament_title: t.title, event_date: t.event_date, city: t.city, is_ranked: t.is_ranked };
        }).sort((a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
      );

      // Season stats: only RANKED tournaments (exclude normal/championship/external)
      if (season && results) {
        const stIds = new Set(
          tournaments
            .filter((t: any) => t.is_ranked === true && !t.championship_id)
            .filter((t: any) => t.event_date >= season.start_date && t.event_date <= season.end_date)
            .map((t: any) => t.id)
        );
        const seasonResults = results.filter((r: any) => stIds.has(r.tournament_id));
        setSeasonStats({
          points: seasonResults.reduce((s: number, r: any) => s + (r.scaled_points || 0), 0),
          wins: seasonResults.filter((r: any) => r.placement === 1).length,
        });
      }
    }
  };

  const fetchMarketListings = async () => {
    if (!user) return;
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("market_listings")
      .select("id, product_name, price, condition, image_url, created_at, categories")
      .eq("user_id", user.id)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    setMarketListings(data || []);
  };

  const handleSetFavoriteDeck = async (deckId: string | null) => {
    if (!user) return;
    const val = deckId === "none" ? null : deckId;
    await supabase.from("profiles").update({ favorite_deck_id: val } as any).eq("user_id", user.id);
    setFavoriteDeckId(val);
    if (val) {
      const { data: deckData } = await (supabase as any)
        .from("decks")
        .select("id, user_id, name, description, created_at")
        .eq("id", val)
        .maybeSingle();
      setFavoriteDeck(deckData);
    } else {
      setFavoriteDeck(null);
    }
    toast.success(val ? "Deck preferito impostato!" : "Deck preferito rimosso");
  };

  const handleRequestParentRole = async () => {
    if (!user) return;
    setRequestingParent(true);
    // If a previous rejected request exists, remove it first so the new one can be inserted.
    if (parentRequestStatus === "rejected") {
      await (supabase as any)
        .from("parent_role_requests")
        .delete()
        .eq("user_id", user.id)
        .eq("status", "rejected");
    }
    const { error } = await (supabase as any)
      .from("parent_role_requests")
      .insert({ user_id: user.id });
    if (error) {
      if (error.code === "23505") {
        toast.error("Hai già una richiesta in corso");
      } else {
        toast.error("Errore nell'invio della richiesta");
      }
    } else {
      toast.success("Richiesta inviata! Verrà valutata da un admin.");
      setParentRequestStatus("pending");
    }
    setRequestingParent(false);
    setShowParentConfirm(false);
  };

  const handleDeactivateParentRole = async () => {
    if (!user) return;
    setDeactivatingParent(true);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("role", "parent");
    if (error) {
      toast.error("Errore nella disattivazione del ruolo");
    } else {
      toast.success("Ruolo Genitore disattivato.");
      window.location.reload();
    }
    setDeactivatingParent(false);
  };

  const fetchRegistrations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tournament_registrations")
      .select(`id, status, tournament_id, tournaments (title, event_date, city)`)
      .eq("user_id", user.id)
      .neq("status", "cancelled")
      .order("registered_at", { ascending: false })
      .limit(5);
    if (data) setRegistrations(data as unknown as Registration[]);
  };

  const fetchCollectionStats = async () => {
    if (!user) return;
    // Reuse cached catalog data instead of fetching again (saves 3 queries)
    const allComps = catalogData?.components ?? [];
    const allVars = catalogData?.variants ?? [];
    const allCats = catalogData?.categories ?? [];

    // Only fetch user's owned items (1 row with JSONB)
    const { data: collRow } = await supabase
      .from("user_collection_data")
      .select("items")
      .eq("user_id", user.id)
      .maybeSingle();
    const owned = (collRow?.items as any[] ?? []).map((i: any) => ({
      component_id: i.c,
      variant_id: i.v ?? null,
    }));

    const ownedRows = owned;
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Seleziona un file immagine"); return; }
    setUploadingAvatar(true);
    try { file = await prepareImageForUpload(file, { maxDimension: 512 }); }
    catch (err: any) { toast.error(err?.message || "Immagine non valida"); setUploadingAvatar(false); return; }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar_${Date.now()}.${ext}`;
    const { data: oldFiles } = await supabase.storage.from("avatars").list(user.id);
    if (oldFiles?.length) {
      const toRemove = oldFiles.filter(f => f.name.startsWith("avatar")).map(f => `${user.id}/${f.name}`);
      if (toRemove.length) await supabase.storage.from("avatars").remove(toRemove);
    }
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (uploadError) { toast.error("Errore nel caricamento"); setUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    if (updateError) { toast.error("Errore nell'aggiornamento del profilo"); } else { toast.success("Foto profilo aggiornata!"); fetchProfile(); }
    setUploadingAvatar(false);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Seleziona un file immagine"); return; }
    setUploadingBanner(true);
    try { file = await prepareImageForUpload(file, { maxDimension: 1600 }); }
    catch (err: any) { toast.error(err?.message || "Immagine non valida"); setUploadingBanner(false); return; }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/banner_${Date.now()}.${ext}`;
    const { data: oldFiles } = await supabase.storage.from("profile-banners").list(user.id);
    if (oldFiles?.length) {
      const toRemove = oldFiles.filter(f => f.name.startsWith("banner")).map(f => `${user.id}/${f.name}`);
      if (toRemove.length) await supabase.storage.from("profile-banners").remove(toRemove);
    }
    const { error: uploadError } = await supabase.storage.from("profile-banners").upload(path, file, { contentType: file.type });
    if (uploadError) { toast.error("Errore nel caricamento"); setUploadingBanner(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("profile-banners").getPublicUrl(path);
    const { error: updateError } = await supabase.from("profiles").update({ banner_url: publicUrl } as any).eq("user_id", user.id);
    if (updateError) { toast.error("Errore nell'aggiornamento"); } else { toast.success("Banner aggiornato!"); fetchProfile(); }
    setUploadingBanner(false);
  };

  const handleSave = async () => {
    try { profileSchema.parse(editForm); } catch (error) {
      if (error instanceof z.ZodError) { toast.error(error.errors[0].message); return; }
    }
    if (!user) return;
    const profanityError = validateNoProfanity(editForm.username, editForm.display_name, editForm.bio, editForm.city);
    if (profanityError) { toast.error(profanityError); return; }
    setSaving(true);

    // If username changed, check availability and handle ghost profiles
    if (editForm.username && editForm.username !== profile?.username) {
      const { data: usernameCheck } = await supabase.rpc("check_username_available" as any, { _username: editForm.username });
      if (usernameCheck && !(usernameCheck as any).available) {
        toast.error("Username già in uso");
        setSaving(false);
        return;
      }
      if (usernameCheck && (usernameCheck as any).is_ghost) {
        await supabase.rpc("claim_ghost_username" as any, { _real_user_id: user.id, _username: editForm.username });
      }
    }

    const updatedDisplayName = editForm.display_name || editForm.username || null;
    const { error } = await supabase
      .from("profiles")
      .update({ username: editForm.username || null, display_name: updatedDisplayName, bio: editForm.bio || null, city: editForm.city || null })
      .eq("user_id", user.id);
    if (error) {
      if (error.code === "23505") { toast.error("Username già in uso"); } else { toast.error("Errore nel salvataggio"); }
    } else {
      toast.success("Profilo aggiornato!");
      setIsEditing(false);
      fetchProfile();
      // Sync city to club membership if user is in a club
      if (editForm.city) {
        supabase.from("club_members").update({ city: editForm.city } as any).eq("user_id", user.id).then(() => {});
      }
    }
    setSaving(false);
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); toast.success("Logout effettuato"); };

  if (authLoading || loading) {
    return (
      <PageShell ambient="subtle">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Caricamento...</div>
        </div>
      </PageShell>
    );
  }

  const collectionPercent = collectionStats.total > 0
    ? Math.round((collectionStats.owned / collectionStats.total) * 100) : 0;

  const placementEmoji = (p: number | null) => p == null ? "—"
    : p === 1 ? <Crown size={15} className="inline-block text-yellow-400" aria-label="1° posto" />
    : p === 2 ? <Medal size={14} className="inline-block text-gray-300" aria-label="2° posto" />
    : p === 3 ? <Award size={14} className="inline-block text-amber-600" aria-label="3° posto" />
    : `#${p}`;

  return (
    <PageShell ambient="rich">
      <Navbar />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-3 sm:px-4 xl:px-6">
          <div className="mx-auto max-w-3xl xl:max-w-7xl">
            {/* Profile Header */}
            <div className="glass-card overflow-hidden mb-4 sm:mb-6">
              {/* Banner */}
              <div className="relative h-28 sm:h-44 overflow-hidden bg-[radial-gradient(120%_140%_at_15%_0%,hsl(var(--primary)/0.28),transparent_55%),radial-gradient(120%_140%_at_85%_10%,hsl(var(--accent)/0.24),transparent_55%)]">
                <div className="profile-hero-aurora" aria-hidden="true" />
                {profile?.banner_url && (
                  <img
                    src={profile.banner_url}
                    alt=""
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                    className="w-full h-full object-cover"
                  />
                )}
                {/* Scrim: fonde il banner nel glass sottostante */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/90 via-transparent to-transparent" aria-hidden="true" />
                <button
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                  className="absolute top-2 right-2 bg-background/70 hover:bg-background/90 backdrop-blur-sm rounded-full p-2 transition-colors"
                  title="Cambia banner"
                >
                  {uploadingBanner ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImagePlus size={16} className="text-foreground" />
                  )}
                </button>
                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              </div>

              <div className="px-4 sm:px-8 pb-5 sm:pb-7">
                {/* Avatar + Name */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">
                  <div className="relative group shrink-0 -mt-12 sm:-mt-16 mx-auto sm:mx-0">
                    <div className="profile-avatar-glow w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-card overflow-hidden bg-primary/20 flex items-center justify-center bg-card shadow-[0_0_0_2px_hsl(var(--primary)/0.55),0_0_28px_-6px_hsl(var(--primary)/0.5)]">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display text-4xl text-primary">
                          {(profile?.display_name || profile?.username || user?.email || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                      <Camera size={24} className="text-foreground" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    {uploadingAvatar && (
                      <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex-1 min-w-0 w-full text-center sm:text-left sm:pb-1">
                      <h1 className="font-display text-2xl sm:text-3xl break-words leading-tight">
                        {profile?.display_name || profile?.username || "Blader"}
                      </h1>
                      {profile?.username ? (
                        <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          <Edit2 size={12} /> Imposta username
                        </button>
                      )}
                      {profile?.city && (
                        <p className="flex items-center justify-center sm:justify-start gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin size={14} className="shrink-0" /> <span className="truncate">{profile.city}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-4 mt-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="display_name">Nome visualizzato</Label>
                        <Input id="display_name" value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} className="bg-secondary" />
                      </div>
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} placeholder="il_tuo_username" className="bg-secondary" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="city">Città</Label>
                      <CityCombobox value={editForm.city} onChange={(c) => setEditForm({ ...editForm, city: c })} placeholder="Cerca comune..." className="bg-secondary" />
                    </div>
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} placeholder="Racconta qualcosa di te..." rows={3} className="bg-secondary" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleSave} disabled={saving}>
                        <Save size={16} className="mr-2" />
                        {saving ? "Salvataggio..." : "Salva"}
                      </Button>
                      <Button variant="ghost" onClick={() => setIsEditing(false)}>Annulla</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Action buttons */}
                    <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                        <Edit2 size={14} /> Modifica
                      </Button>
                      <BattlePassReader
                        currentBestSpeed={(profile as any)?.best_launch_speed}
                        onScoreUpdated={() => fetchProfile()}
                      />
                      {profile?.username && (
                        <ProfileNfcCard
                          username={profile.username}
                          displayName={profile.display_name}
                          avatarUrl={profile.avatar_url}
                        />
                      )}
                    </div>

                    {/* Club / Team chips */}
                    {(myClub || myTeam) && (
                      <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                        {myClub && (
                          <Link to={`/clubs/${myClub.id}`} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-sm max-w-full min-w-0">
                            {myClub.logo_url ? <img src={myClub.logo_url} alt={myClub.name} className="w-5 h-5 rounded-full object-cover shrink-0" /> : <BncIcon name="club" size={20} className="text-primary shrink-0" />}
                            <span className="font-medium truncate">{myClub.name}</span>
                          </Link>
                        )}
                        {myTeam && (
                          <Link to="/squadra" className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors text-sm max-w-full min-w-0">
                            {myTeam.logo_url ? <img src={myTeam.logo_url} alt={myTeam.name} className="w-5 h-5 rounded-full object-cover shrink-0" /> : <BncIcon name="friends" size={20} className="text-primary shrink-0" />}
                            <span className="font-medium truncate">{myTeam.name}</span>
                            {myTeam.role === "owner" && <Crown size={12} className="text-amber-500 shrink-0" />}
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Stats grid */}
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 fib-stagger">
                      <div className="glass-tile px-2 py-3.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_34px_-14px_hsl(var(--primary)/0.55)]">
                        <BncIcon name="points" size={22} className="text-primary mx-auto mb-1.5 drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                        <p className="font-display font-bold text-xl sm:text-2xl leading-none tabular-nums"><CountUp value={profile?.points || 0} /></p>
                        <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-[0.14em] font-semibold">Punti</p>
                      </div>
                      <div className="glass-tile px-2 py-3.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/40 hover:shadow-[0_12px_34px_-14px_rgba(251,191,36,0.5)]">
                        <BncIcon name="crown" size={22} className="text-amber-400 mx-auto mb-1.5 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]" />
                        <p className="font-display font-bold text-xl sm:text-2xl leading-none tabular-nums"><CountUp value={profile?.wins || 0} /></p>
                        <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-[0.14em] font-semibold">Vittorie</p>
                      </div>
                      <div className="glass-tile px-2 py-3.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_12px_34px_-14px_rgba(103,232,249,0.5)]">
                        <BncIcon name="comet" size={22} className="text-cyan-300 mx-auto mb-1.5 drop-shadow-[0_0_8px_rgba(103,232,249,0.45)]" />
                        <p className="font-display font-bold text-xl sm:text-2xl leading-none tabular-nums truncate">
                          {(profile as any)?.best_launch_speed > 0 ? (profile as any).best_launch_speed.toLocaleString() : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-[0.14em] font-semibold">Shoot</p>
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

                    {profile?.bio && <p className="text-muted-foreground mt-3 text-sm sm:text-base whitespace-pre-line break-words">{profile.bio}</p>}

                    {profile && (
                      <div className="mt-4">
                        <ProfileBadges userId={profile.user_id} inline />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* === Desktop 2-col layout: main feed (left) + settings sidebar (right) === */}
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6 xl:items-start">
              <div className="min-w-0">

            {/* Child Profiles (for parents) */}
            <ChildProfilesManager />

            {/* Favorite Deck */}
            <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                <BncIcon name="deck" size={20} className="text-primary" /> Deck preferito
              </h2>
              {myDecks.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Non hai ancora creato nessun deck.{" "}
                  <Link to="/decks" className="text-primary hover:underline">Crea il tuo primo deck</Link>
                </p>
              ) : (
                <div className="space-y-3">
                  <Select value={favoriteDeckId || "none"} onValueChange={handleSetFavoriteDeck}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Seleziona un deck preferito" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun deck preferito</SelectItem>
                      {myDecks.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {favoriteDeck && <DeckCard deck={favoriteDeck} compact />}
                </div>
              )}
            </div>

            {/* Beta ELO Recap */}
            {profile && <BetaEloPanel userId={profile.user_id} />}

            {/* Player Stats Overview */}
            {profile && (
              <PlayerStatsPanel userId={profile.user_id} bflPoints={profile.points || 0} />
            )}

            {/* Tournament History */}
            {tournamentHistory.length > 0 && (
              <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                  <BncIcon name="calendar" size={20} className="text-primary" /> Cronologia Tornei
                </h2>
                <div className="space-y-2 fib-stagger">
                  {tournamentHistory.slice(0, 3).map((t) => (
                    <Link key={t.tournament_id} to={`/tournaments/${t.tournament_id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/[0.05]">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{t.tournament_title}</p>
                        <p className="text-xs text-muted-foreground">{t.city} · {new Date(t.event_date).toLocaleDateString("it-IT")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm font-bold">{placementEmoji(t.placement)}</span>
                        {(t as any).is_ranked ? (
                          t.placement == null
                            ? <Badge variant="secondary" className="text-[10px]">In corso</Badge>
                            : <Badge variant="outline" className="text-[10px]">+{t.scaled_points}pt</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] opacity-60">NORMAL</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                {tournamentHistory.length > 3 && (
                  <Button variant="ghost" size="sm" className="w-full mt-3" onClick={() => setAllTournamentsOpen(true)}>
                    Altro ({tournamentHistory.length - 3})
                  </Button>
                )}
              </div>
            )}

            {/* All Tournaments Dialog */}
            <Dialog open={allTournamentsOpen} onOpenChange={setAllTournamentsOpen}>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Tutti i tornei</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {tournamentHistory.map((t) => (
                    <Link key={t.tournament_id} to={`/tournaments/${t.tournament_id}`}
                      onClick={() => setAllTournamentsOpen(false)}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 transition-colors hover:border-primary/40 hover:bg-white/[0.05]">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{t.tournament_title}</p>
                        <p className="text-xs text-muted-foreground">{t.city} · {new Date(t.event_date).toLocaleDateString("it-IT")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm font-bold">{placementEmoji(t.placement)}</span>
                        {(t as any).is_ranked ? (
                          t.placement == null
                            ? <Badge variant="secondary" className="text-[10px]">In corso</Badge>
                            : <Badge variant="outline" className="text-[10px]">+{t.scaled_points}pt</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] opacity-60">NORMAL</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {/* Registrations */}
            <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                <BncIcon name="calendar" size={20} className="text-primary" />
                I tuoi tornei
              </h2>
              {registrations.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Non sei iscritto a nessun torneo.{" "}
                  <a href="/tournaments" className="text-primary hover:underline">Scopri i prossimi eventi</a>
                </p>
              ) : (
                <div className="space-y-3">
                  {registrations.map((reg) => (
                    <Link key={reg.id} to={`/tournaments/${reg.tournament_id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/[0.05]">
                      <div>
                        <p className="font-medium">{reg.tournaments.title}</p>
                        <p className="text-sm text-muted-foreground">{reg.tournaments.city}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        reg.status === "confirmed" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent-foreground"
                      }`}>
                        {reg.status === "confirmed" ? "Confermato" : reg.status === "waitlist" ? "In attesa" : "In attesa"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Market Listings */}
            {marketListings.length > 0 && (
              <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl flex items-center gap-2">
                    <ShoppingBag size={20} className="text-primary" /> I tuoi annunci
                  </h2>
                  <Link to="/market">
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <ExternalLink size={14} />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-2">
                  {marketListings.map((listing) => {
                    const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24)));
                    return (
                      <Link key={listing.id} to="/market"
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/[0.05]">
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

            {collectionStats.total > 0 && (
              <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
                <Collapsible open={collectionOpen} onOpenChange={setCollectionOpen}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl flex items-center gap-2">
                      <Package size={20} className="text-primary" /> Collezione
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{collectionStats.owned}/{collectionStats.total} ({collectionPercent}%)</span>
                      <Link to="/collezione">
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          <ExternalLink size={14} />
                        </Button>
                      </Link>
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

            {/* Parent Role Request / Deactivation */}
            {!isParent ? (
              <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="font-display text-xl mb-2 flex items-center gap-2">
                  <BncIcon name="friends" size={20} className="text-primary" /> Ruolo Genitore
                </h2>
                <p className="text-muted-foreground text-sm mb-3">
                  Richiedi il ruolo Genitore per gestire fino a 5 profili figli e iscriverli ai tornei.
                </p>
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5"><ClipboardList size={13} className="text-primary shrink-0" aria-hidden="true" /> La richiesta verrà visionata dagli admin e gestita entro 24h.</p>
                {parentRequestStatus === "pending" ? (
                  <Badge variant="outline" className="text-xs"><Hourglass size={11} aria-hidden="true" /> Richiesta in attesa di approvazione</Badge>
                ) : (
                  <>
                    {parentRequestStatus === "rejected" && (
                      <div className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs flex items-start gap-2">
                        <XCircle size={14} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                        <span>La tua precedente richiesta è stata rifiutata. Puoi inviarne una nuova fornendo maggiori dettagli, oppure contattare lo staff.</span>
                      </div>
                    )}
                    <Button size="sm" onClick={() => setShowParentConfirm(true)} disabled={requestingParent} className="gap-1.5">
                      <Send size={14} />
                      {parentRequestStatus === "rejected" ? "Invia nuova richiesta" : "Richiedi ruolo Genitore"}
                    </Button>
                    <AlertDialog open={showParentConfirm} onOpenChange={setShowParentConfirm}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Conferma richiesta</AlertDialogTitle>
                          <AlertDialogDescription>
                            Stai per richiedere il ruolo Genitore. Con questo ruolo potrai creare e gestire profili figli e iscriverli ai tornei. Vuoi procedere?
                            <br /><br />
                            <span className="text-xs text-muted-foreground">La richiesta verrà visionata dagli admin e gestita entro 24h.</span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRequestParentRole} disabled={requestingParent}>
                            {requestingParent ? "Invio..." : "Conferma"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            ) : (
              <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="font-display text-xl mb-2 flex items-center gap-2">
                  <BncIcon name="friends" size={20} className="text-primary" /> Ruolo Genitore
                </h2>
                <p className="text-muted-foreground text-sm mb-3">
                  Hai il ruolo Genitore attivo. Puoi disattivarlo se non ne hai più bisogno.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1.5" disabled={deactivatingParent}>
                      <ShieldOff size={14} />
                      Disattiva ruolo Genitore
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disattivare il ruolo Genitore?</AlertDialogTitle>
                      <AlertDialogDescription>
                        I profili figli associati rimarranno nel sistema ma non potrai più gestirli. Per riattivare il ruolo dovrai inviare una nuova richiesta. Vuoi continuare?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeactivateParentRole} disabled={deactivatingParent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deactivatingParent ? "Disattivazione..." : "Disattiva"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

              </div>{/* /left column */}

              <aside className="space-y-4 sm:space-y-6 xl:sticky xl:top-24">
                {/* Linked external accounts (Challonge / Challengermode) */}
                {user?.id && (
                  <div className="mb-4 sm:mb-6">
                    <LinkedExternalAccounts userId={user.id} />
                  </div>
                )}

                {/* Passkeys (accesso rapido senza password) */}
                <div className="mb-4 sm:mb-6">
                  <PasskeysManager />
                </div>

                {/* Floating chat bubbles (Android only) */}
                <div className="mb-4 sm:mb-6">
                  <ChatBubbleSettings />
                </div>

                {/* Advanced Settings */}
                <div className="mb-4 sm:mb-6">
                  <ProfileAdvancedSettings />
                </div>

                {/* Theme & Logout */}
                <div className="flex flex-col items-center gap-3 max-w-xs mx-auto xl:max-w-none">
                  <ThemeSelector />
                  <Button variant="outline" onClick={handleSignOut} className="w-full">
                    <LogOut size={16} className="mr-2" /> Esci dall'account
                  </Button>
                </div>
              </aside>
            </div>{/* /xl grid */}
          </div>
        </div>
      </main>

      <Footer />
    </PageShell>
  );
};

export default Profile;
