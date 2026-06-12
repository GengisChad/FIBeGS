// ============================================================
// FIBeGS — Hook PONTE (sola lettura).
// Riusa le STESSE query della home reale (stesse query key + stesse
// funzioni fetch gia' esistenti) per popolare la Home FIBeGS su /anteprima.
// NON duplica la logica, NON scrive nulla, NON apre nuovi client.
// Dove un dato non esiste / non e' raggiungibile -> fallback src/lib/ibnf-data.ts.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { fetchNetworkData } from "@/components/NetworkRecap";
import { fetchTournamentsData } from "@/components/TournamentsPreview";
import {
  fibStats,
  fibPodium,
  fibClubs,
  fibTournaments,
  fibSeason,
  type Stat,
  type Player,
  type Club,
  type Tournament,
} from "@/lib/ibnf-data";

type NetworkData = Awaited<ReturnType<typeof fetchNetworkData>>;
type TournamentsData = Awaited<ReturnType<typeof fetchTournamentsData>>;
type RawTournament = TournamentsData["upcoming"][number];

const STALE = 15 * 60 * 1000;
const MONTHS = fibSeason.months;

const displayName = (p: { display_name: string | null; username: string | null }) =>
  p.display_name?.trim() || p.username?.trim() || "Blader";

function buildStats(net: NetworkData): Stat[] {
  const year = new Date().getFullYear();
  return [
    { key: "bladers", label: "Bladers registrati", value: net.stats.bladers, icon: "users" },
    { key: "clubs", label: "Club attivi", value: net.stats.clubs, icon: "shield" },
    { key: "regions", label: "Regioni", value: net.stats.regions, icon: "pin" },
    { key: "tournaments", label: `Tornei ${year}`, value: net.stats.tournamentsYear, icon: "trophy" },
  ];
}

// Podio ordinato per il layout del kit: [2°, 1°, 3°] (1° al centro)
function buildPodium(net: NetworkData): Player[] {
  const top3 = net.top10.slice(0, 3).map((p, i) => ({
    rank: i + 1,
    name: displayName(p),
    city: p.city ?? undefined,
    points: p.points,
    verified: !p.isChild,
  }));
  return [top3[1], top3[0], top3[2]].filter(Boolean) as Player[];
}

function buildClubs(net: NetworkData): Club[] {
  return net.top10Clubs.slice(0, 6).map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city ?? "",
    members: c.member_count,
    logoUrl: c.logo_url,
  }));
}

function kindOf(t: RawTournament): Tournament["kind"] {
  if (t.team_mode === "clubs") return "Club";
  if (t.is_ranked) return "Nazionale";
  return "Unranked";
}

function buildTournaments(data: TournamentsData): Tournament[] {
  return data.upcoming.slice(0, 5).map((t) => {
    const d = new Date(t.event_date);
    const valid = !Number.isNaN(d.getTime());
    return {
      id: t.id,
      day: valid ? String(d.getDate()).padStart(2, "0") : "--",
      month: valid ? MONTHS[d.getMonth()] : "",
      name: t.title,
      kind: kindOf(t),
      city: t.city,
      entrants: data.registrationCounts[t.id] ?? 0,
      open: t.status === "pending",
    };
  });
}

export interface FibHomeData {
  stats: Stat[];
  podium: Player[];
  clubs: Club[];
  tournaments: Tournament[];
  season: typeof fibSeason;
  isLoading: boolean;
  /** true quando uno o piu' blocchi mostrano i dati mock di fallback */
  usingFallback: boolean;
}

export function useFibHomeData(): FibHomeData {
  const network = useQuery({
    queryKey: ["network-recap-v2"],
    queryFn: fetchNetworkData,
    staleTime: STALE,
  });
  const tournaments = useQuery({
    queryKey: ["homepage-tournaments"],
    queryFn: fetchTournamentsData,
    staleTime: STALE,
  });

  const net = network.data;
  const tour = tournaments.data;

  const hasStats = !!net;
  const hasPodium = !!net && net.top10.length >= 3;
  const hasClubs = !!net && net.top10Clubs.length > 0;
  const hasTournaments = !!tour && tour.upcoming.length > 0;

  return {
    stats: hasStats ? buildStats(net!) : fibStats,
    podium: hasPodium ? buildPodium(net!) : fibPodium,
    clubs: hasClubs ? buildClubs(net!) : fibClubs,
    tournaments: hasTournaments ? buildTournaments(tour!) : fibTournaments,
    season: fibSeason,
    isLoading: network.isLoading || tournaments.isLoading,
    usingFallback: !hasStats || !hasPodium || !hasClubs || !hasTournaments,
  };
}
