import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PrivateChatView } from "@/components/chat/PrivateChatView";
import type { FriendProfile } from "@/hooks/useFriends";

/**
 * Minimal chat surface used inside the Android floating-bubble WebView.
 *
 * URL: /chat-embed?id=<chatId>
 * Optional auth bootstrap via location.hash: #token=<jwt>
 *   (when injected by the native overlay we don't have the user's session yet)
 */
const EmbeddedChat = () => {
  const [params] = useSearchParams();
  const chatId = params.get("id") || "";
  const { user } = useAuth();
  const [peer, setPeer] = useState<FriendProfile | null>(null);
  const [ready, setReady] = useState(false);

  // Hash-based token bootstrap (native overlay passes #token=...)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("token=")) { setReady(true); return; }
    const token = new URLSearchParams(hash.slice(1)).get("token");
    if (!token) { setReady(true); return; }
    supabase.auth.setSession({ access_token: token, refresh_token: token })
      .catch(() => {})
      .finally(() => {
        // strip hash to avoid leaking the token in logs
        history.replaceState(null, "", window.location.pathname + window.location.search);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!user || !chatId) return;
    let cancelled = false;
    (async () => {
      const { data: chat } = await supabase
        .from("private_chats")
        .select("user_a, user_b")
        .eq("id", chatId)
        .maybeSingle();
      if (!chat || cancelled) return;
      const peerId = chat.user_a === user.id ? chat.user_b : chat.user_a;
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .eq("user_id", peerId)
        .maybeSingle();
      if (!cancelled && profile) setPeer(profile as FriendProfile);
    })();
    return () => { cancelled = true; };
  }, [user, chatId]);

  if (!ready) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Caricamento…</div>;
  }
  if (!user) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground p-6 text-center">Accedi a FIBApp per usare la chat floating.</div>;
  }
  if (!chatId || !peer) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Chat non disponibile.</div>;
  }

  return (
    <div className="h-screen w-screen bg-background">
      <PrivateChatView chatId={chatId} peer={peer} compact />
    </div>
  );
};

export default EmbeddedChat;
