import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type Friendship = {
  id: string;
  user_a: string;
  user_b: string;
  status: "pending" | "accepted" | "blocked";
  requested_by: string;
  created_at: string;
};

export type FriendProfile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export const useFriends = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FriendProfile>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any).from("friendships")
      .select("id, user_a, user_b, status, requested_by, created_at")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    const fr = (data || []) as Friendship[];
    setRows(fr);
    const otherIds = Array.from(new Set(fr.map(f => f.user_a === user.id ? f.user_b : f.user_a)));
    if (otherIds.length > 0) {
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", otherIds);
      const map: Record<string, FriendProfile> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    } else {
      setProfiles({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`friendships-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, reload]);

  const sendRequest = useCallback(async (otherId: string) => {
    if (!user || otherId === user.id) return;
    const a = user.id < otherId ? user.id : otherId;
    const b = user.id < otherId ? otherId : user.id;
    const { error } = await (supabase as any).from("friendships").insert({
      user_a: a, user_b: b, requested_by: user.id, status: "pending",
    });
    if (error) {
      if (error.code === "23505") toast.error("Richiesta già esistente");
      else toast.error(error.message);
    } else {
      toast.success("Richiesta inviata");
      reload();
    }
  }, [user, reload]);

  const respond = useCallback(async (id: string, accept: boolean) => {
    if (accept) {
      await (supabase as any).from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id);
      toast.success("Amicizia accettata");
    } else {
      await (supabase as any).from("friendships").delete().eq("id", id);
      toast("Richiesta rifiutata");
    }
    reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await (supabase as any).from("friendships").delete().eq("id", id);
    reload();
  }, [reload]);

  if (!user) return { friends: [], incoming: [], outgoing: [], profiles, loading, sendRequest, respond, remove, reload };

  const friends = rows.filter(r => r.status === "accepted");
  const incoming = rows.filter(r => r.status === "pending" && r.requested_by !== user.id);
  const outgoing = rows.filter(r => r.status === "pending" && r.requested_by === user.id);

  return { friends, incoming, outgoing, profiles, loading, sendRequest, respond, remove, reload };
};

export const getFriendStatus = (
  rows: Friendship[],
  myId: string,
  otherId: string,
): "none" | "pending_in" | "pending_out" | "accepted" => {
  const a = myId < otherId ? myId : otherId;
  const b = myId < otherId ? otherId : myId;
  const row = rows.find(r => r.user_a === a && r.user_b === b);
  if (!row) return "none";
  if (row.status === "accepted") return "accepted";
  return row.requested_by === myId ? "pending_out" : "pending_in";
};
