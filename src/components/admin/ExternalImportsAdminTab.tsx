import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileJson, FileSpreadsheet, Check, Clock, Link2, Loader2, Save, MapPin, X, Cloud, Wand2 } from "lucide-react";
import ExcelJS from "exceljs";

// Same point system as finalize_tournament_points
// New system: 2 pt participation + 4 pt per win
const PARTICIPATION_BONUS = 2;
const POINTS_PER_WIN = 4;

const calcScaledPoints = (_placement: number, _participants: number): { base: number; scaled: number } => {
  // For external imports without match data, use participation bonus only
  return { base: PARTICIPATION_BONUS, scaled: PARTICIPATION_BONUS };
};

export interface ParsedPlayer {
  externalName: string;
  placement: number;
  tournamentsPlayed: number; // for Challengermode: how many tournaments this player participated in
  totalPoints: number; // total BFL-adjusted points from XLSX (0 = calculate from placement)
  matchedUserId: string | null;
  matchedDisplayName: string | null;
  isChild: boolean;
}

interface ParsedImportMatch {
  externalId?: string | number | null;
  team1Name: string;
  team2Name: string;
  winnerName?: string | null;
  score1?: number | null;
  score2?: number | null;
  phase?: string;
  bracket?: string;
  round?: number;
  state?: string | null;
}

export const normalizeImportedName = (raw: string): string =>
  String(raw ?? "")
    .replace(/[（(].*$/, "")
    .replace(/\s+/g, " ")
    .trim();

export const buildGhostUsername = (rawName: string, ghostId: string): string => {
  // Sanitize: lowercase, replace non-alphanumeric with underscore, collapse repeats
  const sanitized = normalizeImportedName(rawName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  const suffix = ghostId.replace(/-/g, "").slice(0, 8);

  // Always append a unique suffix to guarantee no collision with existing usernames
  // (real users or other ghost profiles with the same normalized name).
  if (!sanitized) return `p_${suffix}`;
  const base = sanitized.slice(0, 31);
  return `${base}_${suffix}`;
};

// Extract a real event date (DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, or DD/MM with current year fallback)
// from an imported tournament title. Returns ISO string or null.
export const extractEventDateFromTitle = (title: string, fallbackYear?: number): string | null => {
  if (!title) return null;
  // Full date with year first
  let m = title.match(/(\b\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  let d: number, mo: number, y: number;
  if (m) {
    d = parseInt(m[1], 10); mo = parseInt(m[2], 10); y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
  } else {
    // DD/MM only (no year) – fall back to provided year or current year
    m = title.match(/(\b\d{1,2})[\/.\-](\d{1,2})(?!\d)/);
    if (!m) return null;
    d = parseInt(m[1], 10); mo = parseInt(m[2], 10);
    y = fallbackYear ?? new Date().getFullYear();
  }
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

// Hook to load regions
const useRegions = () => {
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase.from("regions").select("id, name").order("name").then(({ data }) => {
      setRegions(data || []);
    });
  }, []);
  return regions;
};

const RegionSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const regions = useRegions();
  return (
    <div>
      <Label className="flex items-center gap-1.5">
        <MapPin size={14} className="text-primary" />
        Regione (applicata a tutti i giocatori)
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Seleziona regione..." />
        </SelectTrigger>
        <SelectContent>
          {regions.map(r => (
            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// Levenshtein distance for fuzzy matching
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

const similarity = (a: string, b: string): number => {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
};

const FUZZY_THRESHOLD = 0.80;

// Auto-match external names against existing profiles/children
const autoMatchPlayers = async (names: { name: string; placement: number; tournamentsPlayed?: number; totalPoints?: number }[]): Promise<ParsedPlayer[]> => {
  const [{ data: profiles }, { data: children }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, username"),
    supabase.from("child_profiles").select("id, display_name"),
  ]);

  const profileByUsername = new Map<string, { user_id: string; display_name: string | null }>();
  const profileByDisplayName = new Map<string, { user_id: string; display_name: string | null }>();
  const allProfiles: { key: string; user_id: string; display_name: string | null }[] = [];

  (profiles || []).forEach(p => {
    if (p.username) {
      profileByUsername.set(p.username.toLowerCase(), p);
      allProfiles.push({ key: p.username.toLowerCase(), user_id: p.user_id, display_name: p.display_name });
    }
    if (p.display_name) {
      profileByDisplayName.set(p.display_name.toLowerCase(), p);
      if (!p.username || p.username.toLowerCase() !== p.display_name.toLowerCase()) {
        allProfiles.push({ key: p.display_name.toLowerCase(), user_id: p.user_id, display_name: p.display_name });
      }
    }
  });

  const childByName = new Map<string, { id: string; display_name: string }>();
  const allChildren: { key: string; id: string; display_name: string }[] = [];
  (children || []).forEach(c => {
    if (c.display_name) {
      childByName.set(c.display_name.toLowerCase(), c);
      allChildren.push({ key: c.display_name.toLowerCase(), id: c.id, display_name: c.display_name });
    }
  });

  // Fuzzy search: find best match above threshold
  const fuzzyFind = (lower: string): { userId: string; displayName: string; isChild: boolean } | null => {
    let bestScore = 0;
    let bestMatch: { userId: string; displayName: string; isChild: boolean } | null = null;

    for (const p of allProfiles) {
      const score = similarity(lower, p.key);
      if (score > bestScore && score >= FUZZY_THRESHOLD) {
        bestScore = score;
        bestMatch = { userId: p.user_id, displayName: p.display_name || p.user_id, isChild: false };
      }
    }
    for (const c of allChildren) {
      const score = similarity(lower, c.key);
      if (score > bestScore && score >= FUZZY_THRESHOLD) {
        bestScore = score;
        bestMatch = { userId: c.id, displayName: c.display_name, isChild: true };
      }
    }
    return bestMatch;
  };

  return names.map(({ name, placement, tournamentsPlayed, totalPoints }) => {
    const normalizedName = normalizeImportedName(name);
    const lower = normalizedName.toLowerCase();
    const tp = tournamentsPlayed || 1;
    const pts = totalPoints || 0;

    // 1. Exact match by username
    const byUsername = profileByUsername.get(lower);
    if (byUsername) {
      return { externalName: normalizedName, placement, tournamentsPlayed: tp, totalPoints: pts, matchedUserId: byUsername.user_id, matchedDisplayName: byUsername.display_name || byUsername.user_id, isChild: false };
    }
    // 2. Exact match by display name
    const byDisplay = profileByDisplayName.get(lower);
    if (byDisplay) {
      return { externalName: normalizedName, placement, tournamentsPlayed: tp, totalPoints: pts, matchedUserId: byDisplay.user_id, matchedDisplayName: byDisplay.display_name, isChild: false };
    }
    // 3. Exact match by child name
    const child = childByName.get(lower);
    if (child) {
      return { externalName: normalizedName, placement, tournamentsPlayed: tp, totalPoints: pts, matchedUserId: child.id, matchedDisplayName: child.display_name, isChild: true };
    }
    // 4. Fuzzy match (≥80% similarity)
    const fuzzy = fuzzyFind(lower);
    if (fuzzy) {
      return { externalName: normalizedName, placement, tournamentsPlayed: tp, totalPoints: pts, matchedUserId: fuzzy.userId, matchedDisplayName: `~${fuzzy.displayName}`, isChild: fuzzy.isChild };
    }
    return { externalName: normalizedName, placement, tournamentsPlayed: tp, totalPoints: pts, matchedUserId: null, matchedDisplayName: null, isChild: false };
  });
};

// Shared import logic
const formatDbError = (error: any) => {
  if (!error) return "Errore sconosciuto";
  return [error.message, error.details, error.hint].filter(Boolean).join(" · ");
};

const assertNoDbError = (error: any, context: string) => {
  if (error) throw new Error(`${context}: ${formatDbError(error)}`);
};

const getActiveSeasonBfl = async () => {
  const { data, error } = await supabase
    .from("ranking_seasons")
    .select("bfl")
    .eq("is_active", true)
    .maybeSingle();

  assertNoDbError(error, "Impossibile leggere la stagione attiva");
  return data?.bfl ?? 10;
};

// New: save imported data to staging table for later editing/review
const saveToStaging = async ({
  players,
  participantCount,
  tournamentName,
  platform,
  regionId,
  clubId,
  rawData,
  matches,
}: {
  players: ParsedPlayer[];
  participantCount: number;
  tournamentName: string;
  platform: string;
  regionId: string;
  clubId?: string;
  rawData?: any;
  matches?: ParsedImportMatch[];
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  // Build participants array with placement + matched info
  const participants = players.map((p) => ({
    externalName: p.externalName,
    placement: p.placement,
    tournamentsPlayed: p.tournamentsPlayed,
    totalPoints: p.totalPoints,
    matchedUserId: p.matchedUserId,
    matchedDisplayName: p.matchedDisplayName,
    isChild: p.isChild,
  }));

  // Build a synthetic standings array (sorted by placement) — editor can refine
  const standings = [...players]
    .sort((a, b) => a.placement - b.placement)
    .map((p, idx) => ({
      position: idx + 1,
      placement: p.placement,
      externalName: p.externalName,
      matchedUserId: p.matchedUserId,
      matchedDisplayName: p.matchedDisplayName,
      isChild: p.isChild,
      totalPoints: p.totalPoints,
    }));

  const { error } = await supabase.from("imported_tournaments_staging" as any).insert({
    imported_by: user.id,
    source_platform: platform,
    raw_data: rawData ?? {},
    title: tournamentName || `Torneo ${platform}`,
    location: platform === "challonge" ? "Challonge" : "Challengermode",
    city: "Esterno",
    event_date: extractEventDateFromTitle(tournamentName) ?? new Date().toISOString(),
    registration_deadline: new Date().toISOString(),
    region_id: regionId || null,
    club_id: clubId || null,
    is_ranked: true,
    participants: participants as any,
    matches: (matches ?? []) as any,
    standings: standings as any,
    status: "draft",
  });

  if (error) throw new Error(error.message);
  return { participants: participants.length };
};

// Legacy: keep importResults for direct send (used by staging area on confirm)
export const importResults = async ({
  players,
  participantCount,
  tournamentName,
  platform,
  regionId,
}: {
  players: ParsedPlayer[];
  participantCount: number;
  tournamentName: string;
  platform: string;
  regionId: string;
}) => {
  const maxTourneys = Math.max(...players.map((p) => p.tournamentsPlayed), 1);
  const isCM = platform === "challengermode" && maxTourneys > 1;
  const tourneysToCreate = isCM ? maxTourneys : 1;
  const bfl = await getActiveSeasonBfl();

  // Prevent duplicate imports: replace existing batch with same tournament prefix (case-insensitive)
  if (platform === "challengermode") {
    const { data: existingTournaments, error: existingErr } = await supabase
      .from("tournaments")
      .select("id")
      .eq("is_external", true)
      .eq("external_source", "challengermode")
      .ilike("title", `${tournamentName}%`);
    assertNoDbError(existingErr, "Errore ricerca importazioni precedenti");

    const existingIds = (existingTournaments || []).map((t: any) => t.id);
    if (existingIds.length > 0) {
      const { error: delResultsErr } = await supabase.from("tournament_results").delete().in("tournament_id", existingIds);
      assertNoDbError(delResultsErr, "Errore pulizia risultati import precedenti");

      const { error: delPendingErr } = await supabase.from("pending_tournament_results" as any).delete().in("tournament_id", existingIds);
      assertNoDbError(delPendingErr, "Errore pulizia pending import precedenti");

      const { error: delTournamentsErr } = await supabase.from("tournaments").delete().in("id", existingIds);
      assertNoDbError(delTournamentsErr, "Errore pulizia tornei import precedenti");
    }
  }

  const createdTournaments = await Promise.all(
    Array.from({ length: tourneysToCreate }, async (_, t) => {
      const title = isCM ? `${tournamentName} - Round ${t + 1}` : tournamentName;
      const { data, error } = await supabase
        .from("tournaments")
        .insert({
          title,
          city: "Esterno",
          location: platform === "challonge" ? "Challonge" : "Challengermode",
          event_date: extractEventDateFromTitle(title) ?? new Date().toISOString(),
          registration_deadline: new Date().toISOString(),
          status: "completed",
          is_active: false,
          is_ranked: true,
          is_external: true,
          external_source: platform,
          region_id: regionId || null,
        } as any)
        .select("id")
        .single();

      assertNoDbError(error, `Errore creazione torneo ${title}`);
      return data?.id;
    })
  );

  const tournamentIds = createdTournaments.filter((id): id is string => Boolean(id));
  const matched = players.filter((p) => p.matchedUserId);
  const pending = players.filter((p) => !p.matchedUserId);

  const buildRowsForPlayer = (player: ParsedPlayer, userId: string) => {
    const numT = Math.min(player.tournamentsPlayed, tournamentIds.length);

    if (platform === "challengermode") {
      const effectiveSlots = Math.min(numT, bfl);
      if (effectiveSlots <= 0) return [];

      // For Challengermode, totalPoints from file is authoritative (no placement fallback)
      const total = Math.max(0, Math.round(player.totalPoints || 0));
      const basePerSlot = Math.floor(total / effectiveSlots);
      const remainder = total - basePerSlot * effectiveSlots;

      return Array.from({ length: effectiveSlots }, (_, t) => {
        const perTournament = basePerSlot + (t < remainder ? 1 : 0);
        return {
          tournament_id: tournamentIds[t],
          user_id: userId,
          placement: player.placement,
          participants_count: participantCount,
          base_points: perTournament,
          scaled_points: perTournament,
        };
      });
    }

    // Challonge fallback: calculate from placement
    const { base, scaled } = calcScaledPoints(player.placement, participantCount);
    return Array.from({ length: numT }, (_, t) => ({
      tournament_id: tournamentIds[t],
      user_id: userId,
      placement: player.placement,
      participants_count: participantCount,
      base_points: base,
      scaled_points: scaled,
    }));
  };

  const matchedRows = matched.flatMap((player) => buildRowsForPlayer(player, player.matchedUserId!));

  if (matchedRows.length > 0) {
    const { error } = await supabase.from("tournament_results").insert(matchedRows as any);
    assertNoDbError(error, "Errore salvataggio risultati importati");
  }

  // For unmatched players: create ghost profiles + insert tournament_results directly
  if (pending.length > 0) {
    const ghostProfiles = pending.map((player) => {
      const ghostId = crypto.randomUUID();
      return { ghostId, player };
    });

    // Create ghost profiles via RPC (bypasses trigger to avoid timeout)
    const profileInserts = ghostProfiles.map(({ ghostId, player }) => {
      const normalizedDisplayName = normalizeImportedName(player.externalName).slice(0, 60);
      return {
        user_id: ghostId,
        username: buildGhostUsername(player.externalName, ghostId),
        display_name: normalizedDisplayName || buildGhostUsername(player.externalName, ghostId),
        region_id: regionId || null,
      };
    });

    const { error: profileError } = await supabase.rpc("bulk_create_ghost_profiles" as any, {
      _profiles: profileInserts,
    });
    assertNoDbError(profileError, "Errore creazione profili segnaposto");

    const ghostResultRows = ghostProfiles.flatMap(({ ghostId, player }) => buildRowsForPlayer(player, ghostId));

    if (ghostResultRows.length > 0) {
      const { error } = await supabase.from("tournament_results").insert(ghostResultRows as any);
      assertNoDbError(error, "Errore salvataggio risultati profili segnaposto");
    }
  }

  if (regionId) {
    const profileIds = matched.filter((p) => !p.isChild).map((p) => p.matchedUserId!);
    const childIds = matched.filter((p) => p.isChild).map((p) => p.matchedUserId!);

    if (profileIds.length > 0) {
      const { error } = await supabase.from("profiles").update({ region_id: regionId }).in("user_id", profileIds);
      assertNoDbError(error, "Errore aggiornamento regione profili");
    }

    if (childIds.length > 0) {
      const { error } = await supabase.from("child_profiles").update({ region_id: regionId }).in("id", childIds);
      assertNoDbError(error, "Errore aggiornamento regione profili kids");
    }
  }

  // Always recalculate rankings (ghost profiles included)
  const { error: recalcError } = await supabase.rpc("recalculate_all_rankings" as any, { _bfl: bfl });
  assertNoDbError(recalcError, "Errore ricalcolo classifica");

  return { matched: matched.length, pending: pending.length, tournaments: tourneysToCreate };
};

const ExternalImportsAdminTab = () => {
  return (
    <Tabs defaultValue="challonge" className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TabsList>
          <TabsTrigger value="challonge" className="gap-1.5">
            <FileJson size={14} /> Challonge
          </TabsTrigger>
          <TabsTrigger value="challengermode" className="gap-1.5">
            <FileSpreadsheet size={14} /> Challengermode
          </TabsTrigger>
        </TabsList>
        <AutoSyncExactMatchButton />
      </div>

      <TabsContent value="challonge"><ChallongeImport /></TabsContent>
      <TabsContent value="challengermode"><ChallengerModeImport /></TabsContent>
    </Tabs>
  );
};

const AutoSyncExactMatchButton = () => {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      // Dry run with 100% threshold to preview
      const { data: preview, error: pErr } = await supabase.functions.invoke("reconcile-ghost-profiles", {
        body: { dryRun: true, minScore: 1.0 },
      });
      if (pErr) throw pErr;
      const count = preview?.matchesFound ?? 0;
      if (count === 0) {
        toast({ title: "Nessuna corrispondenza esatta", description: "Non ci sono profili ghost con nome identico a utenti reali." });
        return;
      }
      const ok = window.confirm(`Trovate ${count} corrispondenze al 100%. Procedere con la sincronizzazione automatica?`);
      if (!ok) return;
      const { data, error } = await supabase.functions.invoke("reconcile-ghost-profiles", {
        body: { dryRun: false, minScore: 1.0 },
      });
      if (error) throw error;
      toast({
        title: "Sincronizzazione completata",
        description: `${data?.transferred ?? 0} profili uniti${data?.errors?.length ? ` · ${data.errors.length} errori` : ""}.`,
      });
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message || "Sincronizzazione fallita", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={run} disabled={loading} variant="secondary" size="sm" className="gap-1.5">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
      Auto-sync match 100%
    </Button>
  );
};

// ═══════════════════════════════════════════
// CHALLONGE IMPORT
// ═══════════════════════════════════════════
const ChallongeImport = () => {
  const [jsonText, setJsonText] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [clubId, setClubId] = useState<string>("");
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [players, setPlayers] = useState<ParsedPlayer[]>([]);
  const [matches, setMatches] = useState<ParsedImportMatch[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [isParsed, setIsParsed] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase.from("clubs").select("id, name").eq("is_active", true).order("name").then(({ data }) => {
      setClubs(data || []);
    });
  }, []);

  const parseChallongeJson = useCallback(async () => {
    try {
      const raw = JSON.parse(jsonText);
      let name = tournamentName || "Torneo Challonge";

      // Find participants array anywhere in the structure
      const tournamentNode = raw.tournament || raw;
      if (tournamentNode?.name) name = tournamentNode.name;

      // Possible locations for participants
      let pList: any[] = [];
      const candidates = [
        tournamentNode?.participants,
        tournamentNode?.players,
        raw?.participants,
        Array.isArray(raw) ? raw : null,
      ].filter(Boolean);
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) { pList = c; break; }
      }

      const rawMatches: any[] = [];
      const seenMatchIds = new Set<string>();
      const collectMatches = (node: any, depth = 0) => {
        if (!node || depth > 8) return;
        if (Array.isArray(node)) {
          node.forEach(item => collectMatches(item, depth + 1));
          return;
        }
        if (typeof node !== "object") return;
        const match = node.match || node;
        if (match && typeof match === "object" && match.player1 && match.player2) {
          const id = String(match.id ?? `${match.player1?.id ?? match.player1?.display_name}-${match.player2?.id ?? match.player2?.display_name}-${match.identifier ?? match.raw_identifier ?? rawMatches.length}`);
          if (!seenMatchIds.has(id)) {
            seenMatchIds.add(id);
            rawMatches.push(match);
          }
        }
        Object.values(node).forEach(value => collectMatches(value, depth + 1));
      };

      collectMatches(raw);

      // Fallback: Challonge public JSON often exposes players only inside match objects
      // (root.matches, consolation_matches, third_place_match, etc.), not in tournament.participants.
      if (pList.length === 0) {
        const playersById = new Map<string, any>();
        const addMatchPlayer = (player: any) => {
          if (!player || typeof player !== "object") return;
          const playerName = player.name || player.display_name || player.username || player.challonge_username;
          const playerId = String(player.id ?? player.participant_id ?? playerName ?? "");
          if (!playerName || !playerId) return;
          playersById.set(playerId, {
            id: playerId,
            name: playerName,
            seed: player.seed,
            final_rank: player.final_rank ?? player.final_position ?? player.rank ?? player.seed ?? 999,
          });
        };

        const scanForMatches = (node: any, depth = 0) => {
          if (!node || depth > 8) return;
          if (Array.isArray(node)) {
            node.forEach(item => scanForMatches(item, depth + 1));
            return;
          }
          if (typeof node !== "object") return;
          const match = node.match || node;
          addMatchPlayer(match.player1);
          addMatchPlayer(match.player2);
          Object.values(node).forEach(value => scanForMatches(value, depth + 1));
        };

        scanForMatches(raw);
        pList = Array.from(playersById.values());
      }

      if (pList.length === 0) {
        const keys = Object.keys(tournamentNode || {}).slice(0, 20).join(", ");
        toast({
          title: "Nessun partecipante trovato nel JSON",
          description: `Chiavi rilevate: ${keys || "(vuote)"}. Incolla il JSON pubblico Challonge completo o esportalo con show_participants=1&show_matches=1.`,
          variant: "destructive",
        });
        console.log("[Challonge import] raw JSON shape:", raw);
        return;
      }

      const participants = pList.map((p: any) => {
        const inner = p.participant || p;
        const nm = inner.name || inner.display_name || inner.username || inner.challonge_username || `Player${inner.id ?? ""}`;
        const rank = inner.final_rank ?? inner.rank ?? inner.final_position ?? inner.seed ?? 999;
        return { id: inner.id ?? inner.participant_id ?? null, name: String(nm).trim(), final_rank: Number(rank) || 999 };
      }).filter(p => p.name);

      const nameById = new Map<string, string>();
      participants.forEach((p: any) => {
        if (p.name) nameById.set(String(p.id ?? p.participant_id ?? p.name), p.name);
      });

      const playerName = (player: any) => String(player?.name || player?.display_name || player?.username || player?.challonge_username || nameById.get(String(player?.id ?? player?.participant_id ?? "")) || "").trim();
      const tType = String(tournamentNode?.tournament_type || tournamentNode?.type || "").toLowerCase();
      let isSwissTournament = tType.includes("swiss");
      let isElimTournament = tType.includes("elimination");
      // Heuristic: Challonge sometimes reports "single elimination" for Swiss-shaped
      // tournaments. In single-elim each round halves; in Swiss each round has
      // roughly the same number of matches as round 1.
      if (!isSwissTournament) {
        const roundCounts = new Map<number, number>();
        for (const m of rawMatches) {
          const r = Number(m.round ?? 0);
          if (r > 0) roundCounts.set(r, (roundCounts.get(r) || 0) + 1);
        }
        const sortedRounds = Array.from(roundCounts.keys()).sort((a, b) => a - b);
        if (sortedRounds.length >= 2) {
          const first = roundCounts.get(sortedRounds[0]) || 0;
          const second = roundCounts.get(sortedRounds[1]) || 0;
          if (first > 0 && second / first > 0.65) {
            isSwissTournament = true;
            isElimTournament = false;
          }
        }
      }
      const parsedMatches: ParsedImportMatch[] = rawMatches.map((m: any) => {
        const p1 = playerName(m.player1);
        const p2 = playerName(m.player2);
        const games = Array.isArray(m.games) ? m.games : [];
        const score1 = games.reduce((sum: number, g: any) => sum + (Number(Array.isArray(g) ? g[0] : g?.[0]) || 0), 0);
        const score2 = games.reduce((sum: number, g: any) => sum + (Number(Array.isArray(g) ? g[1] : g?.[1]) || 0), 0);
        const winnerName = String(m.winner_id ?? "") === String(m.player1?.id ?? m.player1?.participant_id ?? "") ? p1
          : String(m.winner_id ?? "") === String(m.player2?.id ?? m.player2?.participant_id ?? "") ? p2
          : null;
        const bracketText = String(m.raw_identifier || m.identifier || m.round || "");
        const roundNum = Number(m.round ?? 0);
        const isLoserBracket = roundNum < 0;
        let phase: string;
        let bracket: string;
        if (isSwissTournament) {
          phase = isLoserBracket ? "tiebreaker" : "swiss";
          bracket = isLoserBracket ? `Challonge Tiebreaker ${bracketText}` : `Swiss Round ${Math.abs(roundNum) || 1}`;
        } else if (isElimTournament) {
          phase = isLoserBracket ? "tiebreaker" : "top_cut";
          bracket = isLoserBracket ? "Challonge Loser Bracket" : "Challonge Top Cut";
        } else {
          phase = roundNum > 0 ? "top_cut" : "tiebreaker";
          bracket = roundNum > 0 ? "Challonge Top Cut" : `Challonge Placement ${bracketText}`;
        }
        return {
          externalId: m.id ?? null,
          team1Name: p1,
          team2Name: p2,
          winnerName,
          score1: games.length > 0 ? score1 : null,
          score2: games.length > 0 ? score2 : null,
          phase,
          bracket,
          round: Math.abs(roundNum) || 1,
          state: m.state ?? null,
        };
      }).filter(m => m.team1Name && m.team2Name);

      participants.sort((a, b) => a.final_rank - b.final_rank);
      setTournamentName(name);
      setParticipantCount(participants.length);

      const playerList = await autoMatchPlayers(
        participants.map(p => ({ name: p.name, placement: p.final_rank, tournamentsPlayed: 1 }))
      );

      setPlayers(playerList);
      setMatches(parsedMatches);
      setIsParsed(true);

      const matched = playerList.filter(p => p.matchedUserId).length;
      toast({ title: "JSON analizzato", description: `${participants.length} giocatori, ${parsedMatches.length} match: ${matched} trovati, ${participants.length - matched} segnaposto automatici` });
    } catch (e) {
      toast({ title: "Errore parsing JSON", description: String(e), variant: "destructive" });
    }
  }, [jsonText, tournamentName]);

  const handleImport = async () => {
    setImporting(true);
    try {
      await saveToStaging({
        players, participantCount, tournamentName, platform: "challonge", regionId, clubId,
        matches,
        rawData: jsonText ? JSON.parse(jsonText) : undefined,
      });
      toast({ title: "Salvato in stand-by!", description: "Vai nella tab 'Stand-by' per modificarlo e inviarlo definitivamente." });
      setIsParsed(false);
      setPlayers([]);
      setMatches([]);
      setJsonText("");
    } catch (e: any) {
      toast({ title: "Errore salvataggio", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileJson size={18} className="text-primary" />
          Importa da Challonge (JSON)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isParsed ? (
          <>
            <div>
              <Label>Nome Torneo</Label>
              <Input value={tournamentName} onChange={e => setTournamentName(e.target.value)} placeholder="Nome del torneo Challonge" />
            </div>
            <RegionSelector value={regionId} onChange={setRegionId} />
            <div>
              <Label className="text-xs">Club organizzatore (opzionale)</Label>
              <Select value={clubId || "none"} onValueChange={(v) => setClubId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  {clubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>JSON del Torneo</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Apri <code className="bg-muted px-1 rounded">https://challonge.com/&lt;slug&gt;.json?show_participants=1&amp;show_matches=1</code> e incolla qui il risultato. Senza i parametri il JSON non contiene i giocatori.
              </p>
              <Textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder='Incolla il JSON con "participants": [...]' className="font-mono text-xs min-h-[200px]" />
            </div>
            <Button onClick={parseChallongeJson} disabled={!jsonText.trim()}>Analizza JSON</Button>
          </>
        ) : (
          <>
            <ImportSummary
              tournamentName={tournamentName}
              players={players}
              participantCount={participantCount}
              onCancel={() => { setIsParsed(false); setPlayers([]); setMatches([]); }}
              onImport={handleImport}
              importing={importing}
              onPlayersChange={setPlayers}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════
// CHALLENGERMODE API IMPORT (via Public API)
// ═══════════════════════════════════════════
const ChallengerModeApiImport = () => {
  const [tournamentInput, setTournamentInput] = useState("");
  const [regionId, setRegionId] = useState("");
  const [clubId, setClubId] = useState<string>("");
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase.from("clubs").select("id, name").eq("is_active", true).order("name").then(({ data }) => {
      setClubs(data || []);
    });
  }, []);

  const handleApiImport = async () => {
    if (!tournamentInput.trim()) {
      toast({ title: "Inserisci URL o ID del torneo", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("challengermode-import", {
        body: {
          tournamentInput: tournamentInput.trim(),
          regionId: regionId || null,
          clubId: clubId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Torneo importato in stand-by!",
        description: `${data.title}: ${data.participantsCount} partecipanti, ${data.matchesCount} match. Vai in 'Stand-by Import' per revisionarlo.`,
      });
      setTournamentInput("");
    } catch (e: any) {
      toast({ title: "Errore importazione API", description: e.message || String(e), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Cloud size={16} className="text-primary" />
        <h4 className="font-semibold text-sm">Import diretto da API ChallengerMode</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Importa automaticamente partecipanti, match e standings dal torneo. Verrà salvato in stand-by per revisione.
      </p>
      <div>
        <Label className="text-xs">URL o ID Torneo</Label>
        <Input
          value={tournamentInput}
          onChange={(e) => setTournamentInput(e.target.value)}
          placeholder="https://www.challengermode.com/tournaments/... o UUID"
          className="mt-1 text-xs"
        />
      </div>
      <div>
        <Label className="text-xs">Club organizzatore (opzionale)</Label>
        <Select value={clubId || "none"} onValueChange={(v) => setClubId(v === "none" ? "" : v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Nessuno" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nessuno</SelectItem>
            {clubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <RegionSelector value={regionId} onChange={setRegionId} />
      <Button onClick={handleApiImport} disabled={importing || !tournamentInput.trim()} className="w-full">
        {importing ? <Loader2 size={14} className="animate-spin mr-2" /> : <Cloud size={14} className="mr-2" />}
        Importa torneo in stand-by
      </Button>
    </div>
  );
};

// ═══════════════════════════════════════════
// CHALLENGERMODE IMPORT
// ═══════════════════════════════════════════
const ChallengerModeImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tournamentName, setTournamentName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [players, setPlayers] = useState<ParsedPlayer[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [isParsed, setIsParsed] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      const sheet = workbook.worksheets[0];
      if (!sheet) { toast({ title: "File vuoto", variant: "destructive" }); return; }
      const matrix: any[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        matrix.push(row.values ? (row.values as any[]).slice(1) : []);
      });

      const nonEmptyRows = matrix.filter((row) =>
        Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== "")
      );

      if (nonEmptyRows.length === 0) {
        toast({ title: "File vuoto", variant: "destructive" });
        return;
      }

      const headerIndex = nonEmptyRows.findIndex((row) =>
        row.some((cell) => /pos|rank|place|username|nick|player|name|nome|punt|point|score|pts|total/i.test(String(cell ?? "")))
      );
      const headerRow = headerIndex >= 0 ? nonEmptyRows[headerIndex] : [];
      const dataRows = (headerIndex >= 0 ? nonEmptyRows.slice(headerIndex + 1) : nonEmptyRows)
        .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));

      const findHeaderIndex = (regex: RegExp, fallback: number) => {
        const idx = headerRow.findIndex((cell) => regex.test(String(cell ?? "")));
        return idx >= 0 ? idx : fallback;
      };

      const posIndex = findHeaderIndex(/pos|rank|place|#/i, 0);
      const nameIndex = findHeaderIndex(/username|nick|player|name|nome/i, 2);
      const tourneysIndex = findHeaderIndex(/tourn|played|partecip|eventi|games|matches/i, 3);
      const pointsIndex = 4; // Challengermode export: colonna E = punti totali BFL

      const parseNum = (val: any): number => {
        if (val == null) return 0;
        if (typeof val === "number") return val;

        let normalized = String(val).trim().replace(/\s/g, "");
        if (normalized.includes(",") && normalized.includes(".")) {
          normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
            ? normalized.replace(/\./g, "").replace(",", ".")
            : normalized.replace(/,/g, "");
        } else if (normalized.includes(",")) {
          normalized = normalized.replace(",", ".");
        }

        normalized = normalized.replace(/[^\d.-]/g, "");
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const rawPlayers = dataRows.map((row, i) => ({
        name: String(row[nameIndex] ?? "").trim().replace(/\(.*$/, "").trim(),
        placement: parseNum(row[posIndex]) || (i + 1),
        tournamentsPlayed: Math.max(1, parseNum(row[tourneysIndex]) || 1),
        totalPoints: Math.max(0, Math.round(parseNum(row[pointsIndex]))),
      })).filter(p => p.name && !/username|nick|player|name|nome/i.test(p.name.toLowerCase()));

      if (rawPlayers.length === 0) {
        toast({ title: "Nessun giocatore valido trovato", variant: "destructive" });
        return;
      }

      if (rawPlayers.every((p) => p.totalPoints === 0)) {
        toast({
          title: "Colonna punti non letta correttamente",
          description: "Verifica che i punti totali siano nella colonna E del file XLSX.",
          variant: "destructive",
        });
        return;
      }

      console.log("CM parse indexes:", { posIndex, nameIndex, tourneysIndex, pointsIndex });
      console.log("CM points sample:", rawPlayers.slice(0, 5).map((p) => ({ name: p.name, points: p.totalPoints, tournaments: p.tournamentsPlayed })));

      const playerList = await autoMatchPlayers(rawPlayers);

      setPlayers(playerList);
      setParticipantCount(playerList.length);
      setTournamentName(tournamentName || file.name.replace(/\.(xlsx?|csv)$/i, ""));
      setIsParsed(true);

      const matched = playerList.filter(p => p.matchedUserId).length;
      toast({ title: "File analizzato", description: `${playerList.length} giocatori: ${matched} trovati, ${playerList.length - matched} segnaposto automatici` });
    } catch (err: any) {
      toast({ title: "Errore lettura file", description: err.message, variant: "destructive" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [tournamentName]);

  const handleImport = async () => {
    setImporting(true);
    try {
      await saveToStaging({
        players, participantCount, tournamentName: tournamentName || "Torneo Challengermode", platform: "challengermode", regionId,
      });
      toast({ title: "Salvato in stand-by!", description: "Vai nella tab 'Stand-by' per modificarlo e inviarlo definitivamente." });
      setIsParsed(false);
      setPlayers([]);
    } catch (e: any) {
      toast({ title: "Errore salvataggio", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet size={18} className="text-primary" />
          Importa da Challengermode (XLSX)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isParsed ? (
          <>
            <ChallengerModeApiImport />
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">— oppure importa da file XLSX —</p>
            </div>
            <div>
              <Label>Nome Torneo / Stagione</Label>
              <Input value={tournamentName} onChange={e => setTournamentName(e.target.value)} placeholder="Es: Challengermode Season 1" />
            </div>
            <RegionSelector value={regionId} onChange={setRegionId} />
            <div>
              <Label>File XLSX della classifica</Label>
              <div className="mt-1">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} className="mr-2" /> Carica file XLSX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Il file deve avere colonne: Posizione, Username. Le colonne vengono auto-rilevate.
              </p>
            </div>
          </>
        ) : (
          <ImportSummary
            tournamentName={tournamentName}
            players={players}
            participantCount={participantCount}
            onCancel={() => { setIsParsed(false); setPlayers([]); }}
            onImport={handleImport}
            importing={importing}
            onPlayersChange={setPlayers}
          />
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════
// IMPORT EDITOR (shared – pre-confirmation)
// ═══════════════════════════════════════════

const PlayerSearchPopover = ({
  player,
  onMatch,
}: {
  player: ParsedPlayer;
  onMatch: (userId: string, displayName: string, isChild: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; isChild: boolean }[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const term = `%${q}%`;
    const [{ data: profiles }, { data: children }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, username").or(`display_name.ilike.${term},username.ilike.${term}`).limit(8),
      supabase.from("child_profiles").select("id, display_name").ilike("display_name", term).limit(5),
    ]);
    const r: { id: string; name: string; isChild: boolean }[] = [];
    (profiles || []).forEach(p => r.push({ id: p.user_id, name: p.display_name || p.username || p.user_id, isChild: false }));
    (children || []).forEach(c => r.push({ id: c.id, name: c.display_name, isChild: true }));
    setResults(r);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  if (!open) {
    return (
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(true)}>
        <span className="text-xs">✏️</span>
      </Button>
    );
  }

  return (
    <div className="absolute z-50 bg-popover border rounded-lg shadow-lg p-2 w-64 right-0 top-0">
      <Input
        autoFocus
        placeholder="Cerca giocatore..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-8 text-xs mb-1"
      />
      {searching && <p className="text-xs text-muted-foreground p-1">Ricerca...</p>}
      <div className="max-h-32 overflow-auto space-y-0.5">
        {results.map(r => (
          <button
            key={r.id}
            className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent truncate flex items-center gap-1"
            onClick={() => { onMatch(r.id, r.name, r.isChild); setOpen(false); setSearch(""); }}
          >
            {r.name}
            {r.isChild && <Badge variant="outline" className="text-[9px] ml-auto">Kid</Badge>}
          </button>
        ))}
        {!searching && search.length >= 2 && results.length === 0 && (
          <p className="text-xs text-muted-foreground p-1">Nessun risultato</p>
        )}
      </div>
      <Button variant="ghost" size="sm" className="w-full mt-1 h-6 text-xs" onClick={() => setOpen(false)}>Chiudi</Button>
    </div>
  );
};

const ImportSummary = ({
  tournamentName,
  players: initialPlayers,
  participantCount,
  onCancel,
  onImport,
  importing,
  onPlayersChange,
}: {
  tournamentName: string;
  players: ParsedPlayer[];
  participantCount: number;
  onCancel: () => void;
  onImport: () => void;
  importing: boolean;
  onPlayersChange?: (players: ParsedPlayer[]) => void;
}) => {
  const [editablePlayers, setEditablePlayers] = useState<ParsedPlayer[]>(initialPlayers);

  useEffect(() => { setEditablePlayers(initialPlayers); }, [initialPlayers]);

  const updatePlayer = (index: number, patch: Partial<ParsedPlayer>) => {
    setEditablePlayers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      onPlayersChange?.(next);
      return next;
    });
  };

  const matched = editablePlayers.filter(p => p.matchedUserId);
  const pending = editablePlayers.filter(p => !p.matchedUserId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">{tournamentName}</h3>
          <p className="text-sm text-muted-foreground">{participantCount} partecipanti — Modifica i dettagli prima di importare</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Annulla</Button>
          <Button onClick={onImport} disabled={importing}>
            {importing ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            Conferma e Importa
          </Button>
        </div>
      </div>

      <div className="flex gap-3 text-sm">
        <Badge variant="default" className="gap-1">
          <Check size={12} /> {matched.length} collegati
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Clock size={12} /> {pending.length} segnaposto
        </Badge>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Nome Esterno</TableHead>
              <TableHead>Giocatore Collegato</TableHead>
              <TableHead className="w-16">Tornei</TableHead>
              <TableHead className="w-20">Punti</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editablePlayers.map((player, i) => {
              const displayPts = player.totalPoints > 0
                ? player.totalPoints
                : calcScaledPoints(player.placement, participantCount).scaled * player.tournamentsPlayed;
              return (
                <TableRow key={i}>
                  <TableCell>
                    <Input
                      type="number"
                      value={player.placement}
                      onChange={e => updatePlayer(i, { placement: parseInt(e.target.value) || 1 })}
                      className="h-7 w-14 text-xs font-mono p-1"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-sm">{player.externalName}</TableCell>
                  <TableCell className="relative">
                    <div className="flex items-center gap-1">
                      {player.matchedUserId ? (
                        <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                          <Check size={14} />
                          {player.matchedDisplayName}
                          {player.isChild && <Badge variant="outline" className="text-[10px]">Kid</Badge>}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Segnaposto</span>
                      )}
                      <PlayerSearchPopover
                        player={player}
                        onMatch={(userId, displayName, isChild) =>
                          updatePlayer(i, { matchedUserId: userId, matchedDisplayName: displayName, isChild })
                        }
                      />
                      {player.matchedUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive"
                          onClick={() => updatePlayer(i, { matchedUserId: null, matchedDisplayName: null, isChild: false })}
                        >
                          <X size={12} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={player.tournamentsPlayed}
                      onChange={e => updatePlayer(i, { tournamentsPlayed: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="h-7 w-14 text-xs font-mono p-1"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={displayPts}
                      onChange={e => updatePlayer(i, { totalPoints: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 w-20 text-xs font-mono p-1"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// PENDING RESULTS
// ═══════════════════════════════════════════
const PendingResults = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pending_tournament_results" as any)
      .select("*, tournaments:tournament_id(title)")
      .order("created_at", { ascending: false });
    setResults(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock size={18} className="text-primary" />
          Risultati in Attesa di Registrazione
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun risultato in attesa. Tutti i giocatori importati hanno già un account collegato.</p>
        ) : (
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Piattaforma</TableHead>
                  <TableHead>Torneo</TableHead>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead className="w-20">Punti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.external_username}</TableCell>
                    <TableCell><Badge variant="outline">{r.platform}</Badge></TableCell>
                    <TableCell className="text-sm">{(r.tournaments as any)?.title || "—"}</TableCell>
                    <TableCell className="font-mono">{r.placement}</TableCell>
                    <TableCell><Badge variant="secondary">{r.scaled_points} pts</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════
// SAVED MAPPINGS
// ═══════════════════════════════════════════
const SavedMappings = () => {
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("external_player_mappings" as any)
      .select("*")
      .order("platform")
      .order("external_username");
    setMappings(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 size={18} className="text-primary" />
          Mapping Giocatori Salvati
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun mapping salvato.</p>
        ) : (
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Piattaforma</TableHead>
                  <TableHead>Nome Esterno</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell><Badge variant="outline">{m.platform}</Badge></TableCell>
                    <TableCell className="font-medium">{m.external_username}</TableCell>
                    <TableCell>
                      {m.internal_user_id ? (
                        <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                          <Check size={14} /> Collegato
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock size={14} /> In attesa
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExternalImportsAdminTab;
