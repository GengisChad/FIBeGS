import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SharePreviewButton } from "@/components/SharePreviewButton";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { useAuth } from "@/hooks/useAuth";
import { useClubRole } from "@/hooks/useClubRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { MapPin, Users, Crown, Star, Calendar, Plus, Trophy, Medal, Award, Clock, Camera, UserMinus, UserCog, Trash2, Edit2, Save, ImagePlus, Settings, MessageCircle, Hash, Gamepad2, ClipboardList, Phone, ArrowLeft, Image as ImageIcon, ShoppingCart, Copy, Share2, Download, Bell } from "lucide-react";
import { BncIcon } from "@/components/icons/BncIcon";
import { RankBadge } from "@/components/RankMedal";
import { RegionalChatDialog } from "@/components/regional/RegionalChatDialog";
import { useAdmin } from "@/hooks/useAdmin";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { CreateTournamentDialog } from "@/components/tournaments/CreateTournamentDialog";
import { CityCombobox } from "@/components/CityCombobox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ClubOrdersTab from "@/components/clubs/ClubOrdersTab";
import ClubTournamentsCalendar from "@/components/clubs/ClubTournamentsCalendar";
import ClubLinksManager from "@/components/clubs/ClubLinksManager";
import VenueShopDialog from "@/components/clubs/VenueShopDialog";


interface Club {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  regions: { name: string; code: string } | null;
  region_id: string | null;
  social_whatsapp_group: string | null;
  social_whatsapp_channel: string | null;
  social_discord: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_tiktok: string | null;
  default_paypal_link: string | null;
}

interface Member {
  id: string;
  role: string;
  joined_at: string;
  user_id: string;
  city: string | null;
  phone: string | null;
  last_tournament_at: string | null;
  profiles: { display_name: string | null; username: string | null; avatar_url: string | null; points: number | null; wins: number | null } | null;
}

interface Tournament {
  id: string;
  title: string;
  event_date: string;
  city: string;
  is_active: boolean;
  event_type?: string | null;
  max_participants?: number | null;
  virtual?: boolean;
}

interface ClubChildProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  wins: number;
  parent_user_id: string;
  city: string | null;
}

const ClubDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "orders" ? "orders" : "club";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    const t = searchParams.get("tab") === "orders" ? "orders" : "club";
    setActiveTab(t);
  }, [searchParams]);
  const { user } = useAuth();
  const { role, isStaff, isLeader, isViceLeader, loading: roleLoading } = useClubRole(id);
  const { isAdmin } = useAdmin();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [childProfiles, setChildProfiles] = useState<ClubChildProfile[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [rankedThisMonth, setRankedThisMonth] = useState(0);
  const [rankedLimit, setRankedLimit] = useState(3);
  const [regionChatOpen, setRegionChatOpen] = useState(false);
  const [regionChannelId, setRegionChannelId] = useState<string | null>(null);
  const [rankedPeriod, setRankedPeriod] = useState<"monthly" | "weekly">("monthly");
  const [rankingScope, setRankingScope] = useState<"national" | "club">("club");
  const [rankingPage, setRankingPage] = useState(0);
  const [tournamentsMode, setTournamentsMode] = useState<"upcoming" | "past">("upcoming");
  const [membersPage, setMembersPage] = useState(0);
  const MEMBERS_PAGE_SIZE = 25;
  const RANKING_PAGE_SIZE = 25;
  const rankingPageSize = RANKING_PAGE_SIZE;
  const [clubPointsMap, setClubPointsMap] = useState<Map<string, { points: number; wins: number }>>(new Map());
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [managementMembers, setManagementMembers] = useState<any[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCity, setJoinCity] = useState("");
  const [joinPhone, setJoinPhone] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [showSocialDialog, setShowSocialDialog] = useState(false);
  const [showMissingPhoneDialog, setShowMissingPhoneDialog] = useState(false);
  const [missingPhone, setMissingPhone] = useState("");
  const [savingMissingPhone, setSavingMissingPhone] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [venues, setVenues] = useState<any[]>([]);
  const [showAddVenue, setShowAddVenue] = useState(false);
  const [venueForm, setVenueForm] = useState({ name: "", address: "", city: "" });
  const [venueGeocoding, setVenueGeocoding] = useState(false);
  const [shopVenue, setShopVenue] = useState<any | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [socialForm, setSocialForm] = useState({
    social_whatsapp_group: "",
    social_whatsapp_channel: "",
    social_discord: "",
    social_instagram: "",
    social_facebook: "",
    social_tiktok: "",
  });

  // Staff (incl. leader/vice) can manage tournaments/orders/flyers/members.
  // Only Leader / Vice Leader (or admin) can edit identity/socials/venues/links.
  const canManage = isStaff || isAdmin;
  const canManageFull = isLeader || isViceLeader || isAdmin;

  const geocodeAddress = async (address: string, city: string): Promise<{ lat: number; lng: number } | null> => {
    const query = encodeURIComponent(`${address}, ${city}, Italia`);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=it`, { headers: { "Accept-Language": "it" } });
      const results = await res.json();
      if (results.length > 0) return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    } catch {}
    return null;
  };

  const fetchRankedCount = async () => {
    if (!id) return;
    // Parallelize settings fetch with a conservative count query
    const now = new Date();
    // Use monthly as default start (will be refined after settings load)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString();

    const [{ data: settingsData }, monthlyRes, weeklyRes] = await Promise.all([
      supabase.from("site_settings").select("key, value").in("key", ["competitive_ranked_limit", "competitive_ranked_limit_period"]),
      supabase.from("tournaments").select("id", { count: "exact", head: true }).eq("club_id", id).eq("is_ranked", true).gte("created_at", monthStart),
      supabase.from("tournaments").select("id", { count: "exact", head: true }).eq("club_id", id).eq("is_ranked", true).gte("created_at", weekStart),
    ]);

    const settingsMap: Record<string, string> = {};
    (settingsData ?? []).forEach((r: any) => { settingsMap[r.key] = r.value; });
    const limit = parseInt(settingsMap["competitive_ranked_limit"]) || 3;
    const period = (settingsMap["competitive_ranked_limit_period"] || "monthly") as "monthly" | "weekly";
    setRankedLimit(limit);
    setRankedPeriod(period);
    setRankedThisMonth(period === "weekly" ? (weeklyRes.count ?? 0) : (monthlyRes.count ?? 0));
  };

  useEffect(() => {
    if (id) {
      fetchClub();
      fetchVenues();
      fetchRankedCount();
      if (user) fetchFollowStatus();
    }
  }, [id, user]);

  const fetchVenues = async () => {
    if (!id) return;
    const { data } = await supabase.from("club_venues").select("*").eq("club_id", id).order("created_at");
    if (data) setVenues(data);
  };

  const fetchFollowStatus = async () => {
    if (!user || !id) return;
    const { data } = await (supabase as any).from("club_follows").select("id").eq("user_id", user.id).eq("club_id", id).maybeSingle();
    setIsFollowing(!!data);
  };

  const handleToggleFollow = async () => {
    if (!user || !id) return;
    setFollowLoading(true);
    if (isFollowing) {
      await (supabase as any).from("club_follows").delete().eq("user_id", user.id).eq("club_id", id);
      setIsFollowing(false);
      toast.success("Non segui più questo club");
    } else {
      await (supabase as any).from("club_follows").insert({ user_id: user.id, club_id: id });
      setIsFollowing(true);
      toast.success("Ora segui questo club!");
    }
    setFollowLoading(false);
  };

  useEffect(() => {
    if (role) setIsMember(true);
  }, [role]);

  useEffect(() => { setRankingPage(0); }, [rankingScope]);


  // Check if current member is missing phone number (only once per page load)
  useEffect(() => {
    if (!user || !id || !role || roleLoading) return;
    const checkPhone = async () => {
      // club_member_phones is the source of truth (trigger moves phone there)
      const { data } = await supabase
        .from("club_member_phones")
        .select("id")
        .eq("club_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        setShowMissingPhoneDialog(true);
      }
    };
    checkPhone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClub = async () => {
    const [clubRes, membersRes, tournamentsRes, freePlayRes] = await Promise.all([
      supabase.from("clubs").select("*, regions(name, code)").eq("id", id!).single(),
      supabase.from("club_members_public").select("id, club_id, user_id, role, joined_at, city, last_tournament_at").eq("club_id", id!),
      supabase.from("tournaments").select("id, title, event_date, event_end_date, city, location, registration_deadline, is_active, event_type, max_participants, is_ranked").eq("club_id", id!).order("event_date", { ascending: false }),
      (supabase as any)
        .from("club_free_play_schedules")
        .select("id, title, day_of_week, start_time, end_time, valid_from, valid_until, is_active, club_venues(name, address, city)")
        .eq("club_id", id!)
        .eq("is_active", true),
    ]);

    if (clubRes.data) {
      setClub(clubRes.data as any);
      const regionId = (clubRes.data as any).region_id;
      if (regionId) {
        const { data: ch } = await (supabase as any)
          .from("regional_channels")
          .select("id")
          .eq("region_id", regionId)
          .eq("channel_type", "region")
          .is("club_request_id", null)
          .maybeSingle();
        setRegionChannelId(ch?.id ?? null);
      }
    }

    // Build merged calendar list: tournaments + projected free-play occurrences (next 8 weeks)
    const merged: any[] = (tournamentsRes.data as any[]) ?? [];
    const schedules: any[] = (freePlayRes?.data as any[]) ?? [];
    if (schedules.length > 0) {
      const scheduleIds = schedules.map((s) => s.id);
      const { data: excs } = await (supabase as any)
        .from("club_free_play_exceptions")
        .select("schedule_id, exception_date, exception_type, start_time, end_time")
        .in("schedule_id", scheduleIds);
      const exceptions: any[] = (excs as any[]) ?? [];

      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const horizonDays = 8 * 7;
      for (const s of schedules) {
        const validFrom = s.valid_from ? new Date(s.valid_from) : null;
        const validUntil = s.valid_until ? new Date(s.valid_until) : null;
        const venueName = s.club_venues?.name ?? "Sede";
        const venueCity = s.club_venues?.city ?? (clubRes.data as any)?.city ?? "";
        for (let i = -7; i <= horizonDays; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          if (d.getDay() !== s.day_of_week) continue;
          if (validFrom && d < validFrom) continue;
          if (validUntil && d > validUntil) continue;
          const dayKey = d.toISOString().slice(0, 10);
          const ex = exceptions.find((e) => e.schedule_id === s.id && e.exception_date === dayKey);
          if (ex?.exception_type === "cancel") continue;
          const startT = ex?.exception_type === "override" && ex.start_time ? ex.start_time : s.start_time;
          const endT = ex?.exception_type === "override" && ex.end_time ? ex.end_time : s.end_time;
          const [sh, sm] = String(startT).split(":").map(Number);
          const [eh, em] = String(endT).split(":").map(Number);
          const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh || 0, sm || 0).toISOString();
          const eventEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh || 0, em || 0).toISOString();
          merged.push({
            id: `freeplay:${s.id}:${dayKey}`,
            title: s.title || "Free Play",
            event_date: eventDate,
            event_end_date: eventEnd,
            city: venueCity,
            location: venueName,
            registration_deadline: null,
            is_active: true,
            event_type: "free_play",
            max_participants: null,
            virtual: true,
          });
        }
        // Add-type exceptions
        for (const ex of exceptions.filter((e) => e.schedule_id === s.id && e.exception_type === "add")) {
          const d = new Date(ex.exception_date);
          const dayKey = ex.exception_date as string;
          const startT = ex.start_time || s.start_time;
          const endT = ex.end_time || s.end_time;
          const [sh, sm] = String(startT).split(":").map(Number);
          const [eh, em] = String(endT).split(":").map(Number);
          const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh || 0, sm || 0).toISOString();
          const eventEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh || 0, em || 0).toISOString();
          merged.push({
            id: `freeplay:${s.id}:${dayKey}`,
            title: s.title || "Free Play",
            event_date: eventDate,
            event_end_date: eventEnd,
            city: venueCity,
            location: venueName,
            registration_deadline: null,
            is_active: true,
            event_type: "free_play",
            max_participants: null,
            virtual: true,
          });
        }
      }
    }
    setTournaments(merged as any);

    if (membersRes.data && membersRes.data.length > 0) {
      const userIds = membersRes.data.map((m: any) => m.user_id);
      const [{ data: profilesData }, { data: rolesData }, { data: childData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url, points, wins")
          .in("user_id", userIds),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds)
          .eq("role", "parent"),
        (supabase as any)
          .from("child_profiles")
          .select("id, display_name, avatar_url, points, wins, parent_user_id, city")
          .in("parent_user_id", userIds),
      ]);

      const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
      const rolePriority: Record<string, number> = { leader: 0, vice_leader: 1, staff: 2, member: 3 };
      const membersWithProfiles = membersRes.data
        .map((m: any) => ({
          ...m,
          profiles: profileMap.get(m.user_id) || null,
        }))
        .sort((a: any, b: any) => {
          const ra = rolePriority[a.role] ?? 99;
          const rb = rolePriority[b.role] ?? 99;
          if (ra !== rb) return ra - rb;
          const na = (a.profiles?.display_name || a.profiles?.username || "").toLowerCase();
          const nb = (b.profiles?.display_name || b.profiles?.username || "").toLowerCase();
          return na.localeCompare(nb);
        });
      setMembers(membersWithProfiles as any);
      setChildProfiles((childData as ClubChildProfile[]) || []);
    } else {
      setMembers([]);
      setChildProfiles([]);
    }

    setLoading(false);
  };

  const openMemberManagement = async () => {
    if (!id) return;
    // Use secure RPC function - only returns phone data for staff/admin
    const { data: membersData } = await supabase.rpc("get_club_members_with_phone", { _club_id: id });
    if (membersData && membersData.length > 0) {
      const userIds = (membersData as any[]).map((m: any) => m.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
      setManagementMembers((membersData as any[]).map((m: any) => ({ ...m, profiles: profileMap.get(m.user_id) || null })));
    } else {
      setManagementMembers([]);
    }
    setShowMemberManagement(true);
  };

  const handleJoin = async () => {
    if (!user || !id) return;

    try {
      // Validation
      if (!joinCity.trim() || !joinPhone.trim()) {
        toast.error("Compila tutti i campi");
        return;
      }
      if (joinPhone.trim().length < 6) {
        toast.error("Inserisci un numero di telefono valido");
        return;
      }

      // Check if user is already in a club
      const { count, error: countError } = await supabase
        .from("club_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (countError) {
        console.log("club_members count error:", countError);
        toast.error("Errore nell'iscrizione");
        return;
      }

      if (count && count > 0) {
        toast.error(
          "Fai già parte di un club. Devi lasciarlo prima di unirti a un altro."
        );
        return;
      }

      // RPC that inserts into club_members + club_member_phones
      const { data, error } = await supabase.rpc("join_club_member", {
        p_club_id: id,
        p_user_id: user.id,
        p_phone: joinPhone.trim(),
        p_role: "member",
        p_city: joinCity.trim(),
      });

      console.log("join_club_member data:", data);
      console.log("join_club_member error:", error);

      if (error) {
        toast.error(
          error.code === "23505"
            ? "Sei già membro di questo club"
            : "Errore nell'iscrizione"
        );
        return;
      }

      toast.success("Benvenuto nel club!");
      setShowJoinDialog(false);
      setJoinCity("");
      setJoinPhone("");
      fetchClub();
      setIsMember(true);
    } catch (e: any) {
      console.log("handleJoin exception:", e);
      toast.error("Errore nell'iscrizione");
    }
  };

  const handleLeave = async () => {
    if (!user || !id) return;
    // Also delete phone record first (in case cascade doesn't fire due to RLS)
    await supabase.from("club_member_phones").delete().eq("club_id", id).eq("user_id", user.id);
    const { error } = await supabase.from("club_members").delete().eq("club_id", id).eq("user_id", user.id);
    if (error) {
      console.error("Leave club error:", error);
      toast.error("Errore nell'uscita dal club: " + error.message);
    } else {
      toast.success("Hai lasciato il club");
      setIsMember(false);
      setMembers(prev => prev.filter(m => m.user_id !== user.id));
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !id) return;
    if (!file.type.startsWith("image/")) { toast.error("Seleziona un'immagine valida"); return; }

    setUploadingLogo(true);
    try { file = await prepareImageForUpload(file, { maxDimension: 640, preservePng: true }); }
    catch (err: any) { toast.error(err?.message || "Immagine non valida"); setUploadingLogo(false); return; }
    const ext = file.name.split(".").pop();
    const filePath = `${id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage.from("club-logos").upload(filePath, file, { upsert: true, contentType: file.type });
    if (uploadError) { toast.error("Errore nel caricamento del logo"); setUploadingLogo(false); return; }

    const { data: urlData } = supabase.storage.from("club-logos").getPublicUrl(filePath);
    const logoUrl = urlData.publicUrl;

    const { error: updateError } = await supabase.from("clubs").update({ logo_url: logoUrl } as any).eq("id", id);
    if (updateError) { toast.error("Errore nell'aggiornamento del logo"); }
    else { toast.success("Logo aggiornato!"); setClub((prev) => prev ? { ...prev, logo_url: logoUrl } : prev); }
    setUploadingLogo(false);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !id) return;
    if (!file.type.startsWith("image/")) { toast.error("Seleziona un'immagine valida"); return; }

    setUploadingBanner(true);
    try { file = await prepareImageForUpload(file, { maxDimension: 1920 }); }
    catch (err: any) { toast.error(err?.message || "Immagine non valida"); setUploadingBanner(false); return; }
    const ext = file.name.split(".").pop();
    const filePath = `${id}/banner.${ext}`;

    const { error: uploadError } = await supabase.storage.from("club-banners").upload(filePath, file, { upsert: true, contentType: file.type });
    if (uploadError) { toast.error("Errore nel caricamento del banner"); setUploadingBanner(false); return; }

    const { data: urlData } = supabase.storage.from("club-banners").getPublicUrl(filePath);
    const bannerUrl = urlData.publicUrl;

    const { error: updateError } = await supabase.from("clubs").update({ banner_url: bannerUrl } as any).eq("id", id);
    if (updateError) { toast.error("Errore nell'aggiornamento del banner"); }
    else { toast.success("Banner aggiornato!"); setClub((prev) => prev ? { ...prev, banner_url: bannerUrl } : prev); }
    setUploadingBanner(false);
  };

  const getRoleIcon = (r: string) => {
    if (r === "leader") return <Crown size={14} className="text-primary" />;
    if (r === "vice_leader") return <Crown size={14} className="text-muted-foreground" />;
    if (r === "staff") return <Star size={14} className="text-primary" />;
    return null;
  };

  const leaderCount = members.filter(m => m.role === "leader").length;

  const getRoleLabel = (r: string) => {
    if (r === "leader") return leaderCount >= 2 ? "Co-Club Leader" : "Club Leader";
    if (r === "vice_leader") return "Vice Leader";
    if (r === "staff") return "Staff";
    return "Membro";
  };

  const getRankIcon = (rank: number) => <RankBadge rank={rank} size={18} className="text-xs" />;

  const getInactivityDays = (m: Member) => {
    const ref = m.last_tournament_at || m.joined_at;
    return differenceInDays(new Date(), new Date(ref));
  };

  const handleChangeRole = async (memberId: string, memberUserId: string, newRole: "leader" | "vice_leader" | "staff" | "member") => {
    if (!id || !user) return;
    if (newRole === "leader") {
      if (leaderCount >= 2) {
        toast.error("Ci possono essere al massimo 2 Co-Club Leader");
        return;
      }
      const label = leaderCount === 1 ? "Co-Club Leader" : "Club Leader";
      const confirmed = window.confirm(`Sei sicuro di voler promuovere questo membro a ${label}?`);
      if (!confirmed) return;
    }
    const { error } = await supabase.from("club_members").update({ role: newRole } as any).eq("id", memberId);
    if (error) { toast.error("Errore nel cambio ruolo"); return; }
    toast.success(`Ruolo aggiornato a ${newRole === "leader" && leaderCount >= 1 ? "Co-Club Leader" : getRoleLabel(newRole)}`);
    fetchClub();
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const confirmed = window.confirm(`Sei sicuro di voler rimuovere ${memberName} dal club?`);
    if (!confirmed) return;
    const { error } = await supabase.from("club_members").delete().eq("id", memberId);
    if (error) { toast.error("Errore nella rimozione del membro"); }
    else { toast.success(`${memberName} rimosso dal club`); fetchClub(); }
  };

  const handleDeleteClub = async () => {
    if (!id || (!isLeader && !isAdmin)) return;
    const confirmed = window.confirm("Sei sicuro di voler ELIMINARE questo club? Tutti i membri verranno rimossi e l'azione è irreversibile.");
    if (!confirmed) return;
    const doubleConfirm = window.confirm("Ultima conferma: il club verrà eliminato definitivamente.");
    if (!doubleConfirm) return;
    await supabase.from("club_members").delete().eq("club_id", id);
    await supabase.from("tournaments").update({ club_id: null } as any).eq("club_id", id);
    const { error } = await supabase.from("clubs").delete().eq("id", id);
    if (error) { toast.error("Errore nell'eliminazione del club"); }
    else { toast.success("Club eliminato"); navigate("/clubs"); }
  };

  // Fetch club-only points (computed from this club's tournaments only)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      // Get all tournaments of this club
      const { data: tData } = await supabase
        .from("tournaments")
        .select("id")
        .eq("club_id", id);
      const tIds = (tData || []).map((t: any) => t.id);
      if (tIds.length === 0) {
        if (!cancelled) setClubPointsMap(new Map());
        return;
      }
      const { data: rData } = await supabase
        .from("tournament_results")
        .select("user_id, scaled_points, placement")
        .in("tournament_id", tIds);
      const map = new Map<string, { points: number; wins: number }>();
      (rData || []).forEach((r: any) => {
        const cur = map.get(r.user_id) || { points: 0, wins: 0 };
        cur.points += Number(r.scaled_points) || 0;
        if (r.placement === 1) cur.wins += 1;
        map.set(r.user_id, cur);
      });
      if (!cancelled) setClubPointsMap(map);
    })();
    return () => { cancelled = true; };
  }, [id, tournaments.length]);

  // Combine members + child profiles for ranking
  const rankingEntries = [
    ...members.map(m => {
      const cp = clubPointsMap.get(m.user_id);
      return {
        id: m.id,
        type: 'member' as const,
        display_name: m.profiles?.display_name || m.profiles?.username || "Utente",
        username: m.profiles?.username || null,
        avatar_url: m.profiles?.avatar_url || null,
        points: rankingScope === "club" ? (cp?.points ?? 0) : (m.profiles?.points ?? 0),
        wins: rankingScope === "club" ? (cp?.wins ?? 0) : (m.profiles?.wins ?? 0),
        role: m.role,
      };
    }),
    ...childProfiles.map(cp => {
      const parentMember = members.find(m => m.user_id === cp.parent_user_id);
      const clubP = clubPointsMap.get(cp.id);
      return {
        id: cp.id,
        type: 'child' as const,
        display_name: cp.display_name,
        username: null,
        avatar_url: cp.avatar_url,
        points: rankingScope === "club" ? (clubP?.points ?? 0) : cp.points,
        wins: rankingScope === "club" ? (clubP?.wins ?? 0) : cp.wins,
        role: 'child',
        parentName: parentMember?.profiles?.display_name || parentMember?.profiles?.username || null,
      };
    }),
  ].sort((a, b) => b.points - a.points);

  const rankingTotalPages = Math.max(1, Math.ceil(rankingEntries.length / rankingPageSize));
  const pagedRankingEntries = rankingEntries.slice(rankingPage * rankingPageSize, (rankingPage + 1) * rankingPageSize);

  const rankedMembers = [...members].sort((a, b) => (b.profiles?.points ?? 0) - (a.profiles?.points ?? 0));

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-24 text-center text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-24 text-center text-muted-foreground">Club non trovato.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/clubs" className="gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
                Torna ai club
              </Link>
            </Button>
            <SharePreviewButton kind="club" id={club.id} />
          </div>
          {/* Banner */}
          <div className="relative rounded-2xl overflow-hidden mb-8 bg-card border border-border">
            <div className="h-32 sm:h-48 md:h-64 relative">
              {club.banner_url ? (
                <img src={club.banner_url} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
              {canManageFull && (
                <label className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col items-end gap-1 cursor-pointer">
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border text-xs hover:bg-background transition-colors">
                    <ImagePlus size={14} />
                    <span className="hidden sm:inline">{uploadingBanner ? "Caricamento..." : "Cambia banner"}</span>
                  </span>
                  <span className="hidden md:inline-block text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-md">
                    Desktop 1200×400 · Tablet 800×300 · Mobile 600×250
                  </span>
                  <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" disabled={uploadingBanner} />
                </label>
              )}
            </div>

            {/* Club info — stacked on mobile, overlay on desktop */}
            <div className="relative px-4 sm:px-8 pb-5 sm:pb-8 -mt-12 sm:-mt-20">
              <div className="flex flex-col gap-4">
                <div className="flex items-end gap-3 sm:gap-4 min-w-0 w-full">
                  <div className="relative group shrink-0">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-card border-4 border-card flex items-center justify-center overflow-hidden shadow-lg">
                      {club.logo_url ? (
                        <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
                      ) : (
                        <BncIcon name="club" size={28} className="text-primary sm:hidden" />
                      )}
                      {!club.logo_url && <BncIcon name="club" size={40} className="text-primary hidden sm:block" />}
                    </div>
                    {canManageFull && (
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera size={18} className="text-white" />
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploadingLogo} />
                      </label>
                    )}
                  </div>
                  <div className="pb-1 min-w-0 flex-1">
                    {canManageFull && editingName ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="font-display text-xl sm:text-2xl md:text-3xl h-auto py-1"
                          maxLength={60}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (async () => {
                                const trimmed = newName.trim();
                                if (!trimmed) { toast.error("Il nome non può essere vuoto"); return; }
                                const { error } = await supabase.from("clubs").update({ name: trimmed } as any).eq("id", id!);
                                if (error) { toast.error("Errore nel salvataggio"); return; }
                                toast.success("Nome aggiornato!");
                                setClub(prev => prev ? { ...prev, name: trimmed } : prev);
                                setEditingName(false);
                              })();
                            }
                            if (e.key === "Escape") setEditingName(false);
                          }}
                        />
                        <Button size="sm" onClick={async () => {
                          const trimmed = newName.trim();
                          if (!trimmed) { toast.error("Il nome non può essere vuoto"); return; }
                          const { error } = await supabase.from("clubs").update({ name: trimmed } as any).eq("id", id!);
                          if (error) { toast.error("Errore nel salvataggio"); return; }
                          toast.success("Nome aggiornato!");
                          setClub(prev => prev ? { ...prev, name: trimmed } : prev);
                          setEditingName(false);
                        }}>
                          <Save size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Annulla</Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 group min-w-0">
                        <h1 className="font-display text-xl sm:text-3xl md:text-4xl leading-tight break-words">{club.name}</h1>
                        {canManageFull && (
                          <button
                            onClick={() => { setNewName(club.name); setEditingName(true); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary shrink-0"
                          >
                            <Edit2 size={14} className="text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-sm text-muted-foreground mt-1 flex-wrap min-w-0">
                      {club.regions && <span className="whitespace-nowrap">{club.regions.name}</span>}
                      {club.city && (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <MapPin size={16} /> {club.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <BncIcon name="community" size={16} /> {members.length} membri
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-wrap gap-2 items-center">
                  {user && !isMember && (
                    <div className="flex gap-2">
                      <Button variant="hero" size="sm" className="text-sm" onClick={() => setShowJoinDialog(true)}>Unisciti al Club</Button>
                      <Button variant={isFollowing ? "default" : "outline"} size="sm" className="text-sm gap-1" onClick={handleToggleFollow} disabled={followLoading}>
                        <Bell size={14} /> {isFollowing ? "Seguito" : "Segui"}
                      </Button>
                    </div>
                  )}
                  {user && isMember && !isLeader && !isAdmin && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-sm" onClick={handleLeave}>Lascia Club</Button>
                    </div>
                  )}
                  {(isStaff || isAdmin) && (
                    <Button variant="outline" size="sm" className="text-sm" onClick={openMemberManagement}>
                      <ClipboardList size={16} /> <span className="hidden sm:inline">Gestione</span> Membri
                    </Button>
                  )}
                  {(isStaff || isAdmin) && (
                    <div className="flex items-center gap-2">
                      <Button variant="hero" size="sm" className="text-sm" onClick={() => setShowCreateTournament(true)}>
                        <Plus size={16} /> Crea Evento
                      </Button>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        rankedThisMonth >= rankedLimit
                          ? "bg-destructive/15 text-destructive"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        <BncIcon name="podium" size={14} className="inline mr-1" />{rankedThisMonth}/{rankedLimit} ranked {rankedPeriod === "monthly" ? "mensili" : "settimanali"}
                      </span>
                    </div>
                  )}
                  {(isLeader || isViceLeader) && regionChannelId && (
                    <Button variant="outline" size="sm" className="text-sm" onClick={() => setRegionChatOpen(true)}>
                      <BncIcon name="chat" size={16} className="mr-1" /> Chat Regionale
                    </Button>
                  )}
                  {/* QR & Share buttons */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={async () => {
                        const shareUrl = `https://ibna.it/clubs/${id}`;
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                          toast.success("Link del club copiato!");
                        } catch {
                          // Fallback for browsers without clipboard permission
                          const ta = document.createElement("textarea");
                          ta.value = shareUrl; document.body.appendChild(ta);
                          ta.select(); try { document.execCommand("copy"); toast.success("Link del club copiato!"); } catch { toast.error("Impossibile copiare il link"); }
                          document.body.removeChild(ta);
                        }
                      }}
                      title="Copia link"
                    >
                      <Copy size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={async () => {
                        const shareUrl = `https://ibna.it/clubs/${id}`;
                        // Only include URL in `text` (not as `url` field) to avoid duplication:
                        // many share targets append `url` automatically to the text.
                        const shareData = {
                          title: club.name,
                          text: `Club ${club.name}${club.city ? ` — ${club.city}` : ""}\n${shareUrl}`,
                        };
                        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                          try {
                            await navigator.share(shareData);
                            return;
                          } catch (err: any) {
                            if (err?.name === "AbortError") return; // user cancelled
                            // fall through to clipboard
                          }
                        }
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                          toast.success("Link del club copiato!");
                        } catch {
                          toast.error("Impossibile condividere");
                        }
                      }}
                      title="Condividi"
                    >
                      <Share2 size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const svg = document.getElementById("club-qr-code");
                        if (!svg) return;
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const canvas = document.createElement("canvas");
                        canvas.width = 512; canvas.height = 512;
                        const ctx = canvas.getContext("2d")!;
                        const img = new Image();
                        img.onload = () => {
                          ctx.fillStyle = "#ffffff";
                          ctx.fillRect(0, 0, 512, 512);
                          ctx.drawImage(img, 0, 0, 512, 512);
                          const link = document.createElement("a");
                          link.download = `qr-club-${club.name.replace(/\s+/g, "-")}.png`;
                          link.href = canvas.toDataURL("image/png");
                          link.click();
                        };
                        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                      }}
                      title="Salva QR"
                    >
                      <Download size={14} />
                    </Button>
                  </div>
                  {(isLeader || isAdmin) && (
                    <Button variant="destructive" size="sm" className="text-sm" onClick={handleDeleteClub}>
                      <Trash2 size={14} /> <span className="hidden sm:inline">Elimina Club</span>
                    </Button>
                  )}
                </div>
                {/* Hidden QR for download */}
                <div className="hidden">
                  <QRCodeSVG id="club-qr-code" value={`https://ibna.it/clubs/${id}`} size={512} level="M" />
                </div>
              </div>

              {/* Description */}
              {canManageFull ? (
                editingDescription ? (
                  <div className="mt-4 space-y-2">
                    <Textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Descrizione del club..."
                      rows={3}
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => {
                        const { error } = await supabase.from("clubs").update({ description: newDescription.trim() || null } as any).eq("id", id!);
                        if (error) { toast.error("Errore nel salvataggio"); return; }
                        toast.success("Descrizione aggiornata!");
                        setClub(prev => prev ? { ...prev, description: newDescription.trim() || null } : prev);
                        setEditingDescription(false);
                      }}>
                        <Save size={14} className="mr-1" /> Salva
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingDescription(false)}>Annulla</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-start gap-2 group">
                    <p className="text-muted-foreground flex-1 whitespace-pre-line">{club.description || "Nessuna descrizione — clicca per aggiungerne una."}</p>
                    <button
                      onClick={() => { setNewDescription(club.description || ""); setEditingDescription(true); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary"
                    >
                      <Edit2 size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                )
              ) : (
                club.description && <p className="text-muted-foreground mt-4 whitespace-pre-line">{club.description}</p>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchParams(v === "orders" ? { tab: "orders" } : {}, { replace: true }); }} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="club">Club</TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-1.5">
                <ShoppingCart size={14} /> Ordini
              </TabsTrigger>
            </TabsList>

            <TabsContent value="club">
          <div className="grid lg:grid-cols-[1fr_350px] gap-8">
            {/* Left column */}
            <div className="flex flex-col gap-10 min-w-0">
              {/* Tournaments */}
              <div>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h2 className="font-display text-2xl">
                    CALENDARIO <span className="gradient-text">EVENTI</span>
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5 text-xs font-medium">
                      <button
                        onClick={() => setTournamentsMode("upcoming")}
                        className={`px-3 py-1.5 rounded-md transition-colors ${tournamentsMode === "upcoming" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        In corso e futuri
                      </button>
                      <button
                        onClick={() => setTournamentsMode("past")}
                        className={`px-3 py-1.5 rounded-md transition-colors ${tournamentsMode === "past" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Passati
                      </button>
                    </div>
                    {canManage && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/clubs/${id}/flyer`}>
                          <ImageIcon size={14} className="mr-1" /> Crea Locandina
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                {tournaments.length === 0 ? (
                  <p className="text-muted-foreground">Nessun evento organizzato.</p>
                ) : (
                  <ClubTournamentsCalendar
                    tournaments={tournaments}
                    mode={tournamentsMode}
                    canManage={canManage}
                    onDeleted={fetchClub}
                  />
                )}
              </div>

              {/* Club Internal Rankings */}
              <div>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h2 className="font-display text-2xl">
                    {rankingScope === "club" ? <>CLASSIFICA <span className="gradient-text">TORNEI CLUB</span></> : <>CLASSIFICA <span className="gradient-text">NAZIONALE</span></>}
                  </h2>
                  <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5 text-xs font-medium">
                    <button
                      onClick={() => setRankingScope("club")}
                      className={`px-3 py-1.5 rounded-md transition-colors ${rankingScope === "club" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Solo club
                    </button>
                    <button
                      onClick={() => setRankingScope("national")}
                      className={`px-3 py-1.5 rounded-md transition-colors ${rankingScope === "national" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Nazionale
                    </button>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-4 sm:px-6 py-3 bg-secondary/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-1">#</div>
                    <div className="col-span-5">Membro</div>
                    <div className="col-span-2 text-center">Ruolo</div>
                    <div className="col-span-2 text-center">Punti</div>
                    <div className="col-span-2 text-center">Vittorie</div>
                  </div>
                  {/* Mobile header */}
                  <div className="grid sm:hidden grid-cols-[auto_1fr_auto] gap-2 px-3 py-2 bg-secondary/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div>#</div>
                    <div>Membro</div>
                    <div>Punti</div>
                  </div>
                  <div>
                  {rankingEntries.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Nessun membro</div>
                  ) : (
                    <>
                    {pagedRankingEntries.map((entry, idx) => {
                      const i = rankingPage * rankingPageSize + idx;
                      return (
                      <div key={entry.id} data-rank-row>
                        {/* Desktop row */}
                        <div className="hidden sm:grid grid-cols-12 gap-2 px-4 sm:px-6 py-3 border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors">
                          <div className="col-span-1 flex items-center">{getRankIcon(i + 1)}</div>
                          <div className="col-span-5 flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium border border-border overflow-hidden shrink-0">
                              {entry.avatar_url ? (
                                <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                entry.display_name[0].toUpperCase()
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              {entry.type === 'member' && entry.username ? (
                                <Link to={`/profilo/${entry.username}`} className="text-sm font-medium hover:text-primary transition-colors truncate">
                                  {entry.display_name}
                                </Link>
                              ) : entry.type === 'child' ? (
                                <Link to={`/profilo/child/${entry.id}`} className="text-sm font-medium hover:text-primary transition-colors truncate">
                                  {entry.display_name}
                                </Link>
                              ) : (
                                <span className="text-sm font-medium truncate">{entry.display_name}</span>
                              )}
                              {entry.type === 'child' && (entry as any).parentName && (
                                <span className="text-[10px] text-muted-foreground truncate">👶 Figlio di {(entry as any).parentName}</span>
                              )}
                            </div>
                          </div>
                          <div className="col-span-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            {entry.type === 'child' ? (
                              <span className="text-[10px]">👶 Figlio</span>
                            ) : (
                              <>{getRoleIcon(entry.role)}<span className="truncate">{getRoleLabel(entry.role)}</span></>
                            )}
                          </div>
                          <div className="col-span-2 flex items-center justify-center">
                            <span className="font-semibold text-primary text-sm">{entry.points.toLocaleString()}</span>
                          </div>
                          <div className="col-span-2 flex items-center justify-center text-sm text-muted-foreground">
                            {entry.wins}
                          </div>
                        </div>
                        {/* Mobile row */}
                        <div className="grid sm:hidden grid-cols-[auto_1fr_auto] gap-2 px-3 py-3 border-b border-border/30 last:border-0 items-center">
                          <div className="flex items-center w-6 justify-center">{getRankIcon(i + 1)}</div>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium border border-border overflow-hidden shrink-0">
                              {entry.avatar_url ? (
                                <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                entry.display_name[0].toUpperCase()
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              {entry.type === 'member' && entry.username ? (
                                <Link to={`/profilo/${entry.username}`} className="text-sm font-medium hover:text-primary transition-colors truncate">
                                  {entry.display_name}
                                </Link>
                              ) : entry.type === 'child' ? (
                                <Link to={`/profilo/child/${entry.id}`} className="text-sm font-medium hover:text-primary transition-colors truncate">
                                  {entry.display_name}
                                </Link>
                              ) : (
                                <span className="text-sm font-medium truncate">{entry.display_name}</span>
                              )}
                              <span className="text-[10px] text-muted-foreground truncate">
                                {entry.type === 'child' ? `👶 ${(entry as any).parentName ? `Figlio di ${(entry as any).parentName}` : 'Figlio'}` : getRoleLabel(entry.role)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <span className="font-semibold text-primary text-sm">{entry.points.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                    </>
                  )}
                  </div>
                  {rankingTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border bg-secondary/20">
                      <Button variant="outline" size="sm" disabled={rankingPage === 0} onClick={() => setRankingPage(p => p - 1)}>
                        Prec
                      </Button>
                      <span className="text-xs text-muted-foreground px-2 tabular-nums">{rankingPage + 1} / {rankingTotalPages}</span>
                      <Button variant="outline" size="sm" disabled={rankingPage >= rankingTotalPages - 1} onClick={() => setRankingPage(p => p + 1)}>
                        Succ
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Socials + Members */}
            <div className="flex flex-col gap-6 min-w-0">
              {/* Social Links */}
              {(() => {
                const hasSocials = club.social_whatsapp_group || club.social_whatsapp_channel || club.social_discord || club.social_instagram || club.social_facebook || club.social_tiktok;
                const socialLinks = [
                  { key: "social_whatsapp_group", label: "Gruppo WhatsApp", url: club.social_whatsapp_group, icon: <MessageCircle size={16} />, color: "bg-green-600 hover:bg-green-700" },
                  { key: "social_whatsapp_channel", label: "Canale WhatsApp", url: club.social_whatsapp_channel, icon: <Hash size={16} />, color: "bg-green-500 hover:bg-green-600" },
                  { key: "social_discord", label: "Discord", url: club.social_discord, icon: <Gamepad2 size={16} />, color: "bg-indigo-600 hover:bg-indigo-700" },
                  { key: "social_instagram", label: "Instagram", url: club.social_instagram, icon: <Camera size={16} />, color: "bg-pink-600 hover:bg-pink-700" },
                  { key: "social_facebook", label: "Facebook", url: club.social_facebook, icon: <Users size={16} />, color: "bg-blue-600 hover:bg-blue-700" },
                  { key: "social_tiktok", label: "TikTok", url: club.social_tiktok, icon: <Star size={16} />, color: "bg-gray-800 hover:bg-gray-900" },
                ];
                return (hasSocials || canManageFull) ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-display text-xl">SOCIAL</h2>
                      {canManageFull && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSocialForm({
                              social_whatsapp_group: club.social_whatsapp_group || "",
                              social_whatsapp_channel: club.social_whatsapp_channel || "",
                              social_discord: club.social_discord || "",
                              social_instagram: club.social_instagram || "",
                              social_facebook: club.social_facebook || "",
                              social_tiktok: club.social_tiktok || "",
                              default_paypal_link: (club as any).default_paypal_link || "",
                            } as any);
                            setShowSocialDialog(true);
                          }}
                        >
                          <Settings size={14} className="mr-1" /> Modifica
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {socialLinks.filter(s => s.url).map(s => (
                        <a
                          key={s.key}
                          href={s.url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors ${s.color}`}
                        >
                          {s.icon} {s.label}
                        </a>
                      ))}
                      {!hasSocials && canManageFull && (
                        <p className="text-sm text-muted-foreground">Nessun social configurato. Clicca "Modifica" per aggiungerne.</p>
                      )}
                    </div>
                  </div>
               ) : null;
              })()}

              {/* Venues (visible to all, editable by leader/vice) */}
              {(venues.length > 0 || canManageFull) && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-xl">🏟️ SEDI DI GIOCO</h2>
                    {canManageFull && (
                      <Button variant="ghost" size="sm" onClick={() => { setVenueForm({ name: "", address: "", city: "" }); setShowAddVenue(true); }}>
                        <Plus size={14} className="mr-1" /> Aggiungi
                      </Button>
                    )}
                  </div>
                  {venues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {canManageFull ? "Nessuna sede aggiunta. Aggiungi le sedi dove giocate per velocizzare la creazione dei tornei." : "Nessuna sede registrata."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[...venues].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)).map((v) => {
                        const canSetPrimary = canManageFull && !v.is_primary;

                        return (
                          <div key={v.id} className={`flex items-center justify-between p-3 rounded-lg border ${v.is_primary ? "bg-primary/5 border-primary/30" : "bg-secondary/30 border-border"}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              {canManageFull ? (
                                <button
                                  disabled={v.is_primary || settingPrimary}
                                  title={
                                    v.is_primary ? "Sede primaria attuale"
                                    : "Imposta come sede primaria"
                                  }
                                  onClick={async () => {
                                    if (!canSetPrimary) return;
                                    if (!window.confirm(`Impostare "${v.name}" come sede primaria del club? La posizione del club sulla mappa verrà aggiornata.`)) return;
                                    setSettingPrimary(true);
                                    // Remove old primary
                                    await supabase.from("club_venues").update({ is_primary: false, primary_changed_at: null } as any).eq("club_id", id!).eq("is_primary", true);
                                    // Set new primary
                                    const { error: venueErr } = await supabase.from("club_venues").update({ is_primary: true } as any).eq("id", v.id);
                                    if (venueErr) { toast.error("Errore nell'aggiornamento"); setSettingPrimary(false); return; }
                                    // Sync club position
                                    await supabase.from("clubs").update({ city: v.city, latitude: v.latitude, longitude: v.longitude } as any).eq("id", id!);
                                    setClub(prev => prev ? { ...prev, city: v.city, latitude: v.latitude, longitude: v.longitude } : prev);
                                    toast.success(`"${v.name}" è ora la sede primaria!`);
                                    setSettingPrimary(false);
                                    fetchVenues();
                                  }}
                                  className={`shrink-0 p-1 rounded transition-colors ${v.is_primary ? "text-primary" : "text-muted-foreground/40 hover:text-primary/70"} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <Crown size={16} className={v.is_primary ? "fill-primary" : ""} />
                                </button>
                              ) : (
                                v.is_primary && <Crown size={16} className="text-primary fill-primary shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                  {v.name}
                                  {v.is_primary && <span className="text-xs text-primary font-normal">(Primaria)</span>}
                                  {v.is_shop && <span className="text-[10px] uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">Negozio</span>}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{v.address}, {v.city}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {(canManageFull || v.shop_owner_user_id === user?.id) && (
                                <Button variant="ghost" size="sm" title={canManageFull ? "Assegna negoziante / configura negozio" : "Configura il tuo negozio"} onClick={() => setShopVenue(v)}>
                                  <Settings size={14} />
                                </Button>
                              )}
                              {canManageFull && !v.is_primary && (
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  if (!window.confirm(`Rimuovere "${v.name}"?`)) return;
                                  const { error } = await supabase.from("club_venues").delete().eq("id", v.id);
                                  if (error) {
                                    toast.error("Errore nella rimozione della sede");
                                  } else {
                                    toast.success("Sede rimossa");
                                    fetchVenues();
                                  }
                                }}>
                                  <Trash2 size={14} className="text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Club Links */}
              {(isMember || isAdmin) && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <ClubLinksManager clubId={id!} isLeader={canManageFull} />
                </div>
              )}

              {/* Members */}
              <div className="flex-1 flex flex-col">
                <h2 className="font-display text-2xl mb-4">MEMBRI <span className="text-sm font-normal text-muted-foreground">({members.length + childProfiles.length})</span></h2>
                <div className="bg-card rounded-2xl border border-border overflow-hidden flex-1 flex flex-col">
                  {(() => {
                    const membersTotalPages = Math.max(1, Math.ceil(members.length / MEMBERS_PAGE_SIZE));
                    const pageMembers = members.slice(membersPage * MEMBERS_PAGE_SIZE, (membersPage + 1) * MEMBERS_PAGE_SIZE);
                    const groups: { key: string; label: string; items: Member[] }[] = [
                      { key: "leader", label: leaderCount >= 2 ? "Co-Club Leader" : "Club Leader", items: pageMembers.filter(m => m.role === "leader") },
                      { key: "vice_leader", label: "Vice Leader", items: pageMembers.filter(m => m.role === "vice_leader") },
                      { key: "staff", label: "Staff", items: pageMembers.filter(m => m.role === "staff") },
                      { key: "member", label: "Membri", items: pageMembers.filter(m => m.role === "member" || !["leader","vice_leader","staff"].includes(m.role)) },
                    ].filter(g => g.items.length > 0);

                    return (
                      <>
                        {groups.map((group, gi) => (
                      <div key={group.key} className={gi > 0 ? "border-t border-border" : ""}>
                        <div className="px-4 py-2 bg-secondary/40 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {getRoleIcon(group.key)}
                            <span>{group.label}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{group.items.length}</span>
                        </div>
                        <div className="divide-y divide-border/40">
                          {group.items.map((m) => {
                            const days = getInactivityDays(m);
                            const memberChildren = childProfiles.filter(cp => cp.parent_user_id === m.user_id);
                            const displayName = m.profiles?.display_name || m.profiles?.username || "Utente";
                            return (
                              <div key={m.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-medium overflow-hidden border border-border shrink-0">
                                    {m.profiles?.avatar_url ? (
                                      <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      displayName[0].toUpperCase()
                                    )}
                                  </div>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    {m.profiles?.username ? (
                                      <Link to={`/profilo/${m.profiles.username}`} className="text-sm font-medium hover:text-primary transition-colors truncate">
                                        {displayName}
                                      </Link>
                                    ) : (
                                      <span className="text-sm font-medium truncate">{displayName}</span>
                                    )}
                                    {m.city && <span className="text-[11px] text-muted-foreground truncate">{m.city}</span>}
                                  </div>
                                  <div
                                    className={`flex items-center gap-1 text-[11px] tabular-nums shrink-0 ${days > 30 ? "text-destructive" : days > 14 ? "text-amber-500" : "text-muted-foreground"}`}
                                    title={`Ultima attività: ${days} giorni fa`}
                                  >
                                    <Clock size={11} />
                                    <span>{days}g</span>
                                  </div>
                                  {/* Role/remove actions moved to "Gestione Membri" dialog */}
                                </div>
                                {/* Children of this member */}
                                {memberChildren.length > 0 && (
                                  <div className="ml-12 mt-2 space-y-1">
                                    {memberChildren.map(cp => (
                                      <Link key={cp.id} to={`/profilo/child/${cp.id}`} className="flex items-center gap-2 group">
                                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium overflow-hidden border border-border shrink-0">
                                          {cp.avatar_url ? (
                                            <img src={cp.avatar_url} alt="" className="w-full h-full object-cover" />
                                          ) : (
                                            cp.display_name[0].toUpperCase()
                                          )}
                                        </div>
                                        <span className="text-[11px] text-muted-foreground truncate group-hover:text-primary transition-colors">👶 {cp.display_name}</span>
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                        ))}
                        {membersTotalPages > 1 && (
                          <div className="mt-auto flex items-center justify-center gap-2 px-4 py-3 border-t border-border bg-secondary/20">
                            <Button variant="outline" size="sm" disabled={membersPage === 0} onClick={() => setMembersPage(p => p - 1)}>
                              Prec
                            </Button>
                            <span className="text-xs text-muted-foreground px-2 tabular-nums">{membersPage + 1} / {membersTotalPages}</span>
                            <Button variant="outline" size="sm" disabled={membersPage >= membersTotalPages - 1} onClick={() => setMembersPage(p => p + 1)}>
                              Succ
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
            </TabsContent>

            <TabsContent value="orders">
              {isMember || isAdmin ? (
                <ClubOrdersTab clubId={id!} paypalLink={club.default_paypal_link} />
              ) : (
                <p className="text-muted-foreground text-sm">Devi essere membro del club per vedere gli ordini.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Member Management Dialog */}
      <Dialog open={showMemberManagement} onOpenChange={(open) => { setShowMemberManagement(open); if (!open) setEditingMemberId(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList size={20} /> Gestione Membri — {club?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-2">
            {managementMembers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nessun membro</div>
            ) : (
              managementMembers.map((m: any) => {
                const days = getInactivityDays(m);
                const isEditing = editingMemberId === m.id;
                return (
                  <div key={m.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    {/* Row 1: Avatar, name, role, inactivity, edit button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-medium overflow-hidden shrink-0">
                          {m.profiles?.avatar_url ? (
                            <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (m.profiles?.display_name || m.profiles?.username || "?")[0].toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-sm block truncate">{m.profiles?.display_name || m.profiles?.username || "Utente"}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">{getRoleIcon(m.role)} {getRoleLabel(m.role)}</span>
                            <span>·</span>
                            <span>Iscritto {format(new Date(m.joined_at), "dd/MM/yy")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`flex items-center gap-1 text-xs font-medium ${days > 30 ? "text-destructive" : days > 14 ? "text-amber-500" : "text-muted-foreground"}`}>
                          <Clock size={12} />
                          <span>{days === 0 ? "Oggi" : `${days}g`}</span>
                        </div>
                        {!isEditing ? (
                          <>
                            <button
                              onClick={() => { setEditingMemberId(m.id); setEditPhone(m.phone || ""); setEditCity(m.city || ""); }}
                              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                              title="Modifica"
                            >
                              <Edit2 size={14} className="text-muted-foreground" />
                            </button>
                            {canManage && m.user_id !== user?.id && (() => {
                              const canChangeRoles = canManageFull;
                              const canRemove = canManageFull || (isStaff && m.role !== "leader" && m.role !== "vice_leader");
                              if (!canChangeRoles && !canRemove) return null;
                              const displayName = m.profiles?.display_name || m.profiles?.username || "Utente";
                              return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Gestisci ruolo">
                                      <UserCog size={14} className="text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {canChangeRoles && m.role !== "leader" && leaderCount < 2 && (
                                      <DropdownMenuItem onClick={() => handleChangeRole(m.id, m.user_id, "leader")}>
                                        <Crown size={14} className="mr-2" /> Promuovi a {leaderCount === 1 ? "Co-Club Leader" : "Club Leader"}
                                      </DropdownMenuItem>
                                    )}
                                    {canChangeRoles && m.role !== "vice_leader" && (
                                      <DropdownMenuItem onClick={() => handleChangeRole(m.id, m.user_id, "vice_leader" as any)}>
                                        <Crown size={14} className="mr-2" /> {m.role === "leader" ? "Retrocedi a" : "Promuovi a"} Vice Leader
                                      </DropdownMenuItem>
                                    )}
                                    {canChangeRoles && m.role !== "staff" && (
                                      <DropdownMenuItem onClick={() => handleChangeRole(m.id, m.user_id, "staff")}>
                                        <Star size={14} className="mr-2" /> {m.role === "leader" || m.role === "vice_leader" ? "Retrocedi a" : "Promuovi a"} Staff
                                      </DropdownMenuItem>
                                    )}
                                    {canChangeRoles && m.role !== "member" && (
                                      <DropdownMenuItem onClick={() => handleChangeRole(m.id, m.user_id, "member")}>
                                        <Users size={14} className="mr-2" /> Retrocedi a Membro
                                      </DropdownMenuItem>
                                    )}
                                    {canChangeRoles && canRemove && <DropdownMenuSeparator />}
                                    {canRemove && (
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => handleRemoveMember(m.id, displayName)}
                                      >
                                        <UserMinus size={14} className="mr-2" /> Rimuovi dal club
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );
                            })()}
                          </>
                        ) : (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingMemberId(null)}>Annulla</Button>
                            <Button size="sm" onClick={async () => {
                              const { error } = await (supabase as any).rpc("upsert_club_member_contact", {
                                p_member_id: m.id,
                                p_phone: editPhone.trim(),
                                p_city: editCity.trim(),
                                p_update_city: true,
                              });
                              if (error) { toast.error("Errore nel salvataggio"); return; }
                              toast.success("Dati aggiornati");
                              setEditingMemberId(null);
                              setManagementMembers(prev => prev.map(mm => mm.id === m.id ? { ...mm, phone: editPhone.trim() || null, city: editCity.trim() || null } : mm));
                            }}>
                              <Save size={14} className="mr-1" /> Salva
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Row 2: City + Phone (view or edit mode) */}
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Città</Label>
                          <CityCombobox value={editCity} onChange={setEditCity} placeholder="Cerca comune..." className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Telefono</Label>
                          <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+39 333 1234567" className="mt-1" maxLength={20} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin size={12} /> {m.city || "Non specificata"}</span>
                        <span className="flex items-center gap-1"><Phone size={12} /> {m.phone || "Non specificato"}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showCreateTournament && id && (
        <CreateTournamentDialog
          open={showCreateTournament}
          onOpenChange={setShowCreateTournament}
          clubId={id}
          onCreated={() => { fetchClub(); fetchRankedCount(); }}
        />
      )}

      {/* Join Club Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unisciti a {club?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Compila i dati per completare l'iscrizione al club.
            </p>
            <div>
              <Label>Città di provenienza *</Label>
              <CityCombobox
                value={joinCity}
                onChange={setJoinCity}
                placeholder="Cerca il tuo comune..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Numero di cellulare *</Label>
              <Input
                value={joinPhone}
                onChange={(e) => setJoinPhone(e.target.value)}
                placeholder="es. +39 333 1234567"
                className="mt-1"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usato per l'identificazione nel gruppo WhatsApp del club.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowJoinDialog(false)}>Annulla</Button>
            <Button onClick={handleJoin}>Iscriviti</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Social & Settings Dialog */}
      <Dialog open={showSocialDialog} onOpenChange={setShowSocialDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Impostazioni Club</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Link PayPal predefinito per tornei</Label>
              <Input
                value={(socialForm as any).default_paypal_link || ""}
                onChange={(e) => setSocialForm(prev => ({ ...prev, default_paypal_link: e.target.value } as any))}
                placeholder="https://paypal.me/..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Verrà precompilato automaticamente alla creazione dei tornei a pagamento.</p>
            </div>
            <div className="border-t border-border pt-4">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2 block">Social</Label>
            </div>
            {[
              { key: "social_whatsapp_group", label: "Gruppo WhatsApp", placeholder: "https://chat.whatsapp.com/..." },
              { key: "social_whatsapp_channel", label: "Canale WhatsApp", placeholder: "https://whatsapp.com/channel/..." },
              { key: "social_discord", label: "Discord", placeholder: "https://discord.gg/..." },
              { key: "social_instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
              { key: "social_facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
              { key: "social_tiktok", label: "TikTok", placeholder: "https://tiktok.com/@..." },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  value={(socialForm as any)[key]}
                  onChange={(e) => setSocialForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSocialDialog(false)}>Annulla</Button>
            <Button onClick={async () => {
              const updates: any = {};
              Object.entries(socialForm).forEach(([k, v]) => { updates[k] = (v as string).trim() || null; });
              const { error } = await supabase.from("clubs").update(updates).eq("id", id!);
              if (error) { toast.error("Errore nel salvataggio"); return; }
              toast.success("Impostazioni aggiornate!");
              setClub(prev => prev ? { ...prev, ...updates } : prev);
              setShowSocialDialog(false);
            }}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Venue Shop / Free Play Dialog */}
      {shopVenue && (
        <VenueShopDialog
          venue={shopVenue}
          open={!!shopVenue}
          onOpenChange={(o) => { if (!o) setShopVenue(null); }}
          onSaved={fetchVenues}
          canManageFull={canManageFull}
          isShopOwner={shopVenue.shop_owner_user_id === user?.id}
          memberOptions={members.map(m => ({
            user_id: m.user_id,
            display_name: (m as any).profiles?.display_name ?? (m as any).display_name,
            username: (m as any).profiles?.username ?? (m as any).username,
          }))}
        />
      )}

      {/* Add Venue Dialog */}
      <Dialog open={showAddVenue} onOpenChange={setShowAddVenue}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aggiungi Sede di Gioco</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome sede *</Label>
              <Input value={venueForm.name} onChange={(e) => setVenueForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Es. Bar dello Sport" maxLength={100} className="mt-1" />
            </div>
            <div>
              <Label>Città *</Label>
              <CityCombobox value={venueForm.city} onChange={(v) => setVenueForm(prev => ({ ...prev, city: v }))} placeholder="Cerca comune..." />
            </div>
            <div>
              <Label>Indirizzo *</Label>
              <Input value={venueForm.address} onChange={(e) => setVenueForm(prev => ({ ...prev, address: e.target.value }))} placeholder="Es. Via Roma 15" maxLength={200} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddVenue(false)}>Annulla</Button>
            <Button disabled={venueGeocoding} onClick={async () => {
              if (!venueForm.name.trim() || !venueForm.address.trim() || !venueForm.city.trim()) { toast.error("Compila tutti i campi"); return; }
              setVenueGeocoding(true);
              const coords = await geocodeAddress(venueForm.address.trim(), venueForm.city.trim());
              setVenueGeocoding(false);
              const isFirst = venues.length === 0 || !venues.some((v: any) => v.is_primary);
              const { error } = await supabase.from("club_venues").insert({
                club_id: id!,
                name: venueForm.name.trim(),
                address: venueForm.address.trim(),
                city: venueForm.city.trim(),
                latitude: coords?.lat || null,
                longitude: coords?.lng || null,
                is_primary: isFirst,
                primary_changed_at: null,
              } as any);
              if (error) { toast.error("Errore nell'aggiunta"); return; }
              if (isFirst && coords) {
                await supabase.from("clubs").update({ city: venueForm.city.trim(), latitude: coords.lat, longitude: coords.lng } as any).eq("id", id!);
                setClub(prev => prev ? { ...prev, city: venueForm.city.trim(), latitude: coords.lat, longitude: coords.lng } : prev);
              }
              toast.success("Sede aggiunta!" + (isFirst ? " Impostata come primaria." : ""));
              setShowAddVenue(false);
              fetchVenues();
            }}>{venueGeocoding ? "Salvataggio..." : "Aggiungi"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Missing Phone Dialog */}
      <Dialog open={showMissingPhoneDialog} onOpenChange={setShowMissingPhoneDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone size={20} className="text-primary" />
              Numero di telefono mancante
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Per una migliore organizzazione del club, è necessario inserire il tuo numero di telefono. Viene usato dallo staff per contattarti e per l'identificazione nel gruppo WhatsApp.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="missing-phone">Numero di cellulare *</Label>
            <Input
              id="missing-phone"
              type="tel"
              placeholder="es. +39 333 1234567"
              value={missingPhone}
              onChange={(e) => setMissingPhone(e.target.value)}
              maxLength={20}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={savingMissingPhone || missingPhone.trim().length < 6}
              onClick={async () => {
                if (missingPhone.trim().length < 6) {
                  toast.error("Inserisci un numero di telefono valido");
                  return;
                }
                setSavingMissingPhone(true);
                const member = members.find((m) => m.user_id === user!.id);
                if (!member) {
                  setSavingMissingPhone(false);
                  toast.error("Membro club non trovato");
                  return;
                }
                const { error } = await (supabase as any).rpc("upsert_club_member_contact", {
                  p_member_id: member.id,
                  p_phone: missingPhone.trim(),
                  p_city: null,
                  p_update_city: false,
                });
                setSavingMissingPhone(false);
                if (error) {
                  toast.error("Errore nel salvataggio");
                  return;
                }
                toast.success("Numero di telefono salvato!");
                setShowMissingPhoneDialog(false);
              }}
            >
              {savingMissingPhone ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
      <RegionalChatDialog
        open={regionChatOpen}
        onOpenChange={setRegionChatOpen}
        channelId={regionChannelId}
        title={`Chat regione ${club?.regions?.name ?? ""}`}
      />
    </div>
  );
};

export default ClubDetail;
