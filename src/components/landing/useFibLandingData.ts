// ============================================================
// FIB — Bridge dati Direzione B (SOLA LETTURA).
// Riusa le STESSE query della home reale (stesse query key + funzioni fetch
// gia' esistenti) e le mappa ai tipi del kit B. Nessuna scrittura, nessun
// nuovo client, niente motore tornei. Fallback -> src/lib/fib-landing-data.ts.
//   - Numeri / Classifica Top10 / Club  <- network-recap-v2 (fetchNetworkData)
//   - Prossimo evento                   <- homepage-tournaments (fetchTournamentsData)
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { fetchNetworkData } from "@/components/NetworkRecap";
import { fetchTournamentsData } from "@/components/TournamentsPreview";
import {
  stats as mockStats,
  clubs as mockClubs,
  leaderboard as mockLeaderboard,
  nextEvent as mockNextEvent,
  type Stat,
  type Club,
  type Player,
} from "@/lib/fib-landing-data";

type NetworkData = Awaited<ReturnType<typeof fetchNetworkData>>;
type TournamentsData = Awaited<ReturnType<typeof fetchTournamentsData>>;

const STALE = 15 * 60 * 1000;
const RINGS = ["#b64bff", "#7a2cff", "#a6ff00", "#3fd0ff", "#7a2cff", "#a6ff00", "#b64bff"];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const displayName = (p: { display_name: string | null; username: string | null }) =>
  p.display_name?.trim() || p.username?.trim() || "Blader";

function buildStats(net: NetworkData): Stat[] {
  const year = new Date().getFullYear();
  return [
    { key: "bladers", label: "Bladers registrati", value: net.stats.bladers, icon: "users", premium: true },
    { key: "clubs", label: "Club attivi", value: net.stats.clubs, icon: "shield" },
    { key: "regions", label: "Regioni attive", value: net.stats.regions, icon: "pin" },
    { key: "tournaments", label: `Tornei ${year}`, value: net.stats.tournamentsYear, icon: "trophy" },
  ];
}

function buildClubs(net: NetworkData): Club[] {
  const list = net.top10Clubs.slice(0, 7);
  const mid = Math.floor((list.length - 1) / 2);
  return list.map((c, i) => ({
    id: c.id,
    name: c.name,
    city: c.city ?? "",
    ring: RINGS[i % RINGS.length],
    featured: i === mid,
  }));
}

function buildLeaderboard(net: NetworkData): Player[] {
  return net.top10.slice(0, 10).map((p, i) => ({
    rank: i + 1,
    name: displayName(p),
    city: p.city ?? "",
    points: p.points,
  }));
}

function buildNextEvent(tour: TournamentsData): typeof mockNextEvent | null {
  const t = tour.upcoming[0];
  if (!t) return null;
  const d = new Date(t.event_date);
  if (Number.isNaN(d.getTime())) return null;
  const hhmm = format(d, "HH:mm");
  return {
    place: t.city ? `${t.title}, ${t.city}` : t.title,
    date: cap(format(d, "EEEE d MMMM, yyyy", { locale: it })),
    checkin: hhmm === "00:00" ? "10:00" : hhmm,
    startsInSeconds: Math.max(0, Math.floor((d.getTime() - Date.now()) / 1000)),
  };
}

export interface FibLandingData {
  stats: Stat[];
  clubs: Club[];
  leaderboard: Player[];
  nextEvent: typeof mockNextEvent;
  isLoading: boolean;
  /** true quando uno o piu' blocchi usano i dati mock di fallback */
  usingFallback: boolean;
}

export function useFibLandingData(): FibLandingData {
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
  const hasClubs = !!net && net.top10Clubs.length > 0;
  const hasLeaderboard = !!net && net.top10.length > 0;
  const event = tour ? buildNextEvent(tour) : null;

  return {
    stats: hasStats ? buildStats(net!) : mockStats,
    clubs: hasClubs ? buildClubs(net!) : mockClubs,
    leaderboard: hasLeaderboard ? buildLeaderboard(net!) : mockLeaderboard,
    nextEvent: event ?? mockNextEvent,
    isLoading: network.isLoading || tournaments.isLoading,
    usingFallback: !hasStats || !hasClubs || !hasLeaderboard || !event,
  };
}
