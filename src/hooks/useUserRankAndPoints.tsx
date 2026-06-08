import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserRankInfo {
  points: number;
  rank: number | null;
}

const fetchUserRank = async (userId: string): Promise<UserRankInfo> => {
  const { data: profile } = await supabase
    .from("profiles")
    .select("points, wins")
    .eq("user_id", userId)
    .maybeSingle();

  const points = profile?.points ?? 0;
  const wins = (profile as any)?.wins ?? 0;
  if (!points || points <= 0) return { points: 0, rank: null };

  // Match the seasonal national ranking sort: by points DESC, then wins DESC.
  // Count anyone strictly above OR (same points and more wins).
  const [
    { count: profileGtPoints },
    { count: profileEqPoints },
    { count: childGtPoints },
    { count: childEqPoints },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gt("points", points)
      .not("display_name", "like", "[BOT]%")
      .not("display_name", "like", "[Guest]%"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("points", points)
      .gt("wins", wins)
      .not("display_name", "like", "[BOT]%")
      .not("display_name", "like", "[Guest]%"),
    supabase
      .from("child_profiles")
      .select("*", { count: "exact", head: true })
      .gt("points", points),
    supabase
      .from("child_profiles")
      .select("*", { count: "exact", head: true })
      .eq("points", points)
      .gt("wins", wins),
  ]);

  const ahead =
    (profileGtPoints || 0) + (profileEqPoints || 0) + (childGtPoints || 0) + (childEqPoints || 0);
  return { points, rank: ahead + 1 };
};

export const useUserRankAndPoints = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-rank-points", user?.id],
    queryFn: () => fetchUserRank(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
};
