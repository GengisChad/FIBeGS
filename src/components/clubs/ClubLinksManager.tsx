import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, Plus, Check, X, Trash2, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClubLink {
  id: string;
  requester_club_id: string;
  target_club_id: string;
  status: string;
  requested_by: string;
  created_at: string;
  requester_club?: { id: string; name: string; logo_url: string | null; city: string | null };
  target_club?: { id: string; name: string; logo_url: string | null; city: string | null };
}

interface Props {
  clubId: string;
  isLeader: boolean;
}

const ClubLinksManager = ({ clubId, isLeader }: Props) => {
  const { user } = useAuth();
  const [links, setLinks] = useState<ClubLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchLinks = useCallback(async () => {
    // Fetch links where this club is either requester or target
    const { data } = await supabase
      .from("club_links")
      .select("*")
      .or(`requester_club_id.eq.${clubId},target_club_id.eq.${clubId}`)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Fetch club details for all related clubs
      const clubIds = new Set<string>();
      (data as any[]).forEach((l) => {
        clubIds.add(l.requester_club_id);
        clubIds.add(l.target_club_id);
      });

      const { data: clubs } = await supabase
        .from("clubs")
        .select("id, name, logo_url, city")
        .in("id", Array.from(clubIds));

      const clubMap = new Map((clubs ?? []).map((c: any) => [c.id, c]));

      setLinks(
        (data as any[]).map((l) => ({
          ...l,
          requester_club: clubMap.get(l.requester_club_id),
          target_club: clubMap.get(l.target_club_id),
        }))
      );
    } else {
      setLinks([]);
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const searchClubs = async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("clubs")
      .select("id, name, logo_url, city")
      .neq("id", clubId)
      .ilike("name", `%${q.trim()}%`)
      .eq("is_active", true)
      .limit(10);
    setSearchResults(data ?? []);
    setSearching(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => searchClubs(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const sendRequest = async (targetId: string) => {
    if (!user) return;
    setSending(true);

    // Check if link already exists (in either direction)
    const existing = links.find(
      (l) =>
        (l.requester_club_id === clubId && l.target_club_id === targetId) ||
        (l.requester_club_id === targetId && l.target_club_id === clubId)
    );
    if (existing) {
      toast.error("Esiste già un collegamento o una richiesta con questo club");
      setSending(false);
      return;
    }

    const { error } = await supabase.from("club_links").insert({
      requester_club_id: clubId,
      target_club_id: targetId,
      requested_by: user.id,
    } as any);

    if (error) {
      toast.error(error.code === "23505" ? "Richiesta già inviata" : "Errore nell'invio della richiesta");
    } else {
      toast.success("Richiesta di collegamento inviata!");
      setShowRequest(false);
      setSearchQuery("");
      setSearchResults([]);
      fetchLinks();
    }
    setSending(false);
  };

  const respondToRequest = async (linkId: string, accept: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from("club_links")
      .update({ status: accept ? "accepted" : "rejected", responded_by: user.id } as any)
      .eq("id", linkId);
    if (error) {
      toast.error("Errore");
    } else {
      toast.success(accept ? "Collegamento accettato!" : "Richiesta rifiutata");
      fetchLinks();
    }
  };

  const removeLink = async (linkId: string) => {
    if (!window.confirm("Rimuovere questo collegamento? I membri dell'altro club non potranno più accedere ai vostri ordini.")) return;
    const { error } = await supabase.from("club_links").delete().eq("id", linkId);
    if (error) {
      toast.error("Errore nella rimozione");
    } else {
      toast.success("Collegamento rimosso");
      fetchLinks();
    }
  };

  const acceptedLinks = links.filter((l) => l.status === "accepted");
  const pendingIncoming = links.filter((l) => l.status === "pending" && l.target_club_id === clubId);
  const pendingOutgoing = links.filter((l) => l.status === "pending" && l.requester_club_id === clubId);

  const getOtherClub = (link: ClubLink) =>
    link.requester_club_id === clubId ? link.target_club : link.requester_club;

  const ClubAvatar = ({ club }: { club: any }) => (
    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 border border-border">
      {club?.logo_url ? (
        <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
      ) : (
        (club?.name || "?")[0].toUpperCase()
      )}
    </div>
  );

  if (loading) return <div className="text-sm text-muted-foreground">Caricamento collegamenti...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Link2 size={18} className="text-primary" />
          CLUB COLLEGATI
        </h3>
        {isLeader && (
          <Button size="sm" variant="outline" onClick={() => { setShowRequest(true); setSearchQuery(""); setSearchResults([]); }}>
            <Plus size={14} className="mr-1" /> Collega Club
          </Button>
        )}
      </div>

      {/* Pending incoming requests */}
      {pendingIncoming.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Richieste Ricevute</h4>
          {pendingIncoming.map((link) => {
            const other = getOtherClub(link);
            return (
              <div key={link.id} className="flex items-center justify-between bg-primary/5 rounded-xl border border-primary/20 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ClubAvatar club={other} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{other?.name}</p>
                    {other?.city && <p className="text-[10px] text-muted-foreground">{other.city}</p>}
                  </div>
                </div>
                {isLeader && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-500 hover:text-green-600 hover:bg-green-500/10" onClick={() => respondToRequest(link.id, true)}>
                      <Check size={16} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => respondToRequest(link.id, false)}>
                      <X size={16} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending outgoing */}
      {pendingOutgoing.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Richieste Inviate</h4>
          {pendingOutgoing.map((link) => {
            const other = getOtherClub(link);
            return (
              <div key={link.id} className="flex items-center justify-between bg-card rounded-xl border border-border p-3 opacity-70">
                <div className="flex items-center gap-2 min-w-0">
                  <ClubAvatar club={other} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{other?.name}</p>
                    <p className="text-[10px] text-muted-foreground">In attesa di risposta</p>
                  </div>
                </div>
                {isLeader && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeLink(link.id)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Active links */}
      {acceptedLinks.length > 0 ? (
        <div className="space-y-2">
          {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attivi</h4>
          )}
          {acceptedLinks.map((link) => {
            const other = getOtherClub(link);
            return (
              <div key={link.id} className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ClubAvatar club={other} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{other?.name}</p>
                    {other?.city && <p className="text-[10px] text-muted-foreground">{other.city}</p>}
                  </div>
                  <Badge variant="secondary" className="text-[9px] shrink-0">Collegato</Badge>
                </div>
                {isLeader && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeLink(link.id)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun club collegato. {isLeader && "Collega altri club per condividere gli ordini."}</p>
        )
      )}

      {/* Search & Request Dialog */}
      <Dialog open={showRequest} onOpenChange={setShowRequest}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 size={18} /> Collega un Club</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca club per nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {searching && (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin mr-2" /> Ricerca...
                </div>
              )}
              {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nessun club trovato</p>
              )}
              {searchResults.map((club) => {
                const alreadyLinked = links.some(
                  (l) =>
                    (l.requester_club_id === club.id || l.target_club_id === club.id) &&
                    l.status !== "rejected"
                );
                return (
                  <div
                    key={club.id}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-3",
                      alreadyLinked ? "border-border opacity-50" : "border-border hover:border-primary/30 transition-colors"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ClubAvatar club={club} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{club.name}</p>
                        {club.city && <p className="text-[10px] text-muted-foreground">{club.city}</p>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={alreadyLinked || sending}
                      onClick={() => sendRequest(club.id)}
                    >
                      {alreadyLinked ? "Già collegato" : "Invia Richiesta"}
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Il collegamento deve essere approvato dal Club Leader dell'altro club. Una volta accettato, i membri potranno accedere agli ordini reciproci.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClubLinksManager;
