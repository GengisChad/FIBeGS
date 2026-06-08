import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Check, X, Clock, Search, UserPlus, CheckCircle, XCircle, Trash2, MessageSquare } from "lucide-react";
import { RegionalChatDialog } from "@/components/regional/RegionalChatDialog";
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

interface Invite {
  id: string;
  request_id: string;
  status: string;
  club_request: {
    id: string;
    club_name: string;
    city: string | null;
    user_id: string;
    status: string;
  };
  requester_name: string;
}

interface PendingRequest {
  id: string;
  club_name: string;
  city: string | null;
  status: string;
  invites: {
    id: string;
    user_id: string;
    status: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  }[];
}

interface SearchResult {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface ClubInviteBannerProps {
  /** If true, hides the "my pending request" section (user already belongs to a club) */
  hasClub?: boolean;
}

export const ClubInviteBanner = ({ hasClub = false }: ClubInviteBannerProps) => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [myRequest, setMyRequest] = useState<PendingRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestChannelId, setRequestChannelId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const fetchInvites = async () => {
    if (!user) return;

    // Fetch invites addressed to me
    const { data: rawData } = await supabase
      .from("club_request_invites")
      .select("id, request_id, status")
      .eq("user_id", user.id)
      .eq("status", "pending");

    const data = rawData as any[];
    if (data && data.length > 0) {
      const requestIds: string[] = data.map(d => d.request_id);
      const { data: requests } = await supabase
        .from("club_requests")
        .select("id, club_name, city, user_id, status")
        .in("id", requestIds);
      const requestMap = new Map((requests || []).map((r: any) => [r.id, r]));

      const requestUserIds: string[] = [...new Set((requests || []).map((r: any) => String(r.user_id)))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", requestUserIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name || p.username || "Utente"]));

      setInvites(data.filter((d: any) => requestMap.has(d.request_id)).map((d: any) => {
        const req = requestMap.get(d.request_id);
        return {
          id: d.id,
          request_id: d.request_id,
          status: d.status,
          club_request: req,
          requester_name: profileMap.get(req.user_id) || "Utente",
        };
      }));
    } else {
      setInvites([]);
    }

    // Fetch my pending club request
    const { data: myReqs } = await supabase
      .from("club_requests")
      .select("id, club_name, city, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(1);

    if (myReqs && myReqs.length > 0) {
      const req = myReqs[0];
      // Fetch invites for this request
      const { data: reqInvites } = await supabase
        .from("club_request_invites")
        .select("id, user_id, status")
        .eq("request_id", req.id);

      const inviteData = (reqInvites as any[]) || [];
      const userIds: string[] = inviteData.map(i => i.user_id);

      let profilesMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", userIds);
        profilesMap = new Map((ps || []).map((p: any) => [p.user_id, p]));
      }

      setMyRequest({
        id: req.id,
        club_name: req.club_name,
        city: req.city,
        status: req.status,
        invites: inviteData.map(i => {
          const p = profilesMap.get(i.user_id);
          return {
            id: i.id,
            user_id: i.user_id,
            status: i.status,
            display_name: p?.display_name || p?.username || "Utente",
            username: p?.username || null,
            avatar_url: p?.avatar_url || null,
          };
        }),
      });

      // Fetch the regional chat channel for this request (created by trigger)
      const { data: ch } = await (supabase as any)
        .from("regional_channels")
        .select("id")
        .eq("club_request_id", req.id)
        .maybeSingle();
      setRequestChannelId(ch?.id ?? null);
    } else {
      setMyRequest(null);
      setRequestChannelId(null);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, [user]);

  const handleResponse = async (inviteId: string, accept: boolean) => {
    setLoading(true);
    const { error } = await supabase
      .from("club_request_invites")
      .update({ status: accept ? "accepted" : "rejected" } as any)
      .eq("id", inviteId);

    if (error) {
      toast.error("Errore nell'aggiornamento dell'invito");
    } else {
      toast.success(accept ? "Invito accettato!" : "Invito rifiutato");
      fetchInvites();
    }
    setLoading(false);
  };

  const handleCancelRequest = async () => {
    if (!myRequest) return;
    setLoading(true);
    await supabase.from("club_request_invites").delete().eq("request_id", myRequest.id);
    const { error, count } = await supabase
      .from("club_requests")
      .delete({ count: "exact" })
      .eq("id", myRequest.id);
    if (error) {
      toast.error("Errore: " + error.message);
    } else if (!count) {
      toast.error("Impossibile annullare: non hai i permessi su questa richiesta.");
    } else {
      toast.success("Richiesta annullata");
      fetchInvites();
    }
    setLoading(false);
  };

  const handleMemberSearch = async (query: string) => {
    setMemberSearch(query);
    if (query.length < 2) {
      setMemberResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);
    setMemberResults((data as SearchResult[]) ?? []);
    setSearching(false);
  };

  const addNewInvite = async (profile: SearchResult) => {
    if (!myRequest || !user) return;
    if (profile.user_id === user.id) {
      toast.error("Sei già il leader del club");
      return;
    }
    if (myRequest.invites.some(i => i.user_id === profile.user_id)) {
      toast.error("Giocatore già invitato");
      return;
    }

    setAddingMember(true);
    const { error } = await supabase
      .from("club_request_invites")
      .insert({ request_id: myRequest.id, user_id: profile.user_id } as any);

    if (error) {
      toast.error("Errore nell'invio dell'invito");
    } else {
      // Send notification
      await supabase.from("notifications").insert({
        user_id: profile.user_id,
        type: "club_invite",
        title: "Invito Club",
        message: `Sei stato invitato a far parte del nuovo club "${myRequest.club_name}" come membro fondatore.`,
        link: "/clubs",
      });
      // Trigger push delivery on-demand (no cron needed)
      supabase.functions.invoke("auto-push-notification").catch((e) => {
        console.warn("Push trigger failed:", e?.message);
      });
      toast.success("Invito inviato!");
      setMemberSearch("");
      setMemberResults([]);
      fetchInvites();
    }
    setAddingMember(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "accepted": return <CheckCircle size={14} className="text-green-500" />;
      case "rejected": return <XCircle size={14} className="text-destructive" />;
      default: return <Clock size={14} className="text-yellow-500" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "accepted": return "Accettato";
      case "rejected": return "Rifiutato";
      default: return "In attesa";
    }
  };

  const acceptedCount = myRequest?.invites.filter(i => i.status === "accepted").length || 0;
  const pendingCount = myRequest?.invites.filter(i => i.status === "pending").length || 0;
  const rejectedCount = myRequest?.invites.filter(i => i.status === "rejected").length || 0;
  const needsMore = acceptedCount < 7;

  return (
    <div className="space-y-3">
      {/* My pending club request — hidden if user already belongs to a club */}
      {!hasClub && myRequest && (
        <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                Richiesta Club: "{myRequest.club_name}"
              </p>
              <p className="text-xs text-muted-foreground">
                {myRequest.city && `${myRequest.city} · `}
                In attesa di approvazione
                {needsMore && ` · Servono ancora ${7 - acceptedCount} accettazioni`}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-green-500 font-semibold">{acceptedCount}✓</span>
              {pendingCount > 0 && <span className="text-yellow-500 font-semibold">{pendingCount}⏳</span>}
              {rejectedCount > 0 && <span className="text-destructive font-semibold">{rejectedCount}✗</span>}
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 shrink-0"
                  disabled={loading}
                >
                  <Trash2 size={14} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Annullare la richiesta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La richiesta per il club "{myRequest.club_name}" verrà eliminata insieme a tutti gli inviti inviati. Questa azione non può essere annullata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Indietro</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelRequest}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Annulla richiesta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Invited members list */}
          <div className="space-y-1.5">
            {myRequest.invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 bg-secondary/20 rounded-lg p-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={inv.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px] bg-secondary">
                    {(inv.display_name || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{inv.display_name}</span>
                  {inv.username && <span className="text-[10px] text-muted-foreground">@{inv.username}</span>}
                </div>
                <div className="flex items-center gap-1 text-xs shrink-0">
                  {statusIcon(inv.status)}
                  <span className="text-muted-foreground">{statusLabel(inv.status)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Add more members (especially if someone rejected) */}
          {needsMore && (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <UserPlus size={12} />
                {rejectedCount > 0
                  ? "Qualcuno ha rifiutato. Invita altri giocatori per raggiungere 7 accettazioni."
                  : "Invita altri giocatori per raggiungere 7 accettazioni."}
              </p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={memberSearch}
                  onChange={(e) => handleMemberSearch(e.target.value)}
                  placeholder="Cerca per username..."
                  className="pl-9"
                  disabled={addingMember}
                />
                {memberResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {memberResults
                      .filter(r => r.user_id !== user?.id && !myRequest.invites.some(i => i.user_id === r.user_id))
                      .map((r) => (
                        <button
                          key={r.user_id}
                          onClick={() => addNewInvite(r)}
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
                {searching && <p className="text-xs text-muted-foreground mt-1">Ricerca...</p>}
              </div>
            </div>
          )}

          {!needsMore && pendingCount === 0 && (
            <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-green-500/10 text-green-400">
              <CheckCircle size={14} />
              Tutti i membri hanno accettato! La richiesta è in attesa di approvazione dallo staff.
            </div>
          )}

          {/* Chat with regional referent */}
          {requestChannelId && (
            <div className="border-t border-border pt-3">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setChatOpen(true)}
              >
                <MessageSquare size={14} className="mr-1" />
                Chat con il Referente Regionale
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Parla con il referente della tua regione riguardo alla richiesta
              </p>
            </div>
          )}
        </div>
      )}

      <RegionalChatDialog
        open={chatOpen}
        onOpenChange={setChatOpen}
        channelId={requestChannelId}
        title={myRequest ? `Richiesta: ${myRequest.club_name}` : "Chat"}
      />

      {/* Invites addressed to me */}
      {invites.map((invite) => (
        <div key={invite.id} className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Shield size={20} className="text-primary shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Invito a fondare il club "{invite.club_request.club_name}"
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Da {invite.requester_name}
              {invite.club_request.city && ` · ${invite.club_request.city}`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              onClick={() => handleResponse(invite.id, true)}
              disabled={loading}
              className="gap-1"
            >
              <Check size={14} /> Accetta
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleResponse(invite.id, false)}
              disabled={loading}
              className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <X size={14} /> Rifiuta
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
