import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePrivateChatMessages } from "@/hooks/usePrivateChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock, Send, ArrowLeft, PictureInPicture2 } from "lucide-react";
import { MessageActions } from "./MessageActions";
import { ChatBubble, isChatBubbleSupported } from "@/plugins/ChatBubble";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { FriendProfile } from "@/hooks/useFriends";

interface Props {
  chatId: string;
  peer: FriendProfile;
  onBack?: () => void;
  compact?: boolean;
  hideHeader?: boolean;
}

export const PrivateChatView = ({ chatId, peer, onBack, compact, hideHeader }: Props) => {
  const { user } = useAuth();
  const { messages, loading, send, editMessage, deleteMessage } = usePrivateChatMessages(chatId, peer.user_id);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText("");
    await send(v);
  };

  const name = peer.display_name || peer.username || "Amico";
  const bubbleSupported = isChatBubbleSupported();

  const minimizeToBubble = async () => {
    try {
      const perm = await ChatBubble.hasOverlayPermission();
      if (!perm.granted) {
        const req = await ChatBubble.requestOverlayPermission();
        if (!req.granted) {
          toast({ title: "Permesso necessario", description: "Abilita 'Visualizza sopra altre app' per usare i bubble." });
          return;
        }
      }
      await ChatBubble.setEnabled({ enabled: true });
      const { data: { session } } = await supabase.auth.getSession();
      await ChatBubble.showBubble({
        chatId,
        kind: "private",
        senderName: name,
        avatarUrl: peer.avatar_url || undefined,
        accessToken: session?.access_token,
      });
      onBack?.();
    } catch (e: any) {
      toast({ title: "Impossibile aprire il bubble", description: e?.message ?? "Errore sconosciuto", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {!hideHeader && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-card">
          {onBack && <Button size="icon" variant="ghost" onClick={onBack}><ArrowLeft size={16} /></Button>}
          <Avatar className="h-8 w-8"><AvatarImage src={peer.avatar_url || undefined} /><AvatarFallback>{name[0]}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Lock size={9} /> Crittografia end-to-end</div>
          </div>
          {bubbleSupported && (
            <Button size="icon" variant="ghost" onClick={minimizeToBubble} title="Minimizza in bubble">
              <PictureInPicture2 size={16} />
            </Button>
          )}
        </div>
      )}
      <ScrollArea className="flex-1 px-3 py-2">
        {loading && <div className="text-xs text-muted-foreground text-center py-4">Caricamento...</div>}
        {!loading && messages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">Nessun messaggio. Scrivi per iniziare.</div>
        )}
        <div className="space-y-1.5">
          {messages.map(m => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex group items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                {mine && <MessageActions initialText={m.plaintext ?? ""} canEdit canDelete
                  onSaveEdit={(t) => editMessage(m.id, t)} onDelete={() => deleteMessage(m.id)} />}
                <div className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm break-words ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.plaintext ?? "🔒"}
                  {(m as any).edited_at && <span className="ml-1 text-[9px] opacity-60">(modificato)</span>}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <form onSubmit={submit} className="p-2 border-t flex gap-2 bg-card">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi un messaggio cifrato..." className={compact ? "h-8 text-sm" : ""} />
        <Button type="submit" size={compact ? "sm" : "default"}><Send size={14} /></Button>
      </form>
    </div>
  );
};
