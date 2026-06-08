import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ensureKeyPair, encryptMessage, decryptMessage, getPeerPublicKey } from "@/lib/cryptoChat";
import { toast } from "sonner";

export type PrivateChat = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string | null;
  closed_by_a: boolean;
  closed_by_b: boolean;
};

export type PrivateMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content_encrypted: string;
  nonce: string;
  created_at: string;
  read_at: string | null;
  /** decrypted plaintext (cached client-side) */
  plaintext?: string;
};

export const openOrCreateChat = async (myId: string, otherId: string): Promise<string | null> => {
  const a = myId < otherId ? myId : otherId;
  const b = myId < otherId ? otherId : myId;
  await ensureKeyPair(myId);
  const { data: existing } = await (supabase as any).from("private_chats").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await (supabase as any).from("private_chats").insert({ user_a: a, user_b: b }).select("id").maybeSingle();
  if (error) { toast.error("Impossibile aprire chat: " + error.message); return null; }
  return data?.id || null;
};

export const usePrivateChatMessages = (chatId: string | null, peerId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const peerPubRef = useRef<Uint8Array | null>(null);

  const decryptOne = useCallback(async (m: PrivateMessage): Promise<PrivateMessage> => {
    // Plaintext fallback (e.g. message sent from a push-notification reply action)
    if (m.nonce === "plaintext") {
      try { return { ...m, plaintext: decodeURIComponent(escape(atob(m.content_encrypted))) }; }
      catch { return { ...m, plaintext: m.content_encrypted }; }
    }
    if (!user || !peerPubRef.current) return { ...m, plaintext: "🔒" };
    const pt = await decryptMessage(user.id, peerPubRef.current, m.content_encrypted, m.nonce, peerId ?? undefined);
    return { ...m, plaintext: pt };
  }, [user]);

  useEffect(() => {
    if (!chatId || !user || !peerId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      await ensureKeyPair(user.id);
      peerPubRef.current = await getPeerPublicKey(peerId);
      const { data } = await (supabase as any).from("private_messages")
        .select("id, chat_id, sender_id, content_encrypted, nonce, created_at, read_at")
        .eq("chat_id", chatId).order("created_at", { ascending: true }).limit(200);
      if (cancelled) return;
      const rows = (data || []) as PrivateMessage[];
      const decrypted = await Promise.all(rows.map(decryptOne));
      if (cancelled) return;
      setMessages(decrypted);
      setLoading(false);

      // mark as read
      const unread = rows.filter(m => m.sender_id !== user.id && !m.read_at).map(m => m.id);
      if (unread.length > 0) {
        await (supabase as any).from("private_messages").update({ read_at: new Date().toISOString() }).in("id", unread);
      }
    })();
    return () => { cancelled = true; };
  }, [chatId, user, peerId, decryptOne]);

  useEffect(() => {
    if (!chatId || !user) return;
    const ch = supabase.channel(`pmsg-${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages", filter: `chat_id=eq.${chatId}` },
        async (payload: any) => {
          const m = payload.new as PrivateMessage;
          const dec = await decryptOne(m);
          setMessages(prev => prev.some(p => p.id === m.id) ? prev : [...prev, dec]);
          if (m.sender_id !== user.id) {
            await (supabase as any).from("private_messages").update({ read_at: new Date().toISOString() }).eq("id", m.id);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "private_messages", filter: `chat_id=eq.${chatId}` },
        async (payload: any) => {
          const m = payload.new as PrivateMessage;
          const dec = await decryptOne(m);
          setMessages(prev => prev.map(p => p.id === m.id ? { ...p, ...dec } : p));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "private_messages", filter: `chat_id=eq.${chatId}` },
        (payload: any) => {
          const oldId = (payload.old as any)?.id;
          if (oldId) setMessages(prev => prev.filter(p => p.id !== oldId));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId, user, decryptOne]);

  const send = useCallback(async (text: string) => {
    if (!chatId || !user || !peerId || !text.trim()) return;
    await ensureKeyPair(user.id);
    if (!peerPubRef.current) peerPubRef.current = await getPeerPublicKey(peerId);
    if (!peerPubRef.current) {
      toast.error("Il destinatario non ha ancora generato le chiavi. Chiedigli di aprire la chat almeno una volta.");
      return;
    }
    const { content_encrypted, nonce } = await encryptMessage(user.id, peerPubRef.current, text.trim());
    const { error } = await (supabase as any).from("private_messages").insert({
      chat_id: chatId, sender_id: user.id, content_encrypted, nonce,
    });
    if (error) toast.error(error.message);
  }, [chatId, user, peerId]);

  const editMessage = useCallback(async (id: string, text: string) => {
    if (!user || !peerId || !text.trim()) return;
    if (!peerPubRef.current) peerPubRef.current = await getPeerPublicKey(peerId);
    if (!peerPubRef.current) { toast.error("Chiave destinatario non disponibile"); return; }
    const { content_encrypted, nonce } = await encryptMessage(user.id, peerPubRef.current, text.trim());
    const { error } = await (supabase as any).from("private_messages")
      .update({ content_encrypted, nonce, edited_at: new Date().toISOString() })
      .eq("id", id).eq("sender_id", user.id);
    if (error) { toast.error(error.message); return; }
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content_encrypted, nonce, plaintext: text.trim() } : m));
  }, [user, peerId]);

  const deleteMessage = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("private_messages").delete().eq("id", id).eq("sender_id", user.id);
    if (error) { toast.error(error.message); return; }
    setMessages(prev => prev.filter(m => m.id !== id));
  }, [user]);

  return { messages, loading, send, editMessage, deleteMessage };
};
