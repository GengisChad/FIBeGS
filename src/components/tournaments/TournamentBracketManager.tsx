import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { STREAMING_HEARTBEAT_CHANNEL } from "@/lib/streamingPeer";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { linkifyAndFormat } from "@/lib/linkify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/forum/RichTextEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Play, SkipForward, Trophy, AlertTriangle, UserPlus, Loader2, Zap, Undo2, RotateCcw, Settings2, Save, Bell, CheckCircle2, Users, Shuffle, Trash2, ListOrdered } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { SwissRoundView } from "./SwissRoundView";
import { OptionToggleGroup } from "./OptionToggleGroup";
import { TournamentRulesInfo } from "./TournamentRulesInfo";
import { TopCutBracket } from "./TopCutBracket";
import { PlacementBracket } from "./PlacementBracket";
import { MatchScoringDialog } from "./MatchScoringDialog";
import { StandingsTable, getCompleteStandingsOrder } from "./StandingsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Player {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface Match {
  id: string;
  round: number;
  phase: string;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  status: string;
  group_number: number | null;
  scored_by: string | null;
  pairing_meta?: any | null;
}

interface Standing {
  id: string;
  user_id: string;
  wins: number;
  losses: number;
  draws: number;
  game_wins: number;
  game_losses: number;
  points: number;
  resistance: number;
  seed: number | null;
  dropped: boolean;
  group_number: number | null;
}

interface RegistrationInfo {
  id: string;
  user_id: string;
  status: string;
  is_ready: boolean;
  child_profile_id?: string | null;
}

interface TournamentDetails {
  title: string;
  description: string | null;
  location: string;
  city: string;
  event_date: string;
  registration_deadline: string;
  registration_opens_at?: string | null;
  entry_fee: number | null;
  prize_description: string | null;
  payment_method: string | null;
  payment_link: string | null;
  swiss_rounds: number | null;
}

interface Props {
  tournamentId: string;
  format: string | null;
  swissRounds: number | null;
  topCutSize: number | null;
  status: string;
  players: Player[];
  maxParticipants: number;
  isRanked?: boolean;
  checkInEnabled?: boolean;
  hasWaitlist?: boolean;
  registrations?: RegistrationInfo[];
  tiebreakerDepth?: number;
  tiebreakerMode?: "advanced" | "rapid";
  tournamentDetails?: TournamentDetails;
  groupsCount?: number;
  under12Enabled?: boolean;
  under12SeparateTopcut?: boolean;
  u12SwissRounds?: number | null;
  tableAssignmentEnabled?: boolean;
  matchesPerTable?: number;
  initialMatches?: Match[];
  initialStandings?: Standing[];
  onStatusChange: () => void;
  onDeleteTournament?: () => void;
  onHardDeleteTournament?: () => void;
  onConvertToNewTournament?: () => void;
  isCancelled?: boolean;
  scoringPolicy?: string;
  customSwissWinPoints?: number | null;
  customTopWinPoints?: number | null;
  enabledTiebreakers?: {
    head_to_head: boolean;
    omw: boolean;
    buchholz: boolean;
    gw?: boolean;
    ogw?: boolean;
    gw_diff?: boolean;
    resistance?: boolean;
  } | null;
  /** "all" = full panel (legacy), "settings" = only settings/start/danger, "bracket" = only match controls + views */
  renderMode?: "all" | "settings" | "bracket";
  /** Filtra quali sezioni delle impostazioni mostrare (solo se renderMode='settings'). Default 'all' */
  settingsSection?: "all" | "general" | "format" | "kids" | "tiebreakers" | "scoring" | "advanced" | "payment" | "danger";
}

export const TournamentBracketManager = ({
  tournamentId,
  format,
  swissRounds,
  topCutSize,
  status,
  players,
  maxParticipants,
  isRanked = true,
  checkInEnabled = false,
  hasWaitlist: hasWaitlistProp = true,
  registrations: regsProp = [],
  tiebreakerDepth = 0,
  tiebreakerMode = "advanced",
  tournamentDetails,
  groupsCount: groupsCountProp = 0,
  under12Enabled: under12EnabledProp = false,
  under12SeparateTopcut: under12SeparateTopcutProp = false,
  u12SwissRounds: u12SwissRoundsProp = null,
  tableAssignmentEnabled: tableAssignmentEnabledProp = false,
  matchesPerTable: matchesPerTableProp = 1,
  initialMatches,
  initialStandings,
  onStatusChange,
  onDeleteTournament,
  onHardDeleteTournament,
  onConvertToNewTournament,
  isCancelled = false,
  scoringPolicy: scoringPolicyProp = "staff_only",
  customSwissWinPoints = null,
  customTopWinPoints = null,
  enabledTiebreakers: enabledTiebreakersProp = null,
  renderMode = "all",
  settingsSection = "all",
}: Props) => {
  const swissWin = customSwissWinPoints ?? 4;
  const topEarlyWin = customTopWinPoints ?? 4;
  const topLateWin = customTopWinPoints ?? 7;
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);
  const [fillingFakes, setFillingFakes] = useState(false);
  const [shuffledPlayers, setShuffledPlayers] = useState<Player[]>([]);
  const [activeGroupTab, setActiveGroupTab] = useState(() => groupsCountProp > 0 ? 1 : 0);
  const [groupAssignments, setGroupAssignments] = useState<Map<string, number>>(new Map());
  const [under12Players, setUnder12Players] = useState<Set<string>>(new Set());
  const [preTcScoringMatch, setPreTcScoringMatch] = useState<Match | null>(null);
  const [actionLog, setActionLog] = useState("");

  // Append a line to the action log (stored as single text field)
  const appendLog = useCallback(async (action: string) => {
    const now = new Date();
    const ts = now.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const userName = user?.user_metadata?.username || user?.email?.split("@")[0] || "Sistema";
    const line = `[${ts}] ${userName}: ${action}`;
    const newLog = actionLog ? `${actionLog}\n${line}` : line;
    setActionLog(newLog);
    await supabase.from("tournaments").update({ action_log: newLog } as any).eq("id", tournamentId);
  }, [actionLog, tournamentId, user]);

  // Editable settings
  const [editMaxParticipants, setEditMaxParticipants] = useState(maxParticipants);
  const [editTopCutSize, setEditTopCutSize] = useState(topCutSize || 8);
  const [editTiebreakerDepth, setEditTiebreakerDepth] = useState(tiebreakerDepth);
  const [editTiebreakerMode, setEditTiebreakerMode] = useState<"advanced" | "rapid">(tiebreakerMode);
  const [editGroupsCount, setEditGroupsCount] = useState(groupsCountProp);
  const [editUnder12Enabled, setEditUnder12Enabled] = useState(under12EnabledProp);
  const [editUnder12SeparateTopcut, setEditUnder12SeparateTopcut] = useState(under12SeparateTopcutProp);
  const [editU12SwissRounds, setEditU12SwissRounds] = useState(u12SwissRoundsProp ? String(u12SwissRoundsProp) : "");
  const [editFormat, setEditFormat] = useState(format);
  const [editTableAssignment, setEditTableAssignment] = useState(tableAssignmentEnabledProp);
  const [editMatchesPerTable, setEditMatchesPerTable] = useState(matchesPerTableProp);
  const [showSettings, setShowSettings] = useState(false);
  const [streamingDashboardAlive, setStreamingDashboardAlive] = useState(false);
  const [editScoringPolicy, setEditScoringPolicy] = useState(scoringPolicyProp);
  const defaultTiebreakers = { head_to_head: true, omw: true, buchholz: true, gw: true, ogw: true, gw_diff: true, resistance: true };
  const [editEnabledTiebreakers, setEditEnabledTiebreakers] = useState(enabledTiebreakersProp ?? defaultTiebreakers);

  // Auto-select all child profiles into the Kids group when it's enabled.
  // Players already manually toggled stay as-is; we only ADD children that aren't tracked yet.
  useEffect(() => {
    if (!editUnder12Enabled) return;
    if (!regsProp || regsProp.length === 0) return;
    const childIds = regsProp
      .filter(r => r.child_profile_id && r.status !== "cancelled")
      .map(r => r.child_profile_id as string);
    if (childIds.length === 0) return;
    setUnder12Players(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const id of childIds) {
        if (!next.has(id)) { next.add(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [editUnder12Enabled, regsProp]);


  // Load action log on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tournaments").select("action_log").eq("id", tournamentId).single();
      if (data && (data as any).action_log) setActionLog((data as any).action_log);
    })();
  }, [tournamentId]);

  // Listen for streaming dashboard heartbeat via BroadcastChannel
  useEffect(() => {
    const bc = new BroadcastChannel(STREAMING_HEARTBEAT_CHANNEL);
    let timeout: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timeout);
      setStreamingDashboardAlive(true);
      timeout = setTimeout(() => setStreamingDashboardAlive(false), 5000);
    };
    bc.onmessage = (e) => {
      if (e.data?.tournamentId === tournamentId && e.data?.alive) reset();
    };
    // Ping to get immediate response
    bc.postMessage({ ping: true, tournamentId });
    return () => { clearTimeout(timeout); bc.close(); };
  }, [tournamentId]);

  // Tournament detail editable fields
  const toLocalDatetime = (isoStr: string) => {
    const d = new Date(isoStr);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };

  const [editTitle, setEditTitle] = useState(tournamentDetails?.title || "");
  const [editDescription, setEditDescription] = useState(tournamentDetails?.description || "");
  const [editLocation, setEditLocation] = useState(tournamentDetails?.location || "");
  const [editCity, setEditCity] = useState(tournamentDetails?.city || "");
  const [editEventDate, setEditEventDate] = useState(tournamentDetails?.event_date ? toLocalDatetime(tournamentDetails.event_date) : "");
  const [editRegDeadline, setEditRegDeadline] = useState(tournamentDetails?.registration_deadline ? toLocalDatetime(tournamentDetails.registration_deadline) : "");
  const [editRegOpensAt, setEditRegOpensAt] = useState(tournamentDetails?.registration_opens_at ? toLocalDatetime(tournamentDetails.registration_opens_at) : "");
  const [editEntryFee, setEditEntryFee] = useState(String(tournamentDetails?.entry_fee ?? 0));
  const [editPrize, setEditPrize] = useState(tournamentDetails?.prize_description || "");
  const [editPaymentMethods, setEditPaymentMethods] = useState<string[]>((tournamentDetails?.payment_method || "").split(",").filter(Boolean));
  const [editPaymentLink, setEditPaymentLink] = useState(tournamentDetails?.payment_link || "");
  const [editSwissRounds, setEditSwissRounds] = useState(tournamentDetails?.swiss_rounds ? String(tournamentDetails.swiss_rounds) : "");
  const [editIsPaid, setEditIsPaid] = useState((tournamentDetails?.entry_fee ?? 0) > 0);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [editIsHidden, setEditIsHidden] = useState(false);
  const [editAutoPublishAt, setEditAutoPublishAt] = useState<string>("");
  const [visibilityLoaded, setVisibilityLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("is_hidden, auto_publish_at")
        .eq("id", tournamentId)
        .maybeSingle();
      if (cancelled || !data) return;
      setEditIsHidden(!!(data as any).is_hidden);
      setEditAutoPublishAt(
        (data as any).auto_publish_at ? toLocalDatetime((data as any).auto_publish_at) : ""
      );
      setVisibilityLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [tournamentId]);

  const saveVisibility = async (next: { is_hidden?: boolean; auto_publish_at?: string | null }) => {
    const update: any = {};
    if (next.is_hidden !== undefined) update.is_hidden = next.is_hidden;
    if (next.auto_publish_at !== undefined) {
      update.auto_publish_at = next.auto_publish_at ? new Date(next.auto_publish_at).toISOString() : null;
    }
    const { error } = await supabase.from("tournaments").update(update).eq("id", tournamentId);
    if (error) {
      toast.error("Errore nell'aggiornamento visibilità");
      return false;
    }
    toast.success("Visibilità aggiornata");
    return true;
  };

  const playerMap = new Map(players.map((p) => [p.user_id, p.display_name]));
  const avatarMap = new Map(players.map((p) => [p.user_id, p.avatar_url ?? null]));
  const spotsLeft = Math.max(0, maxParticipants - players.length);

  // Build scored_by map: referee user_id -> display_name
  const [scoredByMap, setScoredByMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const scoredByIds = [...new Set(matches.filter(m => m.scored_by).map(m => m.scored_by!))];
    // Use playerMap for known players, fetch unknown ones
    const unknown = scoredByIds.filter(id => !playerMap.has(id));
    if (unknown.length === 0) {
      setScoredByMap(new Map(scoredByIds.map(id => [id, playerMap.get(id) || "Arbitro"])));
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", unknown);
      const map = new Map<string, string>(scoredByIds.map(id => [id, playerMap.get(id) || "Arbitro"]));
      (data ?? []).forEach((p: any) => map.set(p.user_id, p.display_name || "Arbitro"));
      setScoredByMap(map);
    })();
  }, [matches, players]);

  const notifyPlayers = useCallback(async (playerIds: string[]) => {
    const names = playerIds.map(id => playerMap.get(id) || "Giocatore").join(" vs ");
    const { error } = await supabase.from("notifications").insert(
      playerIds.map(id => ({
        user_id: id,
        type: "match_ready",
        title: "🎯 È il tuo turno!",
        message: `Il tuo match è pronto: ${names}. Presentati al tavolo!`,
        link: window.location.pathname,
        push_sent: true,
      }))
    );
    if (!error) {
      toast.success(`Notifica in-app inviata a ${playerIds.length} giocatore/i`);
    } else {
      toast.info("Impossibile inviare la notifica ai giocatori selezionati");
    }
  }, [playerMap]);

  // Sync editable fields only when the tournament identity changes (initial load / nav).
  // Re-syncing on every tournamentDetails prop change (e.g. realtime refreshes) would
  // overwrite the user's in-progress edits — especially noticeable when typing URLs.
  const lastSyncedTournamentId = useRef<string | null>(null);
  useEffect(() => {
    if (!tournamentDetails) return;
    if (lastSyncedTournamentId.current === tournamentId) return;
    lastSyncedTournamentId.current = tournamentId;
    setEditMaxParticipants(maxParticipants);
    setEditTopCutSize(topCutSize || 8);
    setEditTiebreakerDepth(tiebreakerDepth);
    setEditTiebreakerMode(tiebreakerMode);
    setEditTitle(tournamentDetails.title);
    setEditDescription(tournamentDetails.description || "");
    setEditLocation(tournamentDetails.location);
    setEditCity(tournamentDetails.city);
    setEditEventDate(toLocalDatetime(tournamentDetails.event_date));
    setEditRegDeadline(toLocalDatetime(tournamentDetails.registration_deadline));
    setEditRegOpensAt(tournamentDetails.registration_opens_at ? toLocalDatetime(tournamentDetails.registration_opens_at) : "");
    setEditEntryFee(String(tournamentDetails.entry_fee ?? 0));
    setEditPrize(tournamentDetails.prize_description || "");
    setEditPaymentMethods((tournamentDetails.payment_method || "").split(",").filter(Boolean));
    setEditPaymentLink(tournamentDetails.payment_link || "");
    setEditSwissRounds(tournamentDetails.swiss_rounds ? String(tournamentDetails.swiss_rounds) : "");
    setEditIsPaid((tournamentDetails.entry_fee ?? 0) > 0);
    setDisclaimerAccepted(false);
  }, [tournamentId, tournamentDetails, maxParticipants, topCutSize, tiebreakerDepth, tiebreakerMode]);

  // Auto-adjust top cut size when max participants or ready count changes
  useEffect(() => {
    const readyCount = checkInEnabled ? regsProp.filter(r => r.is_ready).length : editMaxParticipants;
    const effectiveMax = Math.min(editMaxParticipants, readyCount);
    const validOptions = [4, 8, 16, 32].filter(v => {
      if (v === 4) return effectiveMax >= 6;
      return v <= Math.floor(effectiveMax / 2);
    });
    if (!validOptions.includes(editTopCutSize) && validOptions.length > 0) {
      setEditTopCutSize(validOptions[validOptions.length - 1]);
    }
  }, [editMaxParticipants, checkInEnabled, regsProp, editTopCutSize]);


  const fetchData = useCallback(async () => {
    const [mRes, sRes] = await Promise.all([
      supabase
        .from("tournament_matches")
        .select("id, tournament_id, round, match_number, player1_id, player2_id, player1_score, player2_score, winner_id, status, phase, group_number, scored_by, pairing_meta, created_at, updated_at")
        .eq("tournament_id", tournamentId)
        .order("round")
        .order("match_number"),
      supabase
        .from("tournament_standings")
        .select("id, tournament_id, user_id, wins, losses, draws, points, resistance, game_wins, game_losses, dropped, seed, group_number, created_at, updated_at")
        .eq("tournament_id", tournamentId)
        .order("points", { ascending: false })
        .order("resistance", { ascending: false }),
    ]);
    setMatches((mRes.data as Match[]) ?? []);
    setStandings((sRes.data as Standing[]) ?? []);

    // Rebuild under12Players from standings (group_number 99 = Kids)
    const u12FromStandings = ((sRes.data ?? []) as Standing[]).filter(s => s.group_number === 99).map(s => s.user_id);
    if (u12FromStandings.length > 0) {
      setUnder12Players(prev => {
        const merged = new Set(prev);
        u12FromStandings.forEach(id => merged.add(id));
        return merged;
      });
    }

    const swissMatches = (mRes.data ?? []).filter((m: any) => m.phase === "swiss");
    if (swissMatches.length > 0) {
      const maxRound = Math.max(...swissMatches.map((m: any) => m.round));
      const allCompleted = swissMatches
        .filter((m: any) => m.round === maxRound)
        .every((m: any) => m.status === "completed");
      setCurrentRound(allCompleted ? maxRound + 1 : maxRound);
    }
    setLoading(false);
  }, [tournamentId]);

  // Use initial data from parent if available to avoid duplicate queries on mount,
  // but always refetch fresh data to handle remounts after tab switches.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (initialMatches && initialStandings) {
        setMatches(initialMatches);
        setStandings(initialStandings);
        const u12Init = initialStandings.filter(s => s.group_number === 99).map(s => s.user_id);
        if (u12Init.length > 0) {
          setUnder12Players(prev => {
            const merged = new Set(prev);
            u12Init.forEach(id => merged.add(id));
            return merged;
          });
        }
        const swissM = initialMatches.filter((m) => m.phase === "swiss");
        if (swissM.length > 0) {
          const maxR = Math.max(...swissM.map((m) => m.round));
          const allDone = swissM.filter((m) => m.round === maxR).every((m) => m.status === "completed");
          setCurrentRound(allDone ? maxR + 1 : maxR);
        }
        setLoading(false);
      }
      // Always fetch fresh from server (handles tab unmount/remount with stale parent state)
      fetchData();
    }
  }, [fetchData, initialMatches, initialStandings]);

  // Keep internal matches in sync when parent refetches (e.g. after public scoring)
  useEffect(() => {
    if (initializedRef.current && initialMatches) {
      setMatches(initialMatches);
    }
  }, [initialMatches]);

  useEffect(() => {
    if (initializedRef.current && initialStandings) {
      setStandings(initialStandings);
    }
  }, [initialStandings]);

  // ===== SAVE SETTINGS =====
  const saveSettings = async () => {
    if (editIsPaid && editPaymentMethods.includes("paypal") && editPaymentLink.trim() && !disclaimerAccepted) {
      toast.error("Devi accettare il disclaimer sul metodo di pagamento");
      return;
    }

    const updates: any = {};
    if (editMaxParticipants !== maxParticipants) updates.max_participants = editMaxParticipants;
    if (editTopCutSize !== (topCutSize || 8)) updates.top_cut_size = editTopCutSize;
    if (editTiebreakerDepth !== tiebreakerDepth) updates.tiebreaker_depth = editTiebreakerDepth;
    if (editTiebreakerMode !== tiebreakerMode) updates.tiebreaker_mode = editTiebreakerMode;
    if (editGroupsCount !== groupsCountProp) updates.groups_count = editGroupsCount;
    if (editUnder12Enabled !== under12EnabledProp) updates.under12_enabled = editUnder12Enabled;
    if (editUnder12SeparateTopcut !== under12SeparateTopcutProp) updates.under12_separate_topcut = editUnder12SeparateTopcut;
    if (editFormat !== format) updates.format = editFormat;
    if (editTableAssignment !== tableAssignmentEnabledProp) updates.table_assignment_enabled = editTableAssignment;
    const newU12SwissRounds = editU12SwissRounds ? parseInt(editU12SwissRounds) : null;
    if (newU12SwissRounds !== (u12SwissRoundsProp ?? null)) updates.u12_swiss_rounds = newU12SwissRounds;
    if (editMatchesPerTable !== matchesPerTableProp) updates.matches_per_table = editMatchesPerTable;
    if (editScoringPolicy !== scoringPolicyProp) updates.scoring_policy = editScoringPolicy;
    const currentTb = enabledTiebreakersProp ?? defaultTiebreakers;
    const tbChanged = (Object.keys(defaultTiebreakers) as Array<keyof typeof defaultTiebreakers>).some(
      (k) => editEnabledTiebreakers[k] !== currentTb[k]
    );
    if (tbChanged) updates.enabled_tiebreakers = editEnabledTiebreakers;

    // Tournament detail fields
    if (tournamentDetails) {
      if (editTitle.trim() && editTitle !== tournamentDetails.title) updates.title = editTitle.trim();
      {
        const newDescriptionRaw = editDescription.trim();
        const newDescription = newDescriptionRaw ? linkifyAndFormat(newDescriptionRaw) : null;
        if ((newDescription ?? "") !== (tournamentDetails.description ?? "")) {
          updates.description = newDescription;
        }
      }
      if (editLocation.trim() && editLocation !== tournamentDetails.location) updates.location = editLocation.trim();
      if (editCity.trim() && editCity !== tournamentDetails.city) updates.city = editCity.trim();
      if (editEventDate) {
        const newDate = new Date(editEventDate).toISOString();
        if (newDate !== tournamentDetails.event_date) updates.event_date = newDate;
        // Validate ranked weekly limit when changing date
        if (newDate !== tournamentDetails.event_date && isRanked) {
          const eventDate = new Date(editEventDate);
          const dayOfWeek = eventDate.getDay();
          const monday = new Date(eventDate);
          monday.setDate(eventDate.getDate() - ((dayOfWeek + 6) % 7));
          monday.setHours(0, 0, 0, 0);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 7);
          // Find club_id for this tournament
          const { data: tData } = await supabase.from("tournaments").select("club_id").eq("id", tournamentId).single();
          if (tData?.club_id) {
            const { count } = await supabase
              .from("tournaments")
              .select("id", { count: "exact", head: true })
              .eq("club_id", tData.club_id)
              .eq("is_ranked", true)
              .neq("id", tournamentId)
              .gte("event_date", monday.toISOString())
              .lt("event_date", sunday.toISOString());
            // Fetch limit from settings
            const { data: settingsData } = await supabase
              .from("site_settings")
              .select("key, value")
              .eq("key", "competitive_ranked_limit");
            const limit = parseInt(settingsData?.[0]?.value ?? "3") || 3;
            if ((count ?? 0) >= limit) {
              toast.error(`Non puoi spostare il torneo in questa settimana: il club ha già ${count}/${limit} tornei Ranked programmati.`);
              return;
            }
          }
        }
      }
      if (editRegDeadline) {
        const newDeadline = new Date(editRegDeadline).toISOString();
        if (newDeadline !== tournamentDetails.registration_deadline) updates.registration_deadline = newDeadline;
      }
      const newOpensAt = editRegOpensAt ? new Date(editRegOpensAt).toISOString() : null;
      const currentOpensAt = tournamentDetails.registration_opens_at ?? null;
      if (newOpensAt !== currentOpensAt) (updates as any).registration_opens_at = newOpensAt;
      const newFee = editIsPaid ? (parseFloat(editEntryFee) || 0) : 0;
      if (newFee !== (tournamentDetails.entry_fee ?? 0)) updates.entry_fee = newFee;
      if (editPrize !== (tournamentDetails.prize_description || "")) updates.prize_description = editPrize.trim() || null;
      const newPaymentMethod = editIsPaid && editPaymentMethods.length > 0 ? editPaymentMethods.join(",") : null;
      if (newPaymentMethod !== tournamentDetails.payment_method) updates.payment_method = newPaymentMethod;
      const newPaymentLink = editIsPaid && editPaymentMethods.includes("paypal") ? (editPaymentLink.trim() || null) : null;
      if (newPaymentLink !== tournamentDetails.payment_link) updates.payment_link = newPaymentLink;
      const newSwissRounds = editSwissRounds ? parseInt(editSwissRounds) : null;
      if (newSwissRounds !== tournamentDetails.swiss_rounds) updates.swiss_rounds = newSwissRounds;
    }

    if (Object.keys(updates).length === 0) {
      toast.info("Nessuna modifica da salvare");
      return;
    }
    const { error } = await supabase.from("tournaments").update(updates).eq("id", tournamentId);
    if (error) {
      toast.error("Errore nel salvataggio");
      console.error(error);
      return;
    }

    // If the tiebreaker mode changed, delete any pending tiebreaker matches so
    // they regenerate with the new structure (advanced ↔ rapid). Completed
    // tiebreaker matches are preserved to avoid losing results.
    if (updates.tiebreaker_mode !== undefined) {
      const { data: pendingTb } = await supabase
        .from("tournament_matches")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("phase", "tiebreaker")
        .neq("status", "completed");
      const idsToDelete = (pendingTb || []).map((m: any) => m.id);
      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("tournament_matches")
          .delete()
          .in("id", idsToDelete);
        if (delErr) {
          console.error("Errore pulizia spareggi", delErr);
        } else {
          toast.info(`${idsToDelete.length} spareggi rigenerati con la nuova modalità`);
        }
      }
    }

    // If max_participants was lowered, move excess confirmed players to waitlist
    if (updates.max_participants !== undefined && updates.max_participants < maxParticipants) {
      const newMax = updates.max_participants;
      const { data: confirmedRegs, error: fetchErr } = await supabase
        .from("tournament_registrations")
        .select("id, registered_at")
        .eq("tournament_id", tournamentId)
        .eq("status", "confirmed")
        .order("registered_at", { ascending: true });

      console.log("Confirmed regs found:", confirmedRegs?.length, "newMax:", newMax);

      if (fetchErr) {
        console.error("Error fetching regs:", fetchErr);
      } else if (confirmedRegs && confirmedRegs.length > newMax) {
        const excessRegs = confirmedRegs.slice(newMax);
        const excessIds = excessRegs.map(r => r.id);
        console.log("Moving to waitlist:", excessIds.length, excessIds);
        
        // Update one by one to avoid RLS issues with batch updates
        let movedCount = 0;
        for (const regId of excessIds) {
          const { error: upErr } = await supabase
            .from("tournament_registrations")
            .update({ status: "waitlist" })
            .eq("id", regId);
          if (upErr) {
            console.error("Error moving reg to waitlist:", regId, upErr);
          } else {
            movedCount++;
          }
        }
        if (movedCount > 0) {
          toast.info(`${movedCount} giocatore/i spostati in lista d'attesa`);
        }
      }
    }

    // If max_participants was raised, promote waitlisted players to confirmed.
    // Skip for paid tournaments: waitlist = awaiting payment, staff must confirm manually.
    const isPaidTournament = (tournamentDetails?.entry_fee ?? 0) > 0 || (updates.entry_fee ?? 0) > 0;
    if (updates.max_participants !== undefined && updates.max_participants > maxParticipants && !isPaidTournament) {
      const newMax = updates.max_participants;
      const { data: confirmedRegs } = await supabase
        .from("tournament_registrations")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("status", "confirmed");

      const currentConfirmed = confirmedRegs?.length || 0;
      const slotsToFill = newMax - currentConfirmed;

      if (slotsToFill > 0) {
        const { data: waitlistRegs } = await supabase
          .from("tournament_registrations")
          .select("id")
          .eq("tournament_id", tournamentId)
          .eq("status", "waitlist")
          .order("registered_at", { ascending: true })
          .limit(slotsToFill);

        if (waitlistRegs && waitlistRegs.length > 0) {
          let promotedCount = 0;
          for (const reg of waitlistRegs) {
            const { error: upErr } = await supabase
              .from("tournament_registrations")
              .update({ status: "confirmed" })
              .eq("id", reg.id);
            if (!upErr) promotedCount++;
          }
          if (promotedCount > 0) {
            toast.info(`${promotedCount} giocatore/i promossi dalla lista d'attesa`);
          }
        }
      }
    }

    toast.success("Impostazioni aggiornate!");
    // Build detailed log of what changed
    const changedParts: string[] = [];
    if (updates.title) changedParts.push(`titolo→"${updates.title}"`);
    if (updates.max_participants !== undefined) changedParts.push(`max giocatori: ${maxParticipants}→${updates.max_participants}`);
    if (updates.format) changedParts.push(`formato→${updates.format}`);
    if (updates.swiss_rounds !== undefined) changedParts.push(`turni swiss→${updates.swiss_rounds}`);
    if (updates.top_cut_size !== undefined) changedParts.push(`top cut→${updates.top_cut_size}`);
    if (updates.tiebreaker_depth !== undefined) changedParts.push(`spareggi→${updates.tiebreaker_depth}`);
    if (updates.groups_count !== undefined) changedParts.push(`gironi→${updates.groups_count}`);
    if (updates.under12_enabled !== undefined) changedParts.push(`kids: ${updates.under12_enabled ? "ON" : "OFF"}`);
    if (updates.scoring_policy) changedParts.push(`scoring→${updates.scoring_policy}`);
    if (updates.entry_fee !== undefined) changedParts.push(`quota→${updates.entry_fee}€`);
    if (updates.event_date) changedParts.push("data evento modificata");
    if (updates.location) changedParts.push(`luogo→"${updates.location}"`);
    if (updates.city) changedParts.push(`città→"${updates.city}"`);
    if (updates.table_assignment_enabled !== undefined) changedParts.push(`tavoli: ${updates.table_assignment_enabled ? "ON" : "OFF"}`);
    if (updates.matches_per_table !== undefined) changedParts.push(`tavoli/gruppo→${updates.matches_per_table}`);
    if (updates.check_in_enabled !== undefined) changedParts.push(`check-in: ${updates.check_in_enabled ? "ON" : "OFF"}`);
    if (updates.description !== undefined) changedParts.push("descrizione modificata");
    if (updates.prize_description !== undefined) changedParts.push("premi modificati");
    if (updates.payment_method !== undefined) changedParts.push(`pagamento→${updates.payment_method || "nessuno"}`);
    const logDetail = changedParts.length > 0 ? ` (${changedParts.join(", ")})` : "";
    appendLog(`Impostazioni aggiornate${logDetail}`);
    setShowSettings(false);
    onStatusChange();
  };

  // ===== UNDO LAST ROUND (Swiss) =====
  const undoLastSwissRound = async (groupNumber?: number) => {
    const swissM = matches.filter((m) => m.phase === "swiss" && (
      groupNumber === 0 ? m.group_number === null :
      groupNumber != null ? m.group_number === groupNumber : true
    ));
    if (swissM.length === 0) return;
    const maxRound = Math.max(...swissM.map((m) => m.round));
    const roundMatches = swissM.filter((m) => m.round === maxRound);
    const roundMatchIds = roundMatches.map((m) => m.id);

    // Save snapshot before deletion so admin can restore
    try {
      await supabase.from("tournament_round_snapshots" as any).insert({
        tournament_id: tournamentId,
        round: maxRound,
        phase: "swiss",
        group_number: groupNumber ?? null,
        matches_data: roundMatches as any,
        created_by: user?.id ?? null,
      } as any);
    } catch (snapErr) {
      console.warn("Snapshot fallito (procedo comunque):", snapErr);
    }

    const { error } = await supabase
      .from("tournament_matches")
      .delete()
      .in("id", roundMatchIds);

    if (error) {
      toast.error("Errore nell'annullamento del turno");
      console.error(error);
      return;
    }

    const label = groupNumber === 0 ? "Principale" :
      groupNumber != null
        ? groupNumber === 99 ? "Gruppo Kids" : `Gruppo ${String.fromCharCode(64 + groupNumber)}`
        : "";
    toast.success(`Turno ${maxRound}${label ? ` (${label})` : ""} annullato! Snapshot salvato.`);
    appendLog(`Annullato turno ${maxRound}${label ? ` (${label})` : ""} (snapshot salvato)`);
    await recalcStandings();
    fetchData();
    onStatusChange();
  };

  // ===== RESTORE LAST SNAPSHOT =====
  const [restoringSnapshot, setRestoringSnapshot] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(false);

  // Check on mount/refresh whether a restorable snapshot exists for current round
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tournament_round_snapshots" as any)
        .select("id")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false })
        .limit(1);
      setHasSnapshot(!!data && data.length > 0);
    })();
  }, [tournamentId, matches]);

  const restoreLastSnapshot = async () => {
    setRestoringSnapshot(true);
    try {
      const { data: snaps, error } = await supabase
        .from("tournament_round_snapshots" as any)
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error || !snaps || snaps.length === 0) {
        toast.error("Nessuno snapshot disponibile");
        return;
      }
      const snap: any = snaps[0];
      const data: any[] = Array.isArray(snap.matches_data) ? snap.matches_data : [];
      if (data.length === 0) {
        toast.error("Snapshot vuoto");
        return;
      }

      // Delete any current matches for that round/phase/group to avoid duplicates
      const phaseFilter = snap.phase || "swiss";
      const round = snap.round;
      const grp = snap.group_number;
      const currentRoundMatches = matches.filter(m => m.phase === phaseFilter && m.round === round && (
        grp == null ? true : m.group_number === grp
      ));
      if (currentRoundMatches.length > 0) {
        await supabase.from("tournament_matches").delete().in("id", currentRoundMatches.map(m => m.id));
      }

      // Re-insert preserved matches (drop id so new ones are generated, but keep all data)
      const inserts = data.map((m) => ({
        tournament_id: tournamentId,
        round: m.round,
        phase: m.phase,
        match_number: m.match_number,
        player1_id: m.player1_id,
        player2_id: m.player2_id,
        player1_score: m.player1_score,
        player2_score: m.player2_score,
        winner_id: m.winner_id,
        status: m.status,
        group_number: m.group_number ?? null,
        scored_by: m.scored_by ?? null,
      }));
      const { error: insErr } = await supabase.from("tournament_matches").insert(inserts);
      if (insErr) {
        toast.error("Errore nel ripristino");
        console.error(insErr);
        return;
      }

      // Remove snapshot now that it's restored
      await supabase.from("tournament_round_snapshots" as any).delete().eq("id", snap.id);

      toast.success(`Turno ${round} ripristinato (${data.length} match)`);
      appendLog(`♻️ Ripristinato turno ${round} dallo snapshot (${data.length} match)`);
      await recalcStandings();
      fetchData();
      onStatusChange();
    } finally {
      setRestoringSnapshot(false);
    }
  };

  // ===== UNDO SINGLE MATCH =====
  const undoMatch = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.status !== "completed") return;

    // Optimistic UI update
    setMatches(prev => prev.map(m => m.id === matchId ? {
      ...m, winner_id: null, player1_score: 0, player2_score: 0, status: "pending",
    } : m));

    // If top_cut, also need to remove winner from next round match
    if (match.phase === "top_cut" && match.winner_id) {
      const nextRound = match.round + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);
      const isPlayer1 = match.match_number % 2 === 1;
      const nextMatch = matches.find(
        (m) => m.phase === "top_cut" && m.round === nextRound && m.match_number === nextMatchNumber
      );
      if (nextMatch) {
        const clearField = isPlayer1 ? { player1_id: null } : { player2_id: null };
        setMatches(prev => prev.map(m => m.id === nextMatch.id ? { ...m, ...clearField } : m));
        await supabase.from("tournament_matches").update(clearField).eq("id", nextMatch.id);
      }

      // Also clear loser from 3rd/4th place match if this was a semifinal
      const topCutMatches = matches.filter(m => m.phase === "top_cut");
      const maxRound = Math.max(...topCutMatches.map(m => m.round));
      const isSemifinal = match.round === maxRound - 1;
      if (isSemifinal) {
        const thirdPlaceMatch = matches.find(
          (m) => m.phase === "top_cut" && m.round === maxRound && m.match_number === 2
        );
        if (thirdPlaceMatch) {
          const loserSlotClear = match.match_number % 2 === 1 ? { player1_id: null } : { player2_id: null };
          setMatches(prev => prev.map(m => m.id === thirdPlaceMatch.id ? { ...m, ...loserSlotClear } : m));
          await supabase.from("tournament_matches").update(loserSlotClear).eq("id", thirdPlaceMatch.id);
        }
      }

      // Delete tiebreaker matches where either player of the undone match is involved
      // (covers both same-round tiebreakers and any round where these players appear)
      if (tiebreakerDepth > 0) {
        const loserId = match.player1_id === match.winner_id ? match.player2_id : match.player1_id;
        // Delete all tiebreaker matches from the same round (generated when all round matches completed)
        // AND any tiebreaker match involving the loser of this undone match
        const { data: tbMatches } = await supabase
          .from("tournament_matches")
          .select("id")
          .eq("tournament_id", tournamentId)
          .eq("phase", "tiebreaker")
          .or(`round.eq.${match.round}${loserId ? `,player1_id.eq.${loserId},player2_id.eq.${loserId}` : ""}`);
        if (tbMatches && tbMatches.length > 0) {
          const tbIds = tbMatches.map(m => m.id);
          await supabase.from("tournament_matches").delete().in("id", tbIds);
          setMatches(prev => prev.filter(m => !tbIds.includes(m.id)));
        }
      }
    }

    // If tiebreaker match, also clear winner from next tiebreaker round
    if (match.phase === "tiebreaker" && match.winner_id) {
      const nextRound = match.round + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);
      const isPlayer1 = match.match_number % 2 === 1;
      const nextMatch = matches.find(
        (m) => m.phase === "tiebreaker" && m.round === nextRound && m.match_number === nextMatchNumber
      );
      if (nextMatch) {
        const clearField = isPlayer1 ? { player1_id: null } : { player2_id: null };
        setMatches(prev => prev.map(m => m.id === nextMatch.id ? { ...m, ...clearField } : m));
        await supabase.from("tournament_matches").update(clearField).eq("id", nextMatch.id);
      }
    }

    const { error } = await supabase
      .from("tournament_matches")
      .update({
        winner_id: null,
        player1_score: 0,
        player2_score: 0,
        status: "pending",
      })
      .eq("id", matchId);

    if (error) {
      toast.error("Errore nell'annullamento del match");
      fetchData(); // revert on error
      return;
    }

    toast.success("Match annullato, puoi reinserire il risultato");
    // Full recalc needed for undo
    await recalcStandings();
    fetchData();
  };

  // ===== ADMIN: FORCE COMPLETE PENDING MATCH =====
  const forceCompleteMatch = async (matchId: string, winnerId: string, p1Score: number, p2Score: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    await handleMatchResult(matchId, winnerId, p1Score, p2Score);
    appendLog(`🔧 Admin: forzato completamento match #${match.match_number} (round ${match.round}, ${match.phase})`);
  };

  // ===== ADMIN: CANCEL BYE AND REASSIGN AS WIN =====
  const cancelByeAndReassign = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.player2_id !== null) return; // only for BYE matches

    // Undo the BYE match first
    await supabase.from("tournament_matches").update({
      status: "completed",
      winner_id: match.player1_id,
      player1_score: 2,
      player2_score: 0,
    }).eq("id", matchId);

    toast.success("Match BYE confermato come vittoria");
    appendLog(`🔧 Admin: BYE match #${match.match_number} confermato come WIN per ${playerMap.get(match.player1_id || "") || "?"}`);
    await recalcStandings();
    fetchData();
  };

  // ===== ADMIN: REVOKE BYE (set match to pending with no winner) =====
  const revokeBye = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    await supabase.from("tournament_matches").update({
      status: "pending",
      winner_id: null,
      player1_score: 0,
      player2_score: 0,
    }).eq("id", matchId);

    toast.success("BYE annullato, match in attesa di avversario");
    appendLog(`🔧 Admin: BYE annullato per match #${match.match_number} (round ${match.round})`);
    await recalcStandings();
    fetchData();
  };

  // ===== ADMIN: FORCE ADVANCE TO NEXT ROUND =====
  const forceAdvanceRound = async () => {
    const swissOnly = matches.filter(m => m.phase === "swiss");
    const currentMaxRound = swissOnly.length > 0 ? Math.max(...swissOnly.map(m => m.round)) : 0;
    const pendingMatches = swissOnly.filter(m => m.round === currentMaxRound && m.status === "pending");
    
    for (const m of pendingMatches) {
      if (m.player2_id === null) {
        await supabase.from("tournament_matches").update({
          status: "completed", winner_id: m.player1_id,
          player1_score: 2, player2_score: 0,
        }).eq("id", m.id);
      } else {
        await supabase.from("tournament_matches").update({
          status: "completed", winner_id: null,
          player1_score: 0, player2_score: 0,
        }).eq("id", m.id);
      }
    }

    toast.success(`${pendingMatches.length} match forzati come completati`);
    appendLog(`🔧 Admin: forzato completamento di ${pendingMatches.length} match nel round ${currentMaxRound}`);
    await recalcStandings();
    fetchData();
  };

  const resetTournament = async () => {
    // Delete all matches
    await supabase.from("tournament_matches").delete().eq("tournament_id", tournamentId);
    // Delete all standings
    await supabase.from("tournament_standings").delete().eq("tournament_id", tournamentId);
    // Delete all tournament results (points) so rankings are recalculated
    await supabase.from("tournament_results").delete().eq("tournament_id", tournamentId);
    // Set status back to pending
    await supabase.from("tournaments").update({ status: "pending" }).eq("id", tournamentId);
    // Recalculate national rankings to reflect the removed results
    await supabase.rpc("recalculate_all_rankings");

    toast.success("Torneo resettato! Le iscrizioni sono riaperte e le classifiche aggiornate.");
    appendLog("⚠️ Torneo resettato — match, classifiche e risultati eliminati");
    onStatusChange();
    fetchData();
  };

  const fillWithFakeUsers = async (count: number) => {
    setFillingFakes(true);
    try {
      // Fetch existing BOT profiles
      const { data: botProfiles, error: botError } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .like("display_name", "[BOT]%");

      if (botError || !botProfiles || botProfiles.length === 0) {
        toast.error("Nessun profilo [BOT] trovato nel database");
        setFillingFakes(false);
        return;
      }

      // Get already registered user_ids to avoid duplicates
      const { data: existingRegs } = await supabase
        .from("tournament_registrations")
        .select("user_id")
        .eq("tournament_id", tournamentId);
      const registeredIds = new Set((existingRegs ?? []).map((r: any) => r.user_id));

      const availableBots = botProfiles.filter((b: any) => !registeredIds.has(b.user_id));
      const slotsToFill = Math.min(count, availableBots.length);

      if (slotsToFill === 0) {
        toast.error("Tutti i BOT sono già registrati o non ce ne sono abbastanza");
        setFillingFakes(false);
        return;
      }

      const selectedBots = availableBots.sort(() => Math.random() - 0.5).slice(0, slotsToFill);

      for (const bot of selectedBots) {
        const { error: regError } = await supabase.from("tournament_registrations").insert({
          tournament_id: tournamentId,
          user_id: bot.user_id,
          status: "confirmed",
        });

        if (regError) {
          console.error("Registration insert error:", regError);
        }
      }

      toast.success(`${slotsToFill} BOT aggiunti al torneo!`);
      onStatusChange();
    } catch (err) {
      console.error(err);
      toast.error("Errore nel riempimento");
    } finally {
      setFillingFakes(false);
    }
  };

  const shufflePlayers = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setShuffledPlayers(shuffled);
    toast.success("Ordine giocatori mescolato!");
  };

  // Keep shuffledPlayers in sync when players change
  useEffect(() => {
    setShuffledPlayers(prev => {
      if (prev.length === 0) return players;
      // Keep existing order but add/remove as needed
      const currentIds = new Set(players.map(p => p.user_id));
      const filtered = prev.filter(p => currentIds.has(p.user_id));
      const existingIds = new Set(filtered.map(p => p.user_id));
      const newPlayers = players.filter(p => !existingIds.has(p.user_id));
      return [...filtered, ...newPlayers];
    });
  }, [players]);

  // Max Swiss rounds based on player count to prevent point farming (only for ranked).
  // Note: when groups are enabled, the caller passes the AVERAGE per-group player count
  // (calcSwissRounds computes it), so this cap reflects per-group size and not the total.
  const getMaxSwissRounds = (playerCount: number) => {
    // Normal tournaments have no round limit
    if (!isRanked) return 999;
    if (playerCount < 4) return 3;
    // For small groups, allow up to N-1 rounds (full round-robin equivalent)
    if (playerCount < 8) return Math.max(3, playerCount - 1); // 4–7 players → up to N-1 rounds
    if (playerCount <= 16) return 5;   // 8–16 players → up to 5 rounds
    if (playerCount <= 32) return 6;
    if (playerCount <= 64) return 7;
    if (playerCount <= 128) return 8;
    return 9;
  };

  const calcSwissRounds = (groupNumber?: number) => {
    // For kids group, use separate u12SwissRounds if set
    if (groupNumber === 99) {
      const u12Val = editU12SwissRounds ? parseInt(editU12SwissRounds) : (u12SwissRoundsProp ?? null);
      const u12Count = standings.filter(s => s.group_number === 99).length || under12Players.size;
      if (format === "round_robin" || format === "round_robin_top_cut") {
        return u12Count % 2 === 0 ? Math.max(u12Count - 1, 1) : Math.max(u12Count, 1);
      }
      const maxAllowed = getMaxSwissRounds(u12Count);
      if (u12Val) return Math.min(u12Val, maxAllowed);
      return Math.max(3, Math.min(Math.ceil(Math.log2(Math.max(u12Count, 2))), maxAllowed));
    }

    // For main groups, count only non-U12 players
    const mainPlayerCount = under12Players.size > 0
      ? players.filter(p => !under12Players.has(p.user_id)).length
      : players.length;

    // When groups are used, cap rounds based on per-group size (not total)
    const effectiveGroupsForCalc = editGroupsCount > 0 ? editGroupsCount : 0;
    const perGroupCount = effectiveGroupsForCalc > 0
      ? Math.ceil(mainPlayerCount / effectiveGroupsForCalc)
      : mainPlayerCount;

    if (format === "round_robin" || format === "round_robin_top_cut") {
      const n = perGroupCount;
      return n % 2 === 0 ? Math.max(n - 1, 1) : Math.max(n, 1);
    }
    const maxAllowed = getMaxSwissRounds(perGroupCount);
    if (swissRounds) return Math.min(swissRounds, maxAllowed);
    return Math.max(3, Math.min(Math.ceil(Math.log2(Math.max(perGroupCount, 2))), maxAllowed));
  };

  // Distribute players to groups preferring even-sized groups to minimize BYEs
  // e.g. 22 players / 4 groups → 6,6,6,4 (all even) instead of 6,6,5,5 (two odd = two BYEs)
  const getEvenGroupForIndex = (idx: number, totalPlayers: number, groupsCount: number): number => {
    if (groupsCount <= 0) return 1;
    // Calculate group sizes that prefer even numbers
    const groupSizes: number[] = [];
    if (totalPlayers % 2 === 0) {
      // All groups can be even: distribute pairs evenly
      const pairs = totalPlayers / 2;
      const basePairs = Math.floor(pairs / groupsCount);
      const extraPairs = pairs % groupsCount;
      for (let i = 0; i < groupsCount; i++) {
        groupSizes.push((basePairs + (i < extraPairs ? 1 : 0)) * 2);
      }
    } else {
      // Odd total: make all groups even except the last one (which gets +1)
      const evenTotal = totalPlayers - 1;
      const pairs = evenTotal / 2;
      const basePairs = Math.floor(pairs / groupsCount);
      const extraPairs = pairs % groupsCount;
      for (let i = 0; i < groupsCount; i++) {
        groupSizes.push((basePairs + (i < extraPairs ? 1 : 0)) * 2);
      }
      groupSizes[groupSizes.length - 1] += 1; // last group gets the odd player
    }
    // Find which group this index falls into
    let cumulative = 0;
    for (let g = 0; g < groupSizes.length; g++) {
      cumulative += groupSizes[g];
      if (idx < cumulative) return g + 1;
    }
    return groupsCount;
  };

  const startTournament = async () => {
    // Use shuffled order if available
    let eligiblePlayers = (shuffledPlayers.length > 0 ? shuffledPlayers : players).filter((p) => !!p.user_id);
    if (checkInEnabled && regsProp.length > 0) {
      const readyUserIds = new Set(regsProp.filter(r => r.is_ready).map(r => r.child_profile_id || r.user_id));
      eligiblePlayers = eligiblePlayers.filter(p => readyUserIds.has(p.user_id));
    }

    const uniquePlayers = Array.from(
      new Map(eligiblePlayers.map((p) => [p.user_id, p])).values()
    );

    // Auto-shuffle if not manually shuffled
    const shuffled = shuffledPlayers.length > 0 ? uniquePlayers : uniquePlayers.sort(() => Math.random() - 0.5);

    // Respect max participants cap - only take the first N players
    const finalPlayers = editMaxParticipants && editMaxParticipants > 0
      ? shuffled.slice(0, editMaxParticipants)
      : shuffled;

    const minPlayers = isRanked ? 8 : 2;
    if (finalPlayers.length < minPlayers) {
      toast.error(isRanked
        ? `Servono almeno 8 giocatori per avviare un torneo Ranked (attuali: ${finalPlayers.length})`
        : (checkInEnabled ? "Servono almeno 2 giocatori pronti" : "Servono almeno 2 giocatori"));
      return;
    }

    // Validate swiss rounds vs player count for ranked.
    // When groups are used, the cap is based on per-group size (not total players),
    // and U12/kids players are excluded from the main groups count.
    if (isRanked) {
      const u12EnabledForCalc = editUnder12Enabled && under12Players.size >= 8;
      const mainPlayerCount = u12EnabledForCalc
        ? finalPlayers.filter(p => !under12Players.has(p.user_id)).length
        : finalPlayers.length;
      const groupsForCalc = editGroupsCount > 0 ? editGroupsCount : 0;
      const perGroupCount = groupsForCalc > 0
        ? Math.ceil(mainPlayerCount / groupsForCalc)
        : mainPlayerCount;
      const maxAllowed = getMaxSwissRounds(perGroupCount);
      const selectedRounds = editSwissRounds ? parseInt(editSwissRounds) : calcSwissRounds();
      if (selectedRounds > maxAllowed) {
        const groupHint = groupsForCalc > 0
          ? ` (${groupsForCalc} gironi da ~${perGroupCount} giocatori)`
          : "";
        toast.error(`Con questa configurazione${groupHint} puoi fare massimo ${maxAllowed} turni Swiss. Riduci i turni nelle impostazioni.`);
        return;
      }
    }

    // Validate top cut size vs actual player count (only for Ranked tournaments).
    // Normal tournaments have full freedom over their settings.
    if (isRanked && (editFormat === "swiss_top_cut" || editFormat === "round_robin_top_cut")) {
      const effectiveTopCut = editTopCutSize || topCutSize || 8;
      if (effectiveTopCut === 4 && finalPlayers.length < 6) {
        toast.error(`Servono almeno 6 giocatori per Top 4 (attuali: ${finalPlayers.length}). Riduci la Top Cut.`);
        return;
      }
      if (effectiveTopCut > 4 && effectiveTopCut > Math.floor(finalPlayers.length / 2)) {
        toast.error(`Servono almeno ${effectiveTopCut * 2} giocatori per Top ${effectiveTopCut} (attuali: ${finalPlayers.length}). Riduci la Top Cut.`);
        return;
      }
    }

    // Idempotent start: clear possible partial data from previous failed attempts
    const [clearMatchesRes, clearStandingsRes] = await Promise.all([
      supabase.from("tournament_matches").delete().eq("tournament_id", tournamentId),
      supabase.from("tournament_standings").delete().eq("tournament_id", tournamentId),
    ]);

    if (clearMatchesRes.error || clearStandingsRes.error) {
      toast.error("Errore nella pulizia dati pre-avvio");
      console.error(clearMatchesRes.error || clearStandingsRes.error);
      return;
    }

    const effectiveGroups = editGroupsCount > 0 ? editGroupsCount : 0;
    const MIN_KIDS_FOR_GROUP = 8;
    const u12Enabled = editUnder12Enabled && under12Players.size >= MIN_KIDS_FOR_GROUP;
    if (editUnder12Enabled && under12Players.size > 0 && under12Players.size < MIN_KIDS_FOR_GROUP) {
      toast.warning(`Gruppo Kids disattivato: servono almeno ${MIN_KIDS_FOR_GROUP} bambini (presenti ${under12Players.size}). I bambini saranno inseriti nei gironi principali.`);
    }

    // Assign groups if enabled - use manual assignments if available, otherwise auto-divide
    // U12 players get group_number = 99
    const nonU12Players = u12Enabled ? finalPlayers.filter(p => !under12Players.has(p.user_id)) : finalPlayers;
    const u12PlayersList = u12Enabled ? finalPlayers.filter(p => under12Players.has(p.user_id)) : [];

    const standingsInsert = finalPlayers.map((p, i) => {
      if (u12Enabled && under12Players.has(p.user_id)) {
        return {
          tournament_id: tournamentId,
          user_id: p.user_id,
          seed: i + 1,
          group_number: 99,
        };
      }
      // For non-U12 players, use group assignments among non-U12 only
      const nonU12Idx = nonU12Players.findIndex(np => np.user_id === p.user_id);
      return {
        tournament_id: tournamentId,
        user_id: p.user_id,
        seed: i + 1,
        group_number: effectiveGroups > 0
          ? (groupAssignments.get(p.user_id) || getEvenGroupForIndex(nonU12Idx, nonU12Players.length, effectiveGroups))
          : null,
      };
    });

    const { error: sErr } = await supabase.from("tournament_standings").insert(standingsInsert);
    if (sErr) {
      toast.error(`Errore nella creazione delle classifiche: ${sErr.message}`);
      console.error(sErr);
      return;
    }

    const phase = format === "single_elimination" ? "top_cut" : "swiss";

    if (format === "single_elimination") {
      await generateSingleEliminationBracket(finalPlayers);
    } else if (format === "round_robin" || format === "round_robin_top_cut") {
      // Round Robin: generate ALL rounds at once
      if (effectiveGroups > 0 || u12Enabled) {
        // When groups or U12 are active, DON'T generate rounds here.
        // Each group tab has its own "Genera Turno 1" button for independent control.
      } else {
        await generateAllRoundRobinRounds(nonU12Players);
      }
    } else {
      // Swiss: generate round 1
      if (effectiveGroups > 0 || u12Enabled) {
        // When groups or U12 are active, DON'T generate round 1 here.
        // Each group tab has its own "Genera Turno 1" button for independent control.
      } else {
        await generateSwissRound(1, nonU12Players);
      }
    }

    await supabase.from("tournaments").update({ status: phase }).eq("id", tournamentId);
    const hasPerGroupStart = (effectiveGroups > 0 || u12Enabled) && format !== "single_elimination";
    toast.success(hasPerGroupStart ? "Torneo avviato! Genera i turni da ogni gruppo." : "Torneo avviato!");
    appendLog(`Torneo avviato — ${finalPlayers.length} giocatori, formato: ${format}, ${isRanked ? "RANKED" : "NORMAL"}${effectiveGroups > 0 ? `, ${effectiveGroups} gironi` : ""}${u12Enabled ? ", Kids ON" : ""}`);
    onStatusChange();
    fetchData();
  };

  const generateSwissRound = async (round: number, activePlayers?: Player[], groupNumber?: number, freshStandings?: Standing[], freshMatchesOverride?: Match[]) => {
    // Use fresh data if provided (avoids stale React state)
    const effectiveStandings = freshStandings ?? standings;
    const effectiveMatches = freshMatchesOverride ?? matches;
    let playersForRound: { user_id: string }[];

    if (activePlayers) {
      const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
      playersForRound = shuffled;
    } else if (groupNumber) {
      // Use standings to get group members (works for any round including round 1 regeneration)
      const groupStandings = effectiveStandings
        .filter((s) => !s.dropped && s.group_number === groupNumber);
      if (groupStandings.length > 0) {
        if (round === 1) {
          const shuffled = [...groupStandings].sort(() => Math.random() - 0.5);
          playersForRound = shuffled;
        } else {
          playersForRound = [...groupStandings].sort((a, b) => b.points - a.points || b.resistance - a.resistance);
        }
      } else {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        playersForRound = shuffled;
      }
    } else if (round === 1) {
      // If fresh standings were provided (e.g. per-group start), use them to avoid including wrong players
      if (freshStandings && freshStandings.length > 0) {
        const nonDropped = effectiveStandings.filter(s => !s.dropped);
        playersForRound = [...nonDropped].sort(() => Math.random() - 0.5);
      } else {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        playersForRound = shuffled;
      }
    } else {
      const activeStandings = effectiveStandings
        .filter((s) => !s.dropped)
        .sort((a, b) => b.points - a.points || b.resistance - a.resistance);
      playersForRound = activeStandings;
    }

    // Filter matches for rematch check to only consider same group
    const groupMatches = groupNumber
      ? effectiveMatches.filter(m => m.group_number === groupNumber)
      : effectiveMatches;

    // Build a set of previous matchups for O(1) lookup
    const previousMatchups = new Set<string>();
    groupMatches.forEach(m => {
      if (m.phase === "swiss" && m.player1_id && m.player2_id) {
        previousMatchups.add(`${m.player1_id}__${m.player2_id}`);
        previousMatchups.add(`${m.player2_id}__${m.player1_id}`);
      }
    });

    const havePlayed = (a: string, b: string) => previousMatchups.has(`${a}__${b}`);

    // Track players who already had a BYE in previous rounds
    const playersWithBye = new Set<string>();
    groupMatches.forEach(m => {
      if (m.phase === "swiss" && m.status === "completed" && !m.player2_id && m.player1_id) {
        playersWithBye.add(m.player1_id);
      }
    });

    const pairs: { p1: string; p2: string | null }[] = [];
    const remaining = [...playersForRound];

    // BYE: lowest-ranked player who hasn't had one yet
    if (remaining.length % 2 === 1) {
      let byeIdx = -1;
      for (let i = remaining.length - 1; i >= 0; i--) {
        if (!playersWithBye.has(remaining[i].user_id)) {
          byeIdx = i;
          break;
        }
      }
      if (byeIdx === -1) byeIdx = remaining.length - 1;
      const byePlayer = remaining.splice(byeIdx, 1)[0];
      pairs.push({ p1: byePlayer.user_id, p2: null });
    }

    // ===== Proper Swiss score-group pairing =====
    // Players are already sorted high-to-low by points (resistance tiebreak).
    // 1. Split into score groups (same `points`).
    // 2. If a group has odd size, drop the lowest of that group into the next group ("float down").
    // 3. Within each group, pair using the standard "fold" method (top half vs bottom half),
    //    swapping rematches with adjacent pairings inside the same group.
    // This prevents the previous bug where a 4-0 could end up paired against a 0-4.

    type Std = typeof remaining[number];
    // Group by points
    const scoreGroups: Std[][] = [];
    for (const p of remaining) {
      const pts = (p as any).points ?? 0;
      const last = scoreGroups[scoreGroups.length - 1];
      if (!last || ((last[0] as any).points ?? 0) !== pts) {
        scoreGroups.push([p]);
      } else {
        last.push(p);
      }
    }

    // Float down odd-sized groups (carry the lowest into the next group)
    for (let g = 0; g < scoreGroups.length - 1; g++) {
      if (scoreGroups[g].length % 2 === 1) {
        const floater = scoreGroups[g].pop()!;
        scoreGroups[g + 1].unshift(floater);
      }
    }
    // If the last group ended up odd (shouldn't normally if total is even), fold it back up
    if (scoreGroups.length && scoreGroups[scoreGroups.length - 1].length % 2 === 1) {
      const last = scoreGroups[scoreGroups.length - 1];
      const floater = last.shift()!;
      if (scoreGroups.length >= 2) scoreGroups[scoreGroups.length - 2].push(floater);
      else last.push(floater); // single group, give up
    }

    // Pair each group with the fold method, then locally swap to avoid rematches
    const groupPairs: { p1: string; p2: string }[] = [];
    for (const grp of scoreGroups) {
      if (grp.length < 2) continue;
      const half = grp.length / 2;
      const top = grp.slice(0, half);
      const bot = grp.slice(half);

      const local: { p1: string; p2: string }[] = [];
      for (let i = 0; i < half; i++) {
        local.push({ p1: top[i].user_id, p2: bot[i].user_id });
      }

      // Try to resolve rematches by swapping bottom-half partners within the group
      for (let i = 0; i < local.length; i++) {
        if (!havePlayed(local[i].p1, local[i].p2)) continue;
        let swapped = false;
        for (let j = 0; j < local.length; j++) {
          if (i === j) continue;
          if (
            !havePlayed(local[i].p1, local[j].p2) &&
            !havePlayed(local[j].p1, local[i].p2)
          ) {
            const tmp = local[i].p2;
            local[i].p2 = local[j].p2;
            local[j].p2 = tmp;
            swapped = true;
            break;
          }
        }
        // If unresolvable inside the group, accept the rematch (rare in real Swiss)
        if (!swapped) {
          // last-resort: try swapping with a different group later via global pass
        }
      }

      groupPairs.push(...local);
    }

    pairs.push(...groupPairs);

    // Final cross-group rematch resolution: swap p2 across pairs (still preserves
    // closeness because we only swap if the new pairing is also rematch-free)
    for (let a = 0; a < pairs.length; a++) {
      if (!pairs[a].p2) continue;
      if (!havePlayed(pairs[a].p1, pairs[a].p2)) continue;
      for (let b = 0; b < pairs.length; b++) {
        if (b === a || !pairs[b].p2) continue;
        if (
          !havePlayed(pairs[a].p1, pairs[b].p2) &&
          !havePlayed(pairs[b].p1, pairs[a].p2)
        ) {
          const tmp = pairs[a].p2;
          pairs[a].p2 = pairs[b].p2;
          pairs[b].p2 = tmp;
          break;
        }
      }
    }

    const matchInserts = pairs.map((pair, idx) => ({
      tournament_id: tournamentId,
      round,
      phase: "swiss",
      match_number: idx + 1,
      player1_id: pair.p1,
      player2_id: pair.p2,
      status: pair.p2 ? "pending" : "completed",
      winner_id: pair.p2 ? null : pair.p1,
      player1_score: pair.p2 ? 0 : 4,
      player2_score: 0,
      group_number: groupNumber || null,
    }));

    const { error } = await supabase.from("tournament_matches").insert(matchInserts);
    if (error) {
      toast.error("Errore nella generazione del round");
      console.error(error);
    }
  };

  // ===== ROUND ROBIN GENERATION =====
  const generateAllRoundRobinRounds = async (rrPlayers: Player[], groupNumber?: number) => {
    const playerList = [...rrPlayers];
    const hasBye = playerList.length % 2 === 1;
    if (hasBye) {
      playerList.push({ user_id: "", display_name: "BYE" }); // ghost player for BYE
    }
    const n = playerList.length;
    const totalRounds = n - 1;

    // Circle method: fix first player, rotate the rest
    const fixed = playerList[0];
    const rotating = playerList.slice(1);

    const allMatchInserts: any[] = [];

    for (let round = 1; round <= totalRounds; round++) {
      const currentOrder = [fixed, ...rotating];
      const pairs: { p1: string; p2: string | null }[] = [];

      for (let i = 0; i < n / 2; i++) {
        const p1 = currentOrder[i];
        const p2 = currentOrder[n - 1 - i];
        const p1Id = p1.user_id || null;
        const p2Id = p2.user_id || null;

        if (!p1Id && !p2Id) continue; // both BYE, skip
        
        const isBye = !p1Id || !p2Id;
        const realPlayer = p1Id || p2Id;

        pairs.push({
          p1: p1Id || realPlayer!,
          p2: isBye ? null : p2Id,
        });
      }

      pairs.forEach((pair, idx) => {
        allMatchInserts.push({
          tournament_id: tournamentId,
          round,
          phase: "swiss", // reuse swiss phase for RR matches
          match_number: idx + 1,
          player1_id: pair.p1,
          player2_id: pair.p2,
          status: pair.p2 ? "pending" : "completed",
          winner_id: pair.p2 ? null : pair.p1,
          player1_score: pair.p2 ? 0 : 4,
          player2_score: 0,
          group_number: groupNumber || null,
        });
      });

      // Rotate: move last to second position
      rotating.unshift(rotating.pop()!);
    }

    const { error } = await supabase.from("tournament_matches").insert(allMatchInserts);
    if (error) {
      toast.error("Errore nella generazione dei turni Round Robin");
      console.error(error);
    }
  };

  // FIBeGS top-cut bracket order keeps the highest seeds apart until the latest possible rounds.
  // size 8: [1,8,4,5,3,6,2,7] → 1vs8, 4vs5, 3vs6, 2vs7.
  const buildBracketSeedOrder = (size: number): number[] => {
    const orders: Record<number, number[]> = {
      2: [1, 2],
      4: [1, 4, 2, 3],
      8: [1, 8, 4, 5, 3, 6, 2, 7],
      16: [1, 16, 8, 9, 4, 13, 5, 12, 3, 14, 6, 11, 7, 10, 2, 15],
      32: [1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 3, 30, 14, 19, 6, 27, 11, 22, 7, 26, 10, 23, 2, 31, 15, 18],
    };
    return orders[size] ?? [];
  };

  const generateSingleEliminationBracket = async (bracketPlayers: Player[]) => {
    const size = Math.pow(2, Math.ceil(Math.log2(bracketPlayers.length)));
    const seeded = [...bracketPlayers];
    while (seeded.length < size) seeded.push({ user_id: "", display_name: "BYE" });

    const totalRounds = Math.log2(size);
    const matchInserts: any[] = [];

    // Track BYE winners per first-round match so we can pre-fill round 2 slots
    const byeWinnersByMatchNum = new Map<number, string>();

    const seedOrder = buildBracketSeedOrder(size);
    for (let i = 0; i < size / 2; i++) {
      const p1 = seeded[seedOrder[i * 2] - 1];
      const p2 = seeded[seedOrder[i * 2 + 1] - 1];
      const isBye = !p2.user_id;
      if (isBye && p1.user_id) byeWinnersByMatchNum.set(i + 1, p1.user_id);
      matchInserts.push({
        tournament_id: tournamentId,
        round: 1,
        phase: "top_cut",
        match_number: i + 1,
        player1_id: p1.user_id || null,
        player2_id: p2.user_id || null,
        status: isBye ? "completed" : "pending",
        winner_id: isBye ? p1.user_id : null,
        player1_score: isBye ? 4 : 0,
        player2_score: 0,
      });
    }

    let matchesInRound = size / 4;
    for (let round = 2; round <= totalRounds; round++) {
      for (let i = 0; i < matchesInRound; i++) {
        const matchNum = i + 1;
        let p1Pre: string | null = null;
        let p2Pre: string | null = null;
        if (round === 2) {
          // Match (round 2, matchNum) takes winners of round 1 matches (2*matchNum - 1) and (2*matchNum)
          p1Pre = byeWinnersByMatchNum.get(2 * matchNum - 1) ?? null;
          p2Pre = byeWinnersByMatchNum.get(2 * matchNum) ?? null;
        }
        matchInserts.push({
          tournament_id: tournamentId,
          round,
          phase: "top_cut",
          match_number: matchNum,
          player1_id: p1Pre,
          player2_id: p2Pre,
          status: "pending",
        });
      }
      matchesInRound = matchesInRound / 2;
    }

    // Add 3rd/4th place match (same round as final, match_number 2)
    if (totalRounds >= 2 && tiebreakerDepth >= 4) {
      matchInserts.push({
        tournament_id: tournamentId,
        round: totalRounds,
        phase: "top_cut",
        match_number: 2,
        player1_id: null,
        player2_id: null,
        status: "pending",
      });
    }

    const { error } = await supabase.from("tournament_matches").insert(matchInserts);
    if (error) {
      toast.error("Errore nella generazione del bracket");
      console.error(error);
    }
  };

  const generateTopCutBracketWithTbdSlots = async (qualifiedPlayers: Player[], topCutSize: number) => {
    const size = Math.pow(2, Math.ceil(Math.log2(topCutSize)));
    const seeded: Array<Player | null> = [...qualifiedPlayers.slice(0, size)];
    while (seeded.length < size) seeded.push(null);

    const totalRounds = Math.log2(size);
    const matchInserts: any[] = [];

    const seedOrder = buildBracketSeedOrder(size);
    for (let i = 0; i < size / 2; i++) {
      const p1 = seeded[seedOrder[i * 2] - 1];
      const p2 = seeded[seedOrder[i * 2 + 1] - 1];
      matchInserts.push({
        tournament_id: tournamentId,
        round: 1,
        phase: "top_cut",
        match_number: i + 1,
        player1_id: p1?.user_id || null,
        player2_id: p2?.user_id || null,
        status: "pending",
        winner_id: null,
        player1_score: 0,
        player2_score: 0,
      });
    }

    let matchesInRound = size / 4;
    for (let round = 2; round <= totalRounds; round++) {
      for (let i = 0; i < matchesInRound; i++) {
        matchInserts.push({
          tournament_id: tournamentId,
          round,
          phase: "top_cut",
          match_number: i + 1,
          player1_id: null,
          player2_id: null,
          status: "pending",
        });
      }
      matchesInRound = matchesInRound / 2;
    }

    // Add 3rd/4th place match (same round as final, match_number 2)
    if (totalRounds >= 2 && tiebreakerDepth >= 4) {
      matchInserts.push({
        tournament_id: tournamentId,
        round: totalRounds,
        phase: "top_cut",
        match_number: 2,
        player1_id: null,
        player2_id: null,
        status: "pending",
      });
    }

    const { error } = await supabase.from("tournament_matches").insert(matchInserts);
    if (error) {
      toast.error("Errore nella generazione del bracket Top Cut");
      console.error(error);
    }
  };

  const createPreTopCutAndTopCut = async (
    preTcPlayers: Player[],
    directQualifierPlayers: Player[],
    effectiveTopCut: number,
    successMessage: string
  ) => {
    // Generate simple paired 1v1 matches (not a bracket tree)
    // Sort contested players: best vs worst for fairest matchups
    const sorted = [...preTcPlayers];
    const preMatchInserts: any[] = [];

    for (let i = 0; i < Math.floor(sorted.length / 2); i++) {
      preMatchInserts.push({
        tournament_id: tournamentId,
        round: 1,
        phase: "pre_top_cut",
        match_number: i + 1,
        player1_id: sorted[i].user_id || null,
        player2_id: sorted[sorted.length - 1 - i].user_id || null,
        status: "pending",
        player1_score: 0,
        player2_score: 0,
      });
    }

    // If odd number, the middle player gets a BYE (auto-qualifies)
    if (sorted.length % 2 === 1) {
      const middleIdx = Math.floor(sorted.length / 2);
      preMatchInserts.push({
        tournament_id: tournamentId,
        round: 1,
        phase: "pre_top_cut",
        match_number: preMatchInserts.length + 1,
        player1_id: sorted[middleIdx].user_id,
        player2_id: null,
        status: "completed",
        winner_id: sorted[middleIdx].user_id,
        player1_score: 4,
        player2_score: 0,
      });
    }

    await supabase.from("tournament_matches").insert(preMatchInserts);
    await generateTopCutBracketWithTbdSlots(directQualifierPlayers, effectiveTopCut);

    await supabase.from("tournaments").update({ status: "pre_top_cut" }).eq("id", tournamentId);
    toast.success(successMessage);
    onStatusChange();
    fetchData();
  };

  const advanceToNextSwissRound = async (groupNumber?: number, force = false) => {
    // groupNumber: undefined = all, 0 = main (null group_number, exclude 99), N = specific group, 99 = kids
    // force: admin bypass to generate an extra round beyond configured Swiss rounds
    const maxRoundsNeeded = calcSwissRounds(groupNumber === 0 ? undefined : groupNumber);

    // Fetch fresh match data to avoid stale state
    let { data: freshMatches } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase", "swiss");

    let relevantMatches = groupNumber === 0
      ? (freshMatches ?? []).filter((m: any) => m.group_number === null)
      : groupNumber
        ? (freshMatches ?? []).filter((m: any) => m.group_number === groupNumber)
        : (freshMatches ?? []);
    const normalizedByeCount = await normalizeByeMatches(relevantMatches as Match[]);
    if (normalizedByeCount > 0) {
      await recalcStandings();
      const refreshed = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("phase", "swiss");
      freshMatches = refreshed.data;
      relevantMatches = groupNumber === 0
        ? (freshMatches ?? []).filter((m: any) => m.group_number === null)
        : groupNumber
          ? (freshMatches ?? []).filter((m: any) => m.group_number === groupNumber)
          : (freshMatches ?? []);
    }
    const roundNumbers = [...new Set(relevantMatches.map((m: any) => m.round as number))];
    const completedRounds = roundNumbers.filter((round) =>
      relevantMatches.filter((m: any) => m.round === round).every((m: any) => m.status === "completed")
    ).length;

    if (completedRounds >= maxRoundsNeeded && !force) {
      toast.error("Tutti i turni Swiss sono completati.");
      return;
    }

    await recalcStandings();
    // Refresh standings after recalc
    const { data: freshStandings } = await supabase
      .from("tournament_standings")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("points", { ascending: false })
      .order("resistance", { ascending: false });

    // Update local state
    setMatches((freshMatches as Match[]) ?? []);
    setStandings((freshStandings as Standing[]) ?? []);

    const groupSwissMatches = groupNumber === 0
      ? (freshMatches ?? []).filter((m: any) => m.phase === "swiss" && m.group_number === null)
      : groupNumber
        ? (freshMatches ?? []).filter((m: any) => m.phase === "swiss" && m.group_number === groupNumber)
        : (freshMatches ?? []).filter((m: any) => m.phase === "swiss");
    const maxRound = groupSwissMatches.length > 0 ? Math.max(...groupSwissMatches.map((m: any) => m.round)) : 0;
    const allDone = groupSwissMatches.filter((m: any) => m.round === maxRound).every((m: any) => m.status === "completed");
    const nextRound = allDone ? maxRound + 1 : maxRound;

    // For groupNumber 0 (main without group_number), pass undefined as groupNumber to generateSwissRound
    // but filter standings to exclude group 99
    const effectiveGroupNumber = groupNumber === 0 ? undefined : groupNumber;
    const filteredStandings = groupNumber === 0
      ? ((freshStandings as Standing[]) ?? []).filter(s => s.group_number === null)
      : (freshStandings as Standing[]) ?? [];
    const filteredMatches = groupNumber === 0
      ? ((freshMatches as Match[]) ?? []).filter((m: any) => m.group_number === null)
      : (freshMatches as Match[]) ?? [];

    // For Round Robin: generate ALL rounds at once when starting (maxRound === 0)
    if ((format === "round_robin" || format === "round_robin_top_cut") && maxRound === 0) {
      const groupStandings = filteredStandings.filter(s => !s.dropped);
      if (effectiveGroupNumber) {
        const grpStandings = ((freshStandings as Standing[]) ?? []).filter(s => !s.dropped && s.group_number === effectiveGroupNumber);
        const rrPlayers = grpStandings.map(s => ({
          user_id: s.user_id,
          display_name: playerMap.get(s.user_id) || "?",
        }));
        await generateAllRoundRobinRounds(rrPlayers, effectiveGroupNumber);
      } else {
        const rrPlayers = groupStandings.map(s => ({
          user_id: s.user_id,
          display_name: playerMap.get(s.user_id) || "?",
        }));
        await generateAllRoundRobinRounds(rrPlayers);
      }
      const label = groupNumber === 99 ? 'Gruppo Kids' : groupNumber && groupNumber > 0 ? 'Gruppo ' + String.fromCharCode(64 + groupNumber) : '';
      toast.success(`Turni Round Robin${label ? ` (${label})` : ""} generati!`);
      appendLog(`Turni Round Robin${label ? ` (${label})` : ""} generati`);
      fetchData();
      onStatusChange();
      return;
    }

    await generateSwissRound(nextRound, undefined, effectiveGroupNumber, filteredStandings, filteredMatches);
    const label = groupNumber === 99 ? 'Gruppo Kids' : groupNumber && groupNumber > 0 ? 'Gruppo ' + String.fromCharCode(64 + groupNumber) : '';
    toast.success(`Turno ${nextRound}${label ? ` (${label})` : ""} generato!`);
    appendLog(`Turno ${nextRound}${label ? ` (${label})` : ""} generato`);
    fetchData();
    onStatusChange();
  };

  const [advancingToTopCut, setAdvancingToTopCut] = useState(false);

  const advanceToTopCut = async (scope: "main" | "u12" | "both" = "both") => {
    if (advancingToTopCut) return;
    setAdvancingToTopCut(true);
    try {
      // Guard: check existing brackets per phase
      const { count: existingMain } = await supabase
        .from("tournament_matches")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .eq("phase", "top_cut");
      const { count: existingU12 } = await supabase
        .from("tournament_matches")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .eq("phase", "u12_top_cut");
      const wantMain = scope !== "u12";
      const wantU12 = scope !== "main";
      if (wantMain && (existingMain ?? 0) > 0 && wantU12 && (existingU12 ?? 0) > 0) {
        toast.error("Entrambi i bracket Top Cut sono già stati generati.");
        setAdvancingToTopCut(false);
        return;
      }
      if (wantMain && !wantU12 && (existingMain ?? 0) > 0) {
        toast.error("Il bracket Top Cut principale è già stato generato.");
        setAdvancingToTopCut(false);
        return;
      }
      if (wantU12 && !wantMain && (existingU12 ?? 0) > 0) {
        toast.error("Il bracket Top Cut Kids è già stato generato.");
        setAdvancingToTopCut(false);
        return;
      }
      const skipMain = !wantMain || (existingMain ?? 0) > 0;
      const skipU12 = !wantU12 || (existingU12 ?? 0) > 0;


      // Snapshot before generating top cut (admin-only RPC; ignore failure for non-admins)
      try {
        await (supabase as any).rpc("create_tournament_snapshot", {
          _tournament_id: tournamentId,
          _reason: "auto:before-top-cut",
        });
      } catch (e) { console.warn("snapshot failed", e); }

    await recalcStandings();

    // Fetch fresh standings from DB to avoid using stale React state
    const { data: freshStandingsData } = await supabase
      .from("tournament_standings")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("seed", { ascending: true, nullsFirst: false })
      .order("points", { ascending: false })
      .order("resistance", { ascending: false });
    const freshStandings = (freshStandingsData as Standing[]) ?? [];
    setStandings(freshStandings);

    const effectiveTopCut = editTopCutSize || topCutSize || 8;

    // For RANKED tournaments only, enforce a minimum of active players vs. top cut size.
    // Normal tournaments have full freedom (es. Top 4 con 5-7 giocatori).
    if (isRanked && format !== "single_elimination") {
      const activePlayers = players.filter(p => {
        const standing = freshStandings.find(s => s.user_id === p.user_id);
        return standing ? !standing.dropped : true;
      });
      const minRequired = effectiveTopCut === 4 ? 6 : effectiveTopCut * 2;
      if (activePlayers.length < minRequired) {
        toast.error(`Top Cut disabilitata: servono almeno ${minRequired} giocatori attivi per Top ${effectiveTopCut} (attualmente ${activePlayers.length}).`);
        setAdvancingToTopCut(false);
        return;
      }
    }
    const effectiveGroups = groupsCountProp > 0 ? groupsCountProp : 0;
    const u12Separate = under12SeparateTopcutProp;
    const u12Active = hasU12Group;

    let bracketPlayers: Player[];

    // Filter out U12 players from main top cut when they have separate top cut
    const mainStandings = u12Active && u12Separate
      ? freshStandings.filter(s => s.group_number !== 99)
      : freshStandings;
    const swissOrder = getCompleteStandingsOrder(
      mainStandings.filter((s) => !s.dropped),
      matches,
      enabledTiebreakersProp ?? undefined
    );

    if (effectiveGroups > 0) {
      // Anche nei tornei a gironi la Top Cut deve seguire la classifica globale visibile:
      // i migliori N assoluti passano, senza quote fisse per girone.
      bracketPlayers = swissOrder.slice(0, effectiveTopCut).map((userId) => ({
        user_id: userId,
        display_name: playerMap.get(userId) || "Sconosciuto",
      }));
    } else {
      // No regular groups - use overall standings (excluding U12 if separate)
      const sortedStandings = mainStandings
        .filter((s) => !s.dropped)
        .sort((a, b) => b.points - a.points || b.resistance - a.resistance || ((a.seed ?? Number.POSITIVE_INFINITY) - (b.seed ?? Number.POSITIVE_INFINITY)));

      // If U12 is NOT separate, include top U12 players in the pool
      if (u12Active && !u12Separate) {
        const u12Standings = freshStandings
          .filter(s => !s.dropped && s.group_number === 99)
          .sort((a, b) => b.points - a.points || b.resistance - a.resistance || ((a.seed ?? Number.POSITIVE_INFINITY) - (b.seed ?? Number.POSITIVE_INFINITY)));
        const u12Spots = Math.max(1, Math.floor(effectiveTopCut / 4));
        u12Standings.slice(0, u12Spots).forEach(s => {
          if (!sortedStandings.find(ss => ss.user_id === s.user_id)) {
            sortedStandings.push(s);
          }
        });
        sortedStandings.sort((a, b) => b.points - a.points || b.resistance - a.resistance);
      }

      // Use the exact same ordering as the visible standings table so Top Cut seeds
      // cannot diverge from what staff/players see in Classifica.
      const standingsOrder = getCompleteStandingsOrder(sortedStandings, matches, enabledTiebreakersProp ?? undefined);
      const standingsIndex = new Map(standingsOrder.map((userId, index) => [userId, index]));
      sortedStandings.sort(
        (a, b) => (standingsIndex.get(a.user_id) ?? Number.POSITIVE_INFINITY) - (standingsIndex.get(b.user_id) ?? Number.POSITIVE_INFINITY)
      );

      // Check for ties at the cutoff position using the already calculated seed.
      if (sortedStandings.length > effectiveTopCut) {
        const lastQualifier = sortedStandings[effectiveTopCut - 1];
        const firstOut = sortedStandings[effectiveTopCut];

        const isTrulyTied = lastQualifier.seed === firstOut.seed;

        if (isTrulyTied) {
          // Find all players truly tied with the cutoff player
          const cutSeed = lastQualifier.seed;

          const directQualifiers = sortedStandings.filter(s => {
            if (s.seed == null || cutSeed == null) return false;
            return s.seed < cutSeed;
          });

          const tiedPlayers = sortedStandings.filter(s => s.seed === cutSeed);

          const spotsToFill = effectiveTopCut - directQualifiers.length;

          if (tiedPlayers.length > spotsToFill && spotsToFill > 0 && tiebreakerDepth > 0) {
            const maxPlayoffPlayers = spotsToFill * 2;
            let playoffCandidates = [...tiedPlayers];
            if (playoffCandidates.length > maxPlayoffPlayers) {
              playoffCandidates.sort((a, b) => b.wins - a.wins || b.game_wins - a.game_wins);
              playoffCandidates = playoffCandidates.slice(0, maxPlayoffPlayers);
            }

            const preTcPlayers = playoffCandidates.map(s => ({
              user_id: s.user_id,
              display_name: playerMap.get(s.user_id) || "Sconosciuto",
            }));

            const directQualifierPlayers = directQualifiers.map(s => ({
              user_id: s.user_id,
              display_name: playerMap.get(s.user_id) || "Sconosciuto",
            }));

            await createPreTopCutAndTopCut(
              preTcPlayers,
              directQualifierPlayers,
              effectiveTopCut,
              `Spareggi necessari! ${playoffCandidates.length} giocatori in parità per ${spotsToFill} posti.`
            );
            return;
          }
        }
      }

      const topPlayers = sortedStandings.slice(0, effectiveTopCut);
      bracketPlayers = topPlayers.map((s) => ({
        user_id: s.user_id,
        display_name: playerMap.get(s.user_id) || "Sconosciuto",
      }));
    }

    // Generate main top cut bracket (unless skipped)
    if (!skipMain) {
      await generateSingleEliminationBracket(bracketPlayers);
    }

    // Generate separate U12 top cut bracket if enabled (unless skipped)
    if (!skipU12 && u12Active && u12Separate) {

      const u12Standings = freshStandings
        .filter(s => !s.dropped && s.group_number === 99)
        .sort((a, b) => b.points - a.points || b.resistance - a.resistance);

      // U12 top cut: take top 4 or all if less than 4
      const u12TopSize = Math.min(4, u12Standings.length);
      const u12BracketPlayers = u12Standings.slice(0, u12TopSize).map(s => ({
        user_id: s.user_id,
        display_name: playerMap.get(s.user_id) || "Sconosciuto",
      }));

      if (u12BracketPlayers.length >= 2) {
        const size = Math.pow(2, Math.ceil(Math.log2(u12BracketPlayers.length)));
        const seeded = [...u12BracketPlayers];
        while (seeded.length < size) seeded.push({ user_id: "", display_name: "BYE" });

        const totalRounds = Math.log2(size);
        const u12MatchInserts: any[] = [];
        const u12ByeWinnersByMatchNum = new Map<number, string>();

        const u12SeedOrder = buildBracketSeedOrder(size);
        for (let i = 0; i < size / 2; i++) {
          const p1 = seeded[u12SeedOrder[i * 2] - 1];
          const p2 = seeded[u12SeedOrder[i * 2 + 1] - 1];
          const isBye = !p2.user_id;
          if (isBye && p1.user_id) u12ByeWinnersByMatchNum.set(i + 1, p1.user_id);
          u12MatchInserts.push({
            tournament_id: tournamentId,
            round: 1,
            phase: "u12_top_cut",
            match_number: i + 1,
            player1_id: p1.user_id || null,
            player2_id: p2.user_id || null,
            status: isBye ? "completed" : "pending",
            winner_id: isBye ? p1.user_id : null,
            player1_score: isBye ? 4 : 0,
            player2_score: 0,
            group_number: 99,
          });
        }

        let matchesInRound = size / 4;
        for (let round = 2; round <= totalRounds; round++) {
          for (let i = 0; i < matchesInRound; i++) {
            const matchNum = i + 1;
            let p1Pre: string | null = null;
            let p2Pre: string | null = null;
            if (round === 2) {
              p1Pre = u12ByeWinnersByMatchNum.get(2 * matchNum - 1) ?? null;
              p2Pre = u12ByeWinnersByMatchNum.get(2 * matchNum) ?? null;
            }
            u12MatchInserts.push({
              tournament_id: tournamentId,
              round,
              phase: "u12_top_cut",
              match_number: matchNum,
              player1_id: p1Pre,
              player2_id: p2Pre,
              status: "pending",
              group_number: 99,
            });
          }
          matchesInRound = matchesInRound / 2;
        }

        // Add 3rd/4th place match for U12 top cut
        if (totalRounds >= 2 && tiebreakerDepth >= 4) {
          u12MatchInserts.push({
            tournament_id: tournamentId,
            round: totalRounds,
            phase: "u12_top_cut",
            match_number: 2,
            player1_id: null,
            player2_id: null,
            status: "pending",
            group_number: 99,
          });
        }

        await supabase.from("tournament_matches").insert(u12MatchInserts);
      }
    }

    await supabase.from("tournaments").update({ status: "top_cut" }).eq("id", tournamentId);
    toast.success("Top Cut generato!");
    onStatusChange();
    fetchData();
    } finally {
      setAdvancingToTopCut(false);
    }
  };

  const completeTournament = async () => {
    await recalcStandings();

    if (isRanked) {
      const { error: rpcError } = await supabase.rpc("finalize_tournament_points", {
        _tournament_id: tournamentId,
      });

      if (rpcError) {
        console.error("Error finalizing points:", rpcError);
        toast.error(`Errore nell'assegnazione dei punti: ${rpcError.message}`);
        return;
      }
    }

    await supabase.from("tournaments").update({ status: "completed" }).eq("id", tournamentId);
    toast.success(isRanked ? "Torneo completato! Punti classifica assegnati." : "Torneo completato!");
    appendLog(isRanked ? "Torneo concluso — punti classifica assegnati" : "Torneo concluso");
    // Invalidate cached rankings so the Monthly BFL leaderboard refreshes immediately
    if (isRanked) {
      try {
        localStorage.removeItem("rq_cache_rankings-data-v8");
      } catch {}
      queryClient.invalidateQueries({ queryKey: ["rankings-data-v8"] });
    }
    onStatusChange();
  };

  const reopenTournament = async () => {
    // Determine target status based on existing matches
    const hasTopCut = matches.some(m => ["top_cut", "u12_top_cut", "pre_top_cut", "tiebreaker"].includes(m.phase));
    const targetStatus = hasTopCut ? "top_cut" : "swiss";
    const { error } = await supabase.from("tournaments").update({ status: targetStatus }).eq("id", tournamentId);
    if (error) {
      toast.error("Errore nella riapertura del torneo");
      console.error(error);
      return;
    }
    toast.success(`Torneo riaperto in fase ${targetStatus === "top_cut" ? "Top Cut" : "Swiss"}. Ricordati di riconcluderlo per ricalcolare i punti.`);
    appendLog(`Torneo riaperto (admin) → fase ${targetStatus}`);
    onStatusChange();
    fetchData();
  };

  const clearTopCutPhaseMatches = async (scope: "all" | "main" | "u12" = "all") => {
    const phases = scope === "main"
      ? ["top_cut", "pre_top_cut", "tiebreaker"]
      : scope === "u12"
      ? ["u12_top_cut"]
      : ["top_cut", "u12_top_cut", "pre_top_cut", "tiebreaker"];
    const { error } = await supabase
      .from("tournament_matches")
      .delete()
      .eq("tournament_id", tournamentId)
      .in("phase", phases);

    if (error) {
      toast.error("Errore nell'annullamento della Top Cut");
      console.error(error);
      return false;
    }

    return true;
  };

  // Round label by number of bracket matches in that round (excluding 3rd-place match)
  const roundLabelByMatchCount = (count: number): string => {
    if (count <= 1) return "Finale";
    if (count === 2) return "Semifinali";
    if (count === 4) return "Quarti di Finale";
    if (count === 8) return "Ottavi di Finale";
    if (count === 16) return "Sedicesimi di Finale";
    if (count === 32) return "Trentaduesimi di Finale";
    return `Round (${count} match)`;
  };

  const getTopCutRoundsInfo = (phase: "top_cut" | "u12_top_cut") => {
    const phaseMatches = matches.filter(m => m.phase === phase);
    if (!phaseMatches.length) return [] as { round: number; label: string }[];
    const maxR = Math.max(...phaseMatches.map(m => m.round));
    const rounds = Array.from(new Set(phaseMatches.map(m => m.round))).sort((a, b) => a - b);
    return rounds.map(r => {
      const cnt = phaseMatches.filter(m => m.round === r && !(r === maxR && m.match_number === 2)).length;
      return { round: r, label: roundLabelByMatchCount(cnt) };
    });
  };

  // Cancel a single round of a top cut phase: reset that round's matches to pending and delete later rounds
  const clearTopCutFromRound = async (phase: "top_cut" | "u12_top_cut", fromRound: number) => {
    const { error: delErr } = await supabase
      .from("tournament_matches")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("phase", phase)
      .gt("round", fromRound);
    if (delErr) { toast.error("Errore eliminazione round successivi"); console.error(delErr); return false; }

    const { error: updErr } = await supabase
      .from("tournament_matches")
      .update({ winner_id: null, player1_score: null, player2_score: null, status: "pending" })
      .eq("tournament_id", tournamentId)
      .eq("phase", phase)
      .eq("round", fromRound);
    if (updErr) { toast.error("Errore reset round"); console.error(updErr); return false; }

    // Clear tiebreakers tied to main top cut
    if (phase === "top_cut") {
      await supabase
        .from("tournament_matches")
        .delete()
        .eq("tournament_id", tournamentId)
        .eq("phase", "tiebreaker");
    }
    return true;
  };

  const recalcStandings = async () => {
    await supabase.rpc("recalc_tournament_standings", { _tournament_id: tournamentId });
  };

  const generateRandomScore = () => {
    const winnerScore = 4 + Math.floor(Math.random() * 3); // 4, 5, or 6
    const loserScore = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
    return { winnerScore, loserScore };
  };

  const getSinglePlayerId = (match: Pick<Match, "player1_id" | "player2_id">) =>
    match.player1_id || match.player2_id || null;

  const normalizeByeMatches = async (candidateMatches: Match[]) => {
    const fixes = candidateMatches
      .map((match) => ({ match, soloPlayerId: getSinglePlayerId(match) }))
      .filter(({ match, soloPlayerId }) => {
        if (!soloPlayerId || !((match.player1_id === null) !== (match.player2_id === null))) return false;
        const mustBeCompleted = match.phase === "swiss" || match.phase === "pre_top_cut" || match.status === "completed" || match.winner_id === soloPlayerId;
        return mustBeCompleted && (match.status !== "completed" || match.winner_id !== soloPlayerId || match.player1_id !== soloPlayerId || match.player2_id !== null || match.player1_score < 4);
      });

    await Promise.all(fixes.map(({ match, soloPlayerId }) =>
      supabase.from("tournament_matches").update({
        player1_id: soloPlayerId,
        player2_id: null,
        winner_id: soloPlayerId,
        player1_score: 4,
        player2_score: 0,
        status: "completed",
      }).eq("id", match.id)
    ));

    return fixes.length;
  };

  const autoCompleteGroupRound = async (groupNumber: number) => {
    const groupMatches = matches.filter((m) => m.phase === "swiss" && (
      groupNumber === 0 ? m.group_number === null :
      m.group_number === groupNumber
    ));
    const maxRound = groupMatches.length > 0 ? Math.max(...groupMatches.map(m => m.round)) : 0;
    const pendingMatches = groupMatches.filter(m => m.status === "pending" && m.round === maxRound && m.player1_id && m.player2_id);
    if (pendingMatches.length === 0) { toast.info("Nessun match da completare"); return; }

    const updates = pendingMatches.map((match) => {
      const { winnerScore, loserScore } = generateRandomScore();
      const p1Wins = Math.random() > 0.5;
      return { id: match.id, winner_id: p1Wins ? match.player1_id : match.player2_id, player1_score: p1Wins ? winnerScore : loserScore, player2_score: p1Wins ? loserScore : winnerScore };
    });
    await Promise.all(updates.map(u => supabase.from("tournament_matches").update({ winner_id: u.winner_id, player1_score: u.player1_score, player2_score: u.player2_score, status: "completed" }).eq("id", u.id)));
    toast.success("Match completati automaticamente!");
    fetchData();
    onStatusChange();
  };

  const autoCompleteRound = async () => {
    const swissM = matches.filter((m) => m.phase === "swiss");
    const currentMaxRound = swissM.length > 0 ? Math.max(...swissM.map((m) => m.round)) : 0;
    let pendingMatches = matches.filter(
      (m) => m.status === "pending" && m.round === currentMaxRound && m.phase === (status === "top_cut" ? "top_cut" : "swiss") && m.player1_id && m.player2_id
    );

    if (pendingMatches.length === 0) {
      pendingMatches = matches.filter((m) => m.status === "pending" && m.phase === "top_cut" && m.player1_id && m.player2_id);
      if (pendingMatches.length === 0) {
        toast.info("Nessun match da completare");
        return;
      }
    }

    const isTopCut = pendingMatches[0]?.phase === "top_cut";

    const updates = pendingMatches.map((match) => {
      const { winnerScore, loserScore } = generateRandomScore();
      const p1Wins = Math.random() > 0.5;
      return {
        id: match.id,
        match,
        winner_id: p1Wins ? match.player1_id : match.player2_id,
        player1_score: p1Wins ? winnerScore : loserScore,
        player2_score: p1Wins ? loserScore : winnerScore,
      };
    });

    await Promise.all(updates.map((u) =>
      supabase.from("tournament_matches").update({
        winner_id: u.winner_id, player1_score: u.player1_score, player2_score: u.player2_score, status: "completed",
      }).eq("id", u.id)
    ));

    // For top_cut: advance winners to next round and generate tiebreaker matches
    if (isTopCut) {
      for (const u of updates) {
        const nextRound = u.match.round + 1;
        const nextMatchNumber = Math.ceil(u.match.match_number / 2);
        const isPlayer1 = u.match.match_number % 2 === 1;
        const nextMatch = matches.find(
          (m) => m.phase === "top_cut" && m.round === nextRound && m.match_number === nextMatchNumber
        );
        if (nextMatch && u.winner_id) {
          const updateField = isPlayer1 ? { player1_id: u.winner_id } : { player2_id: u.winner_id };
          await supabase.from("tournament_matches").update(updateField).eq("id", nextMatch.id);
        }
      }

      // Generate tiebreaker matches for losers of this round
      if (tiebreakerDepth > 0) {
        const round = updates[0].match.round;
        // Use a dummy call - handleTiebreakerPairing queries DB for all completed matches in round
        const lastLoser = updates[updates.length - 1].match.player1_id === updates[updates.length - 1].winner_id
          ? updates[updates.length - 1].match.player2_id
          : updates[updates.length - 1].match.player1_id;
        if (lastLoser) {
          await handleTiebreakerPairing(round, lastLoser, updates[updates.length - 1].id);
        }
      }
    }

    toast.success("Match completati automaticamente!");
    fetchData();
  };

  const autoCompleteSpecificRound = async (matchIds: string[]) => {
    const pendingMatches = matches.filter(
      (m) => matchIds.includes(m.id) && m.player1_id && m.player2_id
    );
    if (pendingMatches.length === 0) {
      toast.info("Nessun match da completare in questo turno");
      return;
    }

    const updates = pendingMatches.map((match) => {
      const { winnerScore, loserScore } = generateRandomScore();
      const p1Wins = Math.random() > 0.5;
      return {
        id: match.id,
        winner_id: p1Wins ? match.player1_id : match.player2_id,
        player1_score: p1Wins ? winnerScore : loserScore,
        player2_score: p1Wins ? loserScore : winnerScore,
      };
    });

    await Promise.all(updates.map((u) =>
      supabase.from("tournament_matches").update({
        winner_id: u.winner_id, player1_score: u.player1_score, player2_score: u.player2_score, status: "completed",
      }).eq("id", u.id)
    ));

    toast.success("Match completati automaticamente!");
    fetchData();
  };

  // Positional tiebreakers are single-step matches only.
  // Winners do not advance to a further tiebreaker round: quarterfinal losers
  // determine 5°-8° placement and semifinal losers determine 3°/4° placement.
  const handleTiebreakerGroupAdvancement = async (_tiebreakerRound: number) => {
    return;
  };

  // When editing a result on a previous round and the next round has no completed (non-BYE) matches,
  // delete and regenerate the next round with correct pairings based on updated standings.
  // IMPORTANT: Only regenerate if ALL matches in the edited round are completed,
  // to avoid changing pairings while matches are still being played.
  const autoRegenerateNextRound = async (editedMatch: Match) => {
    const groupNumber = editedMatch.group_number;
    const editedRound = editedMatch.round;

    // Get fresh match data
    const { data: freshMatches } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase", "swiss");

    const groupMatches = groupNumber
      ? (freshMatches ?? []).filter((m: any) => m.group_number === groupNumber)
      : (freshMatches ?? []);

    const maxRound = groupMatches.length > 0 ? Math.max(...groupMatches.map((m: any) => m.round)) : 0;

    // Only act if there's a round after the edited one
    if (maxRound <= editedRound) return;

    // Check that ALL matches in the edited round are completed before regenerating
    const editedRoundMatches = groupMatches.filter((m: any) => m.round === editedRound);
    const allEditedRoundCompleted = editedRoundMatches.every((m: any) => m.status === "completed");
    if (!allEditedRoundCompleted) return; // Don't regenerate while matches are still in progress

    const nextRoundMatches = groupMatches.filter((m: any) => m.round === maxRound);
    // A completed BYE means the next round already exists in a valid state: don't delete/regenerate it.
    const hasCompletedReal = nextRoundMatches.some((m: any) => m.status === "completed");

    if (hasCompletedReal) return; // Don't touch if matches have been played

    // Delete the next round matches
    const nextRoundIds = nextRoundMatches.map((m: any) => m.id);
    if (nextRoundIds.length > 0) {
      await supabase.from("tournament_matches").delete().in("id", nextRoundIds);
    }

    // Recalc standings and regenerate
    await recalcStandings();
    
    // Refresh standings
    const { data: freshStandings } = await supabase
      .from("tournament_standings")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("points", { ascending: false })
      .order("resistance", { ascending: false });

    setStandings((freshStandings as Standing[]) ?? []);

    // Refresh matches (without the deleted ones)
    const { data: updatedMatches } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId);
    setMatches((updatedMatches as Match[]) ?? []);

    await generateSwissRound(maxRound, undefined, groupNumber ?? undefined, (freshStandings as Standing[]) ?? [], (updatedMatches as Match[]) ?? []);
    toast.info(`Pairing del Turno ${maxRound} rigenerati automaticamente.`);
    fetchData();
    onStatusChange();
  };

  const handleMatchResult = async (matchId: string, winnerId: string | null, p1Score: number, p2Score: number) => {
    // Optimistic UI update: immediately reflect the result locally
    const match = matches.find((m) => m.id === matchId);
    setMatches(prev => prev.map(m => m.id === matchId ? {
      ...m,
      winner_id: winnerId,
      player1_score: p1Score,
      player2_score: p2Score,
      status: "completed",
    } : m));

    // Get current user for scored_by
    const { data: { session } } = await supabase.auth.getSession();
    const currentScoredBy = session?.user?.id ?? null;

    // Optimistic update with scored_by
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, scored_by: currentScoredBy } : m));

    // Fire DB update without awaiting for UI responsiveness
    const dbUpdate = supabase
      .from("tournament_matches")
      .update({
        winner_id: winnerId,
        player1_score: p1Score,
        player2_score: p2Score,
        status: "completed",
        scored_by: currentScoredBy,
      } as any)
      .eq("id", matchId);

    // Handle top_cut advancement in background
    if (match?.phase === "top_cut" && winnerId) {
      const nextRound = match.round + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);
      const isPlayer1 = match.match_number % 2 === 1;

      const nextMatch = matches.find(
        (m) => m.phase === "top_cut" && m.round === nextRound && m.match_number === nextMatchNumber
      );

      if (nextMatch) {
        const updateField = isPlayer1 ? { player1_id: winnerId } : { player2_id: winnerId };
        // Optimistic local update for next match
        setMatches(prev => prev.map(m => m.id === nextMatch.id ? { ...m, ...updateField } : m));
        supabase.from("tournament_matches").update(updateField).eq("id", nextMatch.id).then();
      }

      // Advance loser to 3rd/4th place match (semifinal losers)
      // Semifinal = the round where there are exactly 2 matches (penultimate round)
      const topCutMatches = matches.filter(m => m.phase === "top_cut");
      const maxRound = Math.max(...topCutMatches.map(m => m.round));
      const isSemifinal = match.round === maxRound - 1 && maxRound >= 2;
      if (isSemifinal) {
        const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
        let thirdPlaceMatch = matches.find(
          (m) => m.phase === "top_cut" && m.round === maxRound && m.match_number === 2
        );
        // Safety net: if tiebreakers >= 4 are enabled but the 3rd/4th match was never
        // created at bracket-generation time (legacy tournaments), create it now.
        if (!thirdPlaceMatch && tiebreakerDepth >= 4) {
          const isP1 = match.match_number % 2 === 1;
          const insertPayload: any = {
            tournament_id: tournamentId,
            round: maxRound,
            phase: "top_cut",
            match_number: 2,
            player1_id: isP1 ? loserId : null,
            player2_id: isP1 ? null : loserId,
            status: "pending",
            player1_score: 0,
            player2_score: 0,
          };
          const { data: inserted } = await supabase
            .from("tournament_matches")
            .insert(insertPayload)
            .select()
            .single();
          if (inserted) {
            setMatches(prev => [...prev, inserted as any]);
            appendLog(`Match 3°/4° posto creato automaticamente (safety net)`);
          }
        } else if (thirdPlaceMatch && loserId) {
          const loserSlot = match.match_number % 2 === 1 ? { player1_id: loserId } : { player2_id: loserId };
          setMatches(prev => prev.map(m => m.id === thirdPlaceMatch!.id ? { ...m, ...loserSlot } : m));
          supabase.from("tournament_matches").update(loserSlot).eq("id", thirdPlaceMatch.id).then();
        }
      }

      // Tiebreaker logic is deferred to after DB commit (see below)
    }

    // Handle U12 top cut match advancement
    if (match?.phase === "u12_top_cut" && winnerId) {
      const nextRound = match.round + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);
      const isPlayer1 = match.match_number % 2 === 1;
      const nextMatch = matches.find(
        (m) => m.phase === "u12_top_cut" && m.round === nextRound && m.match_number === nextMatchNumber
      );
      if (nextMatch) {
        const updateField = isPlayer1 ? { player1_id: winnerId } : { player2_id: winnerId };
        setMatches(prev => prev.map(m => m.id === nextMatch.id ? { ...m, ...updateField } : m));
        supabase.from("tournament_matches").update(updateField).eq("id", nextMatch.id).then();
      }

      // Advance loser to 3rd/4th place match if semifinal
      const u12Matches = matches.filter(m => m.phase === "u12_top_cut");
      const u12MaxRound = Math.max(...u12Matches.map(m => m.round));
      if (match.round === u12MaxRound - 1 && u12MaxRound >= 2) {
        const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
        let thirdPlaceMatch = matches.find(
          (m) => m.phase === "u12_top_cut" && m.round === u12MaxRound && m.match_number === 2
        );
        if (!thirdPlaceMatch && tiebreakerDepth >= 4) {
          const isP1 = match.match_number % 2 === 1;
          const insertPayload: any = {
            tournament_id: tournamentId,
            round: u12MaxRound,
            phase: "u12_top_cut",
            match_number: 2,
            player1_id: isP1 ? loserId : null,
            player2_id: isP1 ? null : loserId,
            status: "pending",
            player1_score: 0,
            player2_score: 0,
            group_number: 99,
          };
          const { data: inserted } = await supabase
            .from("tournament_matches")
            .insert(insertPayload)
            .select()
            .single();
          if (inserted) {
            setMatches(prev => [...prev, inserted as any]);
            appendLog(`Match 3°/4° posto U12 creato automaticamente (safety net)`);
          }
        } else if (thirdPlaceMatch && loserId) {
          const loserSlot = match.match_number % 2 === 1 ? { player1_id: loserId } : { player2_id: loserId };
          setMatches(prev => prev.map(m => m.id === thirdPlaceMatch!.id ? { ...m, ...loserSlot } : m));
          supabase.from("tournament_matches").update(loserSlot).eq("id", thirdPlaceMatch.id).then();
        }
      }
    }

    // Handle pre-top-cut advancement (no bracket tree, just simple matches)
    // No next-round advancement needed for pre_top_cut since they're all round 1

    // Tiebreaker advancement handled AFTER dbUpdate commit (see below).



    // Await the main DB update
    const { error } = await dbUpdate;
    if (error) {
      toast.error("Errore nel salvataggio del risultato");
      // Revert optimistic update on error
      fetchData();
      return;
    }

    toast.success("Risultato salvato!");

    // Generate tiebreaker matches AFTER DB commit (so query sees the completed match)
    if (match?.phase === "top_cut" && winnerId && tiebreakerDepth > 0) {
      const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
      if (loserId) {
        await handleTiebreakerPairing(match.round, loserId, matchId);
        fetchData();
      }
    }

    // Also generate tiebreakers for U12 top cut matches
    if (match?.phase === "u12_top_cut" && winnerId && tiebreakerDepth > 0) {
      const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
      if (loserId) {
        // Use same tiebreaker phase, handleTiebreakerPairing queries top_cut phase
        // For u12, we generate separate u12 tiebreaker matches
        await handleU12TiebreakerPairing(match.round, loserId);
        fetchData();
      }
    }

    // Tiebreaker match completed: maybe close a placement-group and spawn W/L subgroups.
    if (match?.phase === "tiebreaker" && winnerId) {
      const completed: Match = {
        ...match,
        winner_id: winnerId,
        player1_score: p1Score,
        player2_score: p2Score,
        status: "completed",
      };
      const created = await advancePlacementBracketAfterTiebreaker(completed);
      if (created > 0) fetchData();
    }


    // Pre-top-cut: just refresh data, no auto-advance (user clicks "AVVIA TOP 8" manually)
    if (match?.phase === "pre_top_cut") {
      fetchData();
      return;
    }

    // Lightweight local standings update for scoring phases only.
    // Excluded from points: tiebreaker, pre_top_cut, and the 3rd-place match (top_cut final round, match 2).
    const topCutFinalRd = matches.filter(m => m.phase === "top_cut").reduce((max, m) => Math.max(max, m.round), 0);
    const isThirdPlaceMatch = match?.phase === "top_cut" && match?.round === topCutFinalRd && match?.match_number === 2;
    const isCountablePhase = (match?.phase === "swiss" || match?.phase === "top_cut") && !isThirdPlaceMatch;
    if (isCountablePhase && match?.player1_id && match?.player2_id) {
      setStandings(prev => {
        const updated = [...prev];
        const s1 = updated.find(s => s.user_id === match.player1_id);
        const s2 = updated.find(s => s.user_id === match.player2_id);
        if (s1) {
          s1.game_wins += p1Score;
          s1.game_losses += p2Score;
          if (winnerId === match.player1_id) { s1.wins++; s1.points = s1.wins * 4 + s1.draws; }
          else if (winnerId === match.player2_id) { s1.losses++; }
          else { s1.draws++; s1.points = s1.wins * 4 + s1.draws; }
        }
        if (s2) {
          s2.game_wins += p2Score;
          s2.game_losses += p1Score;
          if (winnerId === match.player2_id) { s2.wins++; s2.points = s2.wins * 4 + s2.draws; }
          else if (winnerId === match.player1_id) { s2.losses++; }
          else { s2.draws++; s2.points = s2.wins * 4 + s2.draws; }
        }
        return updated.sort((a, b) => b.points - a.points || b.resistance - a.resistance);
      });

      // Auto-regenerate next round pairings if editing a previous round
      // and the next round has no completed matches (Swiss only, not RR)
      if (format !== "round_robin" && format !== "round_robin_top_cut") {
        await autoRegenerateNextRound(match);
      }
    }
  };

  // Start Top Cut from Pre-Top Cut (manual trigger)
  const startTopCutFromPreTopCut = async () => {
    const { data: freshPreTop } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase", "pre_top_cut")
      .order("match_number");

    const preTopMatches = (freshPreTop as Match[]) ?? [];
    const preTopWinners = preTopMatches
      .filter(m => m.status === "completed" && m.winner_id)
      .sort((a, b) => a.match_number - b.match_number)
      .map(m => m.winner_id as string);

    const { data: roundOneTopCut } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase", "top_cut")
      .eq("round", 1)
      .order("match_number");

    const topCutRoundOne = (roundOneTopCut as Match[]) ?? [];
    let winnerIndex = 0;

    for (const tcMatch of topCutRoundOne) {
      if (!tcMatch.player1_id && winnerIndex < preTopWinners.length) {
        await supabase
          .from("tournament_matches")
          .update({ player1_id: preTopWinners[winnerIndex++] })
          .eq("id", tcMatch.id);
      }
      if (!tcMatch.player2_id && winnerIndex < preTopWinners.length) {
        await supabase
          .from("tournament_matches")
          .update({ player2_id: preTopWinners[winnerIndex++] })
          .eq("id", tcMatch.id);
      }
    }

    await supabase.from("tournaments").update({ status: "top_cut" }).eq("id", tournamentId);
    toast.success(`Top ${editTopCutSize} avviata!`);
    onStatusChange();
    fetchData();
  };

  // ===== PLACEMENT BRACKET (Challonge-style consolation) =====
  // For losers of a top-cut round R (K players), build a single-elimination
  // consolation bracket. Each "group" plays K/2 matches at once; winners and
  // losers then form two K/2 subgroups (W and L) that recursively continue.
  // The final match of each subgroup (K=2) determines two adjacent placements.
  type PlacementInsert = {
    player1_id: string;
    player2_id: string;
    pairing_meta: any;
  };

  const buildPlacementGroupMatches = (
    players: string[],
    placementStart: number,
    tcRound: number,
    groupPath: string,
    effectiveDepth: number,
  ): PlacementInsert[] => {
    const K = players.length;
    if (K < 2) return [];
    if (placementStart > effectiveDepth) return [];
    const pathLabel = groupPath || "root";

    // Rapid mode: single round of final matches; each pair resolves two adjacent
    // placements directly. No W/L recursion.
    if (editTiebreakerMode === "rapid" || tiebreakerMode === "rapid") {
      const out: PlacementInsert[] = [];
      for (let i = 0; i + 1 < K; i += 2) {
        const ps = placementStart + i;
        if (ps > effectiveDepth) break;
        out.push({
          player1_id: players[i],
          player2_id: players[i + 1],
          pairing_meta: {
            tb_top_cut_round: tcRound,
            tb_group_path: pathLabel,
            tb_group_size: 2,
            tb_placement_start: ps,
            tb_placement_winner: ps,
            tb_placement_loser: ps + 1,
            tb_is_final: true,
            tb_bracket_index: i / 2,
            tb_mode: "rapid",
          },
        });
      }
      return out;
    }

    if (K === 2) {
      return [{
        player1_id: players[0],
        player2_id: players[1],
        pairing_meta: {
          tb_top_cut_round: tcRound,
          tb_group_path: pathLabel,
          tb_group_size: 2,
          tb_placement_start: placementStart,
          tb_placement_winner: placementStart,
          tb_placement_loser: placementStart + 1,
          tb_is_final: true,
          tb_bracket_index: 0,
        },
      }];
    }
    const out: PlacementInsert[] = [];
    for (let i = 0; i < K; i += 2) {
      out.push({
        player1_id: players[i],
        player2_id: players[i + 1],
        pairing_meta: {
          tb_top_cut_round: tcRound,
          tb_group_path: pathLabel,
          tb_group_size: K,
          tb_placement_start: placementStart,
          tb_bracket_index: i / 2,
          tb_is_final: false,
        },
      });
    }
    return out;
  };

  const insertPlacementMatches = async (inserts: PlacementInsert[], tcRound: number) => {
    if (inserts.length === 0) return 0;
    const { data: existing } = await supabase
      .from("tournament_matches")
      .select("match_number")
      .eq("tournament_id", tournamentId)
      .eq("phase", "tiebreaker")
      .eq("round", tcRound);
    const maxMn = (existing || []).reduce(
      (mx: number, m: any) => Math.max(mx, m.match_number || 0),
      0,
    );
    const rows = inserts.map((ins, idx) => ({
      tournament_id: tournamentId,
      round: tcRound,
      phase: "tiebreaker",
      match_number: maxMn + idx + 1,
      player1_id: ins.player1_id,
      player2_id: ins.player2_id,
      status: "pending",
      pairing_meta: ins.pairing_meta,
    }));
    const { error } = await supabase.from("tournament_matches").insert(rows);
    if (error) {
      console.error("insertPlacementMatches", error);
      return 0;
    }
    return rows.length;
  };

  // Generate the initial (root) placement bracket for losers of a top-cut round.
  const generateInitialPlacementBracket = async (
    tcRound: number,
    phase: "top_cut" | "u12_top_cut" = "top_cut",
  ) => {
    if (tiebreakerDepth <= 0) return 0;

    const { data: tcAll } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase", phase);
    if (!tcAll || tcAll.length === 0) return 0;

    const finalRound = Math.max(...tcAll.map((m: any) => m.round));
    if (tcRound >= finalRound) return 0;
    const roundsFromFinal = finalRound - tcRound;
    if (roundsFromFinal === 1) return 0; // semifinal losers → 3rd/4th place match

    const placementStart = Math.pow(2, roundsFromFinal) + 1;
    if (placementStart > tiebreakerDepth) return 0;

    // Note: do NOT block on completed later rounds. Earlier-round placement
    // brackets must still be generated retroactively if missing.
    // Duplicate insertion is prevented by the existingTb check below.

    const roundMatches = tcAll.filter((m: any) => m.round === tcRound);
    const realMatches = roundMatches.filter((m: any) => m.player1_id && m.player2_id);
    if (realMatches.length < 2) return 0;
    if (!realMatches.every((m: any) => m.status === "completed" && m.winner_id)) return 0;

    const { data: existingTb } = await supabase
      .from("tournament_matches")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("phase", "tiebreaker")
      .eq("round", tcRound);
    if ((existingTb || []).length > 0) return 0;

    const ordered = [...realMatches].sort((a: any, b: any) => a.match_number - b.match_number);
    const losers = ordered
      .map((m: any) => (m.player1_id === m.winner_id ? m.player2_id : m.player1_id))
      .filter(Boolean) as string[];

    const inserts = buildPlacementGroupMatches(losers, placementStart, tcRound, "", tiebreakerDepth);
    return await insertPlacementMatches(inserts, tcRound);
  };

  // After a tiebreaker match completes, check whether its parent group is fully
  // resolved and, if so, generate the W and L subgroups recursively.
  const advancePlacementBracketAfterTiebreaker = async (completedMatch: Match) => {
    const meta = completedMatch.pairing_meta;
    if (!meta || !meta.tb_top_cut_round || meta.tb_is_final) return 0;
    const tcRound: number = meta.tb_top_cut_round;
    const groupPath: string = meta.tb_group_path;
    const groupSize: number = meta.tb_group_size;
    const placementStart: number = meta.tb_placement_start;
    if (!groupPath || !groupSize) return 0;

    const { data: tbAll } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase", "tiebreaker")
      .eq("round", tcRound);
    if (!tbAll) return 0;

    const groupMatches = (tbAll as any[]).filter((m) =>
      m.pairing_meta &&
      m.pairing_meta.tb_group_path === groupPath &&
      m.pairing_meta.tb_group_size === groupSize
    );
    const expected = groupSize / 2;
    if (groupMatches.length < expected) return 0;
    if (!groupMatches.every((m: any) => m.status === "completed" && m.winner_id)) return 0;

    groupMatches.sort(
      (a: any, b: any) =>
        (a.pairing_meta.tb_bracket_index ?? 0) - (b.pairing_meta.tb_bracket_index ?? 0),
    );
    const winners = groupMatches.map((m: any) => m.winner_id as string);
    const losers = groupMatches
      .map((m: any) => (m.player1_id === m.winner_id ? m.player2_id : m.player1_id))
      .filter(Boolean) as string[];

    const subSize = groupSize / 2;
    const winnersStart = placementStart;
    const losersStart = placementStart + subSize;
    const isRoot = groupPath === "root" || groupPath === "";
    const winnersPath = isRoot ? "W" : groupPath + ".W";
    const losersPath = isRoot ? "L" : groupPath + ".L";

    const subgroupExists = (path: string) =>
      (tbAll as any[]).some(
        (m) => m.pairing_meta && m.pairing_meta.tb_group_path === path,
      );

    const inserts: PlacementInsert[] = [];
    if (!subgroupExists(winnersPath)) {
      inserts.push(
        ...buildPlacementGroupMatches(winners, winnersStart, tcRound, winnersPath, tiebreakerDepth),
      );
    }
    if (!subgroupExists(losersPath)) {
      inserts.push(
        ...buildPlacementGroupMatches(losers, losersStart, tcRound, losersPath, tiebreakerDepth),
      );
    }
    return await insertPlacementMatches(inserts, tcRound);
  };

  // Legacy entry points kept for compatibility with existing call sites
  const handleTiebreakerPairing = async (topCutRound: number, _loserId: string, _completedMatchId: string) => {
    const { data: tcAll } = await supabase
      .from("tournament_matches")
      .select("round, match_number")
      .eq("tournament_id", tournamentId)
      .eq("phase", "top_cut");
    const finalRound = Math.max(...((tcAll || []).map((m: any) => m.round) as number[]), topCutRound);
    // Backfill: try to generate the placement bracket for every round up to and
    // including the current one. Earlier rounds may have been skipped if the
    // last match of that round completed after later rounds had already started.
    for (let r = 1; r <= topCutRound; r++) {
      if (finalRound - r === 1) {
        const has3rd = (tcAll || []).some(
          (m: any) => m.round === finalRound && m.match_number === 2,
        );
        if (has3rd) continue;
      }
      await generateInitialPlacementBracket(r, "top_cut");
    }
  };

  const handleU12TiebreakerPairing = async (topCutRound: number, _loserId: string) => {
    await generateInitialPlacementBracket(topCutRound, "u12_top_cut");
  };


  // ===== ADMIN: REGENERATE MISSING PLAYOFF/TIEBREAKER MATCHES =====
  // Scans completed top_cut rounds and fills any missing positional tiebreakers
  // (5°-8°, etc.) and the 3°/4° place match when semifinals are over.
  // Target identifies a specific missing playoff to (re)generate.
  // Format:
  //   { kind: "third_place", phase }
  //   { kind: "positional", phase, round }  // losers bracket of a given top_cut round
  //   { kind: "all" }                        // generate everything missing (legacy)
  type PlayoffTarget =
    | { kind: "all" }
    | { kind: "third_place"; phase: "top_cut" | "u12_top_cut" }
    | { kind: "positional"; phase: "top_cut" | "u12_top_cut"; round: number };

  const regenerateMissingPlayoffMatches = async (target: PlayoffTarget = { kind: "all" }) => {
    try {
      let createdCount = 0;
      const effectiveDepth = tiebreakerDepth > 0 ? tiebreakerDepth : 4;

      const phases: Array<"top_cut" | "u12_top_cut"> = ["top_cut", "u12_top_cut"];

      for (const phase of phases) {
        if (target.kind !== "all" && target.phase !== phase) continue;

        const { data: phaseMatches } = await supabase
          .from("tournament_matches")
          .select("*")
          .eq("tournament_id", tournamentId)
          .eq("phase", phase);

        if (!phaseMatches || phaseMatches.length === 0) continue;

        const finalRound = Math.max(...phaseMatches.map((m) => m.round));

        // 1) Positional tiebreakers (consolation bracket) for completed rounds before the final.
        //    Uses the new generator so it produces proper Challonge-style brackets,
        //    then advances any already-completed groups into their W/L subgroups.
        if (target.kind === "all" || target.kind === "positional") {
          for (let r = 1; r < finalRound; r++) {
            if (target.kind === "positional" && target.round !== r) continue;
            const roundsFromFinal = finalRound - r;
            if (roundsFromFinal === 1) continue; // 3rd/4th handled below
            const placementStart = Math.pow(2, roundsFromFinal) + 1;
            if (placementStart > effectiveDepth) continue;

            // Generate root group if missing
            createdCount += await generateInitialPlacementBracket(r, phase);

            // Walk any completed tiebreaker groups and spawn missing subgroups
            // Loop up to a safety cap (depth of recursion <= log2(K))
            for (let pass = 0; pass < 6; pass++) {
              const { data: tbRound } = await supabase
                .from("tournament_matches")
                .select("*")
                .eq("tournament_id", tournamentId)
                .eq("phase", "tiebreaker")
                .eq("round", r);
              const completedNonFinals = (tbRound || []).filter(
                (m: any) =>
                  m.status === "completed" &&
                  m.winner_id &&
                  m.pairing_meta &&
                  !m.pairing_meta.tb_is_final,
              );
              let advancedThisPass = 0;
              for (const m of completedNonFinals) {
                advancedThisPass += await advancePlacementBracketAfterTiebreaker(m as Match);
              }
              if (advancedThisPass === 0) break;
              createdCount += advancedThisPass;
            }
          }
        }


        // 2) 3°/4° place match (semifinal losers) when missing and tiebreakerDepth >= 4
        if (target.kind === "all" || target.kind === "third_place") {
          if (finalRound >= 2 && effectiveDepth >= 4) {
            const semis = phaseMatches.filter(
              (m) => m.round === finalRound - 1 && m.player1_id && m.player2_id
            );
            const allSemisDone = semis.length >= 2 && semis.every((m) => m.status === "completed" && m.winner_id);
            const thirdPlaceExists = phaseMatches.some(
              (m) => m.round === finalRound && m.match_number === 2
            );

            if (allSemisDone && !thirdPlaceExists) {
              const semiOrdered = [...semis].sort((a, b) => a.match_number - b.match_number);
              const losersOrdered = semiOrdered.map((m) =>
                m.player1_id === m.winner_id ? m.player2_id : m.player1_id
              );
              const { error } = await supabase.from("tournament_matches").insert({
                tournament_id: tournamentId,
                round: finalRound,
                phase,
                match_number: 2,
                player1_id: losersOrdered[0],
                player2_id: losersOrdered[1],
                status: "pending",
              });
              if (!error) createdCount++;
            }
          }
        }
      }

      if (createdCount > 0) {
        toast.success(`Generati ${createdCount} match di spareggio`);
        appendLog(`Admin ha rigenerato ${createdCount} match di spareggio`);
        await fetchData();
      } else {
        toast.info("Nessuno spareggio da generare per questa selezione");
      }
    } catch (e: any) {
      console.error("regenerateMissingPlayoffMatches error", e);
      toast.error("Errore durante la generazione: " + (e?.message || "sconosciuto"));
    }
  };

  // Compute which playoff targets are currently available (missing) so the
  // admin can pick exactly which one to generate.
  const computeMissingPlayoffOptions = (): Array<{ target: PlayoffTarget; label: string }> => {
    const opts: Array<{ target: PlayoffTarget; label: string }> = [];
    // When tiebreakerDepth is not configured (e.g. tournament reopened by admin),
    // fall back to a default depth of 4 so that at minimum the 3rd/4th place
    // playoff and a couple of positional rounds are offered.
    const effectiveDepth = tiebreakerDepth > 0 ? tiebreakerDepth : 4;

    const phases: Array<"top_cut" | "u12_top_cut"> = ["top_cut", "u12_top_cut"];
    for (const phase of phases) {
      const phaseMatches = matches.filter((m) => m.phase === phase);
      if (phaseMatches.length === 0) continue;
      const finalRound = Math.max(...phaseMatches.map((m) => m.round));
      const phaseLabel = phase === "u12_top_cut" ? " (U12)" : "";

      // Positional tiebreakers
      for (let r = 1; r < finalRound; r++) {
        const roundMatches = phaseMatches.filter((m) => m.round === r);
        const realMatches = roundMatches.filter((m) => m.player1_id && m.player2_id);
        if (realMatches.length < 2) continue;
        if (!realMatches.every((m) => m.status === "completed" && m.winner_id)) continue;

        const roundsFromFinal = finalRound - r;
        const placementStart = roundsFromFinal === 1 ? 3 : Math.pow(2, roundsFromFinal) + 1;
        const placementEnd = Math.pow(2, roundsFromFinal + 1);
        if (placementStart > effectiveDepth) continue;
        if (roundsFromFinal === 1) continue; // handled by 3°/4°

        const existingTb = matches.filter(
          (m) => m.phase === "tiebreaker" && m.round === r
        );
        const losers = realMatches
          .map((m) => (m.player1_id === m.winner_id ? m.player2_id : m.player1_id))
          .filter(Boolean) as string[];
        const alreadyPaired = new Set<string>();
        existingTb.forEach((m) => {
          if (m.player1_id) alreadyPaired.add(m.player1_id);
          if (m.player2_id) alreadyPaired.add(m.player2_id);
        });
        const unpaired = losers.filter((l) => !alreadyPaired.has(l));
        if (unpaired.length < 2) continue;

        opts.push({
          target: { kind: "positional", phase, round: r },
          label: `Spareggi ${placementStart}°-${placementEnd}°${phaseLabel}`,
        });
      }

      // 3°/4° place match
      if (finalRound >= 2 && effectiveDepth >= 4) {
        const semis = phaseMatches.filter(
          (m) => m.round === finalRound - 1 && m.player1_id && m.player2_id
        );
        const allSemisDone = semis.length >= 2 && semis.every((m) => m.status === "completed" && m.winner_id);
        const thirdPlaceExists = phaseMatches.some(
          (m) => m.round === finalRound && m.match_number === 2
        );
        if (allSemisDone && !thirdPlaceExists) {
          opts.push({
            target: { kind: "third_place", phase },
            label: `Match 3°/4° posto${phaseLabel}`,
          });
        }
      }
    }
    return opts;
  };




  const swissMatches = matches.filter((m) => m.phase === "swiss");
  const topCutMatches = matches.filter((m) => m.phase === "top_cut");
  const u12TopCutMatches = matches.filter((m) => m.phase === "u12_top_cut");
  const tiebreakerMatches = matches.filter((m) => m.phase === "tiebreaker");
  const preTopCutMatches = matches.filter((m) => m.phase === "pre_top_cut");
  const topCutFinalRound = topCutMatches.length > 0 ? Math.max(...topCutMatches.map((m) => m.round)) : 0;
  const thirdPlaceMatch = topCutMatches.find((m) => m.round === topCutFinalRound && m.match_number === 2);
  const mainTopCutMatches = thirdPlaceMatch ? topCutMatches.filter((m) => m.id !== thirdPlaceMatch.id) : topCutMatches;
  const effectiveGroups = groupsCountProp > 0 ? groupsCountProp : 0;
  const hasU12Group = standings.some(s => s.group_number === 99);

  // Compute group-aware Swiss status
  const getGroupSwissStatus = (groupNum?: number) => {
    // groupNum: undefined = all, 0 = main (null group_number), N = specific group, 99 = kids
    const gMatches = groupNum === 0
      ? swissMatches.filter(m => m.group_number === null)
      : groupNum
        ? swissMatches.filter(m => m.group_number === groupNum)
        : swissMatches;
    const maxRound = gMatches.length > 0 ? Math.max(...gMatches.map(m => m.round)) : 0;
    const allDone = gMatches.filter(m => m.round === maxRound).every(m => m.status === "completed") && maxRound > 0;
    const calcGroup = groupNum === 0 ? undefined : groupNum;
    const allSwiss = maxRound >= calcSwissRounds(calcGroup) && allDone;
    return { maxRound, allDone, allSwiss };
  };

  const { maxRound: maxSwissRound, allDone: allCurrentRoundDone, allSwiss: allSwissDone } = (() => {
    const groupsToCheck: number[] = [];
    if (effectiveGroups > 0) {
      for (let g = 1; g <= effectiveGroups; g++) groupsToCheck.push(g);
    }
    if (hasU12Group) groupsToCheck.push(99);

    if (groupsToCheck.length > 0) {
      let allGroupsDone = true;
      let minMaxRound = Infinity;
      // If no regular groups, also check non-grouped (main) matches
      if (effectiveGroups === 0) {
        const gs = getGroupSwissStatus(0);
        if (!gs.allSwiss) allGroupsDone = false;
        if (gs.maxRound > 0) minMaxRound = Math.min(minMaxRound, gs.maxRound);
      }
      for (const g of groupsToCheck) {
        const gs = getGroupSwissStatus(g);
        if (!gs.allSwiss) allGroupsDone = false;
        minMaxRound = Math.min(minMaxRound, gs.maxRound);
      }
      return { maxRound: minMaxRound === Infinity ? 0 : minMaxRound, allDone: allGroupsDone, allSwiss: allGroupsDone };
    }
    return getGroupSwissStatus();
  })();

  const topCutFinalDone =
    topCutMatches.length > 0 &&
    topCutMatches.filter((m) => m.round === Math.max(...topCutMatches.map((x) => x.round))).every((m) => m.status === "completed");
  const u12TopCutFinalDone =
    u12TopCutMatches.length === 0 ||
    u12TopCutMatches.filter((m) => m.round === Math.max(...u12TopCutMatches.map((x) => x.round))).every((m) => m.status === "completed");
  const allTiebreakersDone = tiebreakerMatches.length === 0 || tiebreakerMatches.every((m) => m.status === "completed");
  const preTopCutDone = preTopCutMatches.length === 0 || preTopCutMatches.every(m => m.status === "completed");
  const hasMainTopCutBracket = topCutMatches.length > 0 || preTopCutMatches.length > 0;
  const hasAnyTopCutBracket = hasMainTopCutBracket || u12TopCutMatches.length > 0 || tiebreakerMatches.length > 0;
  const isTopCutLikePhase = status === "top_cut" || status === "pre_top_cut" || status === "completed" || hasAnyTopCutBracket;

  const isStarted = status !== "pending";

  const showSettings_ = renderMode === "all" || renderMode === "settings";
  const showBracket_ = renderMode === "all" || renderMode === "bracket";

  const settingsAlwaysOpen = renderMode === "settings";

  return (
    <div className="space-y-6">
      {/* Settings Panel */}
      {showSettings_ && !settingsAlwaysOpen && (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
          <Settings2 size={14} className="mr-1" /> Impostazioni Torneo
        </Button>
      </div>
      )}

      {showSettings_ && (showSettings || settingsAlwaysOpen) && (
        <div className={settingsAlwaysOpen ? "space-y-4" : "bg-secondary/30 rounded-xl border border-border p-4 space-y-4"}>
          {!settingsAlwaysOpen && <h4 className="text-sm font-semibold font-sans tracking-[0.08em] text-foreground">Modifica Impostazioni</h4>}
          {(settingsSection === "all" || settingsSection === "general") && (<>
          {/* ═══ SEZIONE 1: Informazioni Generali ═══ */}
          <div className="space-y-1 mb-2">
            <h4 className="text-sm font-semibold font-sans tracking-wide text-foreground">📋 Informazioni Generali</h4>
            <div className="h-px bg-border" />
          </div>

          {/* Visibilità torneo */}
          <div className="flex flex-col gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">Visibilità torneo</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editIsHidden
                    ? "🔒 Nascosto — visibile solo a staff e admin"
                    : "👁 Pubblico — visibile a tutti i giocatori"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${!editIsHidden ? "font-semibold" : "text-muted-foreground"}`}>Pubblico</span>
                <Switch
                  checked={editIsHidden}
                  disabled={!visibilityLoaded}
                  onCheckedChange={async (v) => {
                    setEditIsHidden(v);
                    const update: { is_hidden: boolean; auto_publish_at?: string | null } = { is_hidden: v };
                    if (!v) {
                      setEditAutoPublishAt("");
                      update.auto_publish_at = null;
                    }
                    await saveVisibility(update);
                  }}
                />
                <span className={`text-xs ${editIsHidden ? "font-semibold" : "text-muted-foreground"}`}>Nascosto</span>
              </div>
            </div>

            {editIsHidden && (
              <div className="pl-3 border-l-2 border-primary/30 ml-1 space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="bm_schedule_publish"
                    checked={!!editAutoPublishAt}
                    onCheckedChange={async (v) => {
                      if (v === true) {
                        const d = new Date();
                        d.setHours(d.getHours() + 1, 0, 0, 0);
                        const local = toLocalDatetime(d.toISOString());
                        setEditAutoPublishAt(local);
                        await saveVisibility({ auto_publish_at: local });
                      } else {
                        setEditAutoPublishAt("");
                        await saveVisibility({ auto_publish_at: null });
                      }
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <label htmlFor="bm_schedule_publish" className="text-sm font-medium cursor-pointer block">
                      📅 Programma pubblicazione
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Il torneo diventerà automaticamente pubblico alla data e ora indicate.
                    </p>
                  </div>
                </div>
                {!!editAutoPublishAt && (
                  <div className="pl-6">
                    <label className="text-xs font-medium block mb-1">
                      Data e ora di pubblicazione
                    </label>
                    <Input
                      type="datetime-local"
                      value={editAutoPublishAt}
                      onChange={(e) => setEditAutoPublishAt(e.target.value)}
                      onBlur={() => editAutoPublishAt && saveVisibility({ auto_publish_at: editAutoPublishAt })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <div className="lg:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Titolo</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Descrizione</label>
              <RichTextEditor
                key={`desc-${tournamentId}`}
                initialContent={editDescription}
                onChange={(html) => setEditDescription(html)}
                placeholder="Descrizione del torneo..."
                className="min-h-[120px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Luogo</label>
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Città</label>
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data Evento</label>
              <Input type="datetime-local" value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Apertura Iscrizioni</label>
              <Input type="datetime-local" value={editRegOpensAt} onChange={(e) => setEditRegOpensAt(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Opzionale. Staff club e admin possono iscriversi sempre.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Scadenza Iscrizioni</label>
              <Input type="datetime-local" value={editRegDeadline} onChange={(e) => setEditRegDeadline(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">🏆 Premi</label>
              <Input value={editPrize} onChange={(e) => setEditPrize(e.target.value)} placeholder="Es. Trofeo + Bey esclusivo" maxLength={300} />
            </div>
          </div>
          </>)}

          {(settingsSection === "all" || settingsSection === "format") && (<>
          {/* ═══ SEZIONE 2: Formato e Struttura ═══ */}
          <div className="space-y-1 mb-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold font-sans tracking-wide text-foreground">⚙️ Formato e Struttura</h4>
              <TournamentRulesInfo />
            </div>
            <div className="h-px bg-border" />
          </div>
          <div className="grid lg:grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Giocatori</label>
              <Input
                type="number"
                min={players.length || 2}
                max={256}
                value={editMaxParticipants}
                onChange={(e) => setEditMaxParticipants(Number(e.target.value))}
              />
            </div>
            {!isStarted && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo Torneo</label>
                <Select value={editFormat} onValueChange={(v) => setEditFormat(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swiss">Solo Swiss</SelectItem>
                    <SelectItem value="swiss_top_cut">Swiss + Top Cut</SelectItem>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                    <SelectItem value="round_robin_top_cut">Round Robin + Top Cut</SelectItem>
                    <SelectItem value="single_elimination">Eliminazione Diretta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(editFormat === "swiss_top_cut" || editFormat === "swiss") && (
              <div>
                <OptionToggleGroup
                  label="Turni Swiss"
                  options={[3, 4, 5, 6, 7, 8]}
                  value={editSwissRounds ? parseInt(editSwissRounds) : calcSwissRounds()}
                  onChange={(v) => setEditSwissRounds(String(v))}
                  getDisabledReason={isRanked ? (opt) => {
                    const readyCount = checkInEnabled ? regsProp.filter(r => r.is_ready).length : players.length;
                    const maxRounds = readyCount < 8 ? 3 : readyCount <= 16 ? 4 : readyCount <= 32 ? 5 : readyCount <= 64 ? 6 : readyCount <= 128 ? 7 : 8;
                    if (opt > maxRounds) return `Servono almeno ${opt === 4 ? 8 : opt === 5 ? 17 : opt === 6 ? 33 : opt === 7 ? 65 : 129} iscritti pronti per ${opt} turni (attualmente ${readyCount})`;
                    return null;
                  } : undefined}
                />
              </div>
            )}
            {(editFormat === "swiss_top_cut" || editFormat === "single_elimination" || editFormat === "round_robin_top_cut") && (() => {
              const readyCount = checkInEnabled ? regsProp.filter(r => r.is_ready).length : editMaxParticipants;
              const effectiveMax = Math.min(editMaxParticipants, readyCount);
              return (
                <div>
                  <OptionToggleGroup
                    label="Top Cut"
                    options={[4, 8, 16, 32, 64, 128]}
                    value={editTopCutSize}
                    onChange={(v) => setEditTopCutSize(v)}
                    prefix="Top "
                    getDisabledReason={(opt) => {
                      if (!isRanked) return null;
                      if (opt === 4 && effectiveMax < 6) return `Servono almeno 6 iscritti pronti per Top 4 (attualmente ${effectiveMax})`;
                      if (opt > 4 && opt > Math.floor(effectiveMax / 2)) return `Servono almeno ${opt * 2} iscritti pronti per Top ${opt} (attualmente ${effectiveMax})`;
                      return null;
                    }}
                  />
                </div>
              );
            })()}
            {(format === "swiss_top_cut" || format === "swiss") && (() => {
              const readyCount = checkInEnabled ? regsProp.filter(r => r.is_ready).length : players.length;
              const effectivePlayerCount = Math.min(editMaxParticipants, readyCount);
              return (
                <div>
                  <OptionToggleGroup
                    label="Gironi"
                    options={[0, 2, 3, 4, 5, 6, 7, 8]}
                    value={editGroupsCount}
                    onChange={(v) => setEditGroupsCount(v)}
                    getDisabledReason={(opt) => {
                      if (!isRanked) return null;
                      if (opt === 0) return null;
                      const perGroup = Math.floor(effectivePlayerCount / opt);
                      if (perGroup < 8) return `Servono almeno ${opt * 8} giocatori per ${opt} gironi (attuali: ${effectivePlayerCount})`;
                      return null;
                    }}
                  />
                </div>
              );
            })()}
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">🪑 Assegnazione Tavoli</label>
                  <p className="text-[10px] text-muted-foreground">
                    {editGroupsCount > 0
                      ? "Assegna tavoli per gruppo e controlla i match in corso"
                      : "Suddivide i match di ogni turno tra i tavoli (Tavolo A, B, C…)"}
                  </p>
                </div>
                <Switch checked={editTableAssignment} onCheckedChange={setEditTableAssignment} />
              </div>
              {editTableAssignment && editGroupsCount > 0 && (
                <OptionToggleGroup
                  label="Tavoli per gruppo"
                  options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16]}
                  value={editMatchesPerTable}
                  onChange={(v) => setEditMatchesPerTable(v)}
                />
              )}
              {editTableAssignment && editGroupsCount === 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">Numero tavoli totali</label>
                  <Select
                    value={String(Math.min(32, Math.max(1, editMatchesPerTable)))}
                    onValueChange={(v) => setEditMatchesPerTable(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {Array.from({ length: 32 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? "tavolo" : "tavoli"} ({n <= 26 ? `Tavolo A${n > 1 ? `–${String.fromCharCode(64 + n)}` : ""}` : `A–Z + extra`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    I match di ogni turno verranno distribuiti in modo equo tra i tavoli (round-robin sequenziale).
                  </p>
                </div>
              )}
            </div>
            {/* Sezione Kids spostata nel tab dedicato */}
          </div>
          </>)}

          {(settingsSection === "all" || settingsSection === "kids") && (editFormat === "swiss_top_cut" || editFormat === "swiss") && (<>
          {/* ═══ SEZIONE: Gruppo Kids ═══ */}
          <div className="space-y-1 mb-2">
            <h4 className="text-sm font-semibold font-sans tracking-wide text-foreground">🧒 Gruppo Kids</h4>
            <div className="h-px bg-border" />
          </div>
          <div className="space-y-4 mb-6">
            {players.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessun giocatore iscritto. Le opzioni Kids saranno disponibili dopo le iscrizioni.</p>
            ) : (
              <>
                <div className="bg-secondary/30 rounded-lg border border-border p-3">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Seleziona i giocatori da includere nel gruppo Kids. Servono almeno <strong>8 kids</strong> per attivare il gruppo dedicato.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(shuffledPlayers.length > 0 ? shuffledPlayers : players).map(p => {
                      const isU12 = under12Players.has(p.user_id);
                      return (
                        <button
                          key={p.user_id}
                          type="button"
                          onClick={() => {
                            const newSet = new Set(under12Players);
                            if (isU12) newSet.delete(p.user_id);
                            else newSet.add(p.user_id);
                            setUnder12Players(newSet);
                            if (newSet.size < 8 && editUnder12Enabled) setEditUnder12Enabled(false);
                          }}
                          className={`text-[11px] rounded px-2 py-1 border transition-all ${
                            isU12
                              ? "bg-primary/20 border-primary text-primary font-medium"
                              : "bg-card border-border hover:border-primary/50"
                          }`}
                        >
                          {p.display_name}{isU12 && " ✓"}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {under12Players.size} / 8 kids selezionati {under12Players.size >= 8 ? "✅" : ""}
                  </p>
                </div>

                <div className={`flex items-center justify-between rounded-lg border p-3 ${under12Players.size >= 8 ? "border-border bg-card" : "border-dashed border-border/50 bg-muted/30 opacity-60"}`}>
                  <div>
                    <label className="text-xs font-semibold">Attiva Gruppo Kids</label>
                    <p className="text-[10px] text-muted-foreground">
                      {under12Players.size >= 8
                        ? "Pronto per essere attivato."
                        : `Seleziona almeno ${8 - under12Players.size} kids in più per sbloccare.`}
                    </p>
                  </div>
                  <Switch
                    checked={editUnder12Enabled}
                    disabled={under12Players.size < 8}
                    onCheckedChange={setEditUnder12Enabled}
                  />
                </div>

                {editUnder12Enabled && under12Players.size >= 8 && (
                  <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                    <OptionToggleGroup
                      label="Turni Swiss Kids"
                      options={[3, 4, 5, 6, 7, 8, 9]}
                      value={editU12SwissRounds ? Number(editU12SwissRounds) : 3}
                      onChange={(v) => setEditU12SwissRounds(String(v))}
                    />
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Top Cut separata per Kids</label>
                      <Switch checked={editUnder12SeparateTopcut} onCheckedChange={setEditUnder12SeparateTopcut} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {editUnder12SeparateTopcut
                        ? "I Kids avranno una Top Cut dedicata separata."
                        : "I Kids giocheranno Swiss separato e poi parteciperanno alla Top Cut principale."}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          </>)}

          {(settingsSection === "all" || settingsSection === "tiebreakers") && (<>

          {/* ═══ SEZIONE: Tiebreakers e Spareggi ═══ */}
          <div className="space-y-1 mb-2">
            <h4 className="text-sm font-semibold font-sans tracking-wide text-foreground">⚖️ Tiebreakers e Spareggi</h4>
            <div className="h-px bg-border" />
          </div>
          <div className="grid lg:grid-cols-2 gap-x-6 gap-y-4 mb-6">
            {(editFormat === "swiss_top_cut" || editFormat === "single_elimination" || editFormat === "round_robin_top_cut") && (
              <div>
                <OptionToggleGroup
                  label="Match di spareggio fino a:"
                  options={[0, 4, 8, 16]}
                  value={editTiebreakerDepth}
                  onChange={(v) => setEditTiebreakerDepth(v)}
                  formatLabel={(opt) => {
                    if (opt === 0) return "OFF";
                    if (opt === 4) return "3° - 4°";
                    if (opt === 8) return "5° - 8°";
                    if (opt === 16) return "9° - 16°";
                    return `${opt}°`;
                  }}
                  getDisabledReason={(opt) => {
                    if (opt > 0 && opt > editTopCutSize) return `Top Cut troppo piccola per spareggi fino al ${opt}° posto`;
                    return null;
                  }}
                />
                {editTiebreakerDepth > 0 && (
                  <div className="mt-3 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo di spareggio</label>
                    <Select value={editTiebreakerMode} onValueChange={(v) => setEditTiebreakerMode(v as "advanced" | "rapid")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rapid">Rapidi — match secchi per classifica</SelectItem>
                        <SelectItem value="advanced">Avanzati — bracket completo per fascia</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {editTiebreakerMode === "rapid"
                        ? "I perdenti vengono accoppiati in base allo score in classifica: un solo match per due posizioni."
                        : "Ogni fascia di piazzamento gioca un mini-bracket completo con turni W/L."}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <label className="text-xs text-muted-foreground font-semibold">⚖️ Tiebreaker attivi in classifica</label>
              <p className="text-[10px] text-muted-foreground">
                Disattiva i tiebreaker che non vuoi usare: i criteri spenti non appariranno in classifica e non saranno considerati per le posizioni.
              </p>
              <div className="space-y-1.5 pt-1">
                {([
                  { key: "head_to_head", label: "Scontro diretto (H2H)" },
                  { key: "omw", label: "OMW% — Match win % avversari" },
                  { key: "buchholz", label: "Median Buchholz" },
                  { key: "gw", label: "PW% — Punti partita vinti" },
                  { key: "ogw", label: "OPW% — Punti partita avversari" },
                  { key: "gw_diff", label: "Diff. punti partita" },
                ] as const).map((t) => (
                  <div key={t.key} className="flex items-center justify-between gap-2">
                    <label htmlFor={`tb-${t.key}`} className="text-xs">{t.label}</label>
                    <Switch
                      id={`tb-${t.key}`}
                      checked={editEnabledTiebreakers[t.key]}
                      onCheckedChange={(v) => setEditEnabledTiebreakers((prev) => ({
                        ...prev,
                        [t.key]: v,
                        ...(t.key === "omw" ? { resistance: v } : {}),
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          </>)}

          {(settingsSection === "all" || settingsSection === "scoring") && (<>
          {/* ═══ SEZIONE: Scoring ═══ */}
          <div className="space-y-1 mb-2">
            <h4 className="text-sm font-semibold font-sans tracking-wide text-foreground">🏁 Inserimento Punteggi</h4>
            <div className="h-px bg-border" />
          </div>
          <div className="grid lg:grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs text-muted-foreground font-semibold">Chi può segnare i punteggi</label>
              <Select value={editScoringPolicy} onValueChange={setEditScoringPolicy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff_only">Solo Staff del club</SelectItem>
                  <SelectItem value="staff_and_referees">Staff + Arbitri certificati</SelectItem>
                  <SelectItem value="staff_referees_players">Staff + Arbitri + Giocatori del match</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {editScoringPolicy === "staff_only" && "Solo lo staff del club può inserire i risultati dei match."}
                {editScoringPolicy === "staff_and_referees" && "Lo staff e gli utenti con badge Judge/Head Judge possono inserire i risultati."}
                {editScoringPolicy === "staff_referees_players" && "Staff, arbitri certificati e tutti i partecipanti del torneo possono inserire i risultati di qualsiasi match."}
              </p>
            </div>
          </div>
          </>)}


          {(settingsSection === "all" || settingsSection === "payment") && (<>
          {/* ═══ SEZIONE 4: Iscrizione e Pagamento ═══ */}
          <div className="space-y-1 mb-2">
            <h4 className="text-sm font-semibold font-sans tracking-wide text-foreground">💳 Iscrizione e Pagamento</h4>
            <div className="h-px bg-border" />
          </div>
          <div className="grid lg:grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setEditIsPaid(false); setEditEntryFee("0"); setEditPaymentMethods([]); setEditPaymentLink(""); }}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${!editIsPaid ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}
                >
                  <span>🆓</span>
                  <span className={!editIsPaid ? "text-primary font-medium" : ""}>Gratuito</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditIsPaid(true)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${editIsPaid ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}
                >
                  <span>💰</span>
                  <span className={editIsPaid ? "text-primary font-medium" : ""}>A Pagamento</span>
                </button>
              </div>
              {editIsPaid && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quota Iscrizione (€)</label>
                    <Input type="number" value={editEntryFee} onChange={(e) => setEditEntryFee(e.target.value)} min={0} step={0.5} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Metodo di Pagamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditPaymentMethods(prev => prev.includes("in_loco") ? prev.filter(m => m !== "in_loco") : [...prev, "in_loco"])}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${editPaymentMethods.includes("in_loco") ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}
                      >
                        <span>💵</span>
                        <span className={editPaymentMethods.includes("in_loco") ? "text-primary font-medium" : ""}>In Loco</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditPaymentMethods(prev => prev.includes("paypal") ? prev.filter(m => m !== "paypal") : [...prev, "paypal"]); setDisclaimerAccepted(false); }}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${editPaymentMethods.includes("paypal") ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}
                      >
                        <span>💳</span>
                        <span className={editPaymentMethods.includes("paypal") ? "text-primary font-medium" : ""}>PayPal</span>
                      </button>
                    </div>
                  </div>
                  {editPaymentMethods.includes("paypal") && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Link PayPal</label>
                        <Input value={editPaymentLink} onChange={(e) => setEditPaymentLink(e.target.value)} placeholder="https://paypal.me/..." maxLength={500} />
                      </div>
                      {editPaymentLink.trim() && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            <div className="space-y-2">
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                FIBeGS non è responsabile di qualsiasi entrata o uscita di denaro derivante dai link di pagamento.
                              </p>
                              <div className="flex items-center gap-2">
                                <Checkbox id="settings-payment-disclaimer" checked={disclaimerAccepted} onCheckedChange={(v) => setDisclaimerAccepted(v === true)} />
                                <label htmlFor="settings-payment-disclaimer" className="text-[10px] font-medium cursor-pointer">Accetto il disclaimer</label>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <label className="text-sm font-medium">✅ Check-in (Pronto)</label>
                  <p className="text-xs text-muted-foreground">Abilita il check-in per verificare i giocatori presenti</p>
                </div>
                <Switch
                  checked={checkInEnabled}
                  onCheckedChange={async (checked) => {
                    const { error } = await supabase.from("tournaments").update({ check_in_enabled: checked }).eq("id", tournamentId);
                    if (error) { toast.error("Errore"); } else { onStatusChange(); }
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <label className="text-sm font-medium">📋 Lista d'attesa</label>
                  <p className="text-xs text-muted-foreground">Permetti iscrizioni in lista d'attesa oltre il limite</p>
                </div>
                <Switch
                  checked={hasWaitlistProp}
                  onCheckedChange={async (checked) => {
                    const { error } = await supabase.from("tournaments").update({ has_waitlist: checked } as any).eq("id", tournamentId);
                    if (error) { toast.error("Errore"); } else { onStatusChange(); }
                  }}
                />
              </div>
            </div>
          </div>
          </>)}

          {(settingsSection === "all" || settingsSection === "general" || settingsSection === "format" || settingsSection === "tiebreakers" || settingsSection === "scoring" || settingsSection === "advanced" || settingsSection === "payment") && (
            <Button size="sm" onClick={saveSettings}>
              <Save size={14} className="mr-1" /> Salva Impostazioni
            </Button>
          )}


          {(settingsSection === "all" || settingsSection === "danger") && (
          <div className="pt-6 mt-6 border-t border-destructive/20 space-y-3">
            <h4 className="text-sm font-semibold text-destructive">Zona Pericolosa</h4>
            <div className="flex flex-wrap gap-3">
              {isStarted && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      <RotateCcw size={14} className="mr-1" /> Reset Torneo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset completo del torneo</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tutti i match, le classifiche e i progressi verranno eliminati. Le iscrizioni rimarranno e il torneo tornerà in fase di registrazione. Questa azione è irreversibile.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={resetTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Conferma Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {onDeleteTournament && !isCancelled && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 size={14} className="mr-1" /> Elimina Torneo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Annullare questo torneo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Il torneo verrà spostato nella sezione <strong>Annullati</strong>. I dati (match, classifiche, iscrizioni, risultati) non saranno cancellati: da lì potrai eliminarlo definitivamente o convertirlo in un nuovo torneo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={onDeleteTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Annulla torneo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isCancelled && onConvertToNewTournament && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Undo2 size={14} className="mr-1" /> Converti in nuovo torneo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Convertire in nuovo torneo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Il torneo verrà riattivato come <strong>nuovo torneo da giocare</strong>. Tutti i match, classifiche, iscrizioni e risultati esistenti verranno cancellati. Ricordati di aggiornare data, orario e impostazioni dopo la conversione.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={onConvertToNewTournament}>
                        Converti
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isCancelled && onHardDeleteTournament && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 size={14} className="mr-1" /> Elimina definitivamente
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminare definitivamente?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Questa azione è <strong>irreversibile</strong>. Tutti i dati del torneo (match, classifiche, iscrizioni, risultati) verranno eliminati definitivamente dal database.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={onHardDeleteTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Elimina definitivamente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Admin: reopen completed tournament */}
      {showBracket_ && status === "completed" && isAdmin && (
        <div className="flex flex-wrap gap-3 items-center rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex-1 text-sm text-muted-foreground">
            <strong className="text-foreground">Torneo concluso.</strong> In quanto admin puoi riaprirlo per inserire match mancanti o correggere risultati. Ricordati di riconcluderlo al termine per ricalcolare la classifica.
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Undo2 size={14} className="mr-1" /> Riapri Torneo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Riaprire il torneo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Lo status tornerà alla fase precedente (Top Cut o Swiss). I punti classifica ranked rimarranno assegnati finché non riconcluderai il torneo, momento in cui verranno ricalcolati. Vuoi continuare?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={reopenTournament}>Sì, riapri</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Always-visible action buttons (outside settings) - bracket mode */}
      {showBracket_ && isStarted && !showSettings && (
        <div className="flex flex-wrap gap-3 items-center">
          {allSwissDone && (format === "swiss" || format === "round_robin") && status === "swiss" && (
            <Button variant="hero" onClick={completeTournament}>
              <Trophy size={16} className="mr-2" /> Concludi Torneo
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                <RotateCcw size={14} className="mr-1" /> Reset Torneo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset completo del torneo</AlertDialogTitle>
                <AlertDialogDescription>
                  Tutti i match, le classifiche e i progressi verranno eliminati. Le iscrizioni rimarranno e il torneo tornerà in fase di registrazione. Questa azione è irreversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={resetTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Conferma Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Start Controls - settings mode (solo in sezione Generale) */}
      {showSettings_ && status === "pending" && (settingsSection === "all" || settingsSection === "general") && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h3 className="font-display text-xl mb-2">Avvia Torneo</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {players.length} giocatori iscritti
            {checkInEnabled ? ` (${regsProp.filter(r => r.is_ready).length} pronti)` : ""}.
            {(format === "round_robin" || format === "round_robin_top_cut")
              ? ` Il torneo avrà ${calcSwissRounds()} turni Round Robin`
              : ` Il torneo avrà ${calcSwissRounds()} turni Swiss`}
            {(format === "swiss_top_cut" || format === "round_robin_top_cut") ? ` + Top ${editTopCutSize}` : ""}
            {editGroupsCount > 0 ? ` in ${editGroupsCount} gruppi` : ""}
            {editUnder12Enabled && under12Players.size > 0 ? ` + Gruppo Kids (${under12Players.size}, ${calcSwissRounds(99)} turni)` : ""}.
          </p>
          {checkInEnabled && regsProp.some(r => !r.is_ready) && (
            <p className="text-xs text-destructive mb-4 flex items-center gap-1">
              <AlertTriangle size={12} /> I giocatori non pronti verranno esclusi all'avvio del torneo.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="hero" size="lg" disabled={players.length < (isRanked ? 8 : 2)}>
                  <Play size={16} className="mr-2" /> Avvia Torneo
                </Button>
              </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma avvio torneo</AlertDialogTitle>
                <AlertDialogDescription>
                  Stai per avviare il torneo con {players.length} giocatori. Le iscrizioni verranno chiuse. Continuare?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={startTournament}>Avvia</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>

            <Button
              variant="outline"
              size="lg"
              onClick={shufflePlayers}
              disabled={players.length < (isRanked ? 8 : 2)}
            >
              <Shuffle size={16} className="mr-2" /> Shuffle
            </Button>

            <Button
              variant="outline"
              size="lg"
              disabled={fillingFakes || spotsLeft <= 0}
              onClick={() => fillWithFakeUsers(spotsLeft)}
            >
              {fillingFakes ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <UserPlus size={16} className="mr-2" />
              )}
              {fillingFakes ? "Aggiungendo..." : `Riempi con ${spotsLeft} BOT`}
            </Button>
          </div>

          {/* Shuffled player order preview */}
          {shuffledPlayers.length > 0 && editGroupsCount === 0 && !editUnder12Enabled && (
            <div className="mt-4 bg-secondary/30 rounded-lg border border-border p-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Shuffle size={12} /> Ordine di gioco
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {shuffledPlayers.map((p, i) => (
                  <span key={p.user_id} className="text-xs bg-card border border-border rounded-md px-2 py-1">
                    <span className="text-muted-foreground mr-1">{i + 1}.</span>
                    {p.display_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Group assignment preview */}
          {editGroupsCount > 0 && players.length > 0 && (
            <div className="mt-4 bg-secondary/30 rounded-lg border border-border p-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Users size={12} /> Assegnazione Gironi
              </h4>
              <p className="text-[10px] text-muted-foreground mb-3">
                Clicca sul numero del gruppo per spostare un giocatore. L'assegnazione automatica è distribuita equamente.
              </p>
              <div className="space-y-3">
                {Array.from({ length: editGroupsCount }, (_, g) => g + 1).map(gNum => {
                  const allPlayers = (shuffledPlayers.length > 0 ? shuffledPlayers : players)
                    .filter(p => !under12Players.has(p.user_id));
                  const playersInGroup = allPlayers.filter((p, idx) => {
                    const assigned = groupAssignments.get(p.user_id);
                    return assigned ? assigned === gNum : getEvenGroupForIndex(idx, allPlayers.length, editGroupsCount) === gNum;
                  });
                  return (
                    <div key={gNum}>
                      <span className="text-xs font-semibold text-primary">Gruppo {String.fromCharCode(64 + gNum)}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">({playersInGroup.length} giocatori)</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {playersInGroup.map(p => (
                          <span key={p.user_id} className="text-[11px] bg-card border border-border rounded px-1.5 py-0.5 flex items-center gap-1">
                            {p.display_name}
                            <Select
                              value={String(groupAssignments.get(p.user_id) || gNum)}
                              onValueChange={(v) => {
                                const newMap = new Map(groupAssignments);
                                newMap.set(p.user_id, Number(v));
                                setGroupAssignments(newMap);
                              }}
                            >
                              <SelectTrigger className="h-4 w-8 text-[9px] p-0 border-0 bg-transparent">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: editGroupsCount }, (_, i) => i + 1).map(n => (
                                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selettore Kids spostato nel tab dedicato "Kids" */}
        </div>
      )}

      {/* Swiss phase controls - bracket mode */}
      {showBracket_ && status === "swiss" && (
        <div className="space-y-3">
          {(effectiveGroups > 0 || hasU12Group) ? (
            <>
              {/* Per-group controls */}
              <div className="flex gap-2 flex-wrap items-center mb-2">
                {effectiveGroups > 0 && Array.from({ length: effectiveGroups }, (_, i) => i + 1).map(g => {
                  const gs = getGroupSwissStatus(g);
                  return (
                    <Button
                      key={g}
                      variant={activeGroupTab === g ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveGroupTab(g)}
                      className="gap-1"
                    >
                      Gruppo {String.fromCharCode(64 + g)}
                      {gs.allSwiss && <CheckCircle2 size={12} className={activeGroupTab === g ? "text-primary-foreground" : "text-primary"} />}
                    </Button>
                  );
                })}
                {effectiveGroups === 0 && (
                  <Button
                    variant={activeGroupTab === 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveGroupTab(0)}
                    className="gap-1"
                  >
                    Principale
                    {getGroupSwissStatus(0).allSwiss && <CheckCircle2 size={12} className={activeGroupTab === 0 ? "text-primary-foreground" : "text-primary"} />}
                  </Button>
                )}
                {hasU12Group && (
                  <Button
                    variant={activeGroupTab === 99 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveGroupTab(99)}
                    className="gap-1"
                  >
                     Gruppo Kids
                    {getGroupSwissStatus(99).allSwiss && <CheckCircle2 size={12} className={activeGroupTab === 99 ? "text-primary-foreground" : "text-primary"} />}
                  </Button>
                )}
              </div>
              {(() => {
                const currentTab = activeGroupTab;
                const gs = currentTab === 0 ? getGroupSwissStatus(0) : getGroupSwissStatus(currentTab);
                const tabLabel = currentTab === 99 ? "Gruppo Kids" : currentTab === 0 ? "Principale" : `Gruppo ${String.fromCharCode(64 + currentTab)}`;
                return (
                  <div className="flex flex-wrap gap-3 items-center">
                    {gs.maxRound === 0 && (
                      <Button variant="hero" onClick={() => advanceToNextSwissRound(currentTab)}>
                        <Play size={16} className="mr-2" /> Genera Turno 1 {tabLabel}
                      </Button>
                    )}
                    {gs.allDone && !gs.allSwiss && format !== "round_robin" && format !== "round_robin_top_cut" && (
                      <Button variant="hero" onClick={() => advanceToNextSwissRound(currentTab)}>
                        <SkipForward size={16} className="mr-2" /> Genera Turno {tabLabel}
                      </Button>
                    )}
                    {!gs.allDone && gs.maxRound > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertTriangle size={14} className="text-primary" />
                        Completa tutti i match del Turno {gs.maxRound} {tabLabel && `(${tabLabel})`}.
                      </div>
                    )}
                    {!gs.allDone && gs.maxRound > 0 && isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => autoCompleteGroupRound(currentTab)}>
                        <Zap size={14} className="mr-1" /> ⚡ Auto {tabLabel}
                      </Button>
                    )}
                    {gs.allSwiss && (
                      <span className="text-xs text-primary font-medium flex items-center gap-1">
                        <CheckCircle2 size={12} /> {tabLabel || "Swiss"} completato
                      </span>
                    )}
                    {gs.allSwiss && isAdmin && format !== "round_robin" && format !== "round_robin_top_cut" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => advanceToNextSwissRound(currentTab, true)}
                        title="Forza un turno Swiss extra oltre il numero configurato"
                      >
                        <SkipForward size={14} className="mr-1" /> Forza turno extra {tabLabel && `(${tabLabel})`}
                      </Button>
                    )}
                    {/* Undo round button for group */}
                    {gs.maxRound > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                            <Undo2 size={14} className="mr-1" /> Annulla Turno {gs.maxRound} {tabLabel && `(${tabLabel})`}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Annulla Turno {gs.maxRound} {tabLabel && `(${tabLabel})`}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tutti i match del Turno {gs.maxRound} {tabLabel ? `del ${tabLabel}` : ""} verranno eliminati e le classifiche ricalcolate. Vuoi continuare?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => undoLastSwissRound(currentTab)}>Conferma</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                       </AlertDialog>
                    )}
                    {hasSnapshot && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10" disabled={restoringSnapshot}>
                            <RotateCcw size={14} className="mr-1" /> Ripristina ultimo turno
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Ripristina ultimo turno annullato</AlertDialogTitle>
                            <AlertDialogDescription>
                              Verrà ripristinato l'ultimo snapshot disponibile, recuperando matchup e punteggi precedenti. Eventuali match attualmente presenti nello stesso turno verranno sovrascritti.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={restoreLastSnapshot}>Ripristina</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })()}
              {/* Global advance */}
              {allSwissDone && !hasAnyTopCutBracket && (format === "swiss_top_cut" || format === "round_robin_top_cut") && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="hero" onClick={() => advanceToTopCut(hasU12Group && under12SeparateTopcutProp ? "main" : "both")} disabled={advancingToTopCut}>
                    <Trophy size={16} className="mr-2" /> Avanza al Top {editTopCutSize}{hasU12Group && under12SeparateTopcutProp ? " (Principale)" : ""}
                  </Button>
                  {hasU12Group && under12SeparateTopcutProp && (
                    <Button variant="hero" onClick={() => advanceToTopCut("u12")} disabled={advancingToTopCut}>
                      <Trophy size={16} className="mr-2" /> Avvia Top Cut Kids
                    </Button>
                  )}
                  {isAdmin && format === "swiss_top_cut" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => advanceToNextSwissRound(activeGroupTab, true)}
                      title="Forza un turno Swiss extra invece di passare alla Top Cut"
                    >
                      <SkipForward size={14} className="mr-1" /> Forza turno extra
                    </Button>
                  )}
                </div>
              )}
              {allSwissDone && (format === "swiss" || format === "round_robin") && (
                <Button variant="hero" onClick={completeTournament}>
                  <Trophy size={16} className="mr-2" /> Concludi Torneo
                </Button>
              )}
            </>
          ) : (
            <div className="flex flex-wrap gap-3 items-center">
              {maxSwissRound === 0 && (
                <Button variant="hero" onClick={() => advanceToNextSwissRound()}>
                  <Play size={16} className="mr-2" /> Genera Round 1
                </Button>
              )}
              {allCurrentRoundDone && !allSwissDone && format !== "round_robin" && format !== "round_robin_top_cut" && (
                <Button variant="hero" onClick={() => advanceToNextSwissRound()}>
                  <SkipForward size={16} className="mr-2" /> Genera Round {currentRound}
                </Button>
              )}
              {allSwissDone && !hasAnyTopCutBracket && (format === "swiss_top_cut" || format === "round_robin_top_cut") && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="hero" onClick={() => advanceToTopCut(hasU12Group && under12SeparateTopcutProp ? "main" : "both")} disabled={advancingToTopCut}>
                    <Trophy size={16} className="mr-2" /> Avanza al Top {editTopCutSize}{hasU12Group && under12SeparateTopcutProp ? " (Principale)" : ""}
                  </Button>
                  {hasU12Group && under12SeparateTopcutProp && (
                    <Button variant="hero" onClick={() => advanceToTopCut("u12")} disabled={advancingToTopCut}>
                      <Trophy size={16} className="mr-2" /> Avvia Top Cut Kids
                    </Button>
                  )}
                  {isAdmin && format === "swiss_top_cut" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => advanceToNextSwissRound(undefined, true)}
                      title="Forza un turno Swiss extra invece di passare alla Top Cut"
                    >
                      <SkipForward size={14} className="mr-1" /> Forza turno extra
                    </Button>
                  )}
                </div>
              )}
              {allSwissDone && (format === "swiss" || format === "round_robin") && (
                <Button variant="hero" onClick={completeTournament}>
                  <Trophy size={16} className="mr-2" /> Concludi Torneo
                </Button>
              )}
              {!allCurrentRoundDone && maxSwissRound > 0 && (
                <>
                  <Button variant="outline" onClick={autoCompleteRound}>
                    <Zap size={16} className="mr-2" /> Auto-completa Round
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle size={14} className="text-primary" />
                    Completa tutti i match del Round {maxSwissRound} per procedere.
                  </div>
                  {isAdmin && !allCurrentRoundDone && maxSwissRound > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
                          <SkipForward size={14} className="mr-1" /> Forza Avanzamento
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Forza avanzamento Round {maxSwissRound}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tutti i match pendenti verranno chiusi come pareggio (0-0) o vittoria BYE. Vuoi continuare?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={forceAdvanceRound}>Conferma</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </>
              )}
              {/* Undo round */}
              {maxSwissRound > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Undo2 size={14} className="mr-1" /> Annulla Turno {maxSwissRound}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Annulla Turno {maxSwissRound}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tutti i match del Turno {maxSwissRound} verranno eliminati e le classifiche ricalcolate. Vuoi continuare?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={() => undoLastSwissRound()}>Conferma</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {hasSnapshot && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10" disabled={restoringSnapshot}>
                        <RotateCcw size={14} className="mr-1" /> Ripristina ultimo turno
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Ripristina ultimo turno annullato</AlertDialogTitle>
                        <AlertDialogDescription>
                          Verrà ripristinato l'ultimo snapshot disponibile, recuperando matchup e punteggi precedenti. Eventuali match attualmente presenti nello stesso turno verranno sovrascritti.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={restoreLastSnapshot}>Ripristina</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
        </div>
      )}

      {/* Pre-Top Cut controls - bracket mode */}
      {showBracket_ && (status === "pre_top_cut" || (status === "swiss" && preTopCutMatches.length > 0)) && (
        <div className="flex flex-wrap gap-3 items-center">
          {!preTopCutDone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle size={14} className="text-primary" />
              Completa i match di spareggio per definire i qualificati alla Top {editTopCutSize}.
            </div>
          )}
          {preTopCutDone && (
            <Button variant="hero" size="lg" onClick={startTopCutFromPreTopCut}>
              <Play size={16} className="mr-2" /> AVVIA TOP {editTopCutSize}
            </Button>
          )}
          {/* Undo Top Cut from pre_top_cut */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                <Undo2 size={14} className="mr-1" /> Annulla Top Cut
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Annulla Top Cut</AlertDialogTitle>
                <AlertDialogDescription>
                  Tutti i match della fase Top Cut (inclusi spareggi) verranno eliminati. Il torneo tornerà alla fase Swiss. Vuoi continuare?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  const cleared = await clearTopCutPhaseMatches();
                  if (!cleared) return;
                  await supabase.from("tournaments").update({ status: "swiss" }).eq("id", tournamentId);
                  toast.success("Top Cut annullata! Puoi modificare le impostazioni e rigenerare la Top Cut.");
                  onStatusChange();
                  fetchData();
                }}>Conferma</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Top cut controls - bracket mode */}
      {showBracket_ && (status === "top_cut" || (status === "swiss" && hasAnyTopCutBracket && !preTopCutMatches.length)) && (
        <div className="flex flex-wrap gap-3">
          {!topCutFinalDone && (
            <Button variant="outline" onClick={autoCompleteRound}>
              <Zap size={16} className="mr-2" /> Auto-completa Round Top Cut
            </Button>
          )}
          {isAdmin && (() => {
            const missingOpts = computeMissingPlayoffOptions();
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" title="Genera i match di spareggio mancanti">
                    <Shuffle size={16} className="mr-2" /> Genera spareggi
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 bg-popover z-50">
                  <DropdownMenuLabel>Spareggi mancanti</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {missingOpts.length === 0 ? (
                    <DropdownMenuItem disabled>Nessuno spareggio mancante</DropdownMenuItem>
                  ) : (
                    <>
                      {missingOpts.map((opt, idx) => (
                        <DropdownMenuItem key={idx} onClick={() => regenerateMissingPlayoffMatches(opt.target)}>
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => regenerateMissingPlayoffMatches({ kind: "all" })}>
                        Genera tutti
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
          {hasU12Group && under12SeparateTopcutProp && u12TopCutMatches.length === 0 && (
            <Button variant="hero" onClick={() => advanceToTopCut("u12")} disabled={advancingToTopCut}>
              <Trophy size={16} className="mr-2" /> Avvia Top Cut Kids
            </Button>
          )}
          {topCutFinalDone && u12TopCutFinalDone && allTiebreakersDone && (
            <Button variant="hero" onClick={completeTournament}>
              <Trophy size={16} className="mr-2" /> Concludi Torneo
            </Button>
          )}
          {topCutFinalDone && !u12TopCutFinalDone && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle size={14} className="text-primary" />
              Completa la Top Cut Under 12 prima di concludere il torneo.
            </p>
          )}
          {topCutFinalDone && u12TopCutFinalDone && !allTiebreakersDone && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle size={14} className="text-primary" />
              Completa tutti gli spareggi prima di concludere il torneo.
            </p>
          )}
          {/* Undo Top Cut - Main */}
          {topCutMatches.length > 0 && (() => {
            const roundsInfo = getTopCutRoundsInfo("top_cut");
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Undo2 size={14} className="mr-1" /> Annulla Top Cut Principale
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 bg-popover z-50">
                  <DropdownMenuLabel>Annulla un round della Top Cut</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {roundsInfo.map((info) => (
                    <AlertDialog key={`main-${info.round}`}>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          Annulla {info.label}
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Annulla {info.label}</AlertDialogTitle>
                          <AlertDialogDescription>
                            I match di questo round verranno azzerati e tutti i round successivi (e gli spareggi tiebreaker) verranno eliminati. Vuoi continuare?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => {
                            const ok = await clearTopCutFromRound("top_cut", info.round);
                            if (!ok) return;
                            toast.success(`${info.label} annullata!`);
                            appendLog(`Annullata ${info.label} (Top Cut principale)`);
                            onStatusChange();
                            fetchData();
                          }}>Conferma</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ))}
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                        Annulla intera Top Cut Principale
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Annulla Top Cut Principale</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tutti i match della Top Cut principale (inclusi spareggi e pre-top-cut) verranno eliminati. La Top Cut Kids resterà invariata. Vuoi continuare?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          const cleared = await clearTopCutPhaseMatches("main");
                          if (!cleared) return;
                          // If no U12 top cut either, return to swiss; otherwise stay in top_cut
                          const stillHasU12 = matches.some(m => m.phase === "u12_top_cut");
                          if (!stillHasU12) {
                            await supabase.from("tournaments").update({ status: "swiss" }).eq("id", tournamentId);
                          }
                          toast.success("Top Cut Principale annullata!");
                          appendLog("Annullata Top Cut Principale (admin)");
                          onStatusChange();
                          fetchData();
                        }}>Conferma</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}

          {/* Undo Top Cut - Kids */}
          {u12TopCutMatches.length > 0 && (() => {
            const roundsInfo = getTopCutRoundsInfo("u12_top_cut");
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Undo2 size={14} className="mr-1" /> Annulla Top Cut Kids
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 bg-popover z-50">
                  <DropdownMenuLabel>Annulla un round della Top Cut Kids</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {roundsInfo.map((info) => (
                    <AlertDialog key={`u12-${info.round}`}>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          Annulla {info.label}
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Annulla {info.label} Kids</AlertDialogTitle>
                          <AlertDialogDescription>
                            I match di questo round (Kids) verranno azzerati e tutti i round successivi verranno eliminati. Vuoi continuare?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => {
                            const ok = await clearTopCutFromRound("u12_top_cut", info.round);
                            if (!ok) return;
                            toast.success(`${info.label} Kids annullata!`);
                            appendLog(`Annullata ${info.label} (Top Cut Kids)`);
                            onStatusChange();
                            fetchData();
                          }}>Conferma</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ))}
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                        Annulla intera Top Cut Kids
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Annulla Top Cut Kids</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tutti i match della Top Cut Kids verranno eliminati. La Top Cut Principale resterà invariata. Vuoi continuare?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          const cleared = await clearTopCutPhaseMatches("u12");
                          if (!cleared) return;
                          toast.success("Top Cut Kids annullata!");
                          appendLog("Annullata Top Cut Kids (admin)");
                          onStatusChange();
                          fetchData();
                        }}>Conferma</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
        </div>
      )}

      {/* Content tabs - bracket mode */}
      {showBracket_ && (swissMatches.length > 0 || topCutMatches.length > 0 || preTopCutMatches.length > 0 || u12TopCutMatches.length > 0) && (() => {
        const defaultTab = isTopCutLikePhase
          ? (hasMainTopCutBracket
              ? "bracket"
              : (u12TopCutMatches.length > 0 ? "u12_bracket" : "rounds"))
          : (swissMatches.length > 0
              ? "rounds"
              : hasMainTopCutBracket
                ? "bracket"
                : (u12TopCutMatches.length > 0 ? "u12_bracket" : "rounds"));
        return (
        <Tabs defaultValue={defaultTab} key={defaultTab}>
          <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
            <TabsList className="bg-card border border-border w-full flex">
              {swissMatches.length > 0 && <TabsTrigger value="rounds" className="flex-1 text-xs sm:text-sm">{(format === "round_robin" || format === "round_robin_top_cut") ? "Turni RR" : "Turni Swiss"}</TabsTrigger>}
              
              {(topCutMatches.length > 0 || preTopCutMatches.length > 0) && <TabsTrigger value="bracket" className="flex-1 text-xs sm:text-sm">Top Cut</TabsTrigger>}
              {topCutMatches.length > 0 && tiebreakerDepth > 0 && (
                <TabsTrigger value="placement" className="flex-1 text-xs sm:text-sm gap-1">
                  <ListOrdered size={13} className="shrink-0" /> Spareggi
                </TabsTrigger>
              )}
              {u12TopCutMatches.length > 0 && <TabsTrigger value="u12_bracket" className="flex-1 text-xs sm:text-sm">Top Cut Kids</TabsTrigger>}
            </TabsList>
          </div>

          {swissMatches.length > 0 && (
            <TabsContent value="rounds" className="mt-4 space-y-3">
              {/* Group selector also in top_cut/completed phases */}
              {status !== "swiss" && (effectiveGroups > 0 || hasU12Group) && (
                <div className="flex gap-2 flex-wrap items-center">
                  {effectiveGroups > 0 && Array.from({ length: effectiveGroups }, (_, i) => i + 1).map(g => (
                    <Button
                      key={g}
                      variant={activeGroupTab === g ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveGroupTab(g)}
                    >
                      Gruppo {String.fromCharCode(64 + g)}
                    </Button>
                  ))}
                  {effectiveGroups === 0 && (
                    <Button
                      variant={activeGroupTab === 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveGroupTab(0)}
                    >
                      Principale
                    </Button>
                  )}
                  {hasU12Group && (
                    <Button
                      variant={activeGroupTab === 99 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveGroupTab(99)}
                    >
                      Gruppo Kids
                    </Button>
                  )}
                </div>
              )}
              {(effectiveGroups > 0 || hasU12Group) ? (
                <SwissRoundView
                    matches={swissMatches.filter(m =>
                      activeGroupTab === 0
                        ? m.group_number !== 99
                        : m.group_number === activeGroupTab
                    )}
                    playerMap={playerMap}
                    avatarMap={avatarMap}
                    onResult={handleMatchResult}
                    isStaff={true}
                    onUndoMatch={undoMatch}
                    onNotifyPlayers={notifyPlayers}
                    tableAssignment={{ enabled: editTableAssignment, matchesPerTable: editMatchesPerTable, groupsCount: editGroupsCount }}
                    onAutoCompleteRound={isAdmin ? autoCompleteSpecificRound : undefined}
                    scoredByMap={scoredByMap}
                    tournamentId={tournamentId}
                    winThreshold={swissWin}
                  />
              ) : (
                <SwissRoundView
                  matches={swissMatches}
                  playerMap={playerMap}
                  avatarMap={avatarMap}
                  onResult={handleMatchResult}
                  isStaff={true}
                  onUndoMatch={undoMatch}
                  onNotifyPlayers={notifyPlayers}
                  tableAssignment={{ enabled: editTableAssignment, matchesPerTable: editMatchesPerTable, groupsCount: editGroupsCount }}
                  onAutoCompleteRound={isAdmin ? autoCompleteSpecificRound : undefined}
                  scoredByMap={scoredByMap}
                  tournamentId={tournamentId}
                  winThreshold={swissWin}
                />
              )}
            </TabsContent>
          )}


          {(topCutMatches.length > 0 || preTopCutMatches.length > 0) && (
            <TabsContent value="bracket" className="mt-4 space-y-6">
              {/* Spareggi di qualificazione (Pre-Top Cut) shown above the bracket */}
              {preTopCutMatches.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="text-sm font-medium text-primary uppercase tracking-[0.2em] whitespace-nowrap">
                      ⚔️ Spareggi di Qualificazione
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {preTopCutMatches.map(match => {
                      const p1Name = match.player1_id ? playerMap.get(match.player1_id) || "?" : "BYE";
                      const p2Name = match.player2_id ? playerMap.get(match.player2_id) || "?" : "BYE";
                      const isDone = match.status === "completed";
                      const winnerName = match.winner_id ? playerMap.get(match.winner_id) : null;
                      return (
                        <div
                          key={match.id}
                          className={`rounded-xl border p-3 min-w-[200px] flex-1 max-w-xs transition-colors ${
                            isDone ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                          } ${!isDone && match.player1_id && match.player2_id ? "cursor-pointer hover:border-primary/50 hover:bg-accent/50" : ""}`}
                          onClick={() => {
                            if (!isDone && match.player1_id && match.player2_id) {
                              setPreTcScoringMatch(match);
                            }
                          }}
                        >
                          <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-[0.2em]">
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
                  {preTopCutDone && status === "pre_top_cut" && (
                    <div className="flex justify-center pt-2">
                      <Button variant="hero" size="lg" onClick={startTopCutFromPreTopCut}>
                        <Play size={16} className="mr-2" /> AVVIA TOP {editTopCutSize}
                      </Button>
                    </div>
                  )}
                  <div className="h-px bg-border" />
                </div>
              )}

              {/* Main Top Cut bracket */}
              {mainTopCutMatches.length > 0 && (
                <>
                  <TopCutBracket
                    matches={mainTopCutMatches}
                    playerMap={playerMap}
                    avatarMap={avatarMap}
                    onResult={handleMatchResult}
                    isStaff={true}
                    onUndoMatch={undoMatch}
                    onNotifyPlayers={notifyPlayers}
                    tournamentId={tournamentId}
                    winThresholdEarly={topEarlyWin}
                    winThresholdLate={topLateWin}
                  />
                  {isAdmin && status !== "completed" && (() => {
                    const missingOpts = computeMissingPlayoffOptions();
                    return (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Admin:</span> seleziona quale spareggio generare (5°-8°, 3°/4°, ecc.).
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Shuffle size={14} className="mr-1.5" /> Genera spareggi
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64 bg-popover z-50">
                            <DropdownMenuLabel>Spareggi mancanti</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {missingOpts.length === 0 ? (
                              <DropdownMenuItem disabled>Nessuno spareggio mancante</DropdownMenuItem>
                            ) : (
                              <>
                                {missingOpts.map((opt, idx) => (
                                  <DropdownMenuItem key={idx} onClick={() => regenerateMissingPlayoffMatches(opt.target)}>
                                    {opt.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => regenerateMissingPlayoffMatches({ kind: "all" })}>
                                  Genera tutti
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })()}
                </>
              )}
            </TabsContent>
          )}

          {topCutMatches.length > 0 && tiebreakerDepth > 0 && (
            <TabsContent value="placement" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Struttura completa dei piazzamenti fino al {tiebreakerDepth}° posto. I match si attivano via via che il Top Cut avanza.
              </p>
              <PlacementBracket
                tiebreakerMatches={tiebreakerMatches}
                thirdPlaceMatch={thirdPlaceMatch}
                topCutSize={topCutSize || editTopCutSize}
                topCutFinalRound={topCutFinalRound}
                tiebreakerDepth={tiebreakerDepth}
                tiebreakerMode={editTiebreakerMode || tiebreakerMode}
                playerMap={playerMap}
                avatarMap={avatarMap}
                onResult={handleMatchResult}
                onUndoMatch={undoMatch}
                onNotifyPlayers={notifyPlayers}
                isStaff={true}
                winThresholdEarly={topEarlyWin}
                winThresholdLate={topLateWin}
              />
            </TabsContent>
          )}

          {u12TopCutMatches.length > 0 && (
            <TabsContent value="u12_bracket" className="mt-4">
              <TopCutBracket
                matches={u12TopCutMatches}
                playerMap={playerMap}
                avatarMap={avatarMap}
                onResult={handleMatchResult}
                isStaff={true}
                onUndoMatch={undoMatch}
                    onNotifyPlayers={notifyPlayers}
                    tournamentId={tournamentId}
                    winThresholdEarly={topEarlyWin}
                    winThresholdLate={topLateWin}
                  />
            </TabsContent>
          )}
        </Tabs>
        );
      })()}

      {/* Pre-Top Cut scoring dialog */}
      {preTcScoringMatch && (
        <MatchScoringDialog
          open={!!preTcScoringMatch}
          onOpenChange={(v) => { if (!v) setPreTcScoringMatch(null); }}
          matchId={preTcScoringMatch.id}
          matchNumber={preTcScoringMatch.match_number}
          player1Id={preTcScoringMatch.player1_id}
          player2Id={preTcScoringMatch.player2_id}
          player1Name={playerMap.get(preTcScoringMatch.player1_id || "") || "?"}
          player2Name={playerMap.get(preTcScoringMatch.player2_id || "") || "?"}
          player1Avatar={avatarMap.get(preTcScoringMatch.player1_id || "") ?? null}
          player2Avatar={avatarMap.get(preTcScoringMatch.player2_id || "") ?? null}
          onResult={(matchId, winnerId, p1Score, p2Score) => {
            setPreTcScoringMatch(null);
            handleMatchResult(matchId, winnerId, p1Score, p2Score);
          }}
          tournamentId={tournamentId}
          winThreshold={swissWin}
        />
      )}
    </div>
  );
};
