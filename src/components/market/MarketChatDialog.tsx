import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ChatInfo {
  id: string;
  other_name: string;
  other_username: string | null;
  context_title: string;
  last_message?: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface MarketChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-open a specific chat or create one */
  initialChatTarget?: {
    listingId?: string;
    wantedId?: string;
    targetUserId: string;
  } | null;
}

const MarketChatDialog = ({ open, onOpenChange, initialChatTarget }: MarketChatDialogProps) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchChats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("market_chats")
      .select("id, listing_id, wanted_id, buyer_id, seller_id, updated_at")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!data || data.length === 0) {
      setChats([]);
      setLoadingChats(false);
      return;
    }

    // Get other user profiles
    const otherIds = [...new Set(data.map(c => c.buyer_id === user.id ? c.seller_id : c.buyer_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name, username")
      .in("user_id", otherIds);
    const profileMap: Record<string, { display_name: string; username: string | null }> = {};
    (profilesData ?? []).forEach((p: any) => {
      profileMap[p.user_id] = { display_name: p.display_name || p.username || "Utente", username: p.username };
    });

    // Get context titles
    const listingIds = data.filter(c => c.listing_id).map(c => c.listing_id!);
    const wantedIds = data.filter(c => c.wanted_id).map(c => c.wanted_id!);

    let listingMap: Record<string, string> = {};
    let wantedMap: Record<string, string> = {};

    if (listingIds.length > 0) {
      const { data: listings } = await supabase.from("market_listings").select("id, product_name").in("id", listingIds);
      (listings ?? []).forEach((l: any) => { listingMap[l.id] = l.product_name; });
    }
    if (wantedIds.length > 0) {
      const { data: wanteds } = await supabase.from("market_wanted").select("id, title").in("id", wantedIds);
      (wanteds ?? []).forEach((w: any) => { wantedMap[w.id] = w.title; });
    }

    // Get last message & unread counts in one query per chat
    const chatInfos: ChatInfo[] = [];
    for (const c of data) {
      const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
      const profile = profileMap[otherId];
      const contextTitle = c.listing_id ? (listingMap[c.listing_id] || "Annuncio") : (wantedMap[c.wanted_id!] || "Ricerca");

      // Get last message
      const { data: lastMsg } = await supabase
        .from("market_messages")
        .select("content")
        .eq("chat_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      // Get unread count
      const { count } = await supabase
        .from("market_messages")
        .select("id", { count: "exact", head: true })
        .eq("chat_id", c.id)
        .eq("is_read", false)
        .neq("sender_id", user.id);

      chatInfos.push({
        id: c.id,
        other_name: profile?.display_name || "Utente",
        other_username: profile?.username || null,
        context_title: contextTitle,
        last_message: lastMsg?.[0]?.content,
        unread_count: count || 0,
      });
    }

    setChats(chatInfos);
    setLoadingChats(false);
  }, [user]);

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from("market_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    setMessages((data ?? []) as Message[]);
    setLoadingMessages(false);

    // Mark as read
    if (user) {
      await supabase
        .from("market_messages")
        .update({ is_read: true })
        .eq("chat_id", chatId)
        .neq("sender_id", user.id)
        .eq("is_read", false);
    }

    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 100);
  }, [user]);

  // Handle initial chat target (create or find existing chat)
  useEffect(() => {
    if (!open || !initialChatTarget || !user) return;

    const findOrCreateChat = async () => {
      const { listingId, wantedId, targetUserId } = initialChatTarget;

      // Check if chat already exists
      let query = supabase.from("market_chats").select("id");
      if (listingId) query = query.eq("listing_id", listingId);
      if (wantedId) query = query.eq("wanted_id", wantedId);
      query = query.or(`and(buyer_id.eq.${user.id},seller_id.eq.${targetUserId}),and(buyer_id.eq.${targetUserId},seller_id.eq.${user.id})`);

      const { data: existing } = await query.limit(1);
      if (existing && existing.length > 0) {
        setSelectedChatId(existing[0].id);
        fetchMessages(existing[0].id);
        fetchChats();
        return;
      }

      // Create new chat
      const { data: newChat, error } = await supabase.from("market_chats").insert({
        listing_id: listingId || null,
        wanted_id: wantedId || null,
        buyer_id: user.id,
        seller_id: targetUserId,
      }).select("id").single();

      if (error) {
        toast({ title: "Errore apertura chat", variant: "destructive" });
        return;
      }
      setSelectedChatId(newChat.id);
      fetchChats();
    };

    findOrCreateChat();
  }, [open, initialChatTarget, user]);

  useEffect(() => {
    if (open && user) {
      fetchChats();
      setSelectedChatId(null);
      setMessages([]);
    }
  }, [open, user]);

  // Realtime subscription for messages in active chat
  useEffect(() => {
    if (!selectedChatId || !user) return;

    const channel = supabase
      .channel(`market-chat-${selectedChatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "market_messages",
        filter: `chat_id=eq.${selectedChatId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        // Mark as read if from other user
        if (msg.sender_id !== user.id) {
          supabase.from("market_messages").update({ is_read: true }).eq("id", msg.id).then(() => {});
        }
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        }, 50);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChatId, user]);

  const sendMessage = async () => {
    if (!user || !selectedChatId || !newMessage.trim()) return;
    const profanityError = validateNoProfanity(newMessage);
    if (profanityError) { toast({ title: profanityError, variant: "destructive" }); return; }
    setSending(true);
    const { error } = await supabase.from("market_messages").insert({
      chat_id: selectedChatId,
      sender_id: user.id,
      content: newMessage.trim(),
    });
    if (error) toast({ title: "Errore invio messaggio", variant: "destructive" });
    else {
      setNewMessage("");
      // Update chat timestamp
      await supabase.from("market_chats").update({ updated_at: new Date().toISOString() }).eq("id", selectedChatId);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const totalUnread = chats.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] flex flex-col p-0 gap-0 rounded-[var(--device-radius)] overflow-hidden border-border/60 shadow-2xl sm:max-w-lg sm:h-[70vh] sm:rounded-lg">
        <DialogHeader className="p-4 pb-2 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {selectedChatId && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedChatId(null); setMessages([]); fetchChats(); }}>
                <ArrowLeft size={16} />
              </Button>
            )}
            Chat Market
            {!selectedChatId && totalUnread > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!selectedChatId ? (
          // Chat list
          <ScrollArea className="flex-1">
            {loadingChats ? (
              <p className="text-sm text-muted-foreground p-4">Caricamento...</p>
            ) : chats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Nessuna conversazione.</p>
            ) : (
              <div className="divide-y divide-border">
                {chats.map(chat => (
                  <button
                    key={chat.id}
                    className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors"
                    onClick={() => { setSelectedChatId(chat.id); fetchMessages(chat.id); }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{chat.other_name}</p>
                      {chat.unread_count > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{chat.context_title}</p>
                    {chat.last_message && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.last_message}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
          // Messages view
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {loadingMessages ? (
                <p className="text-sm text-muted-foreground text-center py-8">Caricamento...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inizia la conversazione!</p>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2",
                      msg.sender_id === user?.id
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={cn(
                      "text-[10px] mt-0.5",
                      msg.sender_id === user?.id ? "text-primary-foreground/60" : "text-muted-foreground"
                    )}>
                      {format(new Date(msg.created_at), "HH:mm", { locale: it })}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-border p-3 flex gap-2 shrink-0">
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi un messaggio..."
                maxLength={2000}
                className="flex-1"
              />
              <Button size="icon" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                <Send size={16} />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MarketChatDialog;
