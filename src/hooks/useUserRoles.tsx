import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserRolesContextType {
  roles: string[];
  isAdmin: boolean;
  isStaff: boolean;
  isParent: boolean;
  isSponsor: boolean;
  isRegionalReferent: boolean;
  loading: boolean;
}

const UserRolesContext = createContext<UserRolesContextType>({
  roles: [],
  isAdmin: false,
  isStaff: false,
  isParent: false,
  isSponsor: false,
  isRegionalReferent: false,
  loading: true,
});

export const UserRolesProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const cacheKey = `user_roles_${user.id}`;

    const fetchRoles = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const fetched = (data || []).map((r) => r.role);
      setRoles(fetched);
      sessionStorage.setItem(cacheKey, JSON.stringify(fetched));
      setLoading(false);
    };

    // Use cache only for initial render, then always fetch fresh
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as string[];
        setRoles(parsed);
        setLoading(false);
      } catch { /* fall through */ }
    }

    // Always fetch fresh roles to catch changes
    fetchRoles();
  }, [user]);

  const isAdmin = roles.includes("admin");
  const isStaff = isAdmin || roles.includes("staff") || roles.includes("moderator");
  const isParent = roles.includes("parent");
  const isSponsor = roles.includes("sponsor");
  const isRegionalReferent = roles.includes("regional_referent");

  return (
    <UserRolesContext.Provider value={{ roles, isAdmin, isStaff, isParent, isSponsor, isRegionalReferent, loading }}>
      {children}
    </UserRolesContext.Provider>
  );
};

export const useUserRoles = () => useContext(UserRolesContext);
