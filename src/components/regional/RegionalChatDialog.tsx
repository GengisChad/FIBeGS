import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channelId: string | null;
  title?: string;
}

export const RegionalChatDialog = ({ open, onOpenChange, channelId, title }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const enrich = async (rows: any[]) => {
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
    if (!open || !channelId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("regional_messages")
        .select("id, sender_id, content, created_at")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) {
        toast.error("Impossibile caricare la chat: " + error.message);
        return;
      }
      const enriched = await enrich(data ?? []);
      if (!cancelled) setMessages(enriched);
    })();

    const ch = supabase
      .channel(`regional_messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "regional_messages", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const enriched = await enrich([payload.new]);
          setMessages((prev) => [...prev, ...enriched]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [open, channelId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !channelId || !user) return;
    setSending(true);
    const { error } = await (supabase as any).from("regional_messages").insert({
      channel_id: channelId,
      sender_id: user.id,
      content: input.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Invio fallito: " + error.message);
      return;
    }
    setInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{title || "Chat regionale"}</DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">Nessun messaggio. Inizia la conversazione.</p>
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
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {m.sender?.display_name || m.sender?.username || "Utente"} ·{" "}
                    {new Date(m.created_at).toLocaleString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
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

        <div className="p-3 border-t flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Scrivi un messaggio…"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()}>
            <Send size={16} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
