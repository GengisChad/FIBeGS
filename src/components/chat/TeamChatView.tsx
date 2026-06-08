import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft, Shield } from "lucide-react";
import { toast } from "sonner";
import { MessageActions } from "./MessageActions";

type Msg = { id: string; sender_id: string; content: string; created_at: string; edited_at?: string | null };
type Profile = { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null };

interface Props {
  teamId: string;
  teamName: string;
  onBack?: () => void;
  hideHeader?: boolean;
}

export const TeamChatView = ({ teamId, teamName, onBack, hideHeader }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const loadProfiles = async (ids: string[]) => {
    const missing = ids.filter(id => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", missing);
    setProfiles(prev => {
      const next = { ...prev };
      (data || []).forEach((p: any) => { next[p.user_id] = p; });
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from("team_messages")
        .select("id, sender_id, content, created_at, edited_at")
        .eq("team_id", teamId).order("created_at", { ascending: true }).limit(200);
      if (cancelled) return;
      const rows = (data || []) as Msg[];
      setMessages(rows);
      await loadProfiles(Array.from(new Set(rows.map(m => m.sender_id))));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  useEffect(() => {
    const ch = supabase.channel(`team-msg-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
        async (payload: any) => {
          const m = payload.new as Msg;
          await loadProfiles([m.sender_id]);
          setMessages(prev => prev.some(p => p.id === m.id) ? prev : [...prev, m]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
        (payload: any) => {
          const m = payload.new as Msg;
          setMessages(prev => prev.map(p => p.id === m.id ? { ...p, ...m } : p));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
        (payload: any) => {
          const oldId = (payload.old as any)?.id;
          if (oldId) setMessages(prev => prev.filter(p => p.id !== oldId));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || !user) return;
    setText("");
    const { error } = await (supabase as any).from("team_messages").insert({ team_id: teamId, sender_id: user.id, content: v });
    if (error) toast.error(error.message);
  };

  const editMsg = async (id: string, next: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("team_messages")
      .update({ content: next, edited_at: new Date().toISOString() })
      .eq("id", id).eq("sender_id", user.id);
    if (error) { toast.error(error.message); return; }
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: next, edited_at: new Date().toISOString() } : m));
  };

  const deleteMsg = async (id: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("team_messages").delete().eq("id", id).eq("sender_id", user.id);
    if (error) { toast.error(error.message); return; }
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      {!hideHeader && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-card">
          {onBack && <Button size="icon" variant="ghost" onClick={onBack}><ArrowLeft size={16} /></Button>}
          <Shield size={16} className="text-primary" />
          <div className="flex-1 text-sm font-semibold truncate">{teamName}</div>
        </div>
      )}
      <ScrollArea className="flex-1 px-3 py-2">
        {loading && <div className="text-xs text-muted-foreground text-center py-4">Caricamento...</div>}
        {!loading && messages.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Nessun messaggio. Inizia la conversazione di squadra.</div>}
        <div className="space-y-2">
          {messages.map(m => {
            const mine = m.sender_id === user?.id;
            const p = profiles[m.sender_id];
            return (
              <div key={m.id} className={`flex group items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && <Avatar className="h-6 w-6 mt-0.5"><AvatarImage src={p?.avatar_url || undefined} /><AvatarFallback>{(p?.display_name || p?.username || "?")[0]}</AvatarFallback></Avatar>}
                {mine && <MessageActions initialText={m.content} canEdit canDelete onSaveEdit={(t) => editMsg(m.id, t)} onDelete={() => deleteMsg(m.id)} />}
                <div className={`max-w-[75%]`}>
                  {!mine && <div className="text-[10px] text-muted-foreground mb-0.5 px-1">{p?.display_name || p?.username || "..."}</div>}
                  <div className={`px-3 py-1.5 rounded-2xl text-sm break-words ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {m.content}
                    {m.edited_at && <span className="ml-1 text-[9px] opacity-60">(modificato)</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <form onSubmit={submit} className="p-2 border-t flex gap-2 bg-card">
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="Messaggio alla squadra..." />
        <Button type="submit"><Send size={14} /></Button>
      </form>
    </div>
  );
};
