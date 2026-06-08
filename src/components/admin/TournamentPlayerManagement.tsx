import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Search, UserPlus, RefreshCw, ArrowLeftRight, Replace, Download, Upload, Trophy, Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TournamentPlayerManagementProps {
  tournamentId: string;
  tournamentTitle: string;
  onClose: () => void;
}

const TournamentPlayerManagement = ({ tournamentId, tournamentTitle, onClose }: TournamentPlayerManagementProps) => {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Replace player
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceOldUser, setReplaceOldUser] = useState<any>(null);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceNewUser, setReplaceNewUser] = useState<any>(null);
  const [replacing, setReplacing] = useState(false);

  // Add player
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addUser, setAddUser] = useState<any>(null);
  const [adding, setAdding] = useState(false);

  // Swap players in matches
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapMatch1, setSwapMatch1] = useState<any>(null);
  const [swapPlayer1, setSwapPlayer1] = useState<string>("");
  const [swapMatch2, setSwapMatch2] = useState<any>(null);
  const [swapPlayer2, setSwapPlayer2] = useState<string>("");
  const [swapping, setSwapping] = useState(false);

  // Resync
  const [resyncing, setResyncing] = useState(false);

  // Export/Import
  const [exporting, setExporting] = useState(false);

  // Edit match (set both players)
  const [editMatchOpen, setEditMatchOpen] = useState(false);
  const [editMatch, setEditMatch] = useState<any>(null);
  const [editP1, setEditP1] = useState<string>(""); // user_id or "" for BYE
  const [editP2, setEditP2] = useState<string>("");
  const [editP1Search, setEditP1Search] = useState("");
  const [editP2Search, setEditP2Search] = useState("");
  const [editingMatch, setEditingMatch] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: regs }, { data: matchData }, profilesData] = await Promise.all([
      supabase.from("tournament_registrations").select("*, profiles:user_id(username, display_name, avatar_url)").eq("tournament_id", tournamentId),
      supabase.from("tournament_matches").select("*").eq("tournament_id", tournamentId).order("round").order("match_number"),
      fetchAllProfiles(),
    ]);
    setRegistrations(regs ?? []);
    setMatches(matchData ?? []);
    setAllProfiles(profilesData);
    setLoading(false);
  };

  const fetchAllProfiles = async () => {
    const pageSize = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  useEffect(() => { fetchData(); }, [tournamentId]);

  const profileMap = useMemo(() => {
    const m: Record<string, any> = {};
    allProfiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [allProfiles]);

  const getPlayerName = (userId: string | null) => {
    if (!userId) return "BYE";
    const p = profileMap[userId];
    return p ? (p.display_name || p.username || userId.slice(0, 8)) : userId.slice(0, 8);
  };

  const registeredUserIds = new Set(registrations.map(r => r.user_id));

  // Replace player
  const replaceResults = useMemo(() => {
    if (!replaceSearch.trim()) return [];
    const s = replaceSearch.toLowerCase();
    return allProfiles.filter(p =>
      !registeredUserIds.has(p.user_id) &&
      (p.username?.toLowerCase().includes(s) || p.display_name?.toLowerCase().includes(s) || p.user_id.toLowerCase().includes(s))
    ).slice(0, 10);
  }, [allProfiles, replaceSearch, registeredUserIds]);

  const handleReplace = async () => {
    if (!replaceOldUser || !replaceNewUser) return;
    setReplacing(true);
    const { error } = await supabase.rpc("admin_replace_tournament_player" as any, {
      _tournament_id: tournamentId,
      _old_user_id: replaceOldUser.user_id,
      _new_user_id: replaceNewUser.user_id,
    });
    setReplacing(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Giocatore sostituito!" });
      setReplaceOpen(false);
      fetchData();
    }
  };

  // Add player
  const addResults = useMemo(() => {
    if (!addSearch.trim()) return [];
    const s = addSearch.toLowerCase();
    return allProfiles.filter(p =>
      !registeredUserIds.has(p.user_id) &&
      (p.username?.toLowerCase().includes(s) || p.display_name?.toLowerCase().includes(s))
    ).slice(0, 10);
  }, [allProfiles, addSearch, registeredUserIds]);

  const handleAdd = async () => {
    if (!addUser) return;
    setAdding(true);
    const { error } = await supabase.rpc("admin_register_player" as any, {
      _tournament_id: tournamentId,
      _user_id: addUser.user_id,
    });
    setAdding(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Giocatore iscritto!" });
      setAddOpen(false);
      setAddUser(null);
      setAddSearch("");
      fetchData();
    }
  };

  // Swap match players
  const pendingMatches = matches.filter(m => m.status === "pending" || m.status === "in_progress");

  const handleSwap = async () => {
    if (!swapMatch1 || !swapMatch2 || !swapPlayer1 || !swapPlayer2) return;
    setSwapping(true);
    const { error } = await supabase.rpc("admin_swap_match_players" as any, {
      _tournament_id: tournamentId,
      _match1_id: swapMatch1.id,
      _player1_id: swapPlayer1,
      _match2_id: swapMatch2.id,
      _player2_id: swapPlayer2,
    });
    setSwapping(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Giocatori scambiati!" });
      setSwapOpen(false);
      fetchData();
    }
  };

  // Resync tournament
  const handleResync = async () => {
    setResyncing(true);
    const { data, error } = await supabase.rpc("admin_resync_tournament" as any, { _tournament_id: tournamentId });
    setResyncing(false);
    if (error) {
      toast({ title: "Errore resync", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Torneo risincronizzato con la classifica!" });
      fetchData();
    }
  };

  // Export tournament
  const handleExport = async () => {
    setExporting(true);
    const [{ data: tourney }, { data: regs }, { data: standings }, { data: matchesAll }, { data: results }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      supabase.from("tournament_registrations").select("*").eq("tournament_id", tournamentId),
      supabase.from("tournament_standings").select("*").eq("tournament_id", tournamentId),
      supabase.from("tournament_matches").select("*").eq("tournament_id", tournamentId),
      supabase.from("tournament_results").select("*").eq("tournament_id", tournamentId),
    ]);
    const exportData = { tournament: tourney, registrations: regs, standings, matches: matchesAll, results, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tournament_${tournamentId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast({ title: "Torneo esportato!" });
  };

  // Edit match players (emergency editor)
  const editP1Results = useMemo(() => {
    const s = editP1Search.trim().toLowerCase();
    if (!s) return [];
    return allProfiles.filter(p =>
      p.user_id !== editP2 &&
      (p.username?.toLowerCase().includes(s) || p.display_name?.toLowerCase().includes(s))
    ).slice(0, 8);
  }, [allProfiles, editP1Search, editP2]);

  const editP2Results = useMemo(() => {
    const s = editP2Search.trim().toLowerCase();
    if (!s) return [];
    return allProfiles.filter(p =>
      p.user_id !== editP1 &&
      (p.username?.toLowerCase().includes(s) || p.display_name?.toLowerCase().includes(s))
    ).slice(0, 8);
  }, [allProfiles, editP2Search, editP1]);

  const handleEditMatch = async () => {
    if (!editMatch) return;
    setEditingMatch(true);
    const { error } = await supabase.rpc("admin_set_match_players" as any, {
      _match_id: editMatch.id,
      _player1_id: editP1 || null,
      _player2_id: editP2 || null,
    });
    setEditingMatch(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Match aggiornato" });
      setEditMatchOpen(false);
      fetchData();
    }
  };

  if (loading) return <p className="text-muted-foreground p-4">Caricamento...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">{tournamentTitle}</h3>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><UserPlus size={14} className="mr-1" /> Iscrivi Giocatore</Button>
          <Button size="sm" variant="outline" onClick={() => setSwapOpen(true)}><ArrowLeftRight size={14} className="mr-1" /> Scambia Match</Button>
          <Button size="sm" variant="outline" onClick={handleResync} disabled={resyncing}><RefreshCw size={14} className="mr-1" /> {resyncing ? "Resync..." : "Resync Classifica"}</Button>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}><Download size={14} className="mr-1" /> Esporta</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Chiudi</Button>
        </div>
      </div>

      {/* Registrations */}
      <Card className="bg-secondary/30">
        <CardHeader className="py-3"><CardTitle className="text-sm">Iscritti ({registrations.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {registrations.map((r: any) => {
              const profile = r.profiles || profileMap[r.user_id];
              return (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded border border-border bg-background">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url || ""} />
                    <AvatarFallback>{(profile?.display_name || profile?.username || "?")[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{profile?.display_name || profile?.username || r.user_id.slice(0, 8)}</div>
                    <div className="text-[10px] text-muted-foreground">@{profile?.username || "?"}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Sostituisci" onClick={() => {
                    setReplaceOldUser({ user_id: r.user_id, ...profile });
                    setReplaceNewUser(null);
                    setReplaceSearch("");
                    setReplaceOpen(true);
                  }}>
                    <Replace size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Matches overview */}
      <Card className="bg-secondary/30">
        <CardHeader className="py-3"><CardTitle className="text-sm">Match ({matches.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-96 overflow-auto">
            {matches.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs p-1.5 rounded border border-border">
                <Badge variant="outline" className="text-[9px] w-14 justify-center">{m.phase} R{m.round}</Badge>
                <span className={m.winner_id === m.player1_id ? "font-bold" : ""}>{getPlayerName(m.player1_id)}</span>
                <span className="text-muted-foreground">{m.player1_score ?? 0} - {m.player2_score ?? 0}</span>
                <span className={m.winner_id === m.player2_id ? "font-bold" : ""}>{getPlayerName(m.player2_id)}</span>
                <Badge variant={m.status === "completed" ? "default" : "outline"} className="text-[9px] ml-auto">{m.status}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  title="Modifica giocatori del match"
                  onClick={() => {
                    setEditMatch(m);
                    setEditP1(m.player1_id ?? "");
                    setEditP2(m.player2_id ?? "");
                    setEditP1Search("");
                    setEditP2Search("");
                    setEditMatchOpen(true);
                  }}
                >
                  <Pencil size={12} />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Replace Dialog */}
      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sostituisci Giocatore</DialogTitle></DialogHeader>
          {replaceOldUser && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Giocatore attuale</Label>
                <div className="p-2 rounded border bg-destructive/5 border-destructive/30 mt-1 text-sm">
                  {replaceOldUser.display_name || replaceOldUser.username || replaceOldUser.user_id.slice(0, 8)}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nuovo giocatore</Label>
                <Input placeholder="Cerca username o nome..." value={replaceSearch} onChange={e => setReplaceSearch(e.target.value)} className="mt-1" />
                {replaceResults.length > 0 && !replaceNewUser && (
                  <div className="mt-1 border rounded max-h-40 overflow-auto">
                    {replaceResults.map(p => (
                      <button key={p.user_id} className="w-full flex items-center gap-2 p-2 hover:bg-secondary/50 text-left text-sm" onClick={() => { setReplaceNewUser(p); setReplaceSearch(""); }}>
                        {p.display_name || p.username} <span className="text-muted-foreground text-xs">@{p.username}</span>
                      </button>
                    ))}
                  </div>
                )}
                {replaceNewUser && (
                  <div className="p-2 rounded border bg-primary/5 border-primary/30 mt-1 text-sm flex items-center justify-between">
                    <span>{replaceNewUser.display_name || replaceNewUser.username}</span>
                    <Button variant="ghost" size="sm" onClick={() => setReplaceNewUser(null)}>Cambia</Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceOpen(false)}>Annulla</Button>
            <Button onClick={handleReplace} disabled={!replaceNewUser || replacing}>{replacing ? "Sostituzione..." : "Sostituisci"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Player Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Iscrivi Giocatore Manualmente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Cerca username o nome..." value={addSearch} onChange={e => setAddSearch(e.target.value)} />
            {addResults.length > 0 && !addUser && (
              <div className="border rounded max-h-40 overflow-auto">
                {addResults.map(p => (
                  <button key={p.user_id} className="w-full flex items-center gap-2 p-2 hover:bg-secondary/50 text-left text-sm" onClick={() => { setAddUser(p); setAddSearch(""); }}>
                    {p.display_name || p.username} <span className="text-muted-foreground text-xs">@{p.username}</span>
                  </button>
                ))}
              </div>
            )}
            {addUser && (
              <div className="p-2 rounded border bg-primary/5 border-primary/30 text-sm flex items-center justify-between">
                <span>{addUser.display_name || addUser.username}</span>
                <Button variant="ghost" size="sm" onClick={() => setAddUser(null)}>Cambia</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} disabled={!addUser || adding}>{adding ? "Iscrizione..." : "Iscrivi"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Dialog */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Scambia Giocatori tra Match</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Match 1</Label>
              <Select value={swapMatch1?.id || ""} onValueChange={v => { setSwapMatch1(pendingMatches.find(m => m.id === v)); setSwapPlayer1(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleziona match" /></SelectTrigger>
                <SelectContent>
                  {pendingMatches.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.phase} R{m.round} M{m.match_number}: {getPlayerName(m.player1_id)} vs {getPlayerName(m.player2_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {swapMatch1 && (
                <Select value={swapPlayer1} onValueChange={setSwapPlayer1}>
                  <SelectTrigger><SelectValue placeholder="Giocatore da spostare" /></SelectTrigger>
                  <SelectContent>
                    {swapMatch1.player1_id && <SelectItem value={swapMatch1.player1_id}>{getPlayerName(swapMatch1.player1_id)}</SelectItem>}
                    {swapMatch1.player2_id && <SelectItem value={swapMatch1.player2_id}>{getPlayerName(swapMatch1.player2_id)}</SelectItem>}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex justify-center"><ArrowLeftRight size={20} className="text-muted-foreground" /></div>
            <div className="space-y-2">
              <Label>Match 2</Label>
              <Select value={swapMatch2?.id || ""} onValueChange={v => { setSwapMatch2(pendingMatches.find(m => m.id === v)); setSwapPlayer2(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleziona match" /></SelectTrigger>
                <SelectContent>
                  {pendingMatches.filter(m => m.id !== swapMatch1?.id).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.phase} R{m.round} M{m.match_number}: {getPlayerName(m.player1_id)} vs {getPlayerName(m.player2_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {swapMatch2 && (
                <Select value={swapPlayer2} onValueChange={setSwapPlayer2}>
                  <SelectTrigger><SelectValue placeholder="Giocatore da scambiare" /></SelectTrigger>
                  <SelectContent>
                    {swapMatch2.player1_id && <SelectItem value={swapMatch2.player1_id}>{getPlayerName(swapMatch2.player1_id)}</SelectItem>}
                    {swapMatch2.player2_id && <SelectItem value={swapMatch2.player2_id}>{getPlayerName(swapMatch2.player2_id)}</SelectItem>}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapOpen(false)}>Annulla</Button>
            <Button onClick={handleSwap} disabled={!swapPlayer1 || !swapPlayer2 || swapping}>{swapping ? "Scambio..." : "Scambia"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Match Dialog (emergency editor) */}
      <Dialog open={editMatchOpen} onOpenChange={setEditMatchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifica giocatori del match</DialogTitle>
          </DialogHeader>
          {editMatch && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                {editMatch.phase} · Round {editMatch.round} · Match {editMatch.match_number}
                <div className="mt-1 text-amber-500">
                  ⚠ Modifica d'emergenza: l'esito attuale verrà resettato (status → pending).
                </div>
              </div>

              {/* Player 1 */}
              <div className="space-y-1">
                <Label className="text-xs">Player 1 (vuoto = BYE)</Label>
                <div className="text-sm p-2 border rounded bg-secondary/30">
                  {editP1 ? getPlayerName(editP1) : <span className="text-muted-foreground italic">BYE</span>}
                  {editP1 && (
                    <Button variant="ghost" size="sm" className="ml-2 h-6" onClick={() => setEditP1("")}>
                      Rimuovi
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Cerca per username o nome..."
                  value={editP1Search}
                  onChange={e => setEditP1Search(e.target.value)}
                />
                {editP1Results.length > 0 && (
                  <div className="border rounded max-h-32 overflow-auto">
                    {editP1Results.map(p => (
                      <button
                        key={p.user_id}
                        type="button"
                        className="w-full text-left p-1.5 text-xs hover:bg-secondary/50"
                        onClick={() => { setEditP1(p.user_id); setEditP1Search(""); }}
                      >
                        {p.display_name || p.username} <span className="text-muted-foreground">@{p.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Player 2 */}
              <div className="space-y-1">
                <Label className="text-xs">Player 2 (vuoto = BYE)</Label>
                <div className="text-sm p-2 border rounded bg-secondary/30">
                  {editP2 ? getPlayerName(editP2) : <span className="text-muted-foreground italic">BYE</span>}
                  {editP2 && (
                    <Button variant="ghost" size="sm" className="ml-2 h-6" onClick={() => setEditP2("")}>
                      Rimuovi
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Cerca per username o nome..."
                  value={editP2Search}
                  onChange={e => setEditP2Search(e.target.value)}
                />
                {editP2Results.length > 0 && (
                  <div className="border rounded max-h-32 overflow-auto">
                    {editP2Results.map(p => (
                      <button
                        key={p.user_id}
                        type="button"
                        className="w-full text-left p-1.5 text-xs hover:bg-secondary/50"
                        onClick={() => { setEditP2(p.user_id); setEditP2Search(""); }}
                      >
                        {p.display_name || p.username} <span className="text-muted-foreground">@{p.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMatchOpen(false)}>Annulla</Button>
            <Button onClick={handleEditMatch} disabled={editingMatch}>
              {editingMatch ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TournamentPlayerManagement;
