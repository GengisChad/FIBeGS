import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCached, setCache } from "@/lib/queryPersister";

/**
 * Shared cached query for regions - used across Auth, Tournaments, Rankings, Clubs, Profile etc.
 * Regions almost never change, so we cache with Infinity staleTime + localStorage persistence.
 */
export const useRegions = () => {
  return useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("regions")
        .select("id, name, code")
        .order("name");
      const result = data ?? [];
      setCache(["regions"], result);
      return result;
    },
    initialData: () => getCached<any[]>(["regions"]),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
};

/**
 * Collection catalog data - categories, components, variants, links, stats.
 * This data is admin-managed and changes rarely. Cache for 30 minutes.
 */
export const useCollectionCatalog = () => {
  return useQuery({
    queryKey: ["collection-catalog"],
    queryFn: async () => {
      const fetchPagedRows = async <T,>(queryFactory: (from: number, to: number) => any) => {
        const PAGE_SIZE = 1000;
        const rows: T[] = [];

        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await queryFactory(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          rows.push(...((data ?? []) as T[]));
          if (!data || data.length < PAGE_SIZE) break;
        }

        return rows;
      };

      const [cats, comps, lnks, vars, vlinks, stats] = await Promise.all([
        supabase.from("collection_categories").select("id, name, image_url, sort_order, parent_id, is_products_only").order("sort_order"),
        fetchPagedRows((from, to) =>
          supabase.from("collection_components").select("id, category_id, name, image_url, weight_min, weight_max, recommended_price, sort_order").order("sort_order").range(from, to)
        ),
        supabase.from("collection_component_links").select("parent_component_id, linked_component_id"),
        fetchPagedRows((from, to) =>
          supabase.from("collection_component_variants").select("id, component_id, variant_name, image_url, sort_order").order("sort_order").range(from, to)
        ),
        supabase.from("collection_variant_links").select("parent_variant_id, linked_variant_id"),
        fetchPagedRows((from, to) =>
          supabase.from("collection_component_stats").select("component_id, stat_name, stat_value, stat_order").order("stat_order").range(from, to)
        ),
      ]);
      const result = {
        categories: cats.data ?? [],
        components: comps ?? [],
        links: lnks.data ?? [],
        variants: vars ?? [],
        variantLinks: vlinks.data ?? [],
        componentStats: stats ?? [],
      };
      setCache(["collection-catalog"], result);
      return result;
    },
    initialData: () => getCached<any>(["collection-catalog"]),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

/**
 * Rankings data - profiles with points, match wins, tournament counts.
 * Cached for 5 min in localStorage, stale after 2 min in react-query.
 */
export const useRankingsData = () => {
  return useQuery({
    queryKey: ["rankings-data-v11"],
    queryFn: async () => {
      const fetchAllRankedRows = async (table: "profiles" | "child_profiles", select: string) => {
        const PAGE_SIZE = 1000;
        const rows: any[] = [];

        for (let from = 0; from < 20000; from += PAGE_SIZE) {
          const { data, error } = await supabase
            .from(table)
            .select(select)
            .or("points.gt.0,points_monthly.gt.0")
            .order("points", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;
          rows.push(...(data ?? []));
          if (!data || data.length < PAGE_SIZE) break;
        }

        return rows;
      };

      const [profilesResRaw, childRes] = await Promise.all([
        fetchAllRankedRows("profiles", "id, user_id, username, display_name, avatar_url, banner_url, city, points, wins, points_monthly, wins_monthly, region_id"),
        fetchAllRankedRows("child_profiles", "id, parent_user_id, display_name, avatar_url, city, points, wins, points_monthly, wins_monthly, region_id"),
      ]);

      const profilesRes = profilesResRaw;

      const rankingUserIds = [
        ...profilesRes.map((p: any) => p.user_id),
        ...childRes.map((c: any) => c.id),
      ];

      const clubLookupUserIds = Array.from(new Set([
        ...profilesRes.map((p: any) => p.user_id),
        ...childRes.map((c: any) => c.parent_user_id).filter(Boolean),
      ]));

      let matchWinsMap = new Map<string, number>();
      let tournamentCountMap = new Map<string, number>();
      let clubRegionMap = new Map<string, string>();
      let clubInfoMap = new Map<string, { id: string; name: string; logo_url: string | null }>();

      if (rankingUserIds.length > 0) {
        // Paginate club_members_public to bypass PostgREST 1000-row server cap
        const fetchAllClubMembers = async () => {
          const PAGE = 1000;
          let from = 0;
          const all: Array<{ user_id: string | null; club_id: string | null }> = [];
          // hard cap at 20k to avoid infinite loops
          for (let i = 0; i < 20; i++) {
            const { data, error } = await supabase
              .from("club_members_public")
              .select("user_id, club_id")
              .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            all.push(...(data as any[]));
            if (data.length < PAGE) break;
            from += PAGE;
          }
          return all;
        };

        // Chunk the RPC to avoid PostgREST 1000-row result cap when many users
        const fetchAggInChunks = async () => {
          const CHUNK = 500;
          const all: any[] = [];
          for (let i = 0; i < rankingUserIds.length; i += CHUNK) {
            const slice = rankingUserIds.slice(i, i + CHUNK);
            const { data, error } = await supabase.rpc("get_aggregated_match_wins", { _user_ids: slice } as any);
            if (error) throw error;
            if (data) all.push(...(data as any[]));
          }
          return all;
        };

        const [aggAll, clubMembersAll, clubsRes] = await Promise.all([
          fetchAggInChunks(),
          fetchAllClubMembers(),
          supabase.from("clubs").select("id, name, logo_url, region_id").limit(2000),
        ]);
        const clubMembersRes = { data: clubMembersAll } as any;

        aggAll.forEach((row: any) => {
          matchWinsMap.set(row.user_id, Number(row.total_wins) || 0);
          tournamentCountMap.set(row.user_id, Number(row.tournament_count) || 0);
        });

        const clubsById = new Map<string, { id: string; name: string; logo_url: string | null; region_id: string | null }>();
        (clubsRes.data ?? []).forEach((c: any) => {
          clubsById.set(c.id, { id: c.id, name: c.name, logo_url: c.logo_url ?? null, region_id: c.region_id ?? null });
        });

        const clubLookupSet = new Set(clubLookupUserIds);
        (clubMembersRes.data ?? []).forEach((cm: any) => {
          if (!cm.user_id || !clubLookupSet.has(cm.user_id)) return;
          const club = clubsById.get(cm.club_id);
          if (!club) return;
          if (club.region_id) clubRegionMap.set(cm.user_id, club.region_id);
          if (!clubInfoMap.has(cm.user_id)) {
            clubInfoMap.set(cm.user_id, { id: club.id, name: club.name, logo_url: club.logo_url });
          }
        });
      }

      const regularProfiles = profilesRes.map((p: any) => ({
        ...p,
        is_child: false,
        match_wins: matchWinsMap.get(p.user_id) ?? 0,
        tournament_count: tournamentCountMap.get(p.user_id) ?? 0,
        club_region_id: clubRegionMap.get(p.user_id) ?? null,
        club_id: clubInfoMap.get(p.user_id)?.id ?? null,
        club_name: clubInfoMap.get(p.user_id)?.name ?? null,
        club_logo_url: clubInfoMap.get(p.user_id)?.logo_url ?? null,
      }));

      const childProfiles = childRes.map((c: any) => {
        const parentClub = clubInfoMap.get(c.parent_user_id);
        return {
          id: c.id,
          user_id: c.id,
          username: null,
          display_name: c.display_name,
          avatar_url: c.avatar_url,
          banner_url: null,
          city: c.city,
          points: c.points,
          wins: c.wins,
          points_monthly: c.points_monthly ?? 0,
          wins_monthly: c.wins_monthly ?? 0,
          match_wins: matchWinsMap.get(c.id) ?? 0,
          tournament_count: tournamentCountMap.get(c.id) ?? 0,
          region_id: c.region_id,
          is_child: true,
          club_region_id: clubRegionMap.get(c.parent_user_id) ?? null,
          club_id: parentClub?.id ?? null,
          club_name: parentClub?.name ?? null,
          club_logo_url: parentClub?.logo_url ?? null,
        };
      });

      const allProfiles = [...regularProfiles, ...childProfiles].sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.match_wins !== a.match_wins) return b.match_wins - a.match_wins;
        if (a.tournament_count !== b.tournament_count) return a.tournament_count - b.tournament_count;
        return (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
      });

      setCache(["rankings-data-v11"], allProfiles);
      return allProfiles;
    },
    initialData: () => getCached<any[]>(["rankings-data-v11"]),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Ranking seasons - active + closed seasons.
 */
export const useRankingSeasons = () => {
  return useQuery({
    queryKey: ["ranking-seasons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ranking_seasons")
        .select("id, name, start_date, end_date, is_active, closed_at, bfl, monthly_bfl_enabled, monthly_bfl")
        .order("created_at", { ascending: false });
      const result = data ?? [];
      setCache(["ranking-seasons"], result);
      return result;
    },
    initialData: () => getCached<any[]>(["ranking-seasons"]),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

/**
 * Clubs list with regions.
 */
export const useClubsList = () => {
  return useQuery({
    queryKey: ["clubs-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clubs")
        .select("id, name, description, logo_url, banner_url, city, is_active, latitude, longitude, region_id, regions(name, code), social_whatsapp_group, social_whatsapp_channel, social_discord, social_instagram, social_facebook, social_tiktok")
        .eq("is_active", true)
        .order("name");
      const result = data ?? [];
      setCache(["clubs-list"], result);
      return result;
    },
    initialData: () => getCached<any[]>(["clubs-list"]),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

/**
 * Full Italian municipalities list. ~7800 rows. Cached aggressively (24h).
 */
export const useMunicipalities = () => {
  return useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const PAGE = 1000;
      const all: Array<{ id: string; name: string; province: string; province_code: string; region_id: string }> = [];
      for (let page = 0; page < 15; page++) {
        const { data, error } = await supabase
          .from("municipalities")
          .select("id, name, province, province_code, region_id")
          .order("name")
          .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error || !data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < PAGE) break;
      }
      setCache(["municipalities"], all);
      return all;
    },
    initialData: () => getCached<any[]>(["municipalities"]),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 5 * 60 * 1000, // free ~7800 rows from RAM after unmount; localStorage cache still hydrates
  });
};

/**
 * Per-club member counts - aggregated server-side. Shared across pages.
 */
export const useClubMemberCounts = () => {
  return useQuery({
    queryKey: ["club-member-counts"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_club_member_counts");
      const result = (data ?? []) as any[];
      setCache(["club-member-counts"], result);
      return result;
    },
    initialData: () => getCached<any[]>(["club-member-counts"]),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

/**
 * Media categories (anime, manga sections).
 */
export const useMediaCategories = () => {
  return useQuery({
    queryKey: ["media-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("media_categories")
        .select("*")
        .order("sort_order");
      const result = data ?? [];
      setCache(["media-categories"], result);
      return result;
    },
    initialData: () => getCached<any[]>(["media-categories"]),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

/**
 * Badges list - used in profiles, achievements, etc.
 */
export const useBadges = () => {
  return useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("badges")
        .select("id, name, description, icon_url, color")
        .order("name");
      const result = data ?? [];
      setCache(["badges"], result);
      return result;
    },
    initialData: () => getCached<any[]>(["badges"]),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
};
