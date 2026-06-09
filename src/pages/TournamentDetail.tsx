import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SharePreviewButton } from "@/components/SharePreviewButton";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClubRole } from "@/hooks/useClubRole";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserRoles } from "@/hooks/useUserRoles";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapPin, Users, Trophy, Clock, Shield, Settings, BarChart3, Swords, Bell, BellOff, Trash2, CheckCircle2, XCircle, ListOrdered, UserMinus, Share2, Copy, Link as LinkIcon, ChevronDown, ChevronUp, Printer, X, ArrowLeft, Flag, LogOut, Video, Search, ScrollText, Download, ArrowLeftRight, ImageIcon, Paintbrush, Euro } from "lucide-react";
import { BncIcon } from "@/components/icons/BncIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TournamentBracketManager } from "@/components/tournaments/TournamentBracketManager";
import { SwissRoundView } from "@/components/tournaments/SwissRoundView";
import { TopCutBracket } from "@/components/tournaments/TopCutBracket";
import { PlacementBracket } from "@/components/tournaments/PlacementBracket";
import { StandingsTable, getCompleteStandingsOrder } from "@/components/tournaments/StandingsTable";
import { ParentRegistrationDialog } from "@/components/tournaments/ParentRegistrationDialog";
import { AddFictionalPlayers } from "@/components/tournaments/AddFictionalPlayers";
import { JoinClubDialog } from "@/components/tournaments/JoinClubDialog";
import { useParentRole, ChildProfile } from "@/hooks/useParentRole";

import { TournamentTopDecks } from "@/components/decks/TournamentTopDecks";
import { TournamentPodium } from "@/components/tournaments/TournamentPodium";
import { EventFeedbackButton } from "@/components/feedback/EventFeedbackButton";
import { TournamentPrintView } from "@/components/tournaments/TournamentPrintView";
import { TeamRegistrationDialog } from "@/components/tournaments/TeamRegistrationDialog";
import { CheckinScanner } from "@/components/tournaments/CheckinScanner";
import { CheckinQRCode } from "@/components/tournaments/CheckinQRCode";
import { TournamentActionLog } from "@/components/tournaments/TournamentActionLog";
import { TournamentAdminSections } from "@/components/tournaments/TournamentAdminSections";
import { TournamentRefereesManager } from "@/components/tournaments/TournamentRefereesManager";
import TournamentRulesEditor from "@/components/tournaments/TournamentRulesEditor";
import { TournamentBackup } from "@/components/tournaments/TournamentBackup";
import { sanitizeUserHtml } from "@/lib/sanitizeUserHtml";

interface TournamentTeam {
  id: string;
  team_name: string;
  club_id: string | null;
  created_by: string;
  is_ready: boolean;
  members: Array<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }>;
}

interface Tournament {
  id: string;
  title: string;
  description: string | null;
  location: string;
  city: string;
  event_date: string;
  registration_deadline: string;
  registration_opens_at: string | null;
  max_participants: number;
  prize_description: string | null;
  is_active: boolean;
  is_ranked: boolean;
  entry_fee: number | null;
  payment_method: string | null;
  payment_link: string | null;
  club_id: string | null;
  region_id: string | null;
  format: string | null;
  top_cut_size: number | null;
  swiss_rounds: number | null;
  status: string;
  check_in_enabled: boolean;
  tiebreaker_depth: number | null;
  groups_count: number | null;
  team_mode: string;
  image_url: string | null;
  flyer_url: string | null;
  is_external?: boolean;
  external_source?: string | null;
  clubs: { id: string; name: string; banner_url: string | null; logo_url?: string | null } | null;
  regions: { name: string } | null;
}

interface Registration {
  id: string;
  user_id: string;
  status: string;
  registered_at: string;
  is_ready: boolean;
  child_profile_id: string | null;
}

const formatLabel = (f: string | null) => {
  switch (f) {
    case "swiss_top_cut": return "Swiss + Top Cut";
    case "swiss": return "Solo Swiss";
    case "round_robin": return "Round Robin";
    case "round_robin_top_cut": return "Round Robin + Top Cut";
    case "single_elimination": return "Eliminazione Diretta";
    default: return f || "N/D";
  }
};

const groupLabel = (n: number) => String.fromCharCode(64 + n); // 1→A, 2→B, etc.

const ensureHttps = (url: string) => {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
};

const statusLabel = (s: string) => {
  switch (s) {
    case "pending": return "Iscrizioni aperte";
    case "swiss": return "Fase Swiss";
    case "pre_top_cut": return "Pre-Top Cut";
    case "top_cut": return "Top Cut";
    case "completed": return "Completato";
    default: return s;
  }
};

const TournamentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>>(new Map());
  const [isRegistered, setIsRegistered] = useState(false);
  const [readyFilter, setReadyFilter] = useState<"all" | "ready" | "not_ready">("all");
  const [confirmedSearch, setConfirmedSearch] = useState("");
  const [waitlistSearch, setWaitlistSearch] = useState("");
  const [loading, setLoading] = useState(true);
  // Ticker per ri-valutare deadline e apertura iscrizioni senza ricaricare la pagina
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNowTick(Date.now()), 30000); return () => clearInterval(i); }, []);

  const [publicMatches, setPublicMatches] = useState<any[]>([]);
  const [publicStandings, setPublicStandings] = useState<any[]>([]);
  const [publicResults, setPublicResults] = useState<any[]>([]);
  const [childProfilesMap, setChildProfilesMap] = useState<Map<string, { display_name: string; avatar_url: string | null }>>(new Map());
  const [matchDeckReports, setMatchDeckReports] = useState<Map<string, Set<string>>>(new Map());
  const [scoredByMap, setScoredByMap] = useState<Map<string, string>>(new Map());
  const [userHasRefereeBadge, setUserHasRefereeBadge] = useState(false);

  const { isStaff } = useClubRole(tournament?.club_id ?? undefined);
  const { roles } = useUserRoles();
  const isModerator = roles.includes("moderator");
  const isCreator = user?.id && (tournament as any)?.created_by === user.id;
  const canManage = isStaff || isAdmin || isModerator || isCreator;
  
  const { isParent, children: childProfiles } = useParentRole();
  const [parentDialogOpen, setParentDialogOpen] = useState(false);
  const [parentRegistering, setParentRegistering] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [publicGroupTab, setPublicGroupTab] = useState<number>(0);
  const [standingsViewMode, setStandingsViewMode] = useState<"complete" | "groups">("complete");
  const [showSwissInTopCut, setShowSwissInTopCut] = useState(true);
  const [joinClubDialogOpen, setJoinClubDialogOpen] = useState(false);
  const [suggestedClub, setSuggestedClub] = useState<any>(null);
  const [suggestedClubs, setSuggestedClubs] = useState<any[]>([]);
  const [showPrintView, setShowPrintView] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [replacingMember, setReplacingMember] = useState<{ teamId: string; userId: string; teamName: string } | null>(null);
  const [replacementSearch, setReplacementSearch] = useState("");
  const [replacementResults, setReplacementResults] = useState<Array<{ user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }>>([]);
  const [replacementSearching, setReplacementSearching] = useState(false);
  const [swapPlayerReg, setSwapPlayerReg] = useState<Registration | null>(null);
  const [swapTargetReg, setSwapTargetReg] = useState<Registration | null>(null);
  const [flyerUrlDialogOpen, setFlyerUrlDialogOpen] = useState(false);
  const [flyerUrlInput, setFlyerUrlInput] = useState("");

  // Admin replace player (works even on started/completed tournaments)
  const [adminReplaceOpen, setAdminReplaceOpen] = useState(false);
  const [adminReplaceOldUser, setAdminReplaceOldUser] = useState<{ user_id: string; name: string } | null>(null);
  const [adminReplaceSearch, setAdminReplaceSearch] = useState("");
  const [adminReplaceResults, setAdminReplaceResults] = useState<Array<{ user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }>>([]);
  const [adminReplaceNewUser, setAdminReplaceNewUser] = useState<any>(null);
  const [adminReplacing, setAdminReplacing] = useState(false);


  const handleReplacementSearch = async (query: string) => {
    setReplacementSearch(query);
    if (query.length < 2) { setReplacementResults([]); return; }
    setReplacementSearching(true);
    // Get all user_ids already in teams for this tournament
    const allTeamUserIds = new Set(teams.flatMap(t => t.members.map(m => m.user_id)));
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);
    setReplacementResults((data ?? []).filter(p => !allTeamUserIds.has(p.user_id)));
    setReplacementSearching(false);
  };

  const handleReplaceMember = async (newUserId: string) => {
    if (!replacingMember) return;
    // Remove old member, add new one
    const { data: oldMember } = await (supabase as any)
      .from("tournament_team_members")
      .select("id")
      .eq("team_id", replacingMember.teamId)
      .eq("user_id", replacingMember.userId)
      .single();
    if (oldMember) {
      await (supabase as any).from("tournament_team_members").delete().eq("id", oldMember.id);
    }
    const { error } = await (supabase as any)
      .from("tournament_team_members")
      .insert({ team_id: replacingMember.teamId, user_id: newUserId });
    if (error) {
      toast.error("Errore nella sostituzione");
    } else {
      toast.success("Membro sostituito con successo");
      fetchTournament();
    }
    setReplacingMember(null);
    setReplacementSearch("");
    setReplacementResults([]);
  };

  const handleRemoveTeamMember = (teamId: string, userId: string, teamName: string, teamSize: number) => {
    if (teamSize <= 3) {
      // Must replace, can't just remove
      setReplacingMember({ teamId, userId, teamName });
      toast.info("La squadra ha il minimo di 3 membri. Devi inserire un sostituto.");
    } else {
      // Can remove directly (team goes from 4 to 3)
      (async () => {
        const { data: member } = await (supabase as any)
          .from("tournament_team_members")
          .select("id")
          .eq("team_id", teamId)
          .eq("user_id", userId)
          .single();
        if (member) {
          await (supabase as any).from("tournament_team_members").delete().eq("id", member.id);
          toast.success("Membro rimosso dalla squadra");
          fetchTournament();
        }
      })();
    }
  };

  // Admin replace player search
  const handleAdminReplaceSearch = async (query: string) => {
    setAdminReplaceSearch(query);
    if (query.length < 2) { setAdminReplaceResults([]); return; }
    const registeredUserIds = new Set(registrations.map(r => r.user_id));
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);
    setAdminReplaceResults((data ?? []).filter(p => !registeredUserIds.has(p.user_id)));
  };

  // Admin replace player handler
  const handleAdminReplacePlayer = async () => {
    if (!adminReplaceOldUser || !adminReplaceNewUser || !id) return;
    setAdminReplacing(true);
    const { error } = await supabase.rpc("admin_replace_tournament_player" as any, {
      _tournament_id: id,
      _old_user_id: adminReplaceOldUser.user_id,
      _new_user_id: adminReplaceNewUser.user_id,
    });
    if (error) {
      toast.error("Errore: " + error.message);
      setAdminReplacing(false);
      return;
    }
    // Recalculate standings
    await supabase.rpc("recalc_tournament_standings" as any, { _tournament_id: id });
    // If tournament is completed, recalculate rankings
    if (tournament?.status === "completed") {
      await supabase.rpc("finalize_tournament_points" as any, { _tournament_id: id });
      const { data: activeSeason } = await supabase
        .from("ranking_seasons")
        .select("bfl, monthly_bfl_enabled, monthly_bfl")
        .eq("is_active", true)
        .maybeSingle();
      await supabase.rpc("recalculate_all_rankings", { _bfl: activeSeason?.bfl ?? 10, _monthly_bfl_enabled: !!(activeSeason as any)?.monthly_bfl_enabled, _monthly_bfl: (activeSeason as any)?.monthly_bfl ?? 2 } as any);
    }
    toast.success(`${adminReplaceOldUser.name} sostituito con ${adminReplaceNewUser.display_name || adminReplaceNewUser.username}!`);
    setAdminReplacing(false);
    setAdminReplaceOpen(false);
    setAdminReplaceOldUser(null);
    setAdminReplaceNewUser(null);
    setAdminReplaceSearch("");
    setAdminReplaceResults([]);
    fetchTournament();
  };

  // Soft cancel: marks the tournament as inactive but keeps all data
  const handleDeleteTournament = async () => {
    if (!id) return;

    const { error } = await supabase
      .from("tournaments")
      .update({ is_active: false } as any)
      .eq("id", id);
    if (error) {
      toast.error("Errore nell'annullamento del torneo");
      return;
    }

    // If tournament was completed, recalc rankings now that it's excluded
    if (tournament?.status === "completed") {
      const { data: activeSeason } = await supabase
        .from("ranking_seasons")
        .select("bfl, monthly_bfl_enabled, monthly_bfl")
        .eq("is_active", true)
        .maybeSingle();
      await supabase.rpc("recalculate_all_rankings", { _bfl: activeSeason?.bfl ?? 10, _monthly_bfl_enabled: !!(activeSeason as any)?.monthly_bfl_enabled, _monthly_bfl: (activeSeason as any)?.monthly_bfl ?? 2 } as any);
    }

    toast.success("Torneo annullato. Puoi eliminarlo definitivamente o convertirlo in un nuovo torneo dalla scheda.");
    fetchTournament();
  };

  // Hard delete: permanently removes the tournament and all related data
  const handleHardDeleteTournament = async () => {
    if (!id) return;

    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("tournament_matches").delete().eq("tournament_id", id),
      supabase.from("tournament_standings").delete().eq("tournament_id", id),
      supabase.from("tournament_registrations").delete().eq("tournament_id", id),
      supabase.from("tournament_results").delete().eq("tournament_id", id),
    ]);

    if (r1.error || r2.error || r3.error || r4.error) {
      toast.error("Errore nella pulizia dati torneo");
      return;
    }

    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) {
      toast.error("Errore nell'eliminazione del torneo");
      return;
    }

    const { data: activeSeason } = await supabase
      .from("ranking_seasons")
      .select("bfl, monthly_bfl_enabled, monthly_bfl")
      .eq("is_active", true)
      .maybeSingle();

    await supabase.rpc("recalculate_all_rankings", { _bfl: activeSeason?.bfl ?? 10, _monthly_bfl_enabled: !!(activeSeason as any)?.monthly_bfl_enabled, _monthly_bfl: (activeSeason as any)?.monthly_bfl ?? 2 } as any);

    toast.success("Torneo eliminato definitivamente");
    navigate("/tournaments");
  };

  // Convert a cancelled tournament back into a fresh, playable one
  const handleConvertToNewTournament = async () => {
    if (!id) return;

    // Wipe all match/standings/results data, keep registrations? Per request: "torneo nuovo che va giocato con date nuove" → wipe matches/standings/results, keep registrations only if user wants.
    // We wipe everything related so the tournament starts truly fresh; admin can re-add players.
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("tournament_matches").delete().eq("tournament_id", id),
      supabase.from("tournament_standings").delete().eq("tournament_id", id),
      supabase.from("tournament_registrations").delete().eq("tournament_id", id),
      supabase.from("tournament_results").delete().eq("tournament_id", id),
    ]);
    if (r1.error || r2.error || r3.error || r4.error) {
      toast.error("Errore nel reset dei dati torneo");
      return;
    }

    const { error } = await supabase
      .from("tournaments")
      .update({
        is_active: true,
        status: "pending",
        current_round: 0,
      } as any)
      .eq("id", id);
    if (error) {
      toast.error("Errore nella conversione del torneo");
      return;
    }

    toast.success("Torneo riattivato! Aggiorna data, orario e impostazioni nelle impostazioni.");
    fetchTournament();
  };

  useEffect(() => {
    if (id) fetchTournament();
  }, [id]);

  // Set default publicGroupTab based on tournament config
  useEffect(() => {
    if (!tournament) return;
    const groups = (tournament as any).groups_count ?? 0;
    if (groups > 0) {
      setPublicGroupTab(1);
    } else {
      setPublicGroupTab(0);
    }
  }, [tournament?.id]);

  // Listen for match deck updates - only refetch deck reports, not the entire tournament
  useEffect(() => {
    const handler = async () => {
      if (!id) return;
      // Only refetch deck reports - much cheaper than full fetchTournament
      const matchIds = publicMatches.map((m: any) => m.id);
      if (matchIds.length === 0) return;
      const { data: deckReports } = await (supabase as any)
        .from("tournament_match_decks")
        .select("match_id, user_id")
        .in("match_id", matchIds);
      const dMap = new Map<string, Set<string>>();
      (deckReports ?? []).forEach((r: any) => {
        if (!dMap.has(r.match_id)) dMap.set(r.match_id, new Set());
        dMap.get(r.match_id)!.add(r.user_id);
      });
      setMatchDeckReports(dMap);
    };
    window.addEventListener("match-deck-updated", handler);
    return () => window.removeEventListener("match-deck-updated", handler);
  }, [id, publicMatches]);

  // Check if user has Judge/Head Judge badge OR is in this tournament's referee list
  // (manual referees + club staff of the hosting club both count as referees for scoring)
  useEffect(() => {
    if (!user || !id) { setUserHasRefereeBadge(false); return; }
    const JUDGE_BADGE_IDS = ["e3464fd5-2572-46b9-9fa6-ccb1a18e5ca1", "bf309168-a73c-451b-88a9-f56c18a4315f"];
    (async () => {
      // 1) Global Judge/Head Judge badge
      const { data: badges } = await (supabase as any)
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", user.id)
        .in("badge_id", JUDGE_BADGE_IDS)
        .limit(1);
      if ((badges ?? []).length > 0) { setUserHasRefereeBadge(true); return; }

      // 2) Manually added referee for this tournament
      const { data: ref } = await (supabase as any)
        .from("tournament_referees")
        .select("id")
        .eq("tournament_id", id)
        .eq("user_id", user.id)
        .limit(1);
      if ((ref ?? []).length > 0) { setUserHasRefereeBadge(true); return; }

      // 3) Club staff (owner/admin/staff) of the hosting club
      const clubId = (tournament as any)?.club_id;
      if (clubId) {
        const { data: cm } = await (supabase as any)
          .from("club_members")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .in("role", ["owner", "admin", "staff"])
          .limit(1);
        if ((cm ?? []).length > 0) { setUserHasRefereeBadge(true); return; }
      }

      setUserHasRefereeBadge(false);
    })();
  }, [user, id, (tournament as any)?.club_id]);

  useEffect(() => {
    if (user && registrations.length > 0) {
      setIsRegistered(registrations.some((r) => r.user_id === user.id && !r.child_profile_id && r.status !== "cancelled"));
    }
  }, [user, registrations]);

  const fetchTournament = async () => {
    const [tRes, rRes, mRes, sRes] = await Promise.all([
      supabase.from("tournaments").select("*, clubs(id, name, banner_url, logo_url), regions(name)").eq("id", id!).single(),
      supabase
        .from("tournament_registrations")
        .select("id, user_id, status, registered_at, is_ready, child_profile_id")
        .eq("tournament_id", id!)
        .neq("status", "cancelled")
        .order("registered_at"),
      supabase
        .from("tournament_matches")
        .select("id, tournament_id, round, match_number, player1_id, player2_id, player1_score, player2_score, winner_id, status, phase, group_number, scored_by, created_at, updated_at")
        .eq("tournament_id", id!)
        .order("round")
        .order("match_number"),
      supabase
        .from("tournament_standings")
        .select("id, tournament_id, user_id, wins, losses, draws, points, resistance, game_wins, game_losses, dropped, seed, group_number, created_at, updated_at")
        .eq("tournament_id", id!)
        .order("points", { ascending: false })
        .order("resistance", { ascending: false }),
    ]);

    if (tRes.data) {
      setTournament(tRes.data as any);
      // Default view: if tournament is currently in top_cut → show Top Cut, otherwise Swiss
      const st = (tRes.data as any).status;
      setShowSwissInTopCut(st !== "top_cut");
    }
    
    const regs = (rRes.data as Registration[]) ?? [];
    setRegistrations(regs);

    // Fetch profiles separately for all registered user_ids
    if (regs.length > 0) {
      const userIds = [...new Set(regs.map((r) => r.user_id))];
      const childIds = regs.filter(r => r.child_profile_id).map(r => r.child_profile_id!);

      // Batch IN() queries to avoid URL length limits (200+ UUIDs would exceed proxy/CDN caps)
      const CHUNK = 80;
      const idChunks: string[][] = [];
      for (let i = 0; i < userIds.length; i += CHUNK) idChunks.push(userIds.slice(i, i + CHUNK));

      const [profilesChunks, childRes] = await Promise.all([
        Promise.all(
          idChunks.map((chunk) =>
            supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", chunk)
          )
        ),
        childIds.length > 0
          ? (supabase as any).rpc("get_tournament_child_profiles", { _tournament_id: id })
          : Promise.resolve({ data: [] }),
      ]);

      const profiles = profilesChunks.flatMap((r: any) => r.data ?? []);

      const map = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
      (profiles ?? []).forEach((p: any) => {
        map.set(p.user_id, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url });
      });
      setProfilesMap(map);

      const cMap = new Map<string, { display_name: string; avatar_url: string | null }>();
      ((childRes as any)?.data ?? []).forEach((c: any) => {
        cMap.set(c.id, { display_name: c.display_name, avatar_url: c.avatar_url });
      });
      setChildProfilesMap(cMap);
    }

    setPublicMatches(mRes.data ?? []);

    // Parallelize scored_by profiles + deck reports + ranking results
    const matchIds = (mRes.data ?? []).map((m: any) => m.id);
    const scoredByIds = [...new Set((mRes.data ?? []).filter((m: any) => m.scored_by).map((m: any) => m.scored_by as string))];

    const [refProfilesRes, deckReportsRes, resultsRes] = await Promise.all([
      scoredByIds.length > 0
        ? supabase.from("profiles").select("user_id, display_name").in("user_id", scoredByIds)
        : Promise.resolve({ data: [] as any[] }),
      matchIds.length > 0
        ? (supabase as any).from("tournament_match_decks").select("match_id, user_id").in("match_id", matchIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("tournament_results")
        .select("user_id, placement, scaled_points, base_points, participants_count")
        .eq("tournament_id", id!),
    ]);

    const sbMap = new Map<string, string>();
    (refProfilesRes.data ?? []).forEach((p: any) => sbMap.set(p.user_id, p.display_name || "Arbitro"));
    setScoredByMap(sbMap);

    setPublicStandings(sRes.data ?? []);
    setPublicResults((resultsRes as any)?.data ?? []);

    const dMap = new Map<string, Set<string>>();
    (deckReportsRes.data ?? []).forEach((r: any) => {
      if (!dMap.has(r.match_id)) dMap.set(r.match_id, new Set());
      dMap.get(r.match_id)!.add(r.user_id);
    });
    setMatchDeckReports(dMap);

    // Fetch teams for team tournaments
    const tournamentData = tRes.data as any;
    if (tournamentData && tournamentData.team_mode && tournamentData.team_mode !== "solo") {
      const { data: teamsData } = await supabase
        .from("tournament_teams")
        .select("id, team_name, club_id, created_by, is_ready")
        .eq("tournament_id", id!);

      if (teamsData && teamsData.length > 0) {
        const teamIds = teamsData.map((t: any) => t.id);
        const { data: teamMembersData } = await supabase
          .from("tournament_team_members")
          .select("team_id, user_id")
          .in("team_id", teamIds);

        const memberUserIds = [...new Set((teamMembersData ?? []).map((m: any) => m.user_id))];
        const { data: memberProfiles } = memberUserIds.length > 0
          ? await supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", memberUserIds)
          : { data: [] };

        const profileMap = new Map<string, any>();
        (memberProfiles ?? []).forEach((p: any) => profileMap.set(p.user_id, p));

        const enrichedTeams: TournamentTeam[] = teamsData.map((t: any) => ({
          ...t,
          members: (teamMembersData ?? [])
            .filter((m: any) => m.team_id === t.id)
            .map((m: any) => ({
              user_id: m.user_id,
              ...(profileMap.get(m.user_id) || { display_name: null, username: null, avatar_url: null }),
            })),
        }));
        setTeams(enrichedTeams);

        // Also add team member profiles to the main profiles map for bracket display
        (memberProfiles ?? []).forEach((p: any) => {
          if (!profilesMap.has(p.user_id)) {
            profilesMap.set(p.user_id, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url });
          }
        });
      } else {
        setTeams([]);
      }
    } else {
      setTeams([]);
    }

    setLoading(false);
  };

  const getPlayerName = (userId: string) => {
    const p = profilesMap.get(userId);
    return p?.display_name || p?.username || "Utente";
  };

  const getRegPlayerName = (r: Registration) => {
    if (r.child_profile_id) {
      return childProfilesMap.get(r.child_profile_id)?.display_name || "Figlio";
    }
    return getPlayerName(r.user_id);
  };

  const getRegProfileLink = (r: Registration): string | null => {
    if (r.child_profile_id) return null;
    const p = profilesMap.get(r.user_id);
    return p?.username ? `/profilo/${p.username}` : null;
  };

  const PlayerNameLink = ({ r, className }: { r: Registration; className?: string }) => {
    const link = getRegProfileLink(r);
    const name = getRegPlayerName(r);
    if (link) {
      return (
        <Link to={link} className={`${className || ""} hover:underline hover:text-primary transition-colors`}>
          {name}
          {r.child_profile_id && <span className="text-[9px] text-muted-foreground ml-1">(figlio)</span>}
        </Link>
      );
    }
    return (
      <span className={className}>
        {name}
        {r.child_profile_id && <span className="text-[9px] text-muted-foreground ml-1">(figlio)</span>}
      </span>
    );
  };

  const getRegAvatarUrl = (r: Registration) => {
    if (r.child_profile_id) {
      return childProfilesMap.get(r.child_profile_id)?.avatar_url ?? null;
    }
    return profilesMap.get(r.user_id)?.avatar_url ?? null;
  };

  const handleRegister = async () => {
    if (!user || !id || !tournament) return;
    if (registering) return;
    setRegistering(true);
    try {
      await doHandleRegister();
    } finally {
      setRegistering(false);
    }
  };

  const doHandleRegister = async () => {
    if (!user || !id || !tournament) return;

    // Check club membership for ranked tournaments
    if (tournament.is_ranked) {
      const { count: membershipCount } = await supabase
        .from("club_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!membershipCount || membershipCount === 0) {
        // Find clubs — fetch only needed fields, limit to active clubs
        const [{ data: profile }, { data: clubs }] = await Promise.all([
          supabase.from("profiles").select("city, region_id").eq("user_id", user.id).maybeSingle(),
          supabase.from("clubs").select("id, name, city, logo_url, description, latitude, longitude, region_id").eq("is_active", true),
        ]);

        let nearestClub = null;
        const suggestionList: any[] = [];

        if (clubs && clubs.length > 0) {
          // Find the organizer club
          const organizerClub = tournament.club_id ? clubs.find(c => c.id === tournament.club_id) : null;

          // Prefer clubs in same region first, then by name
          if (profile?.region_id) {
            nearestClub = clubs.find(c => c.region_id === profile.region_id && c.id !== tournament.club_id) || null;
          }
          if (!nearestClub) {
            nearestClub = clubs.find(c => c.id !== tournament.club_id) || clubs[0];
          }

          // If user has a city and clubs have coordinates, try geocoding for distance
          if (profile?.city && clubs.some(c => c.latitude)) {
            try {
              const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(profile.city + ", Italia")}&format=json&limit=1`);
              const geoData = await geoRes.json();
              if (geoData.length > 0) {
                const userLat = parseFloat(geoData[0].lat);
                const userLon = parseFloat(geoData[0].lon);
                
                // Sort all clubs by distance
                const clubsWithDist = clubs.map(club => {
                  if (club.latitude && club.longitude) {
                    const R = 6371;
                    const dLat = (club.latitude - userLat) * Math.PI / 180;
                    const dLon = (club.longitude - userLon) * Math.PI / 180;
                    const a = Math.sin(dLat/2)**2 + Math.cos(userLat*Math.PI/180) * Math.cos(club.latitude*Math.PI/180) * Math.sin(dLon/2)**2;
                    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return { ...club, dist: d };
                  }
                  return { ...club, dist: 99999 };
                }).sort((a, b) => a.dist - b.dist);

                nearestClub = clubsWithDist[0];
              }
            } catch { /* fallback to region match */ }
          }

          // Build suggestion list: organizer first (highlighted), then nearest if different
          if (organizerClub) {
            suggestionList.push(organizerClub);
          }
          if (nearestClub && nearestClub.id !== organizerClub?.id) {
            suggestionList.push(nearestClub);
          }
          // If only one and it's the organizer, that's fine
          if (suggestionList.length === 0 && nearestClub) {
            suggestionList.push(nearestClub);
          }
        }

        setSuggestedClub(suggestionList[0] || nearestClub);
        setSuggestedClubs(suggestionList);
        setJoinClubDialogOpen(true);
        return;
      }
    }

    // If parent with children, show selection dialog
    if (isParent && childProfiles.length > 0) {
      setParentDialogOpen(true);
      return;
    }
    // Fresh count from DB to avoid race conditions
    const isPaidTournament = (tournament.entry_fee ?? 0) > 0 || !!tournament.payment_method?.trim();
    const occupiedStatuses = isPaidTournament ? ["confirmed", "pending_payment"] : ["confirmed"];
    const { count: freshCount } = await supabase
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", id)
      .in("status", occupiedStatuses);
    const occupiedCount = freshCount ?? 0;
    const hasWaitlist = (tournament as any).has_waitlist !== false;
    const isFull = occupiedCount >= tournament.max_participants;
    if (isFull && !hasWaitlist) {
      toast.error("Posti esauriti! Le iscrizioni sono chiuse.");
      return;
    }
    const status = isPaidTournament
      ? (isFull ? "waitlist" : "pending_payment")
      : (isFull ? "waitlist" : "confirmed");
    const { error } = await supabase.from("tournament_registrations").insert({
      tournament_id: id,
      user_id: user.id,
      status,
    });
    if (error) {
      if (error.code === 'P0001' || error.message?.includes('maximum participants')) {
        toast.error("Posti esauriti! Sei stato messo in lista d'attesa.");
      } else {
        toast.error(error.code === "23505" ? "Sei già iscritto" : "Errore nell'iscrizione");
      }
    } else {
      toast.success(
        isPaidTournament
          ? (isFull ? "Sei in lista d'attesa!" : "Iscrizione registrata! In attesa di conferma pagamento.")
          : (isFull ? "Sei in lista d'attesa!" : "Iscrizione completata!")
      );
      fetchTournament();
    }
  };

  const handleParentRegistration = async (registerSelf: boolean, childIds: string[]) => {
    if (!user || !id || !tournament) return;
    // Fresh count from DB
    const isPaidTournament = (tournament.entry_fee ?? 0) > 0 || !!tournament.payment_method?.trim();
    const occupiedStatuses = isPaidTournament ? ["confirmed", "pending_payment"] : ["confirmed"];
    const { count: freshOccupied } = await supabase
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", id)
      .in("status", occupiedStatuses);
    const occupiedCount = freshOccupied ?? 0;
    const hasWaitlist = (tournament as any).has_waitlist !== false;
    let spotsUsed = 0;
    let errors = 0;

    const pickStatus = (): string => {
      const isFull = (occupiedCount + spotsUsed) >= tournament.max_participants;
      if (isPaidTournament) return isFull ? "waitlist" : "pending_payment";
      return isFull ? "waitlist" : "confirmed";
    };

    if (registerSelf) {
      const isFull = (occupiedCount + spotsUsed) >= tournament.max_participants;
      if (isFull && !hasWaitlist) { toast.error("Posti esauriti!"); setParentRegistering(false); setParentDialogOpen(false); return; }
      const status = pickStatus();
      const { error } = await supabase.from("tournament_registrations").insert({
        tournament_id: id,
        user_id: user.id,
        status,
      });
      if (error) errors++;
      else spotsUsed++;
    }

    for (const childId of childIds) {
      const isFull = (occupiedCount + spotsUsed) >= tournament.max_participants;
      if (isFull && !hasWaitlist) break;
      const status = pickStatus();
      const { error } = await (supabase as any).from("tournament_registrations").insert({
        tournament_id: id,
        user_id: user.id,
        child_profile_id: childId,
        status,
      });
      if (error) errors++;
      else spotsUsed++;
    }

    setParentRegistering(false);
    setParentDialogOpen(false);

    if (errors > 0) {
      toast.error("Alcune iscrizioni non sono andate a buon fine (possibili duplicati)");
    } else {
      toast.success(`${spotsUsed} iscrizione/i completata/e!`);
    }
    fetchTournament();
  };

  const promoteFromWaitlist = async () => {
    if (!id || !tournament) return;
    const isPaid = (tournament.entry_fee ?? 0) > 0 || !!tournament.payment_method?.trim();
    const statusesToFetch = isPaid
      ? ["confirmed", "pending_payment", "waitlist"]
      : ["confirmed", "waitlist"];
    const { data: regs } = await supabase
      .from("tournament_registrations")
      .select("id, status, registered_at")
      .eq("tournament_id", id)
      .in("status", statusesToFetch);
    if (!regs) return;
    const max = tournament.max_participants;
    const confirmedCount = regs.filter((r: any) => r.status === "confirmed").length;
    if (isPaid) {
      const pendingCount = regs.filter((r: any) => r.status === "pending_payment").length;
      const need = max - confirmedCount - pendingCount;
      if (need <= 0) return;
      const toPromote = regs
        .filter((r: any) => r.status === "waitlist")
        .sort((a: any, b: any) => +new Date(a.registered_at) - +new Date(b.registered_at))
        .slice(0, need);
      if (toPromote.length === 0) return;
      await supabase
        .from("tournament_registrations")
        .update({ status: "pending_payment" })
        .in("id", toPromote.map((r: any) => r.id));
    } else {
      const need = max - confirmedCount;
      if (need <= 0) return;
      const toPromote = regs
        .filter((r: any) => r.status === "waitlist")
        .sort((a: any, b: any) => +new Date(a.registered_at) - +new Date(b.registered_at))
        .slice(0, need);
      if (toPromote.length === 0) return;
      await supabase
        .from("tournament_registrations")
        .update({ status: "confirmed" })
        .in("id", toPromote.map((r: any) => r.id));
    }
  };

  const handleUnregister = async () => {
    if (!user || !id) return;
    const { error } = await supabase
      .from("tournament_registrations")
      .delete()
      .eq("tournament_id", id)
      .eq("user_id", user.id)
      .is("child_profile_id", null);
    if (error) {
      console.error("Unregister error", error);
      toast.error(`Impossibile annullare l'iscrizione: ${error.message}`);
      return;
    }
    toast.success("Iscrizione annullata");
    await promoteFromWaitlist();
    fetchTournament();
  };

  const handleRemovePlayer = async (regId: string, playerName: string) => {
    const { error } = await supabase.from("tournament_registrations").delete().eq("id", regId);
    if (error) {
      toast.error("Errore nella rimozione");
    } else {
      toast.success(`${playerName} rimosso dal torneo`);
      await promoteFromWaitlist();
      fetchTournament();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-24 text-center text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-24 text-center text-muted-foreground">Torneo non trovato.</div>
      </div>
    );
  }

  const _now = new Date(nowTick);
  const deadlinePassed = new Date(tournament.registration_deadline) < _now;
  const registrationNotOpenYet = !!tournament.registration_opens_at && new Date(tournament.registration_opens_at) > _now;
  const isPaidTournament = (tournament.entry_fee ?? 0) > 0 || !!tournament.payment_method?.trim();
  const nameCollator = new Intl.Collator("it", { sensitivity: "base" });
  const confirmedRegs = registrations
    .filter(r => r.status === "confirmed")
    .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
  const pendingPaymentByDate = registrations
    .filter(r => r.status === "pending_payment")
    .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
  const trueWaitlistRegs = registrations
    .filter(r => r.status === "waitlist")
    .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
  const spotsLeft = tournament.max_participants - confirmedRegs.length - pendingPaymentByDate.length;
  const pendingPaymentRegs = pendingPaymentByDate;
  // Combined waitlist for the admin "swap player" dialog (pending-payment first, then true waitlist)
  const waitlistRegs = [...pendingPaymentByDate, ...trueWaitlistRegs];
  const isStarted = tournament.status !== "pending";

  // Build player map and avatar map for public viewing
  const playerMap = new Map<string, string>();
  const avatarMap = new Map<string, string | null>();
  
  const isTeamTournament = tournament.team_mode && tournament.team_mode !== "solo";
  
  if (isTeamTournament) {
    // For team tournaments, map team IDs to team names
    teams.forEach((t) => {
      playerMap.set(t.id, t.team_name);
      avatarMap.set(t.id, null);
    });
  }
  
  registrations.forEach((r) => {
    if (r.child_profile_id) {
      const child = childProfilesMap.get(r.child_profile_id);
      playerMap.set(r.child_profile_id, child?.display_name || "Figlio");
      avatarMap.set(r.child_profile_id, child?.avatar_url ?? null);
    } else {
      playerMap.set(r.user_id, getPlayerName(r.user_id));
      avatarMap.set(r.user_id, profilesMap.get(r.user_id)?.avatar_url ?? null);
    }
  });

  // Build username map for profile links
  const usernameMap = new Map<string, string>();
  profilesMap.forEach((profile, userId) => {
    if (profile.username) usernameMap.set(userId, profile.username);
  });

  const swissMatches = publicMatches.filter((m: any) => m.phase === "swiss" && m.group_number !== 99);
  const u12SwissMatches = publicMatches.filter((m: any) => m.phase === "swiss" && m.group_number === 99);
  const preTopCutMatches = publicMatches.filter((m: any) => m.phase === "pre_top_cut");
  const topCutMatches = publicMatches.filter((m: any) => m.phase === "top_cut");
  const u12TopCutMatches = publicMatches.filter((m: any) => m.phase === "u12_top_cut");
  const tiebreakerMatches = publicMatches.filter((m: any) => m.phase === "tiebreaker");
  const topCutFinalRound = topCutMatches.length > 0 ? Math.max(...topCutMatches.map((m: any) => m.round)) : 0;
  const thirdPlaceMatch = topCutMatches.find((m: any) => m.round === topCutFinalRound && m.match_number === 2);
  const mainTopCutMatches = thirdPlaceMatch ? topCutMatches.filter((m: any) => m.id !== thirdPlaceMatch.id) : topCutMatches;

  const generatePublicPlacementMatches = async (sourceRound: number) => {
    const tiebreakerDepth = (tournament as any)?.tiebreaker_depth ?? 0;
    if (!id || tiebreakerDepth <= 0) return;

    const [{ data: topCutRoundMatches }, { data: allTopCutMatches }, { data: existingTiebreakers }] = await Promise.all([
      supabase
        .from("tournament_matches")
        .select("id, round, match_number, player1_id, player2_id, winner_id, status")
        .eq("tournament_id", id)
        .eq("phase", "top_cut")
        .eq("round", sourceRound),
      supabase
        .from("tournament_matches")
        .select("round, match_number")
        .eq("tournament_id", id)
        .eq("phase", "top_cut"),
      supabase
        .from("tournament_matches")
        .select("player1_id, player2_id")
        .eq("tournament_id", id)
        .eq("phase", "tiebreaker")
        .eq("round", sourceRound),
    ]);

    if (!topCutRoundMatches?.length || !allTopCutMatches?.length) return;

    const finalRound = Math.max(...allTopCutMatches.map((m: any) => m.round));
    if (sourceRound >= finalRound) return;

    const roundsFromFinal = finalRound - sourceRound;
    const placementStart = roundsFromFinal === 1 ? 3 : Math.pow(2, roundsFromFinal) + 1;
    if (placementStart > tiebreakerDepth) return;

    const thirdPlaceExists = allTopCutMatches.some((m: any) => m.round === finalRound && m.match_number === 2);
    if (roundsFromFinal === 1 && thirdPlaceExists) return;

    const realMatches = topCutRoundMatches.filter((m: any) => m.player1_id && m.player2_id);
    if (realMatches.length < 2 || realMatches.some((m: any) => m.status !== "completed" || !m.winner_id)) return;

    const losers = realMatches
      .map((m: any) => (m.player1_id === m.winner_id ? m.player2_id : m.player1_id))
      .filter(Boolean) as string[];

    const alreadyPaired = new Set<string>();
    (existingTiebreakers ?? []).forEach((m: any) => {
      if (m.player1_id) alreadyPaired.add(m.player1_id);
      if (m.player2_id) alreadyPaired.add(m.player2_id);
    });

    const inserts = [] as Array<Record<string, any>>;
    const unpairedLosers = losers.filter((loserId) => !alreadyPaired.has(loserId));
    const existingCount = existingTiebreakers?.length ?? 0;

    const completeOrder = getCompleteStandingsOrder(publicStandings as any[], publicMatches as any[], (tournament as any)?.enabled_tiebreakers ?? undefined);
    const orderIndex = new Map(completeOrder.map((userId, index) => [userId, index]));

    unpairedLosers.sort(
      (a, b) => (orderIndex.get(a) ?? Number.POSITIVE_INFINITY) - (orderIndex.get(b) ?? Number.POSITIVE_INFINITY)
    );

    const tiebreakerMode = (tournament as any)?.tiebreaker_mode ?? "advanced";
    const K = unpairedLosers.length;
    for (let i = 0; i + 1 < K; i += 2) {
      const ps = placementStart + i;
      const meta: any = {
        tb_top_cut_round: sourceRound,
        tb_group_path: "root",
        tb_group_size: tiebreakerMode === "rapid" ? 2 : K,
        tb_placement_start: tiebreakerMode === "rapid" ? ps : placementStart,
        tb_bracket_index: i / 2,
        tb_is_final: tiebreakerMode === "rapid" || K === 2,
      };
      if (meta.tb_is_final) {
        meta.tb_placement_winner = tiebreakerMode === "rapid" ? ps : placementStart;
        meta.tb_placement_loser = (tiebreakerMode === "rapid" ? ps : placementStart) + 1;
      }
      if (tiebreakerMode === "rapid") meta.tb_mode = "rapid";
      inserts.push({
        tournament_id: id,
        round: sourceRound,
        phase: "tiebreaker",
        match_number: existingCount + Math.floor(i / 2) + 1,
        player1_id: unpairedLosers[i],
        player2_id: unpairedLosers[i + 1],
        status: "pending",
        pairing_meta: meta,
      });
    }

    if (inserts.length > 0) {
      await supabase.from("tournament_matches").insert(inserts as any);
    }
  };

  // --- Staff match scoring from public bracket view ---
  const handlePublicMatchResult = async (matchId: string, winnerId: string | null, p1Score: number, p2Score: number) => {
    const match = publicMatches.find((m: any) => m.id === matchId);
    const { error } = await supabase
      .from("tournament_matches")
      .update({ winner_id: winnerId, player1_score: p1Score, player2_score: p2Score, status: "completed", scored_by: user?.id ?? null } as any)
      .eq("id", matchId);
    if (error) {
      toast.error("Errore nel salvataggio del risultato");
      return;
    }

    // Optimistically update local state so tab switching doesn't lose the result
    setPublicMatches(prev => {
      let updated = prev.map((m: any) =>
        m.id === matchId ? { ...m, winner_id: winnerId, player1_score: p1Score, player2_score: p2Score, status: "completed" } : m
      );
      // For top_cut matches, advance winner to next round
      if (match && match.phase === "top_cut" && winnerId) {
        const nextRound = match.round + 1;
        const nextMatchNumber = Math.ceil(match.match_number / 2);
        const isPlayer1Slot = match.match_number % 2 === 1;
        const nextMatch = prev.find(
          (m: any) => m.phase === "top_cut" && m.round === nextRound && m.match_number === nextMatchNumber
        );
        if (nextMatch) {
          const field = isPlayer1Slot ? "player1_id" : "player2_id";
          updated = updated.map((m: any) =>
            m.id === nextMatch.id ? { ...m, [field]: winnerId } : m
          );
        }
      }
      return updated;
    });

    // For top_cut matches, also persist advancement to DB
    if (match && match.phase === "top_cut" && winnerId) {
      const nextRound = match.round + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);
      const isPlayer1Slot = match.match_number % 2 === 1;
      const nextMatch = publicMatches.find(
        (m: any) => m.phase === "top_cut" && m.round === nextRound && m.match_number === nextMatchNumber
      );
      if (nextMatch) {
        const updateField = isPlayer1Slot ? { player1_id: winnerId } : { player2_id: winnerId };
        await supabase.from("tournament_matches").update(updateField).eq("id", nextMatch.id);
      }

      const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
      const isSemifinal = match.round === topCutFinalRound - 1 && topCutFinalRound >= 2;
      if (isSemifinal && thirdPlaceMatch && loserId) {
        const loserSlot = match.match_number % 2 === 1 ? { player1_id: loserId } : { player2_id: loserId };
        await supabase.from("tournament_matches").update(loserSlot).eq("id", thirdPlaceMatch.id);
      }

      await generatePublicPlacementMatches(match.round);
    }

    toast.success("Risultato salvato!");
    fetchTournament();
  };

  const autoCompletePublicRound = async (matchIds: string[]) => {
    const pendingMatches = publicMatches.filter(
      (m: any) => matchIds.includes(m.id) && m.player1_id && m.player2_id
    );
    if (pendingMatches.length === 0) {
      toast.info("Nessun match da completare in questo turno");
      return;
    }

    const updates = pendingMatches.map((match: any) => {
      const winnerScore = 4 + Math.floor(Math.random() * 3);
      const loserScore = Math.floor(Math.random() * 4);
      const p1Wins = Math.random() > 0.5;
      return {
        id: match.id,
        winner_id: p1Wins ? match.player1_id : match.player2_id,
        player1_score: p1Wins ? winnerScore : loserScore,
        player2_score: p1Wins ? loserScore : winnerScore,
      };
    });

    await Promise.all(updates.map((u: any) =>
      supabase.from("tournament_matches").update({
        winner_id: u.winner_id, player1_score: u.player1_score, player2_score: u.player2_score, status: "completed",
      }).eq("id", u.id)
    ));

    toast.success("Match completati automaticamente!");
    fetchTournament();
  };

  const handlePublicUndoMatch = async (matchId: string) => {
    const match = publicMatches.find((m: any) => m.id === matchId);
    if (!match || match.status !== "completed") return;

    // For top_cut, clear winner from next round
    if (match.phase === "top_cut" && match.winner_id) {
      const nextRound = match.round + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);
      const isPlayer1Slot = match.match_number % 2 === 1;
      const nextMatch = publicMatches.find(
        (m: any) => m.phase === "top_cut" && m.round === nextRound && m.match_number === nextMatchNumber
      );
      if (nextMatch) {
        const clearField = isPlayer1Slot ? { player1_id: null } : { player2_id: null };
        await supabase.from("tournament_matches").update(clearField).eq("id", nextMatch.id);
      }

      const loserId = match.player1_id === match.winner_id ? match.player2_id : match.player1_id;
      const isSemifinal = match.round === topCutFinalRound - 1 && topCutFinalRound >= 2;
      if (isSemifinal && thirdPlaceMatch) {
        const loserSlotClear = match.match_number % 2 === 1 ? { player1_id: null } : { player2_id: null };
        await supabase.from("tournament_matches").update(loserSlotClear).eq("id", thirdPlaceMatch.id);
      }

      if (((tournament as any)?.tiebreaker_depth ?? 0) > 0 && id) {
        const { data: tbMatches } = await supabase
          .from("tournament_matches")
          .select("id")
          .eq("tournament_id", id)
          .eq("phase", "tiebreaker")
          .or(`round.eq.${match.round}${loserId ? `,player1_id.eq.${loserId},player2_id.eq.${loserId}` : ""}`);

        if (tbMatches?.length) {
          await supabase.from("tournament_matches").delete().in("id", tbMatches.map((tb: any) => tb.id));
        }
      }
    }

    const { error } = await supabase
      .from("tournament_matches")
      .update({ winner_id: null, player1_score: 0, player2_score: 0, status: "pending" })
      .eq("id", matchId);
    if (error) {
      toast.error("Errore nell'annullamento");
      return;
    }
    toast.success("Match annullato");
    fetchTournament();
  };

  // --- Forfeit match (player gives up a single match) ---
  const handleForfeitMatch = async (matchId: string, forfeitingPlayerId: string) => {
    const match = publicMatches.find((m: any) => m.id === matchId);
    if (!match || match.status !== "pending") return;

    const winnerId = match.player1_id === forfeitingPlayerId ? match.player2_id : match.player1_id;
    if (!winnerId) return;

    const { error } = await supabase
      .from("tournament_matches")
      .update({ winner_id: winnerId, player1_score: 0, player2_score: 0, status: "completed" })
      .eq("id", matchId);
    if (error) {
      toast.error("Errore nel forfeit");
      return;
    }
    toast.success("Forfeit registrato");
    fetchTournament();
  };

  // --- Staff/Admin: Forfeit a specific player (drop + auto-forfeit pending matches) ---
  const handleStaffForfeitPlayer = async (playerUserId: string, playerName: string) => {
    if (!id) return;
    // Mark as dropped so they won't be paired in subsequent rounds
    const { error: dropError } = await supabase
      .from("tournament_standings")
      .update({ dropped: true })
      .eq("tournament_id", id)
      .eq("user_id", playerUserId);
    if (dropError) {
      toast.error("Errore nel forfeit");
      return;
    }

    // Auto-forfeit all pending matches for this player (current round)
    const pendingMatches = publicMatches.filter(
      (m: any) =>
        m.status === "pending" &&
        (m.player1_id === playerUserId || m.player2_id === playerUserId) &&
        m.player1_id &&
        m.player2_id
    );
    for (const match of pendingMatches) {
      const winnerId = match.player1_id === playerUserId ? match.player2_id : match.player1_id;
      // Convert match into a BYE for the opponent (player2_id = null) so BYE points are awarded
      await supabase
        .from("tournament_matches")
        .update({
          player1_id: winnerId,
          player2_id: null,
          winner_id: winnerId,
          player1_score: 4,
          player2_score: 0,
          status: "completed",
        })
        .eq("id", match.id);
    }

    // Recalculate standings so BYE points (4pt) are applied
    await supabase.rpc("recalc_tournament_standings" as any, { _tournament_id: id });

    toast.success(`${playerName} ha dato forfeit`);
    fetchTournament();
  };

  // --- Drop from tournament (player withdraws entirely) ---
  const handleDropFromTournament = async () => {
    if (!user || !id) return;
    // Set dropped in standings
    const { error: dropError } = await supabase
      .from("tournament_standings")
      .update({ dropped: true })
      .eq("tournament_id", id)
      .eq("user_id", user.id);
    if (dropError) {
      toast.error("Errore nel ritiro");
      return;
    }

    // Auto-forfeit all pending matches for this player
    const pendingMatches = publicMatches.filter(
      (m: any) => m.status === "pending" && (m.player1_id === user.id || m.player2_id === user.id) && m.player1_id && m.player2_id
    );
    for (const match of pendingMatches) {
      const winnerId = match.player1_id === user.id ? match.player2_id : match.player1_id;
      await supabase
        .from("tournament_matches")
        .update({
          player1_id: winnerId,
          player2_id: null,
          winner_id: winnerId,
          player1_score: 4,
          player2_score: 0,
          status: "completed",
        })
        .eq("id", match.id);
    }

    // Recalculate standings so BYE points (4pt) are applied
    await supabase.rpc("recalc_tournament_standings" as any, { _tournament_id: id });

    toast.success("Ti sei ritirato dal torneo");
    fetchTournament();
  };


  const handlePrintBracket = async () => {
    setShowPrintView(true);
    // Wait for render
    await new Promise(r => setTimeout(r, 600));
    const node = printRef.current;
    if (!node) { setShowPrintView(false); return; }
    try {
      // Temporarily make visible for capture
      node.style.opacity = "1";
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width: 1200,
        canvasWidth: 1200,
      });
      const link = document.createElement("a");
      link.download = `bracket-${tournament?.title?.replace(/\s+/g, "-") || "torneo"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Bracket esportato!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Errore nell'esportazione del bracket");
    }
    setShowPrintView(false);
  };

  // Build players array for bracket manager - use team IDs for team tournaments
  // Deduplicate by effective player ID (child_profile_id or user_id) to avoid
  // counting a parent twice when they also registered children
  const bracketPlayers = isTeamTournament
    ? teams.filter(t => t.is_ready).map((t) => ({
        user_id: t.id,
        display_name: t.team_name,
        avatar_url: null as string | null,
      }))
    : (() => {
        const seen = new Set<string>();
        const result: { user_id: string; display_name: string; avatar_url: string | null }[] = [];
        for (const r of confirmedRegs) {
          const effectiveId = r.child_profile_id || r.user_id;
          if (seen.has(effectiveId)) continue;
          seen.add(effectiveId);
          if (r.child_profile_id) {
            const child = childProfilesMap.get(r.child_profile_id);
            result.push({
              user_id: r.child_profile_id,
              display_name: child?.display_name || "Figlio",
              avatar_url: child?.avatar_url ?? null,
            });
          } else {
            result.push({
              user_id: r.user_id,
              display_name: getPlayerName(r.user_id),
              avatar_url: profilesMap.get(r.user_id)?.avatar_url ?? null,
            });
          }
        }
        return result;
      })();

  // Build all players list for admin swap in Top Cut
  const allPlayersForSwap = Array.from(playerMap.entries()).map(([id, name]) => ({ id, name }));

  const handleSwapTopCutPlayer = async (matchId: string, slot: "player1" | "player2", newPlayerId: string) => {
    const field = slot === "player1" ? { player1_id: newPlayerId } : { player2_id: newPlayerId };
    const { error } = await supabase.from("tournament_matches").update(field).eq("id", matchId);
    if (error) {
      toast.error("Errore nella sostituzione");
    } else {
      toast.success("Giocatore sostituito!");
      fetchTournament();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-3 sm:px-4 max-w-7xl 2xl:max-w-[1600px] w-full min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link
                to={tournament.club_id ? `/clubs/${tournament.club_id}` : "/tournaments"}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                {tournament.club_id ? "Torna al Club" : "Torna ai tornei"}
              </Link>
            </Button>
            <SharePreviewButton kind="tournament" id={tournament.id} />
          </div>
          {/* Flyer shown inside header card */}
          {/* Header */}
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-8 mb-6 sm:mb-8 overflow-hidden">
            <div className="flex gap-4 sm:gap-6">
              {/* Left: tournament info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge className={(tournament as any).is_ranked ? "bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0" : "bg-muted/50 text-muted-foreground border-border text-[10px] px-1.5 py-0"}>
                    {(tournament as any).is_ranked ? "RANKED" : "NORMAL"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {tournament.team_mode === "teams" ? "🤝 SQUADRE" : tournament.team_mode === "clubs" ? "🛡️ CLUB" : "👤 SOLO"}
                  </Badge>
                  {!(tournament as any).is_ranked && (tournament as any).banlist && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${(tournament as any).banlist === "hasbro" ? "border-blue-500/30 text-blue-400" : ""}`}>
                      {(tournament as any).banlist === "hasbro" ? "HASBRO" : "ALL"}
                    </Badge>
                  )}
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {formatLabel(tournament.format)}
                  </span>
                  <Badge
                    variant={tournament.status === "completed" ? "default" : "outline"}
                    className={
                      tournament.status === "swiss" || tournament.status === "top_cut"
                        ? "bg-accent/10 text-accent border-accent/20"
                        : ""
                    }
                  >
                    {statusLabel(tournament.status)}
                  </Badge>
                  {(tournament as any).is_hidden && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary bg-primary/5">
                      🔒 NASCOSTO
                    </Badge>
                  )}
                </div>

                <div className="flex items-start gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl md:text-5xl mb-4 break-words">{tournament.title}</h1>
                  {tournament.is_external && (
                    <Badge variant="outline" className="mt-2 border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px]">
                      Importato{tournament.external_source ? ` · ${tournament.external_source}` : ""}
                    </Badge>
                  )}
                </div>

                {tournament.clubs && (
                  <Link to={`/clubs/${tournament.clubs.id}`} className="inline-flex items-center gap-2 text-primary hover:underline mb-4">
                    <BncIcon name="club" size={20} />
                    <span className="text-sm font-medium">{tournament.clubs.name}</span>
                  </Link>
                )}

{tournament.description && (
                  <div 
                    className="text-muted-foreground mb-6 prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(tournament.description) }}
                  />
                )}

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <BncIcon name="calendar" size={20} className="text-primary shrink-0" />
                    <span>{format(new Date(tournament.event_date), "EEEE d MMMM yyyy, HH:mm", { locale: it })}</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tournament.location + ", " + tournament.city)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 text-muted-foreground hover:text-primary transition-colors group"
                  >
                    <MapPin size={20} className="text-primary shrink-0" />
                    <span className="group-hover:underline">{tournament.location}, {tournament.city}</span>
                  </a>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <BncIcon name="community" size={20} className="text-primary shrink-0" />
                    <span>{confirmedRegs.length}/{tournament.max_participants} iscritti{waitlistRegs.length > 0 ? ` (+${waitlistRegs.length} in attesa)` : ""}</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Clock size={20} className="text-primary shrink-0" />
                    <span>Chiusura iscrizioni: {format(new Date(tournament.registration_deadline), "d MMMM yyyy, HH:mm", { locale: it })}</span>
                  </div>
                  {tournament.registration_opens_at && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Clock size={20} className="text-primary shrink-0" />
                      <span>Apertura iscrizioni: {format(new Date(tournament.registration_opens_at), "d MMMM yyyy, HH:mm", { locale: it })}</span>
                    </div>
                  )}
                  {tournament.prize_description && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <BncIcon name="podium" size={20} className="text-primary shrink-0" />
                      <span className="font-medium">Premio: {tournament.prize_description}</span>
                    </div>
                  )}
                  {tournament.entry_fee != null && tournament.entry_fee > 0 && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-primary shrink-0 mt-0.5 text-xs font-bold w-4 text-center">€</span>
                      <span>Quota: {tournament.entry_fee}€</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Flyer image (or club banner as default) */}
              {(() => {
                const flyerSrc = tournament.flyer_url || tournament.image_url || tournament.clubs?.banner_url;
                if (!flyerSrc && !canManage) return null;
                return (
                  <div className="shrink-0 hidden sm:block max-w-[200px] md:max-w-[260px]">
                    {flyerSrc && (
                      <img
                        src={flyerSrc}
                        alt={`Locandina ${tournament.title}`}
                        className="rounded-xl border border-border w-full h-auto object-cover"
                      />
                    )}
                    {canManage && tournament.club_id && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground text-center mb-1">Locandina</p>
                        <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          title="Editor locandina"
                          onClick={() => navigate(`/clubs/${tournament.club_id}/flyer?tournament=${tournament.id}`)}
                        >
                          <Paintbrush size={14} /> Editor
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          title="Locandina esterna (URL)"
                          onClick={() => {
                            setFlyerUrlInput(tournament.flyer_url || tournament.image_url || "");
                            setFlyerUrlDialogOpen(true);
                          }}
                        >
                          <ImageIcon size={14} /> Carica
                        </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Flyer mobile (or club banner as default) */}
            {(() => {
              const flyerSrc = tournament.flyer_url || tournament.image_url || tournament.clubs?.banner_url;
              if (!flyerSrc && !canManage) return null;
              return (
                <div className="sm:hidden mt-4">
                  {flyerSrc && (
                    <img
                      src={flyerSrc}
                      alt={`Locandina ${tournament.title}`}
                      className="rounded-xl border border-border w-full max-w-xs mx-auto h-auto object-cover"
                    />
                  )}
                  {canManage && tournament.club_id && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground text-center mb-1">Locandina</p>
                      <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => navigate(`/clubs/${tournament.club_id}/flyer?tournament=${tournament.id}`)}
                      >
                        <Paintbrush size={14} /> Editor
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => {
                          setFlyerUrlInput(tournament.flyer_url || tournament.image_url || "");
                          setFlyerUrlDialogOpen(true);
                        }}
                      >
                        <ImageIcon size={14} /> Carica
                      </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Hidden full-size QR for download */}
            <div className="hidden">
              <QRCodeSVG id="tournament-qr-code" value={`${window.location.origin}/tournaments/${tournament.id}`} size={512} level="M" />
            </div>

            {/* Registration Action + QR */}
            {!isStarted && (
              <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-end justify-between gap-4">
                <div>
                {(() => {
                  const isTeamMode = tournament.team_mode && tournament.team_mode !== "solo";

                  if (isTeamMode) {
                    const myTeam = teams.find(t => t.created_by === user?.id || t.members.some(m => m.user_id === user?.id));
                    
                    if (myTeam) {
                      return (
                        <div className="space-y-2">
                          <span className="text-primary font-medium text-sm">✓ Squadra iscritta: {myTeam.team_name}</span>
                          {!myTeam.is_ready && <span className="text-xs text-muted-foreground block">In attesa di conferma dallo staff</span>}
                        </div>
                      );
                    }

                    if (deadlinePassed) {
                      return <Button variant="secondary" disabled>Iscrizioni chiuse</Button>;
                    }

                    if (registrationNotOpenYet && !canManage) {
                      return (
                        <Button variant="secondary" disabled>
                          Iscrizioni aprono il {format(new Date(tournament.registration_opens_at!), "d MMMM yyyy, HH:mm", { locale: it })}
                        </Button>
                      );
                    }

                    if (user) {
                      if (tournament.team_mode === "clubs") {
                        return (
                          <Button variant="hero" size="lg" onClick={() => setTeamDialogOpen(true)}>
                            <Shield size={16} className="mr-2" /> Iscrivi Team Club
                          </Button>
                        );
                      }
                      return (
                        <Button variant="hero" size="lg" onClick={() => setTeamDialogOpen(true)}>
                          <Users size={16} className="mr-2" /> Crea Squadra
                        </Button>
                      );
                    }

                    return (
                      <Link to="/auth">
                        <Button variant="hero" size="lg">Accedi per iscriverti</Button>
                      </Link>
                    );
                  }

                  // Solo mode
                  const myRegs = registrations.filter(r => r.user_id === user?.id && r.status !== "cancelled");
                  const selfReg = myRegs.find(r => !r.child_profile_id);
                  const childRegs = myRegs.filter(r => r.child_profile_id);
                  const hasAnyReg = myRegs.length > 0;

                  if (hasAnyReg) {
                    return (
                      <div className="space-y-2">
                        {selfReg && (
                          <div className="flex items-center gap-3">
                            {selfReg.status === "waitlist" ? (
                              <span className="text-muted-foreground font-medium text-sm">⏳ Tu — lista d'attesa</span>
                            ) : selfReg.status === "pending_payment" ? (
                              <span className="text-primary font-medium text-sm">💳 Tu — in attesa di pagamento</span>
                            ) : (
                              <span className="text-primary font-medium text-sm">✓ Tu — iscritto</span>
                            )}
                            <div className="flex items-center gap-2">
                              {tournament.check_in_enabled && selfReg.status !== "waitlist" && !isStarted && (
                                <CheckinQRCode
                                  tournamentId={tournament.id}
                                  userId={user.id}
                                  displayName={profilesMap.get(user.id)?.display_name || "Tu"}
                                  tournamentTitle={tournament.title}
                                />
                              )}
                              <Button variant="outline" size="sm" onClick={handleUnregister}>Annulla</Button>
                            </div>
                          </div>
                        )}
                        {childRegs.map((cr) => {
                          const childName = childProfilesMap.get(cr.child_profile_id!)?.display_name || "Figlio";
                          return (
                            <div key={cr.id} className="flex items-center gap-3">
                              {cr.status === "waitlist" ? (
                                <span className="text-muted-foreground font-medium text-sm">⏳ {childName} — lista d'attesa</span>
                              ) : (
                                <span className="text-primary font-medium text-sm">✓ {childName} — iscritto</span>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  await supabase.from("tournament_registrations").delete().eq("id", cr.id);
                                  toast.success(`Iscrizione di ${childName} annullata`);
                                  fetchTournament();
                                }}
                              >
                                Annulla
                              </Button>
                            </div>
                          );
                        })}
                        {isParent && !deadlinePassed && childProfiles.length > 0 && (
                          <Button variant="outline" size="sm" onClick={() => setParentDialogOpen(true)} className="mt-2">
                            Iscrivi altri
                          </Button>
                        )}
                      </div>
                    );
                  }

                  if (deadlinePassed) {
                    return <Button variant="secondary" disabled>Iscrizioni chiuse</Button>;
                  }

                  if (registrationNotOpenYet && !canManage) {
                    return (
                      <Button variant="secondary" disabled>
                        Iscrizioni aprono il {format(new Date(tournament.registration_opens_at!), "d MMMM yyyy, HH:mm", { locale: it })}
                      </Button>
                    );
                  }

                   if (user) {
                    const hasWaitlist = (tournament as any).has_waitlist !== false;
                    if (spotsLeft <= 0 && !hasWaitlist) {
                      return <Button variant="secondary" disabled>Posti esauriti</Button>;
                    }
                    return (
                      <Button variant="hero" size="lg" onClick={handleRegister} disabled={registering}>
                        {registering ? "Iscrizione..." : (spotsLeft <= 0 ? "Iscriviti in lista d'attesa" : "Iscriviti ora")}
                      </Button>
                    );
                  }

                  return (
                    <Link to="/auth">
                      <Button variant="hero" size="lg">Accedi per iscriverti</Button>
                    </Link>
                  );
                })()}
                </div>

                {/* QR + share buttons */}
                <div className="flex items-center gap-3">
                  <div className="bg-white rounded-lg p-1.5">
                    <QRCodeSVG
                      value={`${window.location.origin}/tournaments/${tournament.id}`}
                      size={56}
                      level="M"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={async () => {
                          const shareUrl = `https://ibna.it/tournaments/${tournament.id}`;
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                            toast.success("Link del torneo copiato!");
                          } catch {
                            const ta = document.createElement("textarea");
                            ta.value = shareUrl; document.body.appendChild(ta);
                            ta.select(); try { document.execCommand("copy"); toast.success("Link del torneo copiato!"); } catch { toast.error("Impossibile copiare il link"); }
                            document.body.removeChild(ta);
                          }
                        }}
                        title="Copia link"
                      >
                        <Copy size={12} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={async () => {
                          const shareUrl = `https://ibna.it/tournaments/${tournament.id}`;
                          // Only include URL in `text` (not as `url` field) to avoid duplication:
                          // many share targets append `url` automatically to the text.
                          const shareData = {
                            title: tournament.title,
                            text: `Torneo: ${tournament.title}${tournament.city ? ` - ${tournament.city}` : ""}\n${shareUrl}`,
                          };
                          if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                            try {
                              await navigator.share(shareData);
                              return;
                            } catch (err: any) {
                              if (err?.name === "AbortError") return;
                            }
                          }
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                            toast.success("Link del torneo copiato!");
                          } catch {
                            toast.error("Impossibile condividere");
                          }
                        }}
                        title="Condividi"
                      >
                        <Share2 size={12} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          const svg = document.getElementById("tournament-qr-code");
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
                            link.download = `qr-${tournament.title.replace(/\s+/g, "-")}.png`;
                            link.href = canvas.toDataURL("image/png");
                            link.click();
                          };
                          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                        }}
                        title="Salva QR"
                      >
                        <Download size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* Drop from tournament button */}
            {isRegistered && isStarted && tournament.status !== "completed" && user && (() => {
              const myStanding = publicStandings.find((s: any) => s.user_id === user.id);
              const isDropped = myStanding?.dropped;
              if (isDropped) {
                return (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Flag size={14} /> Ti sei ritirato dal torneo
                    </div>
                  </div>
                );
              }
              return (
                <div className="mt-4 pt-4 border-t border-border">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                        <LogOut size={14} /> Ritirati dal torneo
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Ritirarsi dal torneo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Verrai segnato come ritirato e tutti i tuoi match pendenti saranno forfeit. Questa azione non può essere annullata.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDropFromTournament}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Conferma Ritiro
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })()}
          </div>

          {/* Content with optional payment sidebar */}
          {(() => {
            const hasPaymentSidebar = (tournament.payment_method || "").includes("paypal") && tournament.payment_link;
            const paymentCard = hasPaymentSidebar ? (
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <h3 className="font-display text-sm flex items-center gap-2">💳 Pagamento</h3>
                {tournament.entry_fee != null && tournament.entry_fee > 0 && (
                  <p className="text-muted-foreground text-xs">Quota: <strong className="text-foreground">€{tournament.entry_fee}</strong></p>
                )}
                {isRegistered ? (
                  <>
                    <a
                      href={ensureHttps((tournament as any).payment_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      💳 Paga con PayPal
                    </a>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase">Scansiona per pagare</span>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ensureHttps((tournament as any).payment_link))}`}
                        alt="QR Code pagamento"
                        className="rounded-lg border border-border bg-white p-1.5"
                        width={140}
                        height={140}
                      />
                    </div>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        ⚠️ Inserisci il tuo <strong>username</strong> nel messaggio di pagamento. FIB non è responsabile delle transazioni esterne.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl bg-muted text-muted-foreground font-semibold text-sm opacity-60 cursor-not-allowed"
                    >
                      🔒 Paga con PayPal
                    </button>
                    <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
                      Iscriviti prima al torneo per sbloccare il pagamento.
                    </p>
                  </div>
                )}
                {((tournament as any).payment_method || "").includes("in_loco") && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                    <p className="text-[11px] text-foreground leading-relaxed">
                      💵 <strong>Pagamento in loco disponibile:</strong> puoi saldare la quota direttamente all'evento.
                    </p>
                  </div>
                )}
              </div>
            ) : null;
            return (
          <div className={`${hasPaymentSidebar ? "grid lg:grid-cols-[1fr_240px] gap-6 items-start" : ""} min-w-0`}>
          <div className="min-w-0 w-full">
          {/* Mobile payment card (above tabs) */}
          {paymentCard && <div className="lg:hidden mb-4">{paymentCard}</div>}
          {/* Tabs */}
          <Tabs defaultValue={isStarted ? "bracket" : "players"}>
            <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4 scrollbar-hide">
              <TabsList className="bg-card border border-border w-max min-w-full flex">
                <TabsTrigger value="players" className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0 sm:flex-1">
                  <Users size={14} className="mr-1 shrink-0 sm:hidden" />
                  Bladers | {confirmedRegs.length + waitlistRegs.length} (<span className="text-emerald-500">{confirmedRegs.length}</span>/<span className="text-muted-foreground">{waitlistRegs.length}</span>)
                </TabsTrigger>
                {isStarted && (
                  <TabsTrigger value="bracket" className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 sm:flex-1">
                    <Swords size={14} className="shrink-0" /> Bracket
                  </TabsTrigger>
                )}
                {isStarted && (swissMatches.length > 0 || u12SwissMatches.length > 0) && (
                  <TabsTrigger value="standings" className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 sm:flex-1">
                    <BarChart3 size={14} className="shrink-0" /> Classifica
                  </TabsTrigger>
                )}
                <TabsTrigger value="info" className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0 sm:flex-1">Info</TabsTrigger>
                {canManage && (
                  <TabsTrigger value="admin" className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 sm:flex-1">
                    <Settings size={14} className="shrink-0" /> Impostazioni
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Champion podium banner under phase switch (completed tournaments) */}
            {tournament.status === "completed" && publicStandings.length > 0 && (
              <div className="mt-6">
                <TournamentPodium
                  tournamentId={tournament.id}
                  tournamentTitle={tournament.title}
                  tournamentDate={tournament.event_date}
                  club={tournament.clubs}
                  standings={publicStandings}
                  matches={publicMatches}
                  enabledTiebreakers={(tournament as any)?.enabled_tiebreakers ?? undefined}
                  playerMap={playerMap}
                  avatarMap={avatarMap}
                  canCreateBanner={canManage}
                  isRanked={(tournament as any).is_ranked !== false}
                />
              </div>
            )}


            <TabsContent value="players" className="mt-6 space-y-6">

              {/* Scanner Check-in for staff */}
              {canManage && tournament.check_in_enabled && confirmedRegs.length > 0 && !isStarted && (
                <CheckinScanner
                  tournamentId={tournament.id}
                  registrations={confirmedRegs.map(r => ({
                    id: r.id,
                    user_id: r.user_id,
                    is_ready: r.is_ready,
                    child_profile_id: r.child_profile_id,
                  }))}
                  profileMap={profilesMap}
                  onCheckinComplete={fetchTournament}
                />
              )}

              {/* Pronti / Non Pronti now shown inline in the unified Iscritti list below */}

              {/* Add fictional players - only for NORMAL tournaments, staff/admin, before start */}
              {canManage && !isStarted && tournament.is_ranked === false && (
                <AddFictionalPlayers
                  tournamentId={tournament.id}
                  guestUserIds={Array.from(profilesMap.entries())
                    .filter(([, p]) => (p.display_name ?? "").startsWith("[Guest] "))
                    .map(([uid]) => uid)
                    .filter((uid) => registrations.some((r) => r.user_id === uid && r.status !== "cancelled"))}
                  onPlayersAdded={(addedProfiles) => {
                    if (addedProfiles && addedProfiles.length > 0) {
                      setProfilesMap((prev) => {
                        const next = new Map(prev);
                        addedProfiles.forEach((p) => {
                          next.set(p.user_id, {
                            display_name: p.display_name,
                            username: null,
                            avatar_url: null,
                          });
                        });
                        return next;
                      });
                    }
                    fetchTournament();
                  }}
                />
              )}

              {/* Teams list for team tournaments */}
              {tournament.team_mode && tournament.team_mode !== "solo" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <BncIcon name="friends" size={16} className="text-primary" />
                      Squadre ({teams.length})
                    </h3>
                    {canManage && teams.filter(t => !t.is_ready).length > 0 && !isStarted && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        const teamIds = teams.filter(t => !t.is_ready).map(t => t.id);
                        const { error } = await (supabase as any).from("tournament_teams").update({ is_ready: true }).in("id", teamIds);
                        if (error) { toast.error("Errore"); } else { toast.success("Tutti i team segnati come pronti!"); fetchTournament(); }
                      }}>
                        <CheckCircle2 size={14} className="mr-1" /> Tutti pronti
                      </Button>
                    )}
                  </div>
                  {teams.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nessuna squadra iscritta ancora.</p>
                  ) : (
                    teams.map((team) => (
                      <Collapsible key={team.id}>
                        <div className="bg-card rounded-xl border border-border overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <button className="w-full p-3 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                              <div className="flex items-center gap-3">
                                {team.is_ready ? (
                                  <CheckCircle2 size={14} className="text-primary shrink-0" />
                                ) : (
                                  <XCircle size={14} className="text-muted-foreground shrink-0" />
                                )}
                                <span className="text-sm font-semibold">{team.team_name}</span>
                                <Badge variant="outline" className="text-[10px]">{team.members.length} membri{team.members.length === 4 ? " (1 riserva)" : ""}</Badge>
                                {team.members.length < 3 && isStarted && (
                                  <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">BYE 1pt</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {canManage && !isStarted && (
                                  <>
                                    <Button
                                      variant={team.is_ready ? "default" : "outline"}
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const { error } = await (supabase as any).from("tournament_teams").update({ is_ready: !team.is_ready }).eq("id", team.id);
                                        if (error) { toast.error("Errore"); } else { fetchTournament(); }
                                      }}
                                    >
                                      {team.is_ready ? "Pronto ✓" : "Segna pronto"}
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10">
                                          <X size={12} />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Rimuovere {team.team_name}?</AlertDialogTitle>
                                          <AlertDialogDescription>La squadra verrà rimossa dal torneo.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={async () => {
                                              await (supabase as any).from("tournament_teams").delete().eq("id", team.id);
                                              toast.success(`${team.team_name} rimosso`);
                                              fetchTournament();
                                            }}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Rimuovi
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                                <ChevronDown size={14} className="text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t border-border divide-y divide-border">
                              {team.members.map((m) => (
                                <div key={m.user_id} className="flex items-center gap-2 p-2.5 px-4">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={m.avatar_url || undefined} />
                                    <AvatarFallback className="text-[9px] bg-secondary">
                                      {(m.display_name || m.username || "?").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium truncate flex-1">{m.display_name || m.username || "Utente"}</span>
                                  {m.username && <span className="text-[10px] text-muted-foreground">@{m.username}</span>}
                                  {canManage && !isStarted && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveTeamMember(team.id, m.user_id, team.team_name, team.members.length);
                                      }}
                                    >
                                      <X size={12} />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))
                  )}
                </div>
              )}

              {confirmedRegs.length === 0 ? (
                <p className="text-muted-foreground">Nessun iscritto ancora.</p>
              ) : (
                <Collapsible defaultOpen={confirmedRegs.length <= 16}>
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="w-full border-b border-border flex flex-col sm:flex-row sm:items-center sm:gap-2 sm:pr-3">
                      <CollapsibleTrigger asChild>
                        <button className="flex-1 min-w-0 p-3 sm:p-4 flex items-center justify-between gap-2 hover:bg-secondary/20 transition-colors text-left">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-sm font-semibold">Iscritti{isPaidTournament ? " (paganti)" : ""} ({confirmedRegs.length}/{tournament.max_participants})</span>
                            {tournament.check_in_enabled && !isStarted && (
                              <>
                                <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/30">
                                  <CheckCircle2 size={10} /> {confirmedRegs.filter(r => r.is_ready).length} pronti
                                </span>
                                <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                                  <XCircle size={10} /> {confirmedRegs.filter(r => !r.is_ready).length} non pronti
                                </span>
                              </>
                            )}
                          </div>
                          <ChevronDown size={16} className="text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180 shrink-0" />
                        </button>
                      </CollapsibleTrigger>
                      {canManage && tournament.check_in_enabled && !isStarted && (
                        <div className="px-3 pb-3 sm:p-0 sm:shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[11px] px-2.5 w-full sm:w-auto gap-1"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ids = confirmedRegs.filter(r => !r.is_ready).map(r => r.id);
                              if (ids.length === 0) { toast.info("Tutti già pronti!"); return; }
                              const { error } = await supabase.from("tournament_registrations").update({ is_ready: true }).in("id", ids);
                              if (error) { toast.error("Errore nell'aggiornamento"); } else { toast.success("Tutti segnati come pronti!"); fetchTournament(); }
                            }}
                          >
                            <Users size={12} /> Metti tutti pronti
                          </Button>
                        </div>
                      )}
                    </div>
                    <CollapsibleContent>
                      <div className="px-3 pt-3 space-y-2">
                        {/* Search */}
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                          <Input
                            type="text"
                            value={confirmedSearch}
                            onChange={(e) => setConfirmedSearch(e.target.value)}
                            placeholder="Cerca iscritto per nome o username..."
                            className="pl-9 h-8 text-xs"
                          />
                          {confirmedSearch && (
                            <button
                              type="button"
                              onClick={() => setConfirmedSearch("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                              title="Pulisci ricerca"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {tournament.check_in_enabled && !isStarted && (
                        <div className="flex items-center gap-1 px-3 pt-3 flex-wrap">
                          {([
                            { v: "all", label: `Tutti (${confirmedRegs.length})` },
                            { v: "ready", label: `Pronti (${confirmedRegs.filter(r => r.is_ready).length})` },
                            { v: "not_ready", label: `Non pronti (${confirmedRegs.filter(r => !r.is_ready).length})` },
                          ] as const).map(opt => (
                            <button
                              key={opt.v}
                              onClick={(e) => { e.stopPropagation(); setReadyFilter(opt.v); }}
                              className={`text-[10px] px-2 h-6 rounded-md border transition-colors ${
                                readyFilter === opt.v
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/60"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                        {confirmedRegs
                          .filter(r => {
                            if (!tournament.check_in_enabled || isStarted) return true;
                            if (readyFilter === "ready") return r.is_ready;
                            if (readyFilter === "not_ready") return !r.is_ready;
                            return true;
                          })
                          .filter(r => {
                            const q = confirmedSearch.trim().toLowerCase();
                            if (!q) return true;
                            const name = getRegPlayerName(r).toLowerCase();
                            const username = profilesMap.get(r.user_id)?.username?.toLowerCase() ?? "";
                            return name.includes(q) || username.includes(q);
                          })
                          .map((r, i) => {
                          const isDropped = publicStandings.find((s: any) => s.user_id === r.user_id)?.dropped === true;
                          return (
                          <div key={r.id} className={`bg-secondary/30 rounded-xl p-2.5 flex flex-col gap-1.5 relative ${isDropped ? "opacity-60" : ""}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-[10px] font-mono shrink-0">{i + 1}</span>
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={getRegAvatarUrl(r) || undefined} />
                                <AvatarFallback className="text-[9px] bg-secondary">
                                  {getRegPlayerName(r).slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <PlayerNameLink r={r} className={`text-xs font-medium truncate min-w-0 ${isDropped ? "line-through" : ""}`} />
                              {isDropped && (
                                <span
                                  className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md text-[9px] font-medium bg-destructive/10 text-destructive border border-destructive/30 shrink-0"
                                  title="Ritirato dal torneo"
                                >
                                  <Flag size={10} /> Ritirato
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[9px] text-muted-foreground shrink-0">
                                {format(new Date(r.registered_at), "d MMM HH:mm", { locale: it })}
                              </span>
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                {tournament.check_in_enabled && !isStarted && (
                                  canManage ? (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const { error } = await supabase
                                          .from("tournament_registrations")
                                          .update({ is_ready: !r.is_ready })
                                          .eq("id", r.id);
                                        if (error) { toast.error("Errore"); } else { fetchTournament(); }
                                      }}
                                      title={r.is_ready ? "Clicca per segnare come Non pronto" : "Clicca per segnare come Pronto"}
                                      className={`inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md text-[9px] font-medium border shrink-0 transition-colors cursor-pointer ${
                                        r.is_ready
                                          ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                                          : "bg-muted text-muted-foreground border-border hover:bg-secondary"
                                      }`}
                                    >
                                      {r.is_ready ? <><CheckCircle2 size={10} /> Pronto</> : <><XCircle size={10} /> Non pronto</>}
                                    </button>
                                  ) : (
                                    r.is_ready ? (
                                      <span
                                        className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md text-[9px] font-medium bg-primary/10 text-primary border border-primary/30 shrink-0"
                                        title="Pronto"
                                      >
                                        <CheckCircle2 size={10} /> Pronto
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md text-[9px] font-medium bg-muted text-muted-foreground border border-border shrink-0"
                                        title="Non pronto"
                                      >
                                        <XCircle size={10} /> Non pronto
                                      </span>
                                    )
                                  )
                                )}
                                {isPaidTournament && (
                                  <span
                                    className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md text-[9px] font-medium bg-primary/10 text-primary border border-primary/30 shrink-0"
                                    title="Pagamento confermato"
                                  >
                                    <CheckCircle2 size={10} /> Pagato
                                  </span>
                                )}
                                {canManage && !isStarted && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 relative"
                                    title="Annulla pagamento (rimetti in attesa)"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                       const { error } = await supabase
                                         .from("tournament_registrations")
                                         .update({ status: "pending_payment", is_ready: false })
                                         .eq("id", r.id);
                                       if (error) { toast.error("Errore"); }
                                       else { toast.success(`${getRegPlayerName(r)} rimesso in attesa pagamento`); fetchTournament(); }
                                    }}
                                  >
                                    <Euro size={10} />
                                    <X size={8} className="absolute -top-0.5 -right-0.5" strokeWidth={3} />
                                  </Button>
                                )}
                                {canManage && !isStarted && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
                                        <UserMinus size={10} />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Rimuovere {getRegPlayerName(r)}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Il giocatore verrà rimosso dal torneo.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemovePlayer(r.id, getRegPlayerName(r))} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          Rimuovi
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                                {canManage && !isStarted && waitlistRegs.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                                    title="Scambia con lista d'attesa"
                                    onClick={(e) => { e.stopPropagation(); setSwapPlayerReg(r); setSwapTargetReg(null); }}
                                  >
                                    <ArrowLeftRight size={10} />
                                  </Button>
                                )}
                                {canManage && isStarted && tournament.status !== "completed" && (() => {
                                  const standing = publicStandings.find((s: any) => s.user_id === r.user_id);
                                  if (standing?.dropped) return null;
                                  return (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                          title="Dichiara forfeit"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Flag size={10} />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Forfeit per {getRegPlayerName(r)}?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Il match in corso del turno attivo verrà assegnato all'avversario (come BYE) e il giocatore non sarà incluso nei turni successivi. Questa azione non può essere annullata.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleStaffForfeitPlayer(r.user_id, getRegPlayerName(r))}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Conferma Forfeit
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  );
                                })()}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                                    title="Sostituisci giocatore (Admin)"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAdminReplaceOldUser({ user_id: r.user_id, name: getRegPlayerName(r) });
                                      setAdminReplaceNewUser(null);
                                      setAdminReplaceSearch("");
                                      setAdminReplaceResults([]);
                                      setAdminReplaceOpen(true);
                                    }}
                                  >
                                    <Search size={10} />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {/* Combined pending payment + waitlist for paid tournaments */}
              {isPaidTournament && (pendingPaymentRegs.length > 0 || trueWaitlistRegs.length > 0) && (() => {
                const combined = [...pendingPaymentRegs, ...trueWaitlistRegs]
                  .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
                const availableSlots = Math.max(0, tournament.max_participants - confirmedRegs.length);
                return (
                  <Collapsible defaultOpen>
                    <div className="bg-card rounded-2xl border border-border overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-secondary/20 transition-colors">
                          <div className="flex items-center gap-2">
                            <Euro size={16} className="text-amber-500" />
                            <span className="text-sm font-semibold">
                              Iscritti — In attesa di pagamento ({combined.length})
                            </span>
                          </div>
                          <ChevronDown size={16} className="text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pt-3">
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                              type="text"
                              value={waitlistSearch}
                              onChange={(e) => setWaitlistSearch(e.target.value)}
                              placeholder="Cerca per nome o username..."
                              className="pl-9 h-8 text-xs"
                            />
                            {waitlistSearch && (
                              <button
                                type="button"
                                onClick={() => setWaitlistSearch("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                                title="Pulisci ricerca"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="divide-y divide-border mt-2">
                          {(() => {
                            const filtered = combined.filter(r => {
                              const q = waitlistSearch.trim().toLowerCase();
                              if (!q) return true;
                              const name = getRegPlayerName(r).toLowerCase();
                              const username = profilesMap.get(r.user_id)?.username?.toLowerCase() ?? "";
                              return name.includes(q) || username.includes(q);
                            });
                            const dividerShown = { current: false };
                            return filtered.map((r) => {
                              const positionInCombined = combined.findIndex(c => c.id === r.id);
                              const isLocked = positionInCombined >= availableSlots;
                              const showDivider = isLocked && !dividerShown.current && availableSlots < combined.length;
                              if (showDivider) dividerShown.current = true;
                              return (
                                <React.Fragment key={r.id}>
                                  {showDivider && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-y border-dashed border-border">
                                      <ListOrdered size={12} className="text-muted-foreground" />
                                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                                        Lista d'attesa — in attesa di un posto libero
                                      </span>
                                    </div>
                                  )}
                                  <div className={`flex items-center gap-3 p-3 px-4 ${isLocked ? "opacity-50" : ""}`}>
                                    <span className="text-muted-foreground text-xs w-5 shrink-0 text-center">{positionInCombined + 1}</span>
                                  <Avatar className="h-7 w-7 shrink-0">
                                    <AvatarImage src={getRegAvatarUrl(r) || undefined} />
                                    <AvatarFallback className="text-[10px] bg-secondary">
                                      {getRegPlayerName(r).slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <PlayerNameLink r={r} className="text-sm font-medium truncate block" />
                                    <span className="text-[10px] text-muted-foreground">
                                      {format(new Date(r.registered_at), "d MMM HH:mm", { locale: it })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {isLocked ? (
                                      <Badge variant="outline" className="text-[10px] h-6 px-2 text-muted-foreground border-muted-foreground/30">
                                        Massimo giocatori raggiunto
                                      </Badge>
                                    ) : canManage ? (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="default"
                                            size="sm"
                                            className="h-7 text-[10px] px-2 gap-1 bg-green-600 hover:bg-green-700 text-white"
                                          >
                                            <CheckCircle2 size={10} /> Conferma il Pagamento
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Confermare il pagamento?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Stai per segnare come <strong>pagato</strong> {getRegPlayerName(r)}. L'iscrizione passerà tra gli iscritti confermati. Procedere?
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={async () => {
                                                // If still on waitlist (occupies no slot), bump to pending_payment first
                                                if (r.status === "waitlist") {
                                                  await supabase
                                                    .from("tournament_registrations")
                                                    .update({ status: "pending_payment" })
                                                    .eq("id", r.id);
                                                }
                                                const { error } = await supabase
                                                  .from("tournament_registrations")
                                                  .update({ status: "confirmed", is_ready: false })
                                                  .eq("id", r.id);
                                                if (error) {
                                                  if (error.code === 'P0001' || error.message?.includes('maximum participants')) {
                                                    toast.error("Posti esauriti! Non puoi confermare altri giocatori.");
                                                  } else {
                                                    toast.error("Errore");
                                                  }
                                                } else {
                                                  toast.success(`Pagamento di ${getRegPlayerName(r)} confermato`);
                                                  await promoteFromWaitlist();
                                                  fetchTournament();
                                                }
                                              }}
                                            >
                                              Conferma pagamento
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    ) : null}
                                    {canManage && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                        onClick={() => handleRemovePlayer(r.id, getRegPlayerName(r))}
                                      >
                                        <UserMinus size={12} />
                                      </Button>
                                    )}
                                  </div>
                                  </div>
                                </React.Fragment>
                              );
                            });
                          })()}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })()}

              {/* True waiting list (only for free tournaments — paid uses combined list above) */}
              {!isPaidTournament && trueWaitlistRegs.length > 0 && (
                <Collapsible defaultOpen>
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-secondary/20 transition-colors">
                        <div className="flex items-center gap-2">
                          <ListOrdered size={16} className="text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            Lista d'attesa ({trueWaitlistRegs.length})
                          </span>
                        </div>
                        <ChevronDown size={16} className="text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="divide-y divide-border mt-2">
                        {trueWaitlistRegs.map((r, i) => (
                          <div key={r.id} className="flex items-center gap-3 p-3 px-4">
                            <span className="text-muted-foreground text-xs w-5 shrink-0 text-center">{i + 1}</span>
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarImage src={getRegAvatarUrl(r) || undefined} />
                              <AvatarFallback className="text-[10px] bg-secondary">
                                {getRegPlayerName(r).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <PlayerNameLink r={r} className="text-sm font-medium truncate block" />
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(r.registered_at), "d MMM HH:mm", { locale: it })}
                              </span>
                            </div>
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() => handleRemovePlayer(r.id, getRegPlayerName(r))}
                              >
                                <UserMinus size={12} />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {/* Swap player dialog */}
              {swapPlayerReg && (
                <Dialog open={!!swapPlayerReg} onOpenChange={(v) => { if (!v) { setSwapPlayerReg(null); setSwapTargetReg(null); } }}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-lg">Scambia Giocatore</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      Seleziona un giocatore dalla lista d'attesa da scambiare con <strong>{getRegPlayerName(swapPlayerReg)}</strong>
                    </p>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {waitlistRegs.map((wr) => (
                        <button
                          key={wr.id}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${swapTargetReg?.id === wr.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50"}`}
                          onClick={() => setSwapTargetReg(wr)}
                        >
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={getRegAvatarUrl(wr) || undefined} />
                            <AvatarFallback className="text-[9px] bg-secondary">{getRegPlayerName(wr).slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {getRegPlayerName(wr)}
                        </button>
                      ))}
                    </div>
                    {swapTargetReg && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="w-full mt-2" disabled={!swapTargetReg}>
                            <ArrowLeftRight size={14} className="mr-1.5" />
                            Conferma Scambio
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confermi lo scambio?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{getRegPlayerName(swapPlayerReg)}</strong> verrà spostato in lista d'attesa e <strong>{getRegPlayerName(swapTargetReg)}</strong> diventerà iscritto confermato.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              // Swap: move confirmed → waitlist, waitlist → confirmed
                              // Move confirmed → waitlist with current timestamp so they go to the end of the waitlist
                              const { error: e1 } = await supabase
                                .from("tournament_registrations")
                                .update({ status: "waitlist", is_ready: false, registered_at: new Date().toISOString() })
                                .eq("id", swapPlayerReg.id);
                              const { error: e2 } = await supabase
                                .from("tournament_registrations")
                                .update({ status: "confirmed", is_ready: false })
                                .eq("id", swapTargetReg.id);
                              if (e1 || e2) {
                                toast.error("Errore durante lo scambio");
                              } else {
                                toast.success(`${getRegPlayerName(swapPlayerReg)} ↔ ${getRegPlayerName(swapTargetReg)} scambiati!`);
                                fetchTournament();
                              }
                              setSwapPlayerReg(null);
                              setSwapTargetReg(null);
                            }}>
                              Sì, scambia
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </DialogContent>
                </Dialog>
              )}

              {/* Admin Replace Player Dialog */}
              {adminReplaceOpen && adminReplaceOldUser && (
                <Dialog open={adminReplaceOpen} onOpenChange={(v) => { if (!v) { setAdminReplaceOpen(false); setAdminReplaceOldUser(null); setAdminReplaceNewUser(null); setAdminReplaceSearch(""); setAdminReplaceResults([]); } }}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-lg">Sostituisci Giocatore</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Giocatore attuale</p>
                        <div className="p-2 rounded-lg border border-destructive/30 bg-destructive/5 text-sm font-medium">
                          {adminReplaceOldUser.name}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Nuovo giocatore</p>
                        {!adminReplaceNewUser ? (
                          <>
                            <Input
                              placeholder="Cerca username o nome..."
                              value={adminReplaceSearch}
                              onChange={(e) => handleAdminReplaceSearch(e.target.value)}
                            />
                            {adminReplaceResults.length > 0 && (
                              <div className="mt-1 border rounded-lg max-h-40 overflow-auto">
                                {adminReplaceResults.map(p => (
                                  <button
                                    key={p.user_id}
                                    className="w-full flex items-center gap-2 p-2 hover:bg-secondary/50 text-left text-sm"
                                    onClick={() => { setAdminReplaceNewUser(p); setAdminReplaceSearch(""); setAdminReplaceResults([]); }}
                                  >
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={p.avatar_url || undefined} />
                                      <AvatarFallback className="text-[8px]">{(p.display_name || p.username || "?")[0]}</AvatarFallback>
                                    </Avatar>
                                    <span>{p.display_name || p.username}</span>
                                    <span className="text-muted-foreground text-xs">@{p.username}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-2 rounded-lg border border-primary/30 bg-primary/5 text-sm flex items-center justify-between">
                            <span className="font-medium">{adminReplaceNewUser.display_name || adminReplaceNewUser.username}</span>
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setAdminReplaceNewUser(null)}>Cambia</Button>
                          </div>
                        )}
                      </div>
                      {adminReplaceNewUser && (
                        <p className="text-xs text-muted-foreground">
                          ⚠️ Tutti i match, risultati, classifiche e punti verranno aggiornati.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button variant="outline" size="sm" onClick={() => setAdminReplaceOpen(false)}>Annulla</Button>
                      <Button size="sm" onClick={handleAdminReplacePlayer} disabled={!adminReplaceNewUser || adminReplacing}>
                        {adminReplacing ? "Sostituzione..." : "Sostituisci"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            {isStarted && (
              <TabsContent value="bracket" className="mt-6 space-y-4 data-[state=inactive]:hidden" forceMount>
                {/* Print button for staff */}
                {canManage && isStarted && (
                  <div className="flex justify-end gap-2 print:hidden flex-wrap">
                    <Button
                      size="sm"
                      className="gap-1.5 text-white border-0"
                      style={{
                        background: "linear-gradient(135deg,#b14dff,#7c3aed)",
                        boxShadow: "0 0 14px -3px rgba(177,77,255,.7)",
                      }}
                      onClick={() => navigate(`/torneo/gestisci/${id}`)}
                    >
                      Gestisci
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/tournaments/${id}/streaming`)}>
                      <Video size={14} /> Streaming Dashboard
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrintBracket}>
                      <Printer size={14} /> Esporta Bracket
                    </Button>
                    <TournamentBackup
                      tournamentId={tournament.id}
                      tournamentTitle={tournament.title}
                      onImportComplete={() => window.location.reload()}
                    />
                  </div>
                )}

                {/* Staff/Admin: Full interactive bracket manager */}
                {canManage ? (
                  <TournamentBracketManager
                    tournamentId={tournament.id}
                    format={tournament.format}
                    swissRounds={tournament.swiss_rounds}
                    topCutSize={tournament.top_cut_size}
                    status={tournament.status}
                    players={bracketPlayers}
                    maxParticipants={tournament.max_participants}
                    isRanked={(tournament as any).is_ranked !== false}
                    checkInEnabled={tournament.check_in_enabled}
                    hasWaitlist={(tournament as any).has_waitlist !== false}
                    registrations={confirmedRegs}
                    tiebreakerDepth={(tournament as any).tiebreaker_depth ?? 0}
                    tiebreakerMode={(tournament as any).tiebreaker_mode ?? "advanced"}
                    groupsCount={tournament.groups_count ?? 0}
                    under12Enabled={(tournament as any).under12_enabled ?? false}
                    under12SeparateTopcut={(tournament as any).under12_separate_topcut ?? false}
                    u12SwissRounds={(tournament as any).u12_swiss_rounds ?? null}
                    tableAssignmentEnabled={(tournament as any).table_assignment_enabled ?? false}
                    matchesPerTable={(tournament as any).matches_per_table ?? 1}
                    scoringPolicy={(tournament as any).scoring_policy ?? "staff_only"}
                    customSwissWinPoints={(tournament as any).custom_swiss_win_points ?? null}
                    customTopWinPoints={(tournament as any).custom_top_win_points ?? null}
                    enabledTiebreakers={(tournament as any).enabled_tiebreakers ?? null}
                    initialMatches={publicMatches}
                    initialStandings={publicStandings}
                    onStatusChange={fetchTournament}
                    renderMode="bracket"
                  />
                ) : (
                  <>
                    {/* Toggle Swiss / Top Cut when top cut is active */}
                    {(tournament.status === "top_cut" || tournament.status === "pre_top_cut" || tournament.status === "completed") && swissMatches.length > 0 && (
                      <div className="inline-flex items-center rounded-lg border border-border bg-secondary/40 p-1 text-xs font-semibold uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => setShowSwissInTopCut(true)}
                          className={`px-3 py-1.5 rounded-md transition-colors ${showSwissInTopCut ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          Swiss
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSwissInTopCut(false)}
                          className={`px-3 py-1.5 rounded-md transition-colors ${!showSwissInTopCut ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          Top
                        </button>
                      </div>
                    )}

                    {/* Swiss view (shown during swiss phase, or when toggled during top cut) */}
                    {(tournament.status === "swiss" || showSwissInTopCut) && (
                      <>
                        {/* Group selector */}
                        {(swissMatches.length > 0 || u12SwissMatches.length > 0) && ((tournament.groups_count ?? 0) > 0 || u12SwissMatches.length > 0) && (
                          <div className="flex gap-2 flex-wrap">
                            {(tournament.groups_count ?? 0) > 0 && Array.from({ length: tournament.groups_count! }, (_, i) => i + 1).map(g => (
                              <Button
                                key={g}
                                variant={publicGroupTab === g ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPublicGroupTab(g)}
                              >
                                Gruppo {groupLabel(g)}
                              </Button>
                            ))}
                            {(tournament.groups_count ?? 0) === 0 && swissMatches.length > 0 && u12SwissMatches.length > 0 && (
                              <Button
                                variant={publicGroupTab === 0 ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPublicGroupTab(0)}
                              >
                                Principale
                              </Button>
                            )}
                            {u12SwissMatches.length > 0 && (
                              <Button
                                variant={publicGroupTab === 99 ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPublicGroupTab(99)}
                              >
                                Gruppo Kids
                              </Button>
                            )}
                          </div>
                        )}
                        {swissMatches.length > 0 && publicGroupTab !== 99 && (
                          <SwissRoundView
                            matches={
                              (tournament.groups_count ?? 0) > 0
                                ? swissMatches.filter((m: any) => m.group_number === publicGroupTab)
                                : swissMatches
                            }
                            playerMap={playerMap}
                            avatarMap={avatarMap}
                            onResult={handlePublicMatchResult}
                            isStaff={false}
                            currentUserId={user?.id}
                            matchDeckReports={matchDeckReports}
                            tableAssignment={{ enabled: (tournament as any).table_assignment_enabled ?? false, matchesPerTable: (tournament as any).matches_per_table ?? 1, groupsCount: (tournament as any).groups_count ?? 0 }}
                            scoredByMap={scoredByMap}
                            scoringPolicy={(tournament as any).scoring_policy ?? "staff_only"}
                            userHasRefereeBadge={userHasRefereeBadge}
                            isParticipant={isRegistered}
                            usernameMap={usernameMap}
                          />
                        )}
                        {u12SwissMatches.length > 0 && publicGroupTab === 99 && (
                          <SwissRoundView
                            matches={u12SwissMatches}
                            playerMap={playerMap}
                            avatarMap={avatarMap}
                            onResult={handlePublicMatchResult}
                            isStaff={false}
                            currentUserId={user?.id}
                            matchDeckReports={matchDeckReports}
                            tableAssignment={{ enabled: (tournament as any).table_assignment_enabled ?? false, matchesPerTable: (tournament as any).matches_per_table ?? 1, groupsCount: 0 }}
                            scoredByMap={scoredByMap}
                            scoringPolicy={(tournament as any).scoring_policy ?? "staff_only"}
                            userHasRefereeBadge={userHasRefereeBadge}
                            isParticipant={isRegistered}
                            usernameMap={usernameMap}
                          />
                        )}
                      </>
                    )}

                    {/* Top Cut view (shown when not toggled to swiss) */}
                    {!showSwissInTopCut && (
                      <>
                        {(preTopCutMatches.length > 0 || topCutMatches.length > 0) && (
                          <div className="bg-card rounded-2xl border border-border p-3 sm:p-5 max-w-[calc(100vw-1.5rem)]">
                            {/* Spareggi di qualificazione inline */}
                            {preTopCutMatches.length > 0 && (
                              <div className="mb-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-px flex-1 bg-border" />
                                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider whitespace-nowrap">
                                    ⚔️ Spareggi di Qualificazione
                                  </h3>
                                  <div className="h-px flex-1 bg-border" />
                                </div>
                                <div className="flex flex-wrap gap-3 justify-center">
                                  {preTopCutMatches.map((match: any) => {
                                    const p1Name = match.player1_id ? playerMap.get(match.player1_id) || "?" : "BYE";
                                    const p2Name = match.player2_id ? playerMap.get(match.player2_id) || "?" : "BYE";
                                    const isDone = match.status === "completed";
                                    const winnerName = match.winner_id ? playerMap.get(match.winner_id) : null;
                                    return (
                                      <div
                                        key={match.id}
                                        className={`rounded-xl border p-3 min-w-[200px] flex-1 max-w-xs ${
                                          isDone ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"
                                        }`}
                                      >
                                        <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
                                          Match {match.match_number}
                                        </div>
                                        <div className="space-y-1.5">
                                          <div className={`flex items-center justify-between text-sm ${
                                            isDone && match.winner_id === match.player1_id ? "font-bold text-primary" : ""
                                          }`}>
                                            <span>{p1Name}</span>
                                            {isDone && <span className="text-xs">{match.player1_score}</span>}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground text-center">VS</div>
                                          <div className={`flex items-center justify-between text-sm ${
                                            isDone && match.winner_id === match.player2_id ? "font-bold text-primary" : ""
                                          }`}>
                                            <span>{p2Name}</span>
                                            {isDone && <span className="text-xs">{match.player2_score}</span>}
                                          </div>
                                        </div>
                                        {isDone && winnerName && (
                                          <div className="mt-2 text-[10px] text-primary font-medium flex items-center gap-1">
                                            <Trophy size={10} /> {winnerName} qualificato
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="h-px bg-border" />
                              </div>
                            )}

                            {/* Main Top Cut bracket */}
                            {mainTopCutMatches.length > 0 ? (
                              (((tournament as any).tiebreaker_depth ?? 0) > 0) ? (
                                <Tabs defaultValue="topcut">
                                  <TabsList className="bg-secondary/40 border border-border">
                                    <TabsTrigger value="topcut" className="text-xs sm:text-sm gap-1">
                                      <Trophy size={13} /> Top Cut
                                    </TabsTrigger>
                                    <TabsTrigger value="placement" className="text-xs sm:text-sm gap-1">
                                      <ListOrdered size={13} /> Spareggi
                                    </TabsTrigger>
                                  </TabsList>
                                  <TabsContent value="topcut" className="mt-4">
                                    <TopCutBracket
                                      matches={mainTopCutMatches}
                                      playerMap={playerMap}
                                      avatarMap={avatarMap}
                                      onResult={handlePublicMatchResult}
                                      isStaff={false}
                                      scoringPolicy={(tournament as any).scoring_policy ?? "staff_only"}
                                      currentUserId={user?.id}
                                      userHasRefereeBadge={userHasRefereeBadge}
                                      isParticipant={isRegistered}
                                      tournamentId={tournament?.id}
                                      usernameMap={usernameMap}
                                      isAdmin={isAdmin}
                                      onSwapPlayers={handleSwapTopCutPlayer}
                                      allPlayers={allPlayersForSwap}
                                    />
                                  </TabsContent>
                                  <TabsContent value="placement" className="mt-4 space-y-3">
                                    <p className="text-xs text-muted-foreground">
                                      Struttura completa dei piazzamenti fino al {(tournament as any).tiebreaker_depth}° posto. I match si attivano via via che il Top Cut avanza.
                                    </p>
                                    <PlacementBracket
                                      tiebreakerMatches={tiebreakerMatches as any}
                                      thirdPlaceMatch={thirdPlaceMatch as any}
                                      topCutSize={(tournament as any).top_cut_size ?? 0}
                                      topCutFinalRound={topCutFinalRound}
                                      tiebreakerDepth={(tournament as any).tiebreaker_depth ?? 0}
                                      tiebreakerMode={(tournament as any).tiebreaker_mode ?? "advanced"}
                                      playerMap={playerMap}
                                      avatarMap={avatarMap}
                                      usernameMap={usernameMap}
                                      onResult={handlePublicMatchResult}
                                      isStaff={false}
                                      scoringPolicy={(tournament as any).scoring_policy ?? "staff_only"}
                                      currentUserId={user?.id}
                                      userHasRefereeBadge={userHasRefereeBadge}
                                      isParticipant={isRegistered}
                                      winThresholdEarly={(tournament as any).custom_top_win_points ?? 4}
                                      winThresholdLate={(tournament as any).custom_top_win_points ?? 7}
                                    />
                                  </TabsContent>
                                </Tabs>
                              ) : (
                                <>
                                  <h3 className="font-display text-lg mb-3">🏆 Top Cut</h3>
                                  <TopCutBracket
                                    matches={mainTopCutMatches}
                                    playerMap={playerMap}
                                    avatarMap={avatarMap}
                                    onResult={handlePublicMatchResult}
                                    isStaff={false}
                                    scoringPolicy={(tournament as any).scoring_policy ?? "staff_only"}
                                    currentUserId={user?.id}
                                    userHasRefereeBadge={userHasRefereeBadge}
                                    isParticipant={isRegistered}
                                    tournamentId={tournament?.id}
                                    usernameMap={usernameMap}
                                    isAdmin={isAdmin}
                                    onSwapPlayers={handleSwapTopCutPlayer}
                                    allPlayers={allPlayersForSwap}
                                  />
                                </>
                              )
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Il bracket Top Cut verrà generato dopo gli spareggi.
                              </p>
                            )}
                          </div>
                        )}
                        {u12TopCutMatches.length > 0 && (
                          <div className="bg-card rounded-2xl border border-border p-3 sm:p-5 max-w-[calc(100vw-1.5rem)]">
                            <h3 className="font-display text-lg mb-3">🧒 Top Cut Kids</h3>
                            <TopCutBracket
                              matches={u12TopCutMatches}
                              playerMap={playerMap}
                              avatarMap={avatarMap}
                              onResult={handlePublicMatchResult}
                              isStaff={false}
                              scoringPolicy={(tournament as any).scoring_policy ?? "staff_only"}
                              currentUserId={user?.id}
                              userHasRefereeBadge={userHasRefereeBadge}
                            isParticipant={isRegistered}
                              tournamentId={tournament?.id}
                              usernameMap={usernameMap}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {swissMatches.length === 0 && u12SwissMatches.length === 0 && preTopCutMatches.length === 0 && topCutMatches.length === 0 && (
                      <p className="text-muted-foreground">Bracket in preparazione...</p>
                    )}
                  </>
                )}




                {/* Top 3 Decks for completed tournaments */}
                {tournament.status === "completed" && publicStandings.length > 0 && (
                  <TournamentTopDecks
                    tournamentId={tournament.id}
                    standings={publicStandings}
                    playerMap={playerMap}
                    avatarMap={avatarMap}
                  />
                )}

                {tournament.status === "completed" && (
                  <div className="pt-2">
                    <EventFeedbackButton
                      scope={(tournament as any).event_type === "event" ? "event" : "tournament"}
                      targetId={tournament.id}
                      canSubmit={isRegistered}
                    />
                  </div>
                )}
              </TabsContent>
            )}


            {isStarted && (swissMatches.length > 0 || u12SwissMatches.length > 0) && (() => {
              const groupsCount = (tournament as any).groups_count ?? 0;
              const groupNumbers = groupsCount > 0
                ? Array.from(new Set(
                    publicStandings
                      .filter((s: any) => s.group_number !== 99 && s.group_number != null)
                      .map((s: any) => s.group_number as number)
                  )).sort((a, b) => a - b)
                : [];
              const hasGroups = groupNumbers.length > 0;
              return (
                <TabsContent value="standings" className="mt-6 space-y-6">
                  <div>
                    <h4 className="font-display text-sm mb-2 flex items-center gap-2">
                      <BncIcon name="ranking" size={16} className="text-primary" /> Classifica
                    </h4>
                    {hasGroups ? (
                      <Tabs defaultValue="complete">
                        <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide mb-3">
                          <TabsList className="bg-card border border-border w-full flex">
                            <TabsTrigger value="complete" className="flex-1 text-xs sm:text-sm">Completa</TabsTrigger>
                            {groupNumbers.map(g => (
                              <TabsTrigger key={g} value={`g${g}`} className="flex-1 text-xs sm:text-sm">
                                Gruppo {g}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </div>
                        <TabsContent value="complete">
                          <StandingsTable
                            standings={publicStandings.filter((s: any) => s.group_number !== 99)}
                            playerMap={playerMap}
                            matches={publicMatches}
                            results={publicResults}
                            tournamentRanked={(tournament as any).is_ranked !== false}
                            enabledTiebreakers={(tournament as any).enabled_tiebreakers ?? undefined}
                          />
                        </TabsContent>
                        {groupNumbers.map(g => (
                          <TabsContent key={g} value={`g${g}`}>
                            <StandingsTable
                              standings={publicStandings.filter((s: any) => s.group_number === g)}
                              playerMap={playerMap}
                              matches={publicMatches.filter((m: any) => m.group_number === g)}
                              results={publicResults}
                              tournamentRanked={(tournament as any).is_ranked !== false}
                              enabledTiebreakers={(tournament as any).enabled_tiebreakers ?? undefined}
                            />
                          </TabsContent>
                        ))}
                      </Tabs>
                    ) : (
                      <StandingsTable
                        standings={publicStandings.filter((s: any) => s.group_number !== 99)}
                        playerMap={playerMap}
                        matches={publicMatches}
                        results={publicResults}
                        tournamentRanked={(tournament as any).is_ranked !== false}
                        enabledTiebreakers={(tournament as any).enabled_tiebreakers ?? undefined}
                      />
                    )}
                  </div>

                  {publicStandings.some((s: any) => s.group_number === 99) && (
                    <div className="bg-card rounded-2xl border border-border p-4">
                      <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-2">🧒 Gruppo Kids</h5>
                      <StandingsTable
                        standings={publicStandings.filter((s: any) => s.group_number === 99)}
                        playerMap={playerMap}
                        matches={publicMatches}
                        results={publicResults}
                        tournamentRanked={(tournament as any).is_ranked !== false}
                        enabledTiebreakers={(tournament as any).enabled_tiebreakers ?? undefined}
                      />
                    </div>
                  )}
                </TabsContent>
              );
            })()}

            <TabsContent value="info" className="mt-6">
              <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Tipo</span>
                    <p className="font-medium flex items-center gap-2">
                      {(tournament as any).is_ranked !== false ? (
                        <Badge variant="default" className="text-xs">Ranked</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Normal</Badge>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Formato</span>
                    <p className="font-medium">{formatLabel(tournament.format)}</p>
                  </div>
                  {tournament.swiss_rounds && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Turni Swiss</span>
                      <p className="font-medium">{tournament.swiss_rounds}</p>
                    </div>
                  )}
                  {(tournament.format === "swiss_top_cut" || tournament.format === "round_robin_top_cut") && tournament.top_cut_size && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Top Cut</span>
                      <p className="font-medium">Top {tournament.top_cut_size}</p>
                    </div>
                  )}
                  {tournament.regions && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Regione</span>
                      <p className="font-medium">{tournament.regions.name}</p>
                    </div>
                  )}
                  {tournament.entry_fee != null && tournament.entry_fee > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Quota Iscrizione</span>
                      <p className="font-medium">€{tournament.entry_fee}</p>
                    </div>
                  )}
                  {(tournament as any).payment_method && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Metodo di Pagamento</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {((tournament as any).payment_method as string).split(",").map((m: string) => (
                          <span key={m} className="font-medium">
                            {m === "in_loco" ? "💵 In Loco" : m === "paypal" ? "💳 PayPal" : m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!(tournament as any).is_ranked && (tournament as any).banlist && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Banlist</span>
                      <p className="font-medium">
                        <Badge variant="outline" className="text-xs">
                          {(tournament as any).banlist === "hasbro" ? "Hasbro Only" : "ALL"}
                        </Badge>
                      </p>
                    </div>
                  )}
                </div>
                {(tournament as any).custom_rules && (
                  <div className="border-t border-border pt-4">
                    <span className="text-xs text-muted-foreground uppercase block mb-2">Regole Custom</span>
                    <p className="text-sm whitespace-pre-line">{(tournament as any).custom_rules}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {canManage && (
              <TabsContent value="admin" className="mt-6 data-[state=inactive]:hidden" forceMount>
                <TournamentAdminSections
                  tournament={tournament}
                  bracketPlayers={bracketPlayers}
                  confirmedRegs={confirmedRegs}
                  publicMatches={publicMatches}
                  publicStandings={publicStandings}
                  canManage={canManage}
                  fetchTournament={fetchTournament}
                  handleDeleteTournament={handleDeleteTournament}
                  handleHardDeleteTournament={handleHardDeleteTournament}
                  handleConvertToNewTournament={handleConvertToNewTournament}
                />
              </TabsContent>
            )}
          </Tabs>
          </div>


          {/* Desktop payment sidebar */}
          {paymentCard && (
            <aside className="hidden lg:block lg:sticky lg:top-24">
              {paymentCard}
            </aside>
          )}
          </div>
            );
          })()}
        </div>
      </main>

      <Footer />

      {/* Parent Registration Dialog */}
      {isParent && user && (
        <ParentRegistrationDialog
          open={parentDialogOpen}
          onOpenChange={setParentDialogOpen}
          children={childProfiles}
          parentName={profilesMap.get(user.id)?.display_name || profilesMap.get(user.id)?.username || "Tu"}
          parentAvatarUrl={profilesMap.get(user.id)?.avatar_url ?? null}
          alreadyRegisteredUserIds={
            registrations.some(r => r.user_id === user.id && !r.child_profile_id && r.status !== "cancelled")
              ? [user.id] : []
          }
          alreadyRegisteredChildIds={
            registrations
              .filter(r => r.user_id === user.id && r.child_profile_id && r.status !== "cancelled")
              .map(r => r.child_profile_id!)
          }
          onConfirm={handleParentRegistration}
          loading={parentRegistering}
        />
      )}

      {/* Join Club Dialog for ranked tournaments */}
      <JoinClubDialog
        open={joinClubDialogOpen}
        onOpenChange={setJoinClubDialogOpen}
        club={suggestedClub}
        clubs={suggestedClubs}
        organizerClubId={tournament?.club_id}
        onJoined={() => {
          // After joining, retry registration
          handleRegister();
        }}
      />

      {/* Export View - rendered on-screen behind overlay for html-to-image capture */}
      {showPrintView && tournament && createPortal(
        <>
          {/* Overlay to hide the render from the user */}
          <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 99998,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "18px",
            fontFamily: "'Inter', sans-serif",
          }}>
            Esportazione in corso...
          </div>
          {/* Actual content to capture - must be visible and on-screen */}
          <div
            ref={printRef}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 99999,
              width: "1200px",
              maxHeight: "100vh",
              overflow: "visible",
              background: "#ffffff",
              color: "#111111",
              fontFamily: "'Inter', sans-serif",
              padding: "32px",
              opacity: 0,
              pointerEvents: "none",
            }}
          >
            <TournamentPrintView
              tournament={{
                title: tournament.title,
                event_date: tournament.event_date,
                city: tournament.city,
                location: tournament.location,
                format: tournament.format,
                groups_count: tournament.groups_count,
                status: tournament.status,
              }}
              swissMatches={swissMatches}
              u12SwissMatches={u12SwissMatches}
              topCutMatches={topCutMatches}
              u12TopCutMatches={u12TopCutMatches}
              preTopCutMatches={preTopCutMatches}
              tiebreakerMatches={tiebreakerMatches}
              playerMap={playerMap}
              avatarMap={avatarMap}
            />
          </div>
        </>,
        document.body
      )}

      {/* Team Registration Dialog */}
      {tournament.team_mode && tournament.team_mode !== "solo" && (
        <TeamRegistrationDialog
          open={teamDialogOpen}
          onOpenChange={setTeamDialogOpen}
          tournamentId={tournament.id}
          teamMode={tournament.team_mode as "teams" | "clubs"}
          clubId={tournament.club_id}
          onTeamCreated={fetchTournament}
        />
      )}

      {/* Member Replacement Dialog */}
      {replacingMember && (
        <Dialog open={!!replacingMember} onOpenChange={(open) => { if (!open) { setReplacingMember(null); setReplacementSearch(""); setReplacementResults([]); } }}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Sostituisci membro</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Cerca il giocatore sostituto per la squadra <strong>{replacingMember.teamName}</strong>
            </p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={replacementSearch}
                onChange={(e) => handleReplacementSearch(e.target.value)}
                placeholder="Cerca per username..."
                className="pl-9"
              />
              {replacementResults.length > 0 && (
                <div className="mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {replacementResults.map((r) => (
                    <button
                      key={r.user_id}
                      onClick={() => handleReplaceMember(r.user_id)}
                      className="w-full flex items-center gap-2 p-2.5 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={r.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px] bg-secondary">
                          {(r.display_name || r.username || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{r.display_name || r.username}</span>
                        {r.username && <span className="text-[10px] text-muted-foreground">@{r.username}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {replacementSearching && <p className="text-xs text-muted-foreground mt-1">Ricerca...</p>}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog locandina esterna */}
      <Dialog open={flyerUrlDialogOpen} onOpenChange={setFlyerUrlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Locandina esterna</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Inserisci il link diretto all'immagine della locandina. Verrà incorporata senza occupare storage.</p>
          <Input
            placeholder="https://esempio.com/locandina.jpg"
            value={flyerUrlInput}
            onChange={(e) => setFlyerUrlInput(e.target.value)}
          />
          {flyerUrlInput && (
            <img src={flyerUrlInput} alt="Anteprima" className="rounded-lg border border-border max-h-48 object-contain mx-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
          <div className="flex gap-2 justify-end">
            {tournament?.flyer_url && (
              <Button variant="destructive" size="sm" onClick={async () => {
                await supabase.from("tournaments").update({ flyer_url: null } as any).eq("id", tournament.id);
                setTournament({ ...tournament, flyer_url: null });
                setFlyerUrlDialogOpen(false);
                toast.success("Locandina esterna rimossa");
              }}>
                Rimuovi
              </Button>
            )}
            <Button onClick={async () => {
              if (!tournament) return;
              const url = flyerUrlInput.trim();
              if (!url) { toast.error("Inserisci un URL valido"); return; }
              await supabase.from("tournaments").update({ flyer_url: url } as any).eq("id", tournament.id);
              setTournament({ ...tournament, flyer_url: url });
              setFlyerUrlDialogOpen(false);
              toast.success("Locandina esterna salvata");
            }}>
              Salva
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TournamentDetail;
