import { useEffect, useState, useCallback, useId } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Counts unread private messages addressed to the current user
 * (messages in any of my private chats where sender != me AND read_at is null).
 */
export const useUnreadPrivateMessages = () => {
  const { user } = useAuth();
  const instanceId = useId();
  const [count, setCount] = useState(0);
  const [byChat, setByChat] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    if (!user) { setCount(0); setByChat({}); return; }
    const { data: chats } = await (supabase as any)
      .from("private_chats").select("id").or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    const ids = (chats || []).map((c: any) => c.id);
    if (ids.length === 0) { setCount(0); setByChat({}); return; }
    const { data: msgs } = await (supabase as any)
      .from("private_messages").select("chat_id")
      .in("chat_id", ids).is("read_at", null).neq("sender_id", user.id);
    const map: Record<string, number> = {};
    (msgs || []).forEach((m: any) => { map[m.chat_id] = (map[m.chat_id] || 0) + 1; });
    setByChat(map);
    setCount((msgs || []).length);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`unread-${user.id}-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages" }, () => reload())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_chats" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, reload, instanceId]);

  return { count, byChat, reload };
};
