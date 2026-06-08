import { Link } from "react-router-dom";
import { ChevronRight, Shield, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface ClubWithCount {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  member_count: number;
}

const fetchClubsData = async (userId: string | undefined) => {
  // Fetch clubs + member counts via RPC (single aggregated query instead of full scan)
  const [clubsRes, countsRes, userMemberRes] = await Promise.all([
    supabase.from("clubs").select("id, name, city, logo_url").eq("is_active", true),
    supabase.rpc("get_club_member_counts"),
    userId
      ? supabase.from("club_members").select("club_id").eq("user_id", userId).limit(1)
      : Promise.resolve({ data: null }),
  ]);

  if (!clubsRes.data) return { clubs: [], userClub: null };

  const countMap = new Map<string, number>();
  for (const row of (countsRes.data || [])) {
    countMap.set(row.club_id, Number(row.member_count));
  }

  const clubsWithCount: ClubWithCount[] = clubsRes.data
    .map(club => ({ ...club, member_count: countMap.get(club.id) || 0 }))
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 10);

  const userClubId = userMemberRes.data?.[0]?.club_id ?? null;
  let userClub: ClubWithCount | null = null;
  if (userClubId) {
    const uc = clubsRes.data.find(c => c.id === userClubId);
    if (uc) userClub = { ...uc, member_count: countMap.get(userClubId) || 0 };
  }

  return { clubs: clubsWithCount, userClub };
};

export const ActiveClubsWidget = () => {
  const { user } = useAuth();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["homepage-clubs", user?.id],
    queryFn: () => fetchClubsData(user?.id),
    staleTime: 30 * 60 * 1000, // 30 min - clubs change rarely
  });

  const clubs = data?.clubs ?? [];
  const userClub = data?.userClub ?? null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 card-glow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg gradient-text flex items-center gap-2">
          <Shield size={18} /> Club Attivi
        </h3>
        <Link to="/clubs" className="text-primary hover:text-primary/80 transition-colors">
          <ChevronRight size={20} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-secondary/50 rounded animate-pulse" />)}
        </div>
      ) : (
        <>
          {userClub && (
            <Link
              to={`/clubs/${userClub.id}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30 mb-3 hover:bg-primary/20 transition-colors"
            >
              {userClub.logo_url ? (
                <img src={userClub.logo_url} alt={userClub.name} className="w-8 h-8 rounded-full object-cover border border-primary/30" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"><Shield size={14} className="text-primary" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Star size={12} className="text-primary shrink-0" />
                  <p className="text-sm font-semibold truncate">{userClub.name}</p>
                </div>
                {userClub.city && <p className="text-xs text-muted-foreground truncate">{userClub.city}</p>}
              </div>
              <span className="text-xs text-primary font-medium">{userClub.member_count} membri</span>
            </Link>
          )}

          <ul className="space-y-1.5">
            {clubs.filter(c => !userClub || c.id !== userClub.id).map((club, index) => (
              <li key={club.id}>
                <Link to={`/clubs/${club.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <span className="text-xs text-muted-foreground w-5 text-center font-medium">
                    {userClub && clubs.findIndex(c => c.id === club.id) >= 0 ? clubs.findIndex(c => c.id === club.id) + 1 : index + 1}
                  </span>
                  {club.logo_url ? (
                    <img src={club.logo_url} alt={club.name} className="w-7 h-7 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center"><Shield size={12} className="text-muted-foreground" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{club.name}</p>
                    {club.city && <p className="text-xs text-muted-foreground truncate">{club.city}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{club.member_count}</span>
                </Link>
              </li>
            ))}
          </ul>

          {clubs.length === 0 && !userClub && (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun club attivo</p>
          )}
        </>
      )}

      <Link to="/clubs" className="mt-4 block text-center text-sm text-primary hover:text-primary/80 font-medium transition-colors">
        Vedi tutti i club →
      </Link>
    </div>
  );
};
