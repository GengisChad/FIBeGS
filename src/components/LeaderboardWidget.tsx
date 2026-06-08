import { Link } from "react-router-dom";
import { Trophy, Medal, Award, ChevronRight, User, Crown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface RankingProfile {
  id: string;
  user_id?: string;
  display_name: string | null;
  username: string | null;
  points: number;
  city: string | null;
  isChild?: boolean;
}

const profileLink = (p: RankingProfile) =>
  p.isChild ? `/profilo/child/${p.id}` : p.username ? `/profilo/${p.username}` : "#";

const fetchLeaderboard = async (userId: string | undefined) => {
  // Fetch both regular profiles AND child profiles (same as full rankings page)
  const [{ data: profilesRaw }, { data: children }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, user_id, display_name, username, points, city, wins")
      .gt("points", 0)
      .not("display_name", "like", "[BOT]%")
      .not("display_name", "like", "[Guest]%")
      .order("points", { ascending: false })
      .limit(50),
    supabase
      .from("child_profiles")
      .select("id, display_name, points, city, wins")
      .gt("points", 0)
      .order("points", { ascending: false })
      .limit(20),
  ]);

  // Filter out placeholder profiles (no real auth.users account)
  const candidateIds = (profilesRaw ?? []).map((p: any) => p.user_id).filter(Boolean);
  let realIds = new Set<string>(candidateIds);
  if (candidateIds.length > 0) {
    const { data: realRows } = await supabase.rpc("filter_real_user_ids", { _user_ids: candidateIds } as any);
    realIds = new Set(((realRows as any[]) ?? []).map((r: any) => r.user_id));
  }
  const profiles = (profilesRaw ?? []).filter((p: any) => realIds.has(p.user_id));

  // Merge and sort
  const allProfiles: RankingProfile[] = [
    ...(profiles ?? []).map(p => ({ ...p, isChild: false })),
    ...(children ?? []).map(c => ({
      id: c.id,
      user_id: c.id,
      display_name: c.display_name,
      username: null,
      points: c.points,
      city: c.city,
      wins: c.wins,
      isChild: true,
    })),
  ].sort((a, b) => b.points - a.points || ((b as any).wins ?? 0) - ((a as any).wins ?? 0)).slice(0, 10);

  let myRank: { rank: number; points: number; display_name: string | null; city: string | null } | null = null;

  if (userId) {
    const inTop10 = allProfiles.findIndex(p => p.user_id === userId);
    if (inTop10 >= 0) {
      const p = allProfiles[inTop10];
      myRank = { rank: inTop10 + 1, points: p.points, display_name: p.display_name, city: p.city };
    } else {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("display_name, points, city")
        .eq("user_id", userId)
        .maybeSingle();

      if (myProfile?.points && myProfile.points > 0) {
        // Count how many profiles+children have more points
        const [{ count: profileCount }, { count: childCount }] = await Promise.all([
          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .gt("points", myProfile.points)
            .not("display_name", "like", "[BOT]%")
            .not("display_name", "like", "[Guest]%"),
          supabase
            .from("child_profiles")
            .select("*", { count: "exact", head: true })
            .gt("points", myProfile.points),
        ]);

        myRank = {
          rank: (profileCount || 0) + (childCount || 0) + 1,
          points: myProfile.points,
          display_name: myProfile.display_name,
          city: myProfile.city,
        };
      }
    }
  }

  return { rankings: allProfiles as RankingProfile[], myRank };
};

const PodiumCard = ({ player, rank }: { player: RankingProfile; rank: number }) => {
  const config = {
    1: {
      icon: <Crown size={18} className="text-yellow-400" />,
      bg: "from-yellow-500/20 to-yellow-600/5",
      border: "border-yellow-500/30",
      badge: "bg-yellow-500 text-yellow-950",
      size: "text-base",
    },
    2: {
      icon: <Medal size={16} className="text-gray-300" />,
      bg: "from-gray-400/15 to-gray-500/5",
      border: "border-gray-400/25",
      badge: "bg-gray-400 text-gray-900",
      size: "text-sm",
    },
    3: {
      icon: <Award size={16} className="text-amber-600" />,
      bg: "from-amber-600/15 to-amber-700/5",
      border: "border-amber-600/25",
      badge: "bg-amber-600 text-amber-950",
      size: "text-sm",
    },
  }[rank]!;

  return (
    <div className={`relative rounded-xl border ${config.border} bg-gradient-to-b ${config.bg} p-3 transition-all hover:scale-[1.02] overflow-hidden`}>
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className={`w-7 h-7 rounded-full ${config.badge} flex items-center justify-center font-bold text-xs shrink-0`}>
          {rank}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <Link to={profileLink(player)} className={`${config.size} font-semibold truncate hover:underline ${!player.username && !player.isChild ? "pointer-events-none" : ""}`}>
            {player.display_name || player.username || "Anonimo"}
          </Link>
          {player.city && (
            <p className="text-xs text-muted-foreground truncate">{player.city}</p>
          )}
        </div>
        <div className="text-right shrink-0 ml-1">
          <p className="text-sm font-bold text-primary">{player.points}</p>
          <p className="text-[10px] text-muted-foreground">pts</p>
        </div>
      </div>
    </div>
  );
};

export const LeaderboardWidget = () => {
  const { user } = useAuth();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["homepage-leaderboard", user?.id],
    queryFn: () => fetchLeaderboard(user?.id),
    staleTime: 15 * 60 * 1000, // 15 min - rankings update only after tournaments
  });

  const rankings = data?.rankings ?? [];
  const myRank = data?.myRank ?? null;
  const podium = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden card-glow">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-primary" />
          <h3 className="font-display text-lg gradient-text">Classifica Nazionale</h3>
        </div>
        <Link to="/rankings" className="text-primary hover:text-primary/80 transition-colors">
          <ChevronRight size={20} />
        </Link>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* My Rank Banner */}
        {myRank && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary truncate">{myRank.display_name || "Tu"}</p>
                <p className="text-xs text-muted-foreground">
                  #{myRank.rank}{myRank.city && ` · ${myRank.city}`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-primary">{myRank.points}</span>
                <p className="text-[10px] text-muted-foreground">punti</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nessun blader in classifica</p>
        ) : (
          <>
            {/* Podium */}
            <div className="space-y-2">
              {podium.map((player, i) => (
                <PodiumCard key={player.id} player={player} rank={i + 1} />
              ))}
            </div>

            {/* Divider */}
            {rest.length > 0 && (
              <div className="border-t border-border/50" />
            )}

            {/* Rest of rankings */}
            {rest.length > 0 && (
              <ul className="space-y-0.5">
                {rest.map((player, index) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/40 transition-colors"
                  >
                    <span className="w-6 text-center text-xs font-medium text-muted-foreground">
                      {index + 4}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link to={profileLink(player)} className={`text-sm font-medium truncate hover:underline ${!player.username && !player.isChild ? "pointer-events-none" : ""}`}>
                        {player.display_name || player.username || "Anonimo"}
                      </Link>
                      {player.city && (
                        <p className="text-xs text-muted-foreground truncate">{player.city}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-primary tabular-nums">{player.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Footer CTA */}
      <Link
        to="/rankings"
        className="block text-center text-sm font-medium text-primary hover:text-primary/80 py-3 border-t border-border/50 transition-colors"
      >
        Vedi classifica completa →
      </Link>
    </div>
  );
};
