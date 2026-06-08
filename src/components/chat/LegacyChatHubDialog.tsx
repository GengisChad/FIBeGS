import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, ArrowLeft, MapPin, Store, Users, Shield, Crown, X, Search, Lock } from "lucide-react";
import { toast } from "sonner";

/**
 * Unified chat hub: market chats + regional channels (region group + 1:1 with referent).
 * Egress-friendly: profiles cache in-memory per dialog session, no realtime on the list,
 * realtime only on the selected channel's messages.
 *
 * Privacy: all reads/writes are gated by RLS. Non-loggati cannot reach this dialog at all
 * (it's behind the auth-protected Navbar button). Non-members cannot read regional channels
 * (RLS), and non-participants cannot read market chats (RLS).
 *
 * Closure: a user can close any chat (except the regional group chat). When BOTH parties
 * have closed, the chat + all its messages are physically deleted via DB triggers. If one
 * party closes and the other later sends a message, the chat reopens for the other party.
 */

type ConvKind = "market" | "regional";
type RegionalKind = "region" | "request";
type Conversation = {
  kind: ConvKind;
  id: string;
  title: string;
  subtitle?: string;
  unread?: number;
  updatedAt?: string;
  counterpartId?: string;
  closedByMe?: boolean;
  regionalKind?: RegionalKind;
};

type ProfileLite = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type RoleTag = "admin" | "club_leader" | "regional_referent" | "blader";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const roleLabel = (r: RoleTag) => {
  switch (r) {
    case "admin": return { label: "Admin", className: "bg-primary/15 text-primary border-primary/30" };
    case "regional_referent": return { label: "Referente", className: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
    case "club_leader": return { label: "Club Leader", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    default: return { label: "Blader", className: "bg-secondary text-secondary-foreground border-border" };
  }
};

const roleIcon = (r: RoleTag) => {
  switch (r) {
    case "admin": return <Shield size={10} />;
    case "regional_referent": return <Crown size={10} />;
    case "club_leader": return <Users size={10} />;
    default: return null;
  }
};

export const LegacyChatHubDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const { isRegionalReferent } = useUserRoles();
  const [loading, setLoading] = useState(true);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  // Search players (referent-only)
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [referentRegionId, setReferentRegionId] = useState<string | null>(null);

  const profileCache = useRef<Map<string, ProfileLite>>(new Map());
  const roleCache = useRef<Map<string, RoleTag>>(new Map());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /** Resolve roles for a list of user_ids in one batch, cached. */
  const resolveRoles = useCallback(async (ids: string[]): Promise<Map<string, RoleTag>> => {
    const need = ids.filter((id) => id && !roleCache.current.has(id));
    if (need.length) {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", need);
      const byUser = new Map<string, Set<string>>();
      (data ?? []).forEach((r: any) => {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Set());
        byUser.get(r.user_id)!.add(r.role);
      });
      const stillUnknown = need.filter((id) => !byUser.has(id) || (
        !byUser.get(id)!.has("admin") &&
        !byUser.get(id)!.has("regional_referent")
      ));
      let clubLeaders = new Set<string>();
      if (stillUnknown.length) {
        const { data: cm } = await supabase
          .from("club_members")
          .select("user_id")
          .in("user_id", stillUnknown)
          .in("role", ["leader", "vice_leader", "staff"]);
        clubLeaders = new Set((cm ?? []).map((m: any) => m.user_id));
      }
      need.forEach((id) => {
        const roles = byUser.get(id) ?? new Set<string>();
        if (roles.has("admin")) roleCache.current.set(id, "admin");
        else if (roles.has("regional_referent")) roleCache.current.set(id, "regional_referent");
        else if (clubLeaders.has(id)) roleCache.current.set(id, "club_leader");
        else roleCache.current.set(id, "blader");
      });
    }
    const out = new Map<string, RoleTag>();
    ids.forEach((id) => out.set(id, roleCache.current.get(id) ?? "blader"));
    return out;
  }, []);

  const resolveProfiles = useCallback(async (ids: string[]): Promise<Map<string, ProfileLite>> => {
    const need = ids.filter((id) => id && !profileCache.current.has(id));
    if (need.length) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", need);
      (data ?? []).forEach((p: any) => profileCache.current.set(p.user_id, p));
    }
    const out = new Map<string, ProfileLite>();
    ids.forEach((id) => {
      const p = profileCache.current.get(id);
      if (p) out.set(id, p);
    });
    return out;
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const items: Conversation[] = [];

    // Market chats
    const { data: mc } = await supabase
      .from("market_chats")
      .select("id, listing_id, wanted_id, buyer_id, seller_id, updated_at")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })
      .limit(50);

    const myMarketClosed = new Set<string>();
    if (mc?.length) {
      const ids = mc.map((c: any) => c.id);
      const { data: clos } = await (supabase as any)
        .from("market_chat_closures")
        .select("chat_id")
        .eq("user_id", user.id)
        .in("chat_id", ids);
      (clos ?? []).forEach((c: any) => myMarketClosed.add(c.chat_id));
    }

    const otherIds = Array.from(
      new Set((mc ?? []).map((c: any) => (c.buyer_id === user.id ? c.seller_id : c.buyer_id)))
    );
    const profMap = await resolveProfiles(otherIds);
    (mc ?? []).forEach((c: any) => {
      if (myMarketClosed.has(c.id)) return; // hide chats this user has closed
      const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
      const p = profMap.get(otherId);
      items.push({
        kind: "market",
        id: c.id,
        title: p?.display_name || p?.username || "Utente",
        subtitle: c.listing_id ? "Annuncio" : "Ricerca",
        updatedAt: c.updated_at,
        counterpartId: otherId,
      });
    });

    // Regional channels
    const { data: members } = await (supabase as any)
      .from("regional_channel_members")
      .select("channel_id")
      .eq("user_id", user.id);
    const channelIds = (members ?? []).map((m: any) => m.channel_id);

    if (channelIds.length) {
      const { data: channels } = await (supabase as any)
        .from("regional_channels")
        .select("id, channel_type, region_id, title, updated_at")
        .in("id", channelIds)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      const myRegClosed = new Set<string>();
      const { data: rclos } = await (supabase as any)
        .from("regional_channel_closures")
        .select("channel_id")
        .eq("user_id", user.id)
        .in("channel_id", channelIds);
      (rclos ?? []).forEach((c: any) => myRegClosed.add(c.channel_id));

      const regionIds: string[] = Array.from(new Set((channels ?? []).map((c: any) => c.region_id as string)));
      const { data: regions } = await supabase
        .from("regions")
        .select("id, name")
        .in("id", regionIds);
      const regionMap = new Map((regions ?? []).map((r: any) => [r.id, r.name]));
      (channels ?? []).forEach((c: any) => {
        if (myRegClosed.has(c.id)) return; // hide channels this user closed
        const regName = regionMap.get(c.region_id) ?? "Regione";
        items.push({
          kind: "regional",
          id: c.id,
          title: c.title || (c.channel_type === "region" ? `Chat ${regName}` : "Chat 1:1"),
          subtitle: c.channel_type === "region" ? `Gruppo ${regName}` : `1:1 · ${regName}`,
          updatedAt: c.updated_at,
          counterpartId: c.region_id,
          regionalKind: c.channel_type as RegionalKind,
        });
      });
    }

    items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    setConvs(items);
    setLoading(false);
  }, [user, resolveProfiles]);

  // Load conversations + referent region when opened
  useEffect(() => {
    if (!open || !user) return;
    setSelected(null);
    setMessages([]);
    setSearch("");
    setSearchResults([]);
    void loadConversations();

    if (isRegionalReferent) {
      (async () => {
        const { data } = await (supabase as any)
          .from("regional_referents")
          .select("region_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        setReferentRegionId(data?.region_id ?? null);
      })();
    } else {
      setReferentRegionId(null);
    }
  }, [open, user, isRegionalReferent, loadConversations]);

  // Load messages on selection + realtime subscribe
  useEffect(() => {
    if (!selected || !user) return;
    let cancelled = false;
    setMessages([]);
    setInput("");

    const table = selected.kind === "market" ? "market_messages" : "regional_messages";
    const filterCol = selected.kind === "market" ? "chat_id" : "channel_id";

    (async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("id, sender_id, content, created_at")
        .eq(filterCol, selected.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) {
        toast.error("Impossibile caricare i messaggi");
        return;
      }
      const ids: string[] = Array.from(new Set((data ?? []).map((m: any) => m.sender_id as string)));
      const [profs, roles] = await Promise.all([resolveProfiles(ids), resolveRoles(ids)]);
      const enriched = (data ?? []).map((m: any) => ({
        ...m,
        sender: profs.get(m.sender_id),
        role: roles.get(m.sender_id) ?? "blader",
      }));
      if (!cancelled) setMessages(enriched);

      if (selected.kind === "market") {
        await supabase
          .from("market_messages")
          .update({ is_read: true })
          .eq("chat_id", selected.id)
          .neq("sender_id", user.id)
          .eq("is_read", false);
      }
    })();

    const ch = supabase
      .channel(`hub-${table}-${selected.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: `${filterCol}=eq.${selected.id}` },
        async (payload: any) => {
          const m = payload.new;
          const [profs, roles] = await Promise.all([
            resolveProfiles([m.sender_id]),
            resolveRoles([m.sender_id]),
          ]);
          setMessages((prev) => [
            ...prev,
            { ...m, sender: profs.get(m.sender_id), role: roles.get(m.sender_id) ?? "blader" },
          ]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [selected, user, resolveProfiles, resolveRoles]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !selected || !user) return;
    setSending(true);
    if (selected.kind === "market") {
      const { error } = await supabase.from("market_messages").insert({
        chat_id: selected.id,
        sender_id: user.id,
        content: input.trim(),
      });
      if (!error) {
        await supabase.from("market_chats").update({ updated_at: new Date().toISOString() }).eq("id", selected.id);
      } else toast.error("Invio fallito");
    } else {
      const { error } = await (supabase as any).from("regional_messages").insert({
        channel_id: selected.id,
        sender_id: user.id,
        content: input.trim(),
      });
      if (error) toast.error("Invio fallito");
    }
    setInput("");
    setSending(false);
  };

  const canCloseSelected = useMemo(() => {
    if (!selected) return false;
    if (selected.kind === "regional" && selected.regionalKind === "region") return false;
    return true;
  }, [selected]);

  const confirmClose = async () => {
    if (!selected || !user) return;
    const table = selected.kind === "market" ? "market_chat_closures" : "regional_channel_closures";
    const idCol = selected.kind === "market" ? "chat_id" : "channel_id";
    const { error } = await (supabase as any).from(table).insert({
      [idCol]: selected.id,
      user_id: user.id,
    });
    if (error && !String(error.message).includes("duplicate")) {
      toast.error("Impossibile chiudere la chat");
      setCloseOpen(false);
      return;
    }
    toast.success("Chat chiusa. Verrà eliminata quando anche l'altra parte la chiude.");
    setCloseOpen(false);
    setSelected(null);
    await loadConversations();
  };

  // Username search for referents (their region only)
  useEffect(() => {
    if (!isRegionalReferent || !referentRegionId) {
      setSearchResults([]);
      return;
    }
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancel = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .eq("region_id", referentRegionId)
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("user_id", user!.id)
        .limit(10);
      if (!cancel) {
        setSearchResults(data ?? []);
        setSearching(false);
      }
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [search, isRegionalReferent, referentRegionId, user]);

  const startDirectChat = async (target: ProfileLite) => {
    const { data, error } = await (supabase as any).rpc("referent_open_direct_channel", {
      _target_user_id: target.user_id,
    });
    if (error) {
      toast.error(error.message || "Impossibile aprire la chat");
      return;
    }
    setSearch("");
    setSearchResults([]);
    await loadConversations();
    // open it
    const { data: ch } = await (supabase as any)
      .from("regional_channels")
      .select("id, channel_type, region_id, title, updated_at")
      .eq("id", data)
      .maybeSingle();
    if (ch) {
      setSelected({
        kind: "regional",
        id: ch.id,
        title: ch.title || `Chat con ${target.display_name || target.username || "giocatore"}`,
        subtitle: "1:1",
        updatedAt: ch.updated_at,
        regionalKind: "request",
      });
    }
  };

  const grouped = useMemo(() => {
    const market = convs.filter((c) => c.kind === "market");
    const regional = convs.filter((c) => c.kind === "regional");
    return { market, regional };
  }, [convs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] flex flex-col p-0 gap-0 rounded-[var(--device-radius)] overflow-hidden border-border/60 shadow-2xl sm:max-w-3xl sm:h-[80vh] sm:rounded-lg">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {selected ? (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelected(null)}>
                  <ArrowLeft size={14} />
                </Button>
                <span className="truncate flex-1">{selected.title}</span>
                <span className="text-xs text-muted-foreground font-normal hidden sm:inline">{selected.subtitle}</span>
                {canCloseSelected && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => setCloseOpen(true)}
                  >
                    <X size={12} className="mr-1" /> Chiudi
                  </Button>
                )}
              </>
            ) : (
              <span className="flex items-center gap-2">
                Le mie chat
                <Lock size={12} className="text-muted-foreground" aria-label="Conversazioni protette" />
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {isRegionalReferent && (
                <section>
                  <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 mb-1 flex items-center gap-1">
                    <Search size={11} /> Cerca giocatore della tua regione
                  </h3>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Username o nome..."
                    className="h-9"
                  />
                  {searching && <p className="text-xs text-muted-foreground mt-1 px-1">Ricerca…</p>}
                  {searchResults.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {searchResults.map((p) => (
                        <button
                          key={p.user_id}
                          onClick={() => startDirectChat(p)}
                          className="w-full text-left rounded-lg border border-border/60 hover:bg-card transition-colors p-2 flex items-center gap-2"
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {(p.display_name || p.username || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{p.display_name || p.username}</p>
                            {p.username && p.display_name && (
                              <p className="text-[10px] text-muted-foreground truncate">@{p.username}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {loading && <p className="text-center text-sm text-muted-foreground py-6">Caricamento…</p>}
              {!loading && convs.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Nessuna conversazione attiva.</p>
              )}

              {grouped.regional.length > 0 && (
                <section>
                  <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 mb-1 flex items-center gap-1">
                    <MapPin size={11} /> Chat regionali
                  </h3>
                  <div className="space-y-1">
                    {grouped.regional.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="w-full text-left rounded-lg border border-border/60 bg-card/40 hover:bg-card transition-colors p-2.5 flex items-center gap-2"
                      >
                        <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          <MapPin size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {grouped.market.length > 0 && (
                <section>
                  <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 mb-1 flex items-center gap-1">
                    <Store size={11} /> Mercatino
                  </h3>
                  <div className="space-y-1">
                    {grouped.market.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="w-full text-left rounded-lg border border-border/60 bg-card/40 hover:bg-card transition-colors p-2.5 flex items-center gap-2"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Store size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-10">Nessun messaggio. Inizia la conversazione.</p>
              )}
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                const tag = roleLabel(m.role as RoleTag);
                return (
                  <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={m.sender?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(m.sender?.display_name || m.sender?.username || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      <div className={`flex items-center gap-1.5 px-1 ${mine ? "flex-row-reverse" : ""}`}>
                        <span className="text-[10px] text-muted-foreground">
                          {m.sender?.display_name || m.sender?.username || "Utente"}
                        </span>
                        <Badge variant="outline" className={`h-4 text-[9px] px-1.5 gap-0.5 ${tag.className}`}>
                          {roleIcon(m.role as RoleTag)}
                          {tag.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("it-IT", {
                            hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${
                          mine ? "bg-primary text-primary-foreground" : "bg-secondary"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t flex gap-2 shrink-0">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Scrivi un messaggio…"
                disabled={sending}
              />
              <Button onClick={send} disabled={sending || !input.trim()}>
                <Send size={16} />
              </Button>
            </div>
          </>
        )}
      </DialogContent>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chiudere questa chat?</AlertDialogTitle>
            <AlertDialogDescription>
              La chat sparirà dalla tua lista. Verrà eliminata definitivamente dal sistema solo
              quando anche l'altra parte la chiuderà. Se l'altra persona scrive un nuovo messaggio
              nel frattempo, la chat ricomparirà con tutta la conversazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Chiudi chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default LegacyChatHubDialog;
