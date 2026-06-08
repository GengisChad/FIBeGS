import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChatDock } from "@/stores/chatDockStore";
import { openOrCreateChat } from "@/hooks/usePrivateChat";

/**
 * Opens a private chat with another user as a docked chat window (Social Hub style).
 * Works from any page — replaces the old `window.location.href = '/?chat=...'` pattern.
 */
export const useStartPrivateChat = () => {
  const { user } = useAuth();
  const { openChat } = useChatDock();

  return useCallback(async (peerId: string) => {
    if (!user || !peerId || peerId === user.id) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .eq("user_id", peerId)
      .maybeSingle();
    const chatId = await openOrCreateChat(user.id, peerId);
    if (!chatId) return;
    openChat({
      kind: "private",
      peerId,
      chatId,
      displayName: p?.display_name || p?.username || "Utente",
      avatarUrl: p?.avatar_url ?? null,
      username: p?.username ?? null,
    });
  }, [user, openChat]);
};
