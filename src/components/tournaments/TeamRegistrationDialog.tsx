import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, X, Users, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  teamMode: "teams" | "clubs";
  clubId?: string | null;
  onTeamCreated: () => void;
}

interface SearchResult {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export const TeamRegistrationDialog = ({ open, onOpenChange, tournamentId, teamMode, clubId, onTeamCreated }: Props) => {
  const { user } = useAuth();
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingTeamUserIds, setExistingTeamUserIds] = useState<Set<string>>(new Set());
  const [clubMembers, setClubMembers] = useState<SearchResult[]>([]);

  // Auto-add creator as team leader when dialog opens
  useEffect(() => {
    if (!open || !user) return;
    const addCreator = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setMembers(prev => {
          if (prev.some(m => m.user_id === user.id)) return prev;
          return [data as SearchResult, ...prev];
        });
      }
    };
    addCreator();
  }, [open, user]);

  // Load existing team members for this tournament to prevent duplicates
  useEffect(() => {
    if (!open) return;
    const fetchExisting = async () => {
      const { data: teams } = await supabase
        .from("tournament_teams")
        .select("id")
        .eq("tournament_id", tournamentId);
      if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id);
        const { data: members } = await supabase
          .from("tournament_team_members")
          .select("user_id")
          .in("team_id", teamIds);
        setExistingTeamUserIds(new Set((members ?? []).map(m => m.user_id)));
      } else {
        setExistingTeamUserIds(new Set());
      }
    };
    fetchExisting();
  }, [open, tournamentId]);

  // For clubs mode, load club members
  useEffect(() => {
    if (!open || teamMode !== "clubs" || !clubId) return;
    const fetchClubMembers = async () => {
      const { data } = await supabase
        .from("club_members")
        .select("user_id")
        .eq("club_id", clubId);
      if (data) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds);
        setClubMembers((profiles as SearchResult[]) ?? []);
      }
    };
    fetchClubMembers();
  }, [open, teamMode, clubId]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);
    setSearchResults((data as SearchResult[]) ?? []);
    setSearching(false);
  };

  const addMember = (profile: SearchResult) => {
    if (members.length >= 4) {
      toast.error("Massimo 4 membri per squadra");
      return;
    }
    if (members.some(m => m.user_id === profile.user_id)) {
      toast.error("Giocatore già aggiunto");
      return;
    }
    if (existingTeamUserIds.has(profile.user_id)) {
      toast.error("Questo giocatore è già in una squadra per questo torneo");
      return;
    }
    setMembers(prev => [...prev, profile]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeMember = (userId: string) => {
    if (userId === user?.id) {
      toast.error("Non puoi rimuovere il team leader");
      return;
    }
    setMembers(prev => prev.filter(m => m.user_id !== userId));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!teamName.trim()) {
      toast.error("Inserisci il nome della squadra");
      return;
    }
    if (teamName.trim().length > 20) {
      toast.error("Il nome della squadra non può superare i 20 caratteri");
      return;
    }
    if (members.length < 3) {
      toast.error("Servono almeno 3 membri per creare una squadra");
      return;
    }
    if (members.length > 4) {
      toast.error("Massimo 4 membri per squadra");
      return;
    }

    setSubmitting(true);

    // Create team
    const { data: team, error: teamError } = await supabase
      .from("tournament_teams")
      .insert({
        tournament_id: tournamentId,
        team_name: teamName.trim(),
        club_id: teamMode === "clubs" ? clubId : null,
        created_by: user.id,
      } as any)
      .select("id")
      .single();

    if (teamError || !team) {
      toast.error("Errore nella creazione della squadra");
      setSubmitting(false);
      return;
    }

    // Add members
    const memberInserts = members.map(m => ({
      team_id: team.id,
      user_id: m.user_id,
    }));

    const { error: membersError } = await supabase
      .from("tournament_team_members")
      .insert(memberInserts as any);

    if (membersError) {
      toast.error("Errore nell'aggiunta dei membri. Alcuni potrebbero essere già in una squadra.");
      // Clean up team
      await supabase.from("tournament_teams").delete().eq("id", team.id);
      setSubmitting(false);
      return;
    }

    toast.success("Squadra creata con successo!");
    setTeamName("");
    setMembers([]);
    setSubmitting(false);
    onOpenChange(false);
    onTeamCreated();
  };

  const availableClubMembers = clubMembers.filter(
    m => !members.some(mem => mem.user_id === m.user_id) && !existingTeamUserIds.has(m.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {teamMode === "clubs" ? <Shield size={20} className="text-primary" /> : <Users size={20} className="text-primary" />}
            {teamMode === "clubs" ? "Iscrivi Team Club" : "Crea Squadra"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Team name */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Nome Squadra *</label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value.slice(0, 20))}
              placeholder="Nome della squadra"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground mt-1">{teamName.length}/20 caratteri</p>
          </div>

          {/* Members */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Membri ({members.length}/4) — minimo 3
            </label>

            {/* Current members */}
            {members.length > 0 && (
              <div className="space-y-2 mb-3">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 bg-secondary/30 rounded-xl p-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-secondary">
                        {(m.display_name || m.username || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{m.display_name || m.username}</span>
                        {m.user_id === user?.id && (
                          <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">LEADER</span>
                        )}
                      </div>
                      {m.username && <span className="text-[10px] text-muted-foreground">@{m.username}</span>}
                    </div>
                    {m.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeMember(m.user_id)}
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Search / Add members */}
            {members.length < 4 && (
              <>
                {teamMode === "teams" ? (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Cerca per username..."
                      className="pl-9"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {searchResults
                          .filter(r => !members.some(m => m.user_id === r.user_id) && r.user_id !== user?.id)
                          .map((r) => (
                            <button
                              key={r.user_id}
                              onClick={() => addMember(r)}
                              disabled={existingTeamUserIds.has(r.user_id)}
                              className="w-full flex items-center gap-2 p-2.5 hover:bg-secondary/50 transition-colors text-left disabled:opacity-50"
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
                              {existingTeamUserIds.has(r.user_id) && (
                                <span className="text-[9px] text-destructive ml-auto shrink-0">Già in squadra</span>
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                    {searching && <p className="text-xs text-muted-foreground mt-1">Ricerca...</p>}
                  </div>
                ) : (
                  /* Clubs mode: show club members list */
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded-xl">
                    {availableClubMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">Nessun membro disponibile</p>
                    ) : (
                      availableClubMembers.map((m) => (
                        <button
                          key={m.user_id}
                          onClick={() => addMember(m)}
                          className="w-full flex items-center gap-2 p-2.5 hover:bg-secondary/50 transition-colors text-left"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={m.avatar_url || undefined} />
                            <AvatarFallback className="text-[9px] bg-secondary">
                              {(m.display_name || m.username || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{m.display_name || m.username}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={submitting || !teamName.trim() || members.length < 3} className="w-full" variant="hero" size="lg">
            {submitting ? "Creazione..." : "Crea Squadra"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
