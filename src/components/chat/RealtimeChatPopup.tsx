/**
 * Global realtime popup for incoming private messages.
 * Shows a small bottom-right toast when foreground; click expands to mini-chat
 * (~360x500), with an "Apri" button to open the full ChatHubDialog.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ensureKeyPair, decryptMessage, getPeerPublicKey } from "@/lib/cryptoChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";
import type { FriendProfile } from "@/hooks/useFriends";
import { lazy, Suspense } from "react";

const ChatHubDialog = lazy(() => import("./ChatHubDialog"));

type Incoming = { chatId: string; peer: FriendProfile; preview: string };

export const RealtimeChatPopup = () => {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubChatId, setHubChatId] = useState<string | null>(null);
  const myChatIds = useRef<Set<string>>(new Set());

  const reloadMyChats = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("private_chats").select("id").or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    myChatIds.current = new Set((data || []).map((c: any) => c.id));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    ensureKeyPair(user.id).catch(() => {});
    reloadMyChats();
    const ch = supabase.channel(`my-chats-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_chats" }, () => reloadMyChats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, reloadMyChats]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`incoming-pm-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages" },
        async (payload: any) => {
          const m = payload.new as { id: string; chat_id: string; sender_id: string; content_encrypted: string; nonce: string };
          if (m.sender_id === user.id) return;
          if (!myChatIds.current.has(m.chat_id)) {
            await reloadMyChats();
            if (!myChatIds.current.has(m.chat_id)) return;
          }
          // Skip toast if the hub is already open on this chat
          if (hubOpen && hubChatId === m.chat_id) return;
          const { data: chat } = await (supabase as any).from("private_chats").select("user_a, user_b").eq("id", m.chat_id).maybeSingle();
          if (!chat) return;
          const peerId = chat.user_a === user.id ? chat.user_b : chat.user_a;
          const { data: p } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").eq("user_id", peerId).maybeSingle();
          if (!p) return;
          let preview = "Hai ricevuto un nuovo messaggio";
          try {
            const pub = await getPeerPublicKey(peerId);
            if (pub) preview = (await decryptMessage(user.id, pub, m.content_encrypted, m.nonce, peerId)).slice(0, 120);
          } catch {}
          setIncoming({ chatId: m.chat_id, peer: p as FriendProfile, preview });
        }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, reloadMyChats, hubOpen, hubChatId]);

  const openInHub = (chatId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("chat", chatId);
    url.searchParams.set("kind", "private");
    window.history.replaceState({}, "", url.toString());
    setHubChatId(chatId);
    setHubOpen(true);
    setIncoming(null);
  };

  return (
    <>
      {user && incoming && (
        <div className="fixed bottom-4 right-4 left-4 sm:right-auto sm:left-4 z-[60] pointer-events-auto animate-in slide-in-from-bottom-2">
          <button
            onClick={() => openInHub(incoming.chatId)}
            className="w-full sm:w-auto flex items-center gap-3 bg-card border border-border shadow-2xl rounded-2xl pl-2 pr-3 py-2 hover:bg-muted transition-all sm:max-w-[360px]"
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={incoming.peer.avatar_url || undefined} />
              <AvatarFallback>{(incoming.peer.display_name || incoming.peer.username || "?")[0]}</AvatarFallback>
            </Avatar>
            <div className="text-left min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">
                {incoming.peer.display_name || incoming.peer.username || "Nuovo messaggio"}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">{incoming.preview}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setIncoming(null); }}
              className="ml-1 shrink-0 text-muted-foreground hover:text-foreground p-1"
              aria-label="Chiudi"
            >
              <X size={16} />
            </button>
          </button>
        </div>
      )}
      <Suspense fallback={null}>
        {hubOpen && <ChatHubDialog open={hubOpen} onOpenChange={(v) => { setHubOpen(v); if (!v) setHubChatId(null); }} />}
      </Suspense>
    </>
  );
};

export default RealtimeChatPopup;
