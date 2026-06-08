import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ActiveTimeout { id: string; reason: string; expires_at: string; created_at: string; }
export interface ActiveBan { id: string; reason: string; expires_at: string | null; created_at: string; }

export const useModerationStatus = () => {
  const { user } = useAuth();
  const [timeout_, setTimeout_] = useState<ActiveTimeout | null>(null);
  const [ban, setBan] = useState<ActiveBan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setTimeout_(null); setBan(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const [{ data: tos }, { data: bs }] = await Promise.all([
        (supabase as any).from("user_timeouts")
          .select("id, reason, expires_at, created_at")
          .eq("user_id", user.id).is("revoked_at", null).gt("expires_at", nowIso)
          .order("expires_at", { ascending: false }).limit(1),
        (supabase as any).from("user_bans")
          .select("id, reason, expires_at, created_at")
          .eq("user_id", user.id).is("revoked_at", null)
          .order("created_at", { ascending: false }).limit(5),
      ]);
      if (cancelled) return;
      setTimeout_((tos?.[0] as ActiveTimeout) || null);
      const activeBan = (bs as ActiveBan[] | null)?.find(b => b.expires_at === null || new Date(b.expires_at) > new Date()) || null;
      setBan(activeBan);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { timeout: timeout_, ban, isBlocked: !!(timeout_ || ban), loading };
};
