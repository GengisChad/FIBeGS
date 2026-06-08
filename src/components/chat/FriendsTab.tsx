import { useEffect, useState } from "react";
import { useFriends } from "@/hooks/useFriends";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserPlus, Search, MessageCircle } from "lucide-react";
import { openOrCreateChat } from "@/hooks/usePrivateChat";

interface Props {
  onOpenChat: (chatId: string, peerId: string) => void;
}

export const FriendsTab = ({ onOpenChat }: Props) => {
  const { user } = useAuth();
  const { isAdmin, isRegionalReferent } = useUserRoles();
  const { friends, incoming, outgoing, profiles, sendRequest, respond, remove } = useFriends();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; region_id?: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [regionalIds, setRegionalIds] = useState<string[]>([]);
  const canStaffChat = isAdmin || (isRegionalReferent && regionalIds.length > 0);

  useEffect(() => {
    if (!user || !isRegionalReferent) { setRegionalIds([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("regional_referents")
        .select("region_id")
        .eq("user_id", user.id)
        .eq("is_active", true);
      setRegionalIds(Array.from(new Set((data || []).map((r: any) => r.region_id).filter(Boolean))));
    })();
  }, [user, isRegionalReferent]);

  const search = async () => {
    if (!query.trim() || !user) return;
    setSearching(true);
    const q = query.trim();
    let request = supabase.from("profiles")
      .select("user_id, display_name, username, avatar_url, region_id")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq("user_id", user.id)
      .limit(15);
    if (!isAdmin && regionalIds.length > 0) request = request.in("region_id", regionalIds);
    const { data } = await request;
    setResults((data || []) as any);
    setSearching(false);
  };

  const openChat = async (otherId: string) => {
    if (!user) return;
    const id = await openOrCreateChat(user.id, otherId);
    if (id) onOpenChat(id, otherId);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">CERCA GIOCATORI</div>
          <div className="flex gap-2">
            <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="Username o nome..." className="h-9" />
            <Button size="sm" onClick={search} disabled={searching}><Search size={14} /></Button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map(p => (
                <div key={p.user_id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <Avatar className="h-7 w-7"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{(p.display_name || p.username || "?")[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 text-sm truncate">{p.display_name || p.username}</div>
                  {canStaffChat && (
                    <Button size="sm" variant="default" onClick={() => openChat(p.user_id)}><MessageCircle size={12} className="mr-1" />Chat</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => sendRequest(p.user_id)}><UserPlus size={12} className="mr-1" />Aggiungi</Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {incoming.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">RICHIESTE RICEVUTE <Badge variant="secondary" className="ml-1">{incoming.length}</Badge></div>
            <div className="space-y-1">
              {incoming.map(r => {
                const other = r.user_a === user?.id ? r.user_b : r.user_a;
                const p = profiles[other];
                return (
                  <div key={r.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    <Avatar className="h-7 w-7"><AvatarImage src={p?.avatar_url || undefined} /><AvatarFallback>{(p?.display_name || p?.username || "?")[0]}</AvatarFallback></Avatar>
                    <div className="flex-1 text-sm truncate">{p?.display_name || p?.username || "Utente"}</div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => respond(r.id, true)}><Check size={14} className="text-emerald-500" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => respond(r.id, false)}><X size={14} className="text-destructive" /></Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">AMICI ({friends.length})</div>
          {friends.length === 0 && <div className="text-xs text-muted-foreground px-1">Nessun amico ancora. Cerca un giocatore qui sopra.</div>}
          <div className="space-y-1">
            {friends.map(r => {
              const other = r.user_a === user?.id ? r.user_b : r.user_a;
              const p = profiles[other];
              if (!p) return null;
              return (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer" onClick={() => openChat(other)}>
                  <Avatar className="h-8 w-8"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{(p.display_name || p.username || "?")[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 text-sm truncate font-medium">{p.display_name || p.username}</div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openChat(other); }}><MessageCircle size={14} /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); if (confirm("Rimuovere amico?")) remove(r.id); }}><X size={14} className="text-muted-foreground" /></Button>
                </div>
              );
            })}
          </div>
        </div>

        {outgoing.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">INVIATE</div>
            <div className="space-y-1">
              {outgoing.map(r => {
                const other = r.user_a === user?.id ? r.user_b : r.user_a;
                const p = profiles[other];
                return (
                  <div key={r.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <Avatar className="h-7 w-7"><AvatarImage src={p?.avatar_url || undefined} /><AvatarFallback>{(p?.display_name || p?.username || "?")[0]}</AvatarFallback></Avatar>
                    <div className="flex-1 text-sm truncate text-muted-foreground">{p?.display_name || p?.username || "..."}</div>
                    <Badge variant="outline" className="text-[10px]">In attesa</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(r.id)}><X size={14} /></Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
