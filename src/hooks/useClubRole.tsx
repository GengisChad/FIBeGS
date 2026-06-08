import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ClubRole = "leader" | "vice_leader" | "staff" | "member" | null;

export const useClubRole = (clubId?: string) => {
  const { user } = useAuth();
  const [role, setRole] = useState<ClubRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !clubId) {
      setRole(null);
      setLoading(false);
      return;
    }

    // Check sessionStorage cache to avoid redundant queries
    const cacheKey = `club_role_${user.id}_${clubId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setRole(cached === "none" ? null : cached as ClubRole);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle();

      const r = (data?.role as ClubRole) ?? null;
      setRole(r);
      sessionStorage.setItem(cacheKey, r || "none");
      setLoading(false);
    };

    fetchRole();
  }, [user, clubId]);

  const isStaff = role === "leader" || role === "vice_leader" || role === "staff";
  const isLeader = role === "leader";
  const isViceLeader = role === "vice_leader";

  return { role, isStaff, isLeader, isViceLeader, loading };
};

export const useUserClubs = () => {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Array<{ club_id: string; role: string; clubs: { id: string; name: string } }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setClubs([]);
      setLoading(false);
      return;
    }

    // Cache user clubs in session
    const cacheKey = `user_clubs_${user.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setClubs(JSON.parse(cached));
        setLoading(false);
        return;
      } catch { /* fall through */ }
    }

    const fetchClubs = async () => {
      const { data } = await supabase
        .from("club_members")
        .select("club_id, role, clubs(id, name)")
        .eq("user_id", user.id);

      const result = (data as any) ?? [];
      setClubs(result);
      sessionStorage.setItem(cacheKey, JSON.stringify(result));
      setLoading(false);
    };

    fetchClubs();
  }, [user]);

  const staffClubs = clubs.filter((c) => c.role === "leader" || c.role === "vice_leader" || c.role === "staff");

  return { clubs, staffClubs, loading };
};
