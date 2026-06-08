import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Inbox, Send, Trash2, Pencil, Loader2, FileJson, FileSpreadsheet,
  CheckCircle2, XCircle, Clock, AlertTriangle, Save, Users, Eye,
} from "lucide-react";
import { normalizeImportedName, buildGhostUsername } from "./ExternalImportsAdminTab";
import { StagingPlayersTab } from "./staging/StagingPlayersTab";
import { StagingPreviewTab } from "./staging/StagingPreviewTab";
import { computeStagingStandings } from "@/lib/computeStagingStandings";

interface StagingRow {
  id: string;
  source_platform: string;
  title: string;
  description: string | null;
  city: string | null;
  location: string | null;
  event_date: string | null;
  registration_deadline: string | null;
  club_id: string | null;
  region_id: string | null;
  format: string | null;
  is_ranked: boolean;
  participants: any;
  matches: any;
  standings: any;
  status: string;
  send_error: string | null;
  sent_tournament_id: string | null;
  created_at: string;
  imported_by: string;
}

const ImportedTournamentsStagingTab = () => {
  const [rows, setRows] = useState<StagingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StagingRow | null>(null);
  const [confirmSendOne, setConfirmSendOne] = useState<StagingRow | null>(null);
  const [confirmSendAll, setConfirmSendAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StagingRow | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendInProgress, setSendInProgress] = useState(false);
  const [sendAsIbna, setSendAsIbna] = useState(false);
  const [sendChampionshipId, setSendChampionshipId] = useState<string>("none");
  const [championships, setChampionships] = useState<{ id: string; name: string }[]>([]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      // Carico in chunk per evitare timeout su JSON grossi (participants/standings/matches)
      const CHUNK = 20;
      let from = 0;
      const all: any[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("imported_tournaments_staging" as any)
          .select("id, source_platform, title, description, city, location, event_date, registration_deadline, club_id, region_id, format, is_ranked, participants, matches, standings, status, send_error, sent_tournament_id, created_at, imported_by")
          .order("created_at", { ascending: false })
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        const batch = (data as any[]) || [];
        all.push(...batch);
        if (batch.length < CHUNK) break;
        from += CHUNK;
      }
      setRows(all as any);
    } catch (e: any) {
      toast({ title: "Errore caricamento staging", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    supabase.from("championships").select("id, name").eq("is_active", true).order("name").then(({ data }) => {
      setChampionships((data as any) || []);
    });
  }, []);

  const drafts = rows.filter((r) => r.status === "draft");
  const sent = rows.filter((r) => r.status === "sent");
  const failed = rows.filter((r) => r.status === "failed");

  const sendOne = async (row: StagingRow, opts: { inProgress?: boolean; asIbna?: boolean; championshipId?: string | null } = {}) => {
    const inProgress = !!opts.inProgress;
    const asIbna = !!opts.asIbna;
    const championshipId = opts.championshipId || null;
    setSendingId(row.id);
    try {
      const rawParticipants: any[] = Array.isArray(row.participants) ? row.participants : [];
      const rawMatches: any[] = Array.isArray(row.matches) ? row.matches : [];

      // 1. Recompute standings & per-tournament points (2 + 4*wins, no ties)
      const { standings: computedStandings, participants: computedParticipants } =
        computeStagingStandings(rawParticipants, rawMatches);

      // Persist back for traceability
      await supabase.from("imported_tournaments_staging" as any).update({
        participants: computedParticipants as any,
        standings: computedStandings as any,
      }).eq("id", row.id);

      // 2. Resolve user_ids for every player. Pre-create ghosts for unmatched.
      const norm = (s: any) => String(s ?? "").trim().toLowerCase();
      const nameToUserId = new Map<string, string>();
      const ghostInserts: { user_id: string; username: string; display_name: string; region_id: string | null }[] = [];

      for (const p of computedParticipants) {
        const key = norm(p.externalName);
        if (!key) continue;
        if (p.matchedUserId) {
          nameToUserId.set(key, p.matchedUserId);
        } else {
          const ghostId = crypto.randomUUID();
          const display = normalizeImportedName(p.externalName || "").slice(0, 60) || `Player`;
          ghostInserts.push({
            user_id: ghostId,
            username: buildGhostUsername(p.externalName || "p", ghostId),
            display_name: display,
            region_id: row.region_id || null,
          });
          nameToUserId.set(key, ghostId);
        }
      }

      if (ghostInserts.length > 0) {
        const { error: ghostErr } = await supabase.rpc("bulk_create_ghost_profiles" as any, {
          _profiles: ghostInserts,
        });
        if (ghostErr) throw new Error(`Errore creazione ghost: ${ghostErr.message}`);
      }

      const resolveId = (name: any): string | null => {
        const k = norm(name);
        return k ? (nameToUserId.get(k) || null) : null;
      };

      // 3. Determine tournament shape from matches
      const phaseOf = (m: any): "swiss" | "top_cut" | "tiebreaker" => {
        const explicit = typeof m.phase === "string" ? m.phase.toLowerCase() : null;
        if (explicit === "tiebreaker" || explicit === "spareggio" || explicit === "placement") return "tiebreaker";
        if (explicit === "top_cut" || explicit === "top-cut" || explicit === "elimination") return "top_cut";
        if (explicit === "swiss" || explicit === "group") return "swiss";
        const bracket = typeof m.bracket === "string" ? m.bracket.toLowerCase() : "";
        if (/(lower|loser|losers|perdenti|consolation|repechage)/.test(bracket)) return "tiebreaker";
        if (/final|semi|quarter|round.*16|top|elim|upper|winner/.test(bracket)) return "top_cut";
        return "swiss";
      };

      const swissRoundsCount = rawMatches
        .filter((m) => phaseOf(m) === "swiss")
        .reduce((mx, m) => Math.max(mx, typeof m.round === "number" ? m.round : 1), 0);
      const topCutPlayers = new Set<string>();
      rawMatches.forEach((m) => {
        if (phaseOf(m) !== "top_cut") return;
        const p1 = resolveId(m.team1Name || m.player1);
        const p2 = resolveId(m.team2Name || m.player2);
        if (p1) topCutPlayers.add(p1);
        if (p2) topCutPlayers.add(p2);
      });
      const topCutSize = topCutPlayers.size > 0
        ? [8, 16, 32, 64].find((n) => n >= topCutPlayers.size) || topCutPlayers.size
        : 0;
      const tournamentFormat = topCutSize > 0 ? "swiss_top_cut" : "swiss";
      const tournamentStatus = inProgress ? (topCutPlayers.size > 0 ? "top_cut" : "swiss") : "completed";

      // 4. Create the tournament with full metadata
      const eventDate = row.event_date || new Date().toISOString();
      const { data: createdT, error: tErr } = await supabase
        .from("tournaments")
        .insert({
          title: row.title,
          description: row.description,
          city: row.city || (asIbna ? "Italia" : "Esterno"),
          location: row.location || (asIbna ? "FIB" : (row.source_platform === "challonge" ? "Challonge" : "Challengermode")),
          event_date: eventDate,
          registration_deadline: row.registration_deadline || eventDate,
          club_id: row.club_id,
          region_id: row.region_id,
          championship_id: championshipId,
          format: tournamentFormat,
          swiss_rounds: swissRoundsCount || null,
          top_cut_size: topCutSize || null,
          status: tournamentStatus,
          is_active: inProgress ? true : false,
          is_ranked: row.is_ranked,
          is_external: !asIbna,
          external_source: asIbna ? null : row.source_platform,
          max_participants: computedParticipants.length || null,
        } as any)
        .select("id")
        .single();
      if (tErr || !createdT) throw new Error(`Errore creazione torneo: ${tErr?.message}`);
      const tournamentId = createdT.id;

      // 5. tournament_registrations: one per resolved player
      const allUserIds = Array.from(new Set(Array.from(nameToUserId.values())));
      if (allUserIds.length > 0) {
        const regRows = allUserIds.map((uid) => ({
          tournament_id: tournamentId,
          user_id: uid,
          status: "confirmed",
          registered_at: eventDate,
        }));
        for (let i = 0; i < regRows.length; i += 100) {
          const { error } = await supabase.from("tournament_registrations").insert(regRows.slice(i, i + 100));
          if (error) console.error("registrations insert error:", error);
        }
      }

      // 6. tournament_standings: from computed standings
      const standingRows = computedStandings.map((s) => {
        const uid = resolveId(s.externalName);
        if (!uid) return null;
        return {
          tournament_id: tournamentId,
          user_id: uid,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws,
          game_wins: 0,
          game_losses: 0,
          points: s.totalPoints,
          resistance: s.omwPercent || 0,
          opponent_match_win_pct: s.omwPercent || 0,
          dropped: false,
        };
      }).filter(Boolean) as any[];
      if (standingRows.length > 0) {
        for (let i = 0; i < standingRows.length; i += 100) {
          const { error } = await supabase.from("tournament_standings").insert(standingRows.slice(i, i + 100));
          if (error) console.error("standings insert error:", error);
        }
      }

      // 7. tournament_matches — group by phase+round, allocate match_numbers
      // Sort: swiss rounds first (in order), then top_cut, then tiebreaker
      const phaseOrder = { swiss: 0, top_cut: 1, tiebreaker: 2 } as const;
      const sortedMatches = [...rawMatches].sort((a, b) => {
        const pa = phaseOf(a), pb = phaseOf(b);
        if (pa !== pb) return phaseOrder[pa] - phaseOrder[pb];
        const ra = typeof a.round === "number" ? a.round : 1;
        const rb = typeof b.round === "number" ? b.round : 1;
        return ra - rb;
      });
      const counters = new Map<string, number>();
      const matchInserts = sortedMatches.map((m) => {
        const phase = phaseOf(m);
        const round = typeof m.round === "number" && m.round > 0 ? m.round : 1;
        const key = `${phase}-${round}`;
        const next = (counters.get(key) || 0) + 1;
        counters.set(key, next);
        const p1Name = m.team1Name || m.player1 || null;
        const p2Name = m.team2Name || m.player2 || null;
        const winnerName = m.score1 != null && m.score2 != null && m.score1 !== m.score2
          ? (m.score1 > m.score2 ? p1Name : p2Name)
          : (m.winnerName || null);
        const player1_id = resolveId(p1Name);
        const player2_id = resolveId(p2Name);
        const winner_id = resolveId(winnerName);
        const s1 = typeof m.score1 === "number" ? m.score1 : null;
        const s2 = typeof m.score2 === "number" ? m.score2 : null;
        const isCompleted = !!(m.isFinal || m.state === "FINISHED" || m.state === "COMPLETED" || winner_id || s1 != null || s2 != null);
        return {
          tournament_id: tournamentId,
          phase,
          round,
          match_number: next,
          player1_id,
          player2_id,
          player1_score: s1,
          player2_score: s2,
          winner_id,
          status: isCompleted ? "completed" : "pending",
          pairing_meta: {
            imported: true,
            source: row.source_platform,
            external_id: m.externalId || m.seriesId || null,
            series_title: m.seriesTitle || null,
            bracket: m.bracket || null,
            stage: m.stage ?? null,
            team1_name: p1Name,
            team2_name: p2Name,
          },
        };
      });

      // Insert one-by-one (or small batches) to avoid losing all when one fails
      let matchOk = 0, matchFail = 0;
      const failureSamples: string[] = [];
      for (let i = 0; i < matchInserts.length; i += 25) {
        const chunk = matchInserts.slice(i, i + 25);
        const { error } = await supabase.from("tournament_matches").insert(chunk as any);
        if (error) {
          // Fallback: try one-by-one to salvage as many as possible
          for (const single of chunk) {
            const { error: sErr } = await supabase.from("tournament_matches").insert(single as any);
            if (sErr) {
              matchFail++;
              if (failureSamples.length < 3) failureSamples.push(sErr.message);
            } else {
              matchOk++;
            }
          }
        } else {
          matchOk += chunk.length;
        }
      }
      if (matchFail > 0) {
        console.warn(`Match falliti: ${matchFail}/${matchInserts.length}. Sample:`, failureSamples);
      }

      // 8. tournament_results: scaled_points = computed totalPoints (2 + 4*wins)
      // Skipped for in-progress tournaments (no final placements yet).
      const participantCount = computedParticipants.length;
      const resultRows = inProgress ? [] : computedStandings.map((s) => {
        const uid = resolveId(s.externalName);
        if (!uid) return null;
        return {
          tournament_id: tournamentId,
          user_id: uid,
          placement: s.position,
          participants_count: participantCount,
          base_points: s.totalPoints,
          scaled_points: s.totalPoints,
        };
      }).filter(Boolean) as any[];
      if (resultRows.length > 0) {
        for (let i = 0; i < resultRows.length; i += 100) {
          const { error } = await supabase.from("tournament_results").insert(resultRows.slice(i, i + 100));
          if (error) console.error("results insert error:", error);
        }
      }

      // 9. Recompute global rankings (skip for in-progress tournaments)
      if (!inProgress) {
        const bfl = (await supabase.from("ranking_seasons").select("bfl").eq("is_active", true).maybeSingle()).data?.bfl ?? 10;
        await supabase.rpc("recalculate_all_rankings" as any, { _bfl: bfl });
      }

      // 10. Mark staging as sent
      await supabase
        .from("imported_tournaments_staging" as any)
        .update({ status: "sent", sent_tournament_id: tournamentId, send_error: null })
        .eq("id", row.id);

      toast({
        title: inProgress ? "Importato come in corso!" : "Inviato!",
        description: `"${row.title}" ${inProgress ? "pubblicato come torneo attivo" : "pubblicato"} (${matchOk} match, ${standingRows.length} giocatori${matchFail > 0 ? `, ${matchFail} match falliti` : ""}).`,
      });
      await fetchRows();
    } catch (e: any) {
      await supabase
        .from("imported_tournaments_staging" as any)
        .update({ status: "failed", send_error: e.message })
        .eq("id", row.id);
      toast({ title: "Errore invio", description: e.message, variant: "destructive" });
      await fetchRows();
      throw e;
    } finally {
      setSendingId(null);
    }
  };

  const sendAll = async () => {
    setSendingAll(true);
    let okCount = 0;
    const errors: { title: string; error: string }[] = [];
    for (const row of drafts) {
      try {
        await sendOne(row);
        okCount++;
      } catch (e: any) {
        errors.push({ title: row.title, error: e.message });
      }
    }
    setSendingAll(false);
    if (errors.length === 0) {
      toast({ title: "Invio batch completato!", description: `${okCount} tornei pubblicati.` });
    } else {
      toast({
        title: `Invio batch: ${okCount} ok, ${errors.length} errori`,
        description: errors.map((e) => `${e.title}: ${e.error}`).join(" · "),
        variant: "destructive",
      });
    }
  };

  const deleteRow = async (row: StagingRow) => {
    const { error } = await supabase.from("imported_tournaments_staging" as any).delete().eq("id", row.id);
    if (error) {
      toast({ title: "Errore eliminazione", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Eliminato" });
      await fetchRows();
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === "sent") return <Badge variant="default" className="gap-1 bg-primary"><CheckCircle2 size={12} /> Inviato</Badge>;
    if (status === "failed") return <Badge variant="destructive" className="gap-1"><XCircle size={12} /> Fallito</Badge>;
    return <Badge variant="secondary" className="gap-1"><Clock size={12} /> Bozza</Badge>;
  };

  const renderActions = (row: StagingRow, showActions: boolean) => (
    <div className="flex justify-end gap-1">
      {showActions && (
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(row)}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-primary"
            onClick={() => setConfirmSendOne(row)}
            disabled={sendingId === row.id}
          >
            {sendingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(row)}>
        <Trash2 size={14} />
      </Button>
    </div>
  );

  const renderTable = (data: StagingRow[], showActions: boolean) => (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {data.length === 0 ? (
          <div className="border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Nessun torneo
          </div>
        ) : (
          data.map((row) => (
            <div key={row.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm break-words flex-1 min-w-0">{row.title}</div>
                {renderActions(row, showActions)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 text-xs">
                  {row.source_platform === "challonge" ? <FileJson size={12} /> : <FileSpreadsheet size={12} />}
                  {row.source_platform}
                </Badge>
                {renderStatusBadge(row.status)}
                <Badge variant="secondary" className="text-xs">{(row.participants || []).length} partecipanti</Badge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(row.created_at).toLocaleString("it")}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block border border-border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Piattaforma</TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead>Partecipanti</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Importato il</TableHead>
              <TableHead className="w-32 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                  Nessun torneo
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {row.source_platform === "challonge" ? <FileJson size={12} /> : <FileSpreadsheet size={12} />}
                      {row.source_platform}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{(row.participants || []).length}</TableCell>
                  <TableCell>{renderStatusBadge(row.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("it")}
                  </TableCell>
                  <TableCell className="text-right">{renderActions(row, showActions)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox size={18} className="text-primary" /> Tornei Importati in Stand-by
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Modifica e rivedi i tornei importati prima di pubblicarli definitivamente in FIBApp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Aggiorna"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={drafts.length === 0 || loading}
            onClick={async () => {
              const targets = drafts.filter(
                (r) =>
                  r.source_platform === "challengermode_api" ||
                  r.source_platform === "challonge",
              );
              if (targets.length === 0) {
                toast({ title: "Nessuna bozza da riprocessare" });
                return;
              }
              setLoading(true);
              const { reprocessChallengerMatches } = await import("@/lib/reprocessChallengerMatches");
              const { reprocessChallongeMatches } = await import("@/lib/reprocessChallongeMatches");
              let okCount = 0;
              let totalScore = 0;
              for (const r of targets) {
                const { data } = await supabase
                  .from("imported_tournaments_staging" as any)
                  .select("raw_data")
                  .eq("id", r.id)
                  .maybeSingle();
                if (!data) continue;
                const fresh =
                  r.source_platform === "challonge"
                    ? reprocessChallongeMatches((data as any).raw_data)
                    : reprocessChallengerMatches((data as any).raw_data);
                if (fresh.length === 0) continue;
                const { error } = await supabase
                  .from("imported_tournaments_staging" as any)
                  .update({ matches: fresh as any })
                  .eq("id", r.id);
                if (!error) {
                  okCount++;
                  totalScore += fresh.filter((m: any) => m.score1 != null || m.score2 != null).length;
                }
              }
              await fetchRows();
              toast({
                title: "Riprocessamento completato",
                description: `${okCount}/${targets.length} bozze aggiornate · ${totalScore} match con punteggio totali.`,
              });
            }}
          >
            Riprocessa tutto
          </Button>
          <Button
            onClick={() => setConfirmSendAll(true)}
            disabled={drafts.length === 0 || sendingAll}
            className="gap-1.5"
          >
            {sendingAll ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Invia tutti ({drafts.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="draft">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="draft" className="gap-1.5"><Clock size={14} /> Bozze ({drafts.length})</TabsTrigger>
            <TabsTrigger value="sent" className="gap-1.5"><CheckCircle2 size={14} /> Inviati ({sent.length})</TabsTrigger>
            <TabsTrigger value="failed" className="gap-1.5"><XCircle size={14} /> Falliti ({failed.length})</TabsTrigger>
            <TabsTrigger value="players" className="gap-1.5"><Users size={14} /> Giocatori</TabsTrigger>
          </TabsList>
          <TabsContent value="draft" className="mt-4">{renderTable(drafts, true)}</TabsContent>
          <TabsContent value="sent" className="mt-4">{renderTable(sent, false)}</TabsContent>
          <TabsContent value="failed" className="mt-4">
            {failed.length > 0 && (
              <div className="mb-3 p-3 rounded border border-destructive/40 bg-destructive/10 text-sm">
                <div className="flex items-center gap-1.5 font-medium text-destructive mb-2">
                  <AlertTriangle size={14} /> Tornei falliti
                </div>
                {failed.map((r) => (
                  <div key={r.id} className="text-xs text-muted-foreground">
                    <strong>{r.title}:</strong> {r.send_error || "errore sconosciuto"}
                  </div>
                ))}
              </div>
            )}
            {renderTable(failed, true)}
          </TabsContent>
          <TabsContent value="players" className="mt-4">
            <StagingPlayersTab rows={rows} onSyncDone={fetchRows} />
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Editor dialog */}
      {editing && (
        <StagingEditor
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchRows(); }}
        />
      )}

      {/* Confirm send one */}
      <AlertDialog
        open={!!confirmSendOne}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmSendOne(null);
            setSendInProgress(false);
            setSendAsIbna(false);
            setSendChampionshipId("none");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invia in FIBApp?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Stai per pubblicare "<strong>{confirmSendOne?.title}</strong>" nella sezione tornei.
                {sendInProgress
                  ? " Il torneo verrà creato come ATTIVO e potrai continuarlo direttamente sul sito (nessun risultato finale o ranking calcolato)."
                  : " Questa azione creerà il torneo, i risultati e la classifica."}
                {(() => {
                  const unmatched = (confirmSendOne?.participants || []).filter((p: any) => !p.matchedUserId).length;
                  if (unmatched === 0) return null;
                  return (
                    <span className="block mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs">
                      ⚠ {unmatched} giocatori non sincronizzati: verranno creati profili segnaposto. Quando uno di loro collegherà l'account Challonge/Challengermode, i risultati e i punti gli saranno automaticamente attribuiti.
                    </span>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <label className="flex items-start gap-2 p-3 rounded border border-border bg-secondary/30 cursor-pointer">
              <Checkbox
                checked={sendInProgress}
                onCheckedChange={(c) => setSendInProgress(c === true)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <div className="font-medium">Torneo ancora in corso</div>
                <div className="text-xs text-muted-foreground">
                  Importa il torneo come attivo per continuarlo su FIBApp. I match già giocati restano con i loro risultati, quelli senza punteggio rimangono in attesa.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 p-3 rounded border border-border bg-secondary/30 cursor-pointer">
              <Checkbox
                checked={sendAsIbna}
                onCheckedChange={(c) => setSendAsIbna(c === true)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <div className="font-medium">Importa come torneo FIB</div>
                <div className="text-xs text-muted-foreground">
                  Il torneo non sarà marcato come esterno: apparirà come un torneo FIB nativo (location "FIB", senza badge Challonge/Challengermode).
                </div>
              </div>
            </label>
            <div className="p-3 rounded border border-border bg-secondary/30">
              <Label className="text-sm font-medium">Inserisci in un campionato (opzionale)</Label>
              <Select value={sendChampionshipId} onValueChange={setSendChampionshipId}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  {championships.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const r = confirmSendOne!;
                const ip = sendInProgress;
                const ibna = sendAsIbna;
                const champ = sendChampionshipId === "none" ? null : sendChampionshipId;
                setConfirmSendOne(null);
                setSendInProgress(false);
                setSendAsIbna(false);
                setSendChampionshipId("none");
                try { await sendOne(r, { inProgress: ip, asIbna: ibna, championshipId: champ }); } catch {}
              }}
            >
              {sendInProgress ? "IMPORTA COME IN CORSO" : "INVIA IN IBNAPP"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm send all */}
      <AlertDialog open={confirmSendAll} onOpenChange={setConfirmSendAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invia tutti i tornei in bozza?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per pubblicare {drafts.length} tornei in FIBApp. In caso di errore su uno, gli altri continueranno
              comunque e a fine processo riceverai un report.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmSendAll(false); sendAll(); }}>
              INVIA TUTTI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare?</AlertDialogTitle>
            <AlertDialogDescription>
              "<strong>{confirmDelete?.title}</strong>" verrà rimosso dalla lista di staging.
              {confirmDelete?.status === "sent" && " Il torneo già pubblicato NON verrà eliminato dal sito."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { const r = confirmDelete!; setConfirmDelete(null); deleteRow(r); }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

// ═══════════════════════════════════════════
// EDITOR
// ═══════════════════════════════════════════
const StagingEditor = ({
  row,
  onClose,
  onSaved,
}: {
  row: StagingRow;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState({
    title: row.title,
    description: row.description || "",
    city: row.city || "",
    location: row.location || "",
    event_date: row.event_date ? row.event_date.slice(0, 16) : "",
    registration_deadline: row.registration_deadline ? row.registration_deadline.slice(0, 16) : "",
    club_id: row.club_id || "",
    region_id: row.region_id || "",
    format: row.format || "",
    is_ranked: row.is_ranked,
  });
  const [participants, setParticipants] = useState<any[]>(row.participants || []);
  const [standings, setStandings] = useState<any[]>(row.standings || []);
  const [matchesData, setMatchesData] = useState<any[]>(row.matches || []);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("clubs").select("id, name").eq("is_active", true).order("name").then(({ data }) => setClubs(data || []));
    supabase.from("regions").select("id, name").order("name").then(({ data }) => setRegions(data || []));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("imported_tournaments_staging" as any).update({
      title: form.title,
      description: form.description || null,
      city: form.city || null,
      location: form.location || null,
      event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
      registration_deadline: form.registration_deadline ? new Date(form.registration_deadline).toISOString() : null,
      club_id: form.club_id || null,
      region_id: form.region_id || null,
      format: form.format || null,
      is_ranked: form.is_ranked,
      participants: participants as any,
      standings: standings as any,
      matches: matchesData as any,
    }).eq("id", row.id);

    setSaving(false);
    if (error) {
      toast({ title: "Errore salvataggio", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Modifiche salvate" });
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="!max-w-none w-[98vw] sm:w-[98vw] h-[96vh] max-h-[96vh] p-0 flex flex-col gap-0 overflow-hidden sm:rounded-lg"
        hideClose
      >
        {/* HEADER */}
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <DialogTitle className="text-base truncate">{form.title || "Modifica torneo importato"}</DialogTitle>
              <DialogDescription className="text-xs">
                {row.source_platform} · {participants.length} partecipanti · {matchesData.length} match
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={form.is_ranked ? "default" : "outline"} className="text-[10px]">
                {form.is_ranked ? "BFL ranked" : "Non classificato"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* BODY: sidebar nav (lg+) + main content */}
        <Tabs defaultValue="info" orientation="vertical" className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          <TabsList
            className={cn(
              "shrink-0 rounded-none p-1 bg-muted/30",
              // mobile: horizontal grid across the top
              "max-lg:grid max-lg:grid-cols-5 max-lg:w-full max-lg:h-auto max-lg:border-b max-lg:border-border",
              // desktop: vertical sidebar
              "lg:flex lg:flex-col lg:items-stretch lg:justify-start lg:h-full lg:w-52 lg:border-r lg:border-border lg:p-2 lg:gap-1",
            )}
          >
            <TabsTrigger value="info" className="text-xs lg:justify-start lg:gap-2 lg:py-2 lg:w-full">
              <FileJson size={13} className="hidden lg:inline" /> Info
            </TabsTrigger>
            <TabsTrigger value="participants" className="text-xs lg:justify-start lg:gap-2 lg:py-2 lg:w-full">
              <Users size={13} className="hidden lg:inline" /> Partecipanti
              <Badge variant="secondary" className="text-[9px] h-4 ml-auto hidden lg:inline-flex">{participants.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="standings" className="text-xs lg:justify-start lg:gap-2 lg:py-2 lg:w-full">
              <CheckCircle2 size={13} className="hidden lg:inline" /> Classifica
              <Badge variant="secondary" className="text-[9px] h-4 ml-auto hidden lg:inline-flex">{standings.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="matches" className="text-xs lg:justify-start lg:gap-2 lg:py-2 lg:w-full">
              <Send size={13} className="hidden lg:inline" /> Match
              <Badge variant="secondary" className="text-[9px] h-4 ml-auto hidden lg:inline-flex">{matchesData.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs gap-1 lg:justify-start lg:gap-2 lg:py-2 lg:w-full">
              <Eye size={13} /> Anteprima
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-w-0 min-h-0 overflow-auto p-4">

          {/* INFO TAB */}
          <TabsContent value="info" className="space-y-3 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Titolo *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Formato</Label>
                <Input value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))} placeholder="es. Swiss + Top 8" />
              </div>
              <div>
                <Label>Data evento</Label>
                <Input type="datetime-local" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div>
                <Label>Scadenza iscrizioni</Label>
                <Input type="datetime-local" value={form.registration_deadline} onChange={(e) => setForm((f) => ({ ...f, registration_deadline: e.target.value }))} />
              </div>
              <div>
                <Label>Città</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <Label>Club organizzatore</Label>
                <Select value={form.club_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, club_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Regione</Label>
                <Select value={form.region_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, region_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna</SelectItem>
                    {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Descrizione</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_ranked"
                  checked={form.is_ranked}
                  onChange={(e) => setForm((f) => ({ ...f, is_ranked: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_ranked" className="cursor-pointer">Torneo classificato (assegna punti BFL)</Label>
              </div>
            </div>
          </TabsContent>

          {/* PARTICIPANTS TAB */}
          <TabsContent value="participants" className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">
              Modifica nome esterno, posizionamento e mapping. Per i giocatori non collegati verrà creato un profilo segnaposto.
            </div>
            <div className="border border-border rounded max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Pos</TableHead>
                    <TableHead>Nome esterno</TableHead>
                    <TableHead>Collegato</TableHead>
                    <TableHead className="w-20">Punti</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          type="number"
                          value={p.placement || 0}
                          className="h-7 w-14"
                          onChange={(e) => {
                            const next = [...participants];
                            next[i] = { ...next[i], placement: parseInt(e.target.value) || 0 };
                            setParticipants(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={p.externalName || ""}
                          className="h-7 text-xs"
                          onChange={(e) => {
                            const next = [...participants];
                            next[i] = { ...next[i], externalName: e.target.value };
                            setParticipants(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {p.matchedUserId ? (
                          <Badge variant="default" className="text-xs gap-1">
                            <CheckCircle2 size={10} /> {p.matchedDisplayName}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Segnaposto</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={p.totalPoints || 0}
                          className="h-7 w-16 text-xs"
                          onChange={(e) => {
                            const next = [...participants];
                            next[i] = { ...next[i], totalPoints: parseFloat(e.target.value) || 0 };
                            setParticipants(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setParticipants(participants.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* STANDINGS TAB */}
          <TabsContent value="standings" className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="text-xs text-muted-foreground">
                Classifica finale. <strong>Punti torneo</strong> = 2 (partecipazione) + 4 × vittorie (escluse spareggio). Posizioni uniche tramite tiebreaker (OMW%, diff. game).
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1.5"
                onClick={() => {
                  const { standings: cs, participants: cp } = computeStagingStandings(participants, matchesData);
                  setStandings(cs);
                  setParticipants(cp);
                  toast({ title: "Classifica ricalcolata", description: `${cs.length} giocatori. Salva per confermare.` });
                }}
              >
                Ricalcola da match
              </Button>
            </div>
            <div className="border border-border rounded max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Pos</TableHead>
                    <TableHead>Giocatore</TableHead>
                    <TableHead className="w-16 text-center">V</TableHead>
                    <TableHead className="w-16 text-center">S</TableHead>
                    <TableHead className="w-20 text-center">OMW%</TableHead>
                    <TableHead className="w-20 text-center">Diff</TableHead>
                    <TableHead className="w-20">Punti</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((s: any, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          type="number"
                          value={s.position || (i + 1)}
                          className="h-7 w-12"
                          onChange={(e) => {
                            const next = [...standings];
                            next[i] = { ...next[i], position: parseInt(e.target.value) || 1 };
                            setStandings(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.matchedDisplayName || s.externalName}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">{s.wins ?? "—"}</TableCell>
                      <TableCell className="text-center text-xs font-mono text-muted-foreground">{s.losses ?? "—"}</TableCell>
                      <TableCell className="text-center text-xs font-mono text-muted-foreground">{s.omwPercent != null ? `${s.omwPercent}%` : "—"}</TableCell>
                      <TableCell className="text-center text-xs font-mono text-muted-foreground">{s.gameDiff ?? "—"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={s.totalPoints || 0}
                          className="h-7 w-16 text-xs"
                          onChange={(e) => {
                            const next = [...standings];
                            next[i] = { ...next[i], totalPoints: parseFloat(e.target.value) || 0 };
                            setStandings(next);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* MATCHES TAB */}
          <TabsContent value="matches" className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="text-xs text-muted-foreground">
                Match importati raggruppati per stage e round.{" "}
                <span className="text-foreground">
                  {matchesData.filter((m) => m.score1 != null || m.score2 != null).length}/{matchesData.length} con punteggio
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1.5"
                onClick={async () => {
                  const { data, error } = await supabase
                    .from("imported_tournaments_staging" as any)
                    .select("raw_data")
                    .eq("id", row.id)
                    .maybeSingle();
                  if (error || !data) {
                    toast({ title: "Errore caricamento raw_data", description: error?.message, variant: "destructive" });
                    return;
                  }
                  const { reprocessChallengerMatches } = await import("@/lib/reprocessChallengerMatches");
                  const fresh = reprocessChallengerMatches((data as any).raw_data);
                  if (fresh.length === 0) {
                    toast({ title: "Nessun match estratto dal raw data", variant: "destructive" });
                    return;
                  }
                  setMatchesData(fresh);
                  const withScore = fresh.filter((m) => m.score1 != null || m.score2 != null).length;
                  toast({
                    title: "Match riprocessati",
                    description: `${fresh.length} match · ${withScore} con punteggio. Salva per confermare.`,
                  });
                }}
              >
                <Loader2 size={11} className="animate-none" />
                Riprocessa dal raw data
              </Button>
            </div>
            <div className="border border-border rounded max-h-96 overflow-auto">
              {matchesData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nessun match registrato.
                </p>
              ) : (
                (() => {
                  const groups = new Map<string, Map<string, any[]>>();
                  matchesData.forEach((m) => {
                    const stageKey = m.stage != null ? `Stage ${m.stage}` : (m.bracket || "Match");
                    const roundKey = m.round != null ? `Round ${m.round}` : (m.group != null ? `Girone ${m.group}` : "—");
                    if (!groups.has(stageKey)) groups.set(stageKey, new Map());
                    const sg = groups.get(stageKey)!;
                    if (!sg.has(roundKey)) sg.set(roundKey, []);
                    sg.get(roundKey)!.push(m);
                  });
                  return (
                    <div className="divide-y divide-border">
                      {Array.from(groups.entries()).map(([stageKey, rounds]) => {
                        const stageTotal = Array.from(rounds.values()).reduce((a, arr) => a + arr.length, 0);
                        return (
                          <div key={stageKey}>
                            <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold sticky top-0 z-10">
                              {stageKey} <span className="text-muted-foreground font-normal">({stageTotal} match)</span>
                            </div>
                            {Array.from(rounds.entries()).map(([roundKey, list]) => (
                              <div key={roundKey}>
                                <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground bg-muted/20 border-t border-border">
                                  {roundKey} · {list.length} match
                                </div>
                                <div className="divide-y divide-border/50">
                                  {list.map((m, i) => {
                                    const p1 = m.team1Name || m.player1 || "-";
                                    const p2 = m.team2Name || m.player2 || "-";
                                    const s1 = m.score1 ?? null;
                                    const s2 = m.score2 ?? null;
                                    const hasScore = s1 != null || s2 != null;
                                    const score = hasScore ? `${s1 ?? "-"} - ${s2 ?? "-"}` : "—";
                                    const winnerName = m.winnerName;
                                    return (
                                      <div key={i} className="p-2.5 text-xs space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[10px] text-muted-foreground truncate">{m.seriesTitle || `Match ${i + 1}`}</span>
                                          <span className={`font-mono font-semibold ${!hasScore ? "text-muted-foreground" : ""}`}>{score}</span>
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={`flex-1 min-w-0 truncate ${winnerName === p1 ? "font-semibold text-primary" : ""}`}>{p1}</span>
                                          <span className="text-muted-foreground shrink-0">vs</span>
                                          <span className={`flex-1 min-w-0 truncate text-right ${winnerName === p2 ? "font-semibold text-primary" : ""}`}>{p2}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </TabsContent>

          {/* PREVIEW TAB */}
          <TabsContent value="preview" className="mt-4">
            <StagingPreviewTab
              participants={participants}
              standings={standings}
              matches={matchesData}
              onMatchesChange={setMatchesData}
              onStandingsChange={setStandings}
            />
          </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-4 py-3 border-t border-border bg-muted/20 shrink-0 flex flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salva modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportedTournamentsStagingTab;
