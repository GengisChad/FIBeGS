import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { toast } from "sonner";

type Channel = { id: string; region_id: string; title: string | null; region_name: string };
type Msg = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export const RegionalStaffChatView = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load channels the user belongs to (region-type only, i.e. staff channels)
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Resolve all region_ids the user can see staff chats for:
      // - explicit channel memberships
      // - regional_referents (their region)
      // - club leaders/owners (their club's region)
      // - admins: all regions
      const [
        { data: mems },
        { data: refs },
        { data: leaderClubs },
        { data: roles },
      ] = await Promise.all([
        (supabase as any).from("regional_channel_members").select("channel_id").eq("user_id", user.id),
        (supabase as any).from("regional_referents").select("region_id").eq("user_id", user.id).eq("is_active", true),
        (supabase as any)
          .from("club_members")
          .select("clubs(region_id)")
          .eq("user_id", user.id)
          .in("role", ["owner", "leader", "admin", "co_leader"]),
        (supabase as any).from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      const memberChannelIds = (mems ?? []).map((m: any) => m.channel_id);
      const regionIds = new Set<string>([
        ...((refs ?? []).map((r: any) => r.region_id)),
        ...((leaderClubs ?? []).map((c: any) => c.clubs?.region_id).filter(Boolean)),
      ]);

      let chansQuery = (supabase as any)
        .from("regional_channels")
        .select("id, region_id, title, channel_type, is_active")
        .eq("channel_type", "region")
        .eq("is_active", true);
      if (!isAdmin) {
        const orParts: string[] = [];
        if (memberChannelIds.length) orParts.push(`id.in.(${memberChannelIds.join(",")})`);
        if (regionIds.size) orParts.push(`region_id.in.(${Array.from(regionIds).join(",")})`);
        if (!orParts.length) { setChannels([]); setLoading(false); return; }
        chansQuery = chansQuery.or(orParts.join(","));
      }
      const { data: chans } = await chansQuery;
      const regIds: string[] = Array.from(new Set((chans ?? []).map((c: any) => c.region_id as string)));
      const { data: regs } = await supabase.from("regions").select("id, name").in("id", regIds as any);
      const regMap = new Map((regs ?? []).map((r: any) => [r.id, r.name]));
      const list: Channel[] = (chans ?? []).map((c: any) => ({
        id: c.id,
        region_id: c.region_id,
        title: c.title,
        region_name: regMap.get(c.region_id) ?? "Regione",
      }));
      setChannels(list);
      setActiveId((prev) => prev || list[0]?.id || null);
      setLoading(false);
    })();
  }, [user]);

  const enrich = async (rows: any[]): Promise<Msg[]> => {
    const ids = Array.from(new Set(rows.map((r) => r.sender_id)));
    if (!ids.length) return rows;
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .in("user_id", ids);
    const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
    return rows.map((r) => ({ ...r, sender: map.get(r.sender_id) ?? null }));
  };

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("regional_messages")
        .select("id, sender_id, content, created_at")
        .eq("channel_id", activeId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) { toast.error("Impossibile caricare la chat: " + error.message); return; }
      const enriched = await enrich(data ?? []);
      if (!cancelled) setMessages(enriched);
    })();
    const ch = supabase
      .channel(`regional_messages_hub:${activeId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "regional_messages", filter: `channel_id=eq.${activeId}` },
        async (payload) => {
          const enriched = await enrich([payload.new]);
          setMessages((prev) => [...prev, ...enriched]);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !activeId || !user) return;
    setSending(true);
    const { error } = await (supabase as any).from("regional_messages").insert({
      channel_id: activeId,
      sender_id: user.id,
      content: input.trim(),
    });
    setSending(false);
    if (error) { toast.error("Invio fallito: " + error.message); return; }
    setInput("");
  };

  if (loading) return <div className="p-4 text-xs text-muted-foreground text-center">Caricamento…</div>;
  if (channels.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground text-center">Nessuna chat staff regionale disponibile.</div>;
  }

  const active = channels.find((c) => c.id === activeId);

  return (
    <div className="flex flex-col h-full min-h-0">
      {channels.length > 1 && (
        <div className="px-3 pb-2 shrink-0">
          <Select value={activeId ?? ""} onValueChange={setActiveId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona regione" /></SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title || `Staff ${c.region_name}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">Nessun messaggio.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={m.sender?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {(m.sender?.display_name || m.sender?.username || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-muted-foreground px-1">
                  {m.sender?.display_name || m.sender?.username || "Utente"} ·{" "}
                  {new Date(m.created_at).toLocaleString("it-IT", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </span>
                <div className={`rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
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
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={active ? `Messaggio in ${active.title || active.region_name}…` : "Scrivi…"}
          disabled={sending}
        />
        <Button onClick={send} disabled={sending || !input.trim()} size="icon"><Send size={16} /></Button>
      </div>
    </div>
  );
};

export default RegionalStaffChatView;
