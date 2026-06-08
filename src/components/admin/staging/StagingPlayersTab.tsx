import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2, Search, CheckCircle2, Link2, Users, X, Sparkles, Wand2,
} from "lucide-react";

interface AggregatedPlayer {
  externalName: string;
  platform: string;
  tournamentCount: number;
  matchedUserId: string | null;
  matchedDisplayName: string | null;
  isChild: boolean;
  stagingIds: string[];
}

interface Suggestion {
  id: string;
  name: string;
  isChild: boolean;
  score: number; // 0..1
}

interface StagingPlayersTabProps {
  rows: any[];
  onSyncDone: () => void;
}

export const StagingPlayersTab = ({ rows, onSyncDone }: StagingPlayersTabProps) => {
  const [filter, setFilter] = useState("");
  const [showOnlyUnmatched, setShowOnlyUnmatched] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [savedMappings, setSavedMappings] = useState<Map<string, { userId: string; displayName: string; isChild: boolean }>>(new Map());
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [suggestions, setSuggestions] = useState<Map<string, Suggestion[]>>(new Map());

  // Cache di tutti gli utenti/bambini per fare matching fuzzy in locale (1 sola query)
  const allUsersRef = useMemo(() => ({ current: null as null | { id: string; name: string; username: string | null; isChild: boolean }[] }), []);

  // Load mappings to merge with staging data
  const loadMappings = useCallback(async () => {
    setLoadingMappings(true);
    const { data } = await supabase
      .from("external_player_mappings" as any)
      .select("external_username, platform, internal_user_id");
    const map = new Map<string, { userId: string; displayName: string; isChild: boolean }>();
    if (data) {
      const userIds = Array.from(new Set((data as any[]).map(d => d.internal_user_id).filter(Boolean)));
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name, username").in("user_id", userIds);
      const profMap = new Map((profs || []).map(p => [p.user_id, p.display_name || p.username || p.user_id]));
      (data as any[]).forEach(d => {
        if (d.internal_user_id) {
          map.set(`${d.platform}::${d.external_username.toLowerCase()}`, {
            userId: d.internal_user_id,
            displayName: profMap.get(d.internal_user_id) || d.internal_user_id,
            isChild: false,
          });
        }
      });
    }
    setSavedMappings(map);
    setLoadingMappings(false);
  }, []);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  // Aggregate players across all staging rows
  const aggregated: AggregatedPlayer[] = useMemo(() => {
    const map = new Map<string, AggregatedPlayer>();
    for (const row of rows) {
      const platform = row.source_platform;
      const participants = row.participants || [];
      for (const p of participants) {
        const name = (p.externalName || "").trim();
        if (!name) continue;
        const key = `${platform}::${name.toLowerCase()}`;
        const existing = map.get(key);
        const saved = savedMappings.get(key);
        const matchedUserId = p.matchedUserId || saved?.userId || null;
        const matchedDisplayName = p.matchedDisplayName || saved?.displayName || null;
        const isChild = !!p.isChild || !!saved?.isChild;
        if (existing) {
          existing.tournamentCount++;
          existing.stagingIds.push(row.id);
          if (matchedUserId && !existing.matchedUserId) {
            existing.matchedUserId = matchedUserId;
            existing.matchedDisplayName = matchedDisplayName;
            existing.isChild = isChild;
          }
        } else {
          map.set(key, {
            externalName: name,
            platform,
            tournamentCount: 1,
            matchedUserId,
            matchedDisplayName,
            isChild,
            stagingIds: [row.id],
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.tournamentCount - a.tournamentCount);
  }, [rows, savedMappings]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return aggregated.filter(p => {
      if (showOnlyUnmatched && p.matchedUserId) return false;
      if (f && !p.externalName.toLowerCase().includes(f) && !(p.matchedDisplayName || "").toLowerCase().includes(f)) return false;
      return true;
    });
  }, [aggregated, filter, showOnlyUnmatched]);

  const totalUnmatched = aggregated.filter(p => !p.matchedUserId).length;

  const syncPlayer = async (player: AggregatedPlayer, userId: string, displayName: string, isChild: boolean) => {
    // 1. Save mapping for future imports
    const { error: mapErr } = await supabase
      .from("external_player_mappings" as any)
      .upsert(
        { platform: player.platform, external_username: player.externalName, internal_user_id: userId },
        { onConflict: "platform,external_username" }
      );
    if (mapErr) {
      toast({ title: "Errore mapping", description: mapErr.message, variant: "destructive" });
      return;
    }

    // 2. Update all staging rows that contain this player
    const targetRows = rows.filter(r => player.stagingIds.includes(r.id));
    let updated = 0;
    for (const row of targetRows) {
      const newParticipants = (row.participants || []).map((p: any) => {
        if ((p.externalName || "").trim().toLowerCase() === player.externalName.toLowerCase()) {
          return { ...p, matchedUserId: userId, matchedDisplayName: displayName, isChild };
        }
        return p;
      });
      const newStandings = (row.standings || []).map((s: any) => {
        if ((s.externalName || "").trim().toLowerCase() === player.externalName.toLowerCase()) {
          return { ...s, matchedUserId: userId, matchedDisplayName: displayName, isChild };
        }
        return s;
      });
      const { error } = await supabase
        .from("imported_tournaments_staging" as any)
        .update({ participants: newParticipants, standings: newStandings })
        .eq("id", row.id);
      if (!error) updated++;
    }

    toast({
      title: "Giocatore sincronizzato",
      description: `"${player.externalName}" → ${displayName} in ${updated} tornei. Mapping salvato per import futuri.`,
    });
    await loadMappings();
    onSyncDone();
  };

  const unsyncPlayer = async (player: AggregatedPlayer) => {
    // Remove mapping
    await supabase
      .from("external_player_mappings" as any)
      .delete()
      .eq("platform", player.platform)
      .eq("external_username", player.externalName);

    // Clear from staging rows
    const targetRows = rows.filter(r => player.stagingIds.includes(r.id));
    for (const row of targetRows) {
      const newParticipants = (row.participants || []).map((p: any) => {
        if ((p.externalName || "").trim().toLowerCase() === player.externalName.toLowerCase()) {
          return { ...p, matchedUserId: null, matchedDisplayName: null, isChild: false };
        }
        return p;
      });
      const newStandings = (row.standings || []).map((s: any) => {
        if ((s.externalName || "").trim().toLowerCase() === player.externalName.toLowerCase()) {
          return { ...s, matchedUserId: null, matchedDisplayName: null, isChild: false };
        }
        return s;
      });
      await supabase
        .from("imported_tournaments_staging" as any)
        .update({ participants: newParticipants, standings: newStandings })
        .eq("id", row.id);
    }

    toast({ title: "Sync rimosso" });
    await loadMappings();
    onSyncDone();
  };

  // ───────────────────────────────────────────
  // Auto-suggest: ricerca fuzzy per tutti i non collegati
  // ───────────────────────────────────────────
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  // Levenshtein-based similarity 0..1
  const similarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const al = a.length, bl = b.length;
    if (Math.abs(al - bl) > Math.max(al, bl) * 0.6) return 0;
    const dp: number[] = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) dp[j] = j;
    for (let i = 1; i <= al; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= bl; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
        prev = tmp;
      }
    }
    return 1 - dp[bl] / Math.max(al, bl);
  };

  const runAutoSuggest = async () => {
    setSuggesting(true);
    try {
      // 1. Carica tutti gli utenti e bambini in cache
      if (!allUsersRef.current) {
        const [{ data: profs }, { data: kids }] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, username"),
          supabase.from("child_profiles").select("id, display_name"),
        ]);
        allUsersRef.current = [
          ...((profs || []).map(p => ({
            id: p.user_id,
            name: p.display_name || p.username || p.user_id,
            username: p.username,
            isChild: false,
          }))),
          ...((kids || []).map(k => ({
            id: k.id,
            name: k.display_name,
            username: null,
            isChild: true,
          }))),
        ];
      }
      const pool = allUsersRef.current!;
      const targets = aggregated.filter(p => !p.matchedUserId);
      const map = new Map<string, Suggestion[]>();
      for (const t of targets) {
        const tn = normalize(t.externalName);
        if (tn.length < 2) continue;
        const scored: Suggestion[] = [];
        for (const u of pool) {
          const candidates = [u.name, u.username].filter(Boolean) as string[];
          let best = 0;
          for (const c of candidates) {
            const cn = normalize(c);
            if (!cn) continue;
            const sim = cn === tn ? 1 :
              cn.includes(tn) || tn.includes(cn)
                ? Math.max(0.85, similarity(cn, tn))
                : similarity(cn, tn);
            if (sim > best) best = sim;
          }
          if (best >= 0.7) scored.push({ id: u.id, name: u.name, isChild: u.isChild, score: best });
        }
        scored.sort((a, b) => b.score - a.score);
        if (scored.length) map.set(`${t.platform}::${t.externalName.toLowerCase()}`, scored.slice(0, 3));
      }
      setSuggestions(map);
      const found = map.size;
      toast({
        title: "Suggerimenti aggiornati",
        description: `${found} su ${targets.length} non collegati hanno match potenziali.`,
      });
    } catch (e: any) {
      toast({ title: "Errore auto-suggest", description: e.message, variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  // Auto-sync di TUTTI i giocatori con un match esatto (100%) sul nome normalizzato
  const runAutoSync100 = async () => {
    setAutoSyncing(true);
    try {
      if (!allUsersRef.current) {
        const [{ data: profs }, { data: kids }] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, username"),
          supabase.from("child_profiles").select("id, display_name"),
        ]);
        allUsersRef.current = [
          ...((profs || []).map(p => ({
            id: p.user_id,
            name: p.display_name || p.username || p.user_id,
            username: p.username,
            isChild: false,
          }))),
          ...((kids || []).map(k => ({
            id: k.id,
            name: k.display_name,
            username: null,
            isChild: true,
          }))),
        ];
      }
      const pool = allUsersRef.current!;
      // Indicizza pool per chiave normalizzata; salta chiavi ambigue (più utenti stesso nome)
      const exactIndex = new Map<string, { id: string; name: string; isChild: boolean } | "AMBIGUOUS">();
      for (const u of pool) {
        for (const c of [u.name, u.username].filter(Boolean) as string[]) {
          const key = normalize(c);
          if (!key || key.length < 2) continue;
          const existing = exactIndex.get(key);
          if (!existing) exactIndex.set(key, { id: u.id, name: u.name, isChild: u.isChild });
          else if (existing !== "AMBIGUOUS" && existing.id !== u.id) exactIndex.set(key, "AMBIGUOUS");
        }
      }

      const targets = aggregated.filter(p => !p.matchedUserId);
      const matches: { player: AggregatedPlayer; user: { id: string; name: string; isChild: boolean } }[] = [];
      const ambiguous: string[] = [];
      for (const t of targets) {
        const key = normalize(t.externalName);
        if (!key) continue;
        const hit = exactIndex.get(key);
        if (!hit) continue;
        if (hit === "AMBIGUOUS") { ambiguous.push(t.externalName); continue; }
        matches.push({ player: t, user: hit });
      }

      if (matches.length === 0) {
        toast({
          title: "Nessun match al 100%",
          description: ambiguous.length
            ? `${ambiguous.length} nomi ambigui (più utenti con stesso nome) saltati.`
            : "Nessun giocatore non collegato corrisponde esattamente a un utente.",
        });
        return;
      }

      const ok = window.confirm(
        `Trovati ${matches.length} match esatti (100%). Sincronizzare tutti?` +
        (ambiguous.length ? `\n\n${ambiguous.length} nomi ambigui verranno saltati.` : "")
      );
      if (!ok) return;

      // 1. Bulk upsert mappings
      const mappingRows = matches.map(({ player, user }) => ({
        platform: player.platform,
        external_username: player.externalName,
        internal_user_id: user.id,
      }));
      const { error: mapErr } = await supabase
        .from("external_player_mappings" as any)
        .upsert(mappingRows, { onConflict: "platform,external_username" });
      if (mapErr) throw mapErr;

      // 2. Aggiorna le righe di staging che contengono almeno uno dei giocatori
      const matchByKey = new Map(matches.map(m => [
        `${m.player.platform}::${m.player.externalName.toLowerCase()}`,
        m.user,
      ]));
      const affectedRowIds = new Set<string>();
      matches.forEach(m => m.player.stagingIds.forEach(id => affectedRowIds.add(id)));
      const targetRows = rows.filter(r => affectedRowIds.has(r.id));

      let updatedRows = 0;
      for (const row of targetRows) {
        const platform = row.source_platform;
        const remap = (arr: any[]) => (arr || []).map((p: any) => {
          const k = `${platform}::${(p.externalName || "").trim().toLowerCase()}`;
          const u = matchByKey.get(k);
          if (!u) return p;
          return { ...p, matchedUserId: u.id, matchedDisplayName: u.name, isChild: u.isChild };
        });
        const { error } = await supabase
          .from("imported_tournaments_staging" as any)
          .update({
            participants: remap(row.participants || []),
            standings: remap(row.standings || []),
          })
          .eq("id", row.id);
        if (!error) updatedRows++;
      }

      toast({
        title: "Auto-sync completato",
        description: `${matches.length} giocatori sincronizzati su ${updatedRows} tornei.` +
          (ambiguous.length ? ` ${ambiguous.length} ambigui saltati.` : ""),
      });
      await loadMappings();
      onSyncDone();
    } catch (e: any) {
      toast({ title: "Errore auto-sync", description: e.message, variant: "destructive" });
    } finally {
      setAutoSyncing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <span className="text-sm font-medium">{aggregated.length} giocatori unici</span>
          <Badge variant="secondary" className="text-xs">{rows.length} tornei in staging</Badge>
          {totalUnmatched > 0 && (
            <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
              {totalUnmatched} non collegati
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setCleaning(true);
              const { data, error } = await supabase.functions.invoke("cleanup-staging-names");
              setCleaning(false);
              if (error) {
                toast({ title: "Errore pulizia", description: error.message, variant: "destructive" });
              } else {
                toast({
                  title: "Pulizia completata",
                  description: `${data?.updated || 0}/${data?.scanned || 0} tornei aggiornati.`,
                });
                onSyncDone();
              }
            }}
            disabled={cleaning}
            className="text-xs h-8 gap-1.5"
            title="Rimuove suffissi tipo &apos;s party dai nomi importati"
          >
            {cleaning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Pulisci nomi
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={runAutoSuggest}
            disabled={suggesting || aggregated.length === 0}
            className="text-xs h-8 gap-1.5"
            title="Cerca utenti del sito con nome simile per ogni giocatore non collegato"
          >
            {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            Auto-suggerisci
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={runAutoSync100}
            disabled={autoSyncing || aggregated.length === 0}
            className="text-xs h-8 gap-1.5"
            title="Sincronizza automaticamente tutti i giocatori il cui nome coincide al 100% con un utente esistente"
          >
            {autoSyncing ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
            Auto-sync 100%
          </Button>
          <Button
            variant={showOnlyUnmatched ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyUnmatched(v => !v)}
            className="text-xs h-8"
          >
            Solo non collegati
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca giocatore esterno o utente collegato..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      <div className="border border-border rounded-lg overflow-auto max-h-[600px]">
        {loadingMappings ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="inline animate-spin mr-2" size={14} /> Caricamento mapping...
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Nome esterno</TableHead>
                <TableHead className="hidden sm:table-cell">Piattaforma</TableHead>
                <TableHead className="text-center">Tornei</TableHead>
                <TableHead>Collegato a</TableHead>
                <TableHead className="text-right w-32">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                    Nessun giocatore corrisponde ai filtri.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={`${p.platform}::${p.externalName}`}>
                    <TableCell className="font-medium text-xs sm:text-sm break-all">
                      {p.externalName}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-[10px]">{p.platform}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">{p.tournamentCount}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.matchedUserId ? (
                        <Badge variant="default" className="text-xs gap-1 bg-primary/90">
                          <CheckCircle2 size={10} />
                          <span className="truncate max-w-[140px]">{p.matchedDisplayName}</span>
                          {p.isChild && <span className="text-[9px]">(Kid)</span>}
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="secondary" className="text-xs text-muted-foreground">Segnaposto</Badge>
                          {(suggestions.get(`${p.platform}::${p.externalName.toLowerCase()}`) || []).map(s => (
                            <button
                              key={`${s.isChild}-${s.id}`}
                              onClick={() => syncPlayer(p, s.id, s.name, s.isChild)}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-primary/40 bg-primary/5 hover:bg-primary/15 transition-colors flex items-center gap-1"
                              title={`Suggerito (${Math.round(s.score * 100)}% match) - clicca per sincronizzare`}
                            >
                              <Wand2 size={9} className="text-primary" />
                              <span className="truncate max-w-[100px]">{s.name}</span>
                              {s.isChild && <span className="text-[8px] opacity-70">Kid</span>}
                              <span className="text-[8px] opacity-70">{Math.round(s.score * 100)}%</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <UserSearchPopover
                          externalName={p.externalName}
                          onSelect={(uid, name, child) => syncPlayer(p, uid, name, child)}
                        />
                        {p.matchedUserId && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => unsyncPlayer(p)}
                            title="Rimuovi sync"
                          >
                            <X size={12} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────
// User search popover with auto-suggest
// ───────────────────────────────────────────
const UserSearchPopover = ({
  externalName,
  onSelect,
}: {
  externalName: string;
  onSelect: (userId: string, displayName: string, isChild: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; isChild: boolean; matchType?: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Pre-fill with externalName when opening, to show suggestions
  useEffect(() => {
    if (open) setSearch(externalName);
  }, [open, externalName]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const term = `%${q}%`;
    const [{ data: profiles }, { data: children }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, username")
        .or(`display_name.ilike.${term},username.ilike.${term}`).limit(10),
      supabase.from("child_profiles").select("id, display_name").ilike("display_name", term).limit(5),
    ]);
    const r: { id: string; name: string; isChild: boolean; matchType?: string }[] = [];
    const lq = q.toLowerCase();
    (profiles || []).forEach(p => {
      const name = p.display_name || p.username || p.user_id;
      const isExact = (p.username || "").toLowerCase() === lq || (p.display_name || "").toLowerCase() === lq;
      r.push({ id: p.user_id, name, isChild: false, matchType: isExact ? "exact" : "fuzzy" });
    });
    (children || []).forEach(c => {
      const isExact = c.display_name.toLowerCase() === lq;
      r.push({ id: c.id, name: c.display_name, isChild: true, matchType: isExact ? "exact" : "fuzzy" });
    });
    // Exact matches first
    r.sort((a, b) => (a.matchType === "exact" ? -1 : 0) - (b.matchType === "exact" ? -1 : 0));
    setResults(r);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 250);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs">
          <Link2 size={12} />
          <span className="hidden sm:inline">Sync</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <Input
          autoFocus
          placeholder="Cerca utente o bambino..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs mb-2"
        />
        {searching && (
          <p className="text-xs text-muted-foreground p-1 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" /> Ricerca...
          </p>
        )}
        <div className="max-h-56 overflow-auto space-y-0.5">
          {results.map(r => (
            <button
              key={`${r.isChild}-${r.id}`}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2"
              onClick={() => {
                onSelect(r.id, r.name, r.isChild);
                setOpen(false);
                setSearch("");
              }}
            >
              {r.matchType === "exact" && <CheckCircle2 size={10} className="text-primary shrink-0" />}
              <span className="truncate flex-1">{r.name}</span>
              {r.isChild && <Badge variant="outline" className="text-[9px] py-0">Kid</Badge>}
            </button>
          ))}
          {!searching && search.length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground p-1">Nessun risultato.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
