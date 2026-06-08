import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EloTier {
  key: string;
  name: string;
  min_rating: number;
  max_rating: number | null;
  color_hex: string;
  glow_hex: string;
  sort_order: number;
}

export interface EloRating {
  user_id: string;
  rating: number;
  peak_rating: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  tier_key: string;
  last_match_at: string | null;
}

export interface EloMatch {
  id: string;
  source_match_id: string;
  tournament_id: string;
  player_id: string;
  opponent_id: string;
  result: "win" | "loss" | "draw";
  rating_before: number;
  rating_after: number;
  opponent_rating_before: number;
  delta: number;
  played_at: string;
}

export const useEloTiers = () =>
  useQuery({
    queryKey: ["beta-elo-tiers"],
    queryFn: async (): Promise<EloTier[]> => {
      const { data, error } = await (supabase as any)
        .from("beta_elo_tiers")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as EloTier[];
    },
    staleTime: 60 * 60 * 1000,
  });

export const useEloRating = (userId: string | undefined) =>
  useQuery({
    queryKey: ["beta-elo-rating", userId],
    queryFn: async (): Promise<EloRating | null> => {
      if (!userId) return null;
      const { data } = await (supabase as any)
        .from("beta_elo_ratings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return (data as EloRating) ?? null;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

export const useEloRecentMatches = (userId: string | undefined, limit = 10) =>
  useQuery({
    queryKey: ["beta-elo-recent", userId, limit],
    queryFn: async (): Promise<EloMatch[]> => {
      if (!userId) return [];
      const { data } = await (supabase as any)
        .from("beta_elo_matches")
        .select("*")
        .eq("player_id", userId)
        .order("played_at", { ascending: false })
        .limit(limit);
      return (data || []) as EloMatch[];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

export const useEloLeaderboard = (limit = 50) =>
  useQuery({
    queryKey: ["beta-elo-leaderboard", limit],
    queryFn: async () => {
      const { data: ratings } = await (supabase as any)
        .from("beta_elo_ratings")
        .select("user_id,rating,peak_rating,matches_played,wins,losses,draws,tier_key")
        .order("rating", { ascending: false })
        .limit(limit);
      const list = (ratings || []) as EloRating[];
      if (list.length === 0) return [];
      const ids = list.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return list.map((r) => ({ ...r, profile: map.get(r.user_id) || null }));
    },
    staleTime: 60 * 1000,
  });

export const tierFor = (rating: number, tiers: EloTier[]): EloTier | undefined => {
  return [...tiers]
    .reverse()
    .find((t) => rating >= t.min_rating && (t.max_rating == null || rating <= t.max_rating));
};

/* ------------------------------------------------------------------ */
/*  BNC Ladder Elo v1.0 — divisioni                                   */
/* ------------------------------------------------------------------ */

// Tier che hanno le 4 divisioni romane (IV → I).
const DIVISIONED_TIERS = new Set(["sfidante", "combattente", "veterano", "elite"]);
const DIVISION_WIDTH = 75; // ogni divisione larga 75 punti
const DIVISION_LABELS = ["IV", "III", "II", "I"] as const;

export interface DivisionInfo {
  /** Etichetta della divisione (es. "II"), o null se tier apex senza divisioni. */
  label: string | null;
  /** Indice 0-3 (0 = IV, 3 = I), o null per apex. */
  index: number | null;
  /** Elo di inizio della divisione corrente (o del tier per apex). */
  divisionMin: number;
  /** Elo di fine della divisione corrente (o del tier per apex; Infinity per Leggenda). */
  divisionMax: number;
  /** Progresso 0-100 dentro la divisione corrente. */
  divisionProgress: number;
  /** Progresso 0-100 dentro l'intero tier (per la barra "verso prossimo tier"). */
  tierProgress: number;
  /** Punti che mancano alla promozione (divisione successiva o tier successivo). */
  pointsToNext: number;
  /** Etichetta della prossima soglia: "Combattente IV" o "Maestro". */
  nextLabel: string | null;
}

export const divisionFor = (
  rating: number,
  tier: EloTier | undefined,
  allTiers: EloTier[],
): DivisionInfo => {
  if (!tier) {
    return {
      label: null,
      index: null,
      divisionMin: rating,
      divisionMax: rating,
      divisionProgress: 0,
      tierProgress: 0,
      pointsToNext: 0,
      nextLabel: null,
    };
  }

  const sorted = [...allTiers].sort((a, b) => a.sort_order - b.sort_order);
  const nextTier = sorted.find((t) => t.min_rating > rating);

  if (!DIVISIONED_TIERS.has(tier.key)) {
    // Apex (Maestro / Gran Maestro / Leggenda) — niente divisioni.
    const maxR = tier.max_rating ?? rating + 200; // Leggenda è aperta
    const span = (tier.max_rating ?? rating + 200) - tier.min_rating;
    const tierProgress =
      tier.max_rating == null
        ? 100
        : Math.min(100, Math.max(0, ((rating - tier.min_rating) / Math.max(1, span)) * 100));
    return {
      label: null,
      index: null,
      divisionMin: tier.min_rating,
      divisionMax: maxR,
      divisionProgress: tierProgress,
      tierProgress,
      pointsToNext: nextTier ? nextTier.min_rating - rating : 0,
      nextLabel: nextTier ? nextTier.name : null,
    };
  }

  // Tier con divisioni: ogni divisione è larga 75 pt.
  const offset = rating - tier.min_rating;
  const rawIdx = Math.floor(offset / DIVISION_WIDTH);
  const idx = Math.min(3, Math.max(0, rawIdx));
  const divisionMin = tier.min_rating + idx * DIVISION_WIDTH;
  const divisionMax = divisionMin + DIVISION_WIDTH - 1;
  const divisionProgress = Math.min(
    100,
    Math.max(0, ((rating - divisionMin) / DIVISION_WIDTH) * 100),
  );
  const tierSpan = (tier.max_rating ?? tier.min_rating + 300) - tier.min_rating + 1;
  const tierProgress = Math.min(
    100,
    Math.max(0, ((rating - tier.min_rating) / tierSpan) * 100),
  );

  // Prossima soglia: prossima divisione dentro lo stesso tier, oppure prossimo tier.
  let pointsToNext: number;
  let nextLabel: string | null;
  if (idx < 3) {
    pointsToNext = divisionMax + 1 - rating;
    nextLabel = `${tier.name} ${DIVISION_LABELS[idx + 1]}`;
  } else if (nextTier) {
    pointsToNext = nextTier.min_rating - rating;
    nextLabel = DIVISIONED_TIERS.has(nextTier.key) ? `${nextTier.name} IV` : nextTier.name;
  } else {
    pointsToNext = 0;
    nextLabel = null;
  }

  return {
    label: DIVISION_LABELS[idx],
    index: idx,
    divisionMin,
    divisionMax,
    divisionProgress,
    tierProgress,
    pointsToNext,
    nextLabel,
  };
};

/** Etichetta completa "Combattente II" o "Maestro". */
export const fullTierLabel = (tier: EloTier | undefined, division: DivisionInfo): string => {
  if (!tier) return "—";
  if (division.label) return `${tier.name} ${division.label}`;
  return tier.name;
};
