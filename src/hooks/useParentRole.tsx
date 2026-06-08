import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";

export interface ChildProfile {
  id: string;
  parent_user_id: string;
  display_name: string;
  city: string | null;
  region_id: string | null;
  avatar_url: string | null;
  points: number;
  wins: number;
  created_at: string;
  updated_at: string;
}

export const useParentRole = () => {
  const { user } = useAuth();
  const { isParent } = useUserRoles();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user || !isParent) {
      setChildren([]);
      setLoading(false);
      return;
    }

    const { data: childData } = await (supabase as any)
      .from("child_profiles")
      .select("id, display_name, avatar_url, city, points, wins, region_id, parent_user_id, created_at")
      .eq("parent_user_id", user.id)
      .order("created_at");

    setChildren((childData as any as ChildProfile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, isParent]);

  return { isParent, children, loading, refetch: fetchData };
};
