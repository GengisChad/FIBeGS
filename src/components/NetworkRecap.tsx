import { Link } from "react-router-dom";
import { Trophy, Users, Shield, MapPin, Calendar, Award, Crown, Medal, ChevronRight, Play, Search, Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { CustomIcon } from "@/components/CustomIcon";
import { bncFallback } from "@/components/icons/BncIcon";

const VIDEO_YEARS = [2024, 2025] as const;
type VideoYear = (typeof VIDEO_YEARS)[number];
const DEFAULT_VIDEO_ID = "m5zQgw52nFw";

const extractYouTubeId = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const m = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : trimmed;
};

const fetchHomeVideos = async (): Promise<Record<VideoYear, string>> => {
  const keys = VIDEO_YEARS.map((y) => `home_video_${y}`);
  const { data } = await supabase.from("site_settings").select("key, value").in("key", keys);
  const out = {} as Record<VideoYear, string>;
  VIDEO_YEARS.forEach((y) => {
    const row = data?.find((r: any) => r.key === `home_video_${y}`);
    out[y] = row?.value || DEFAULT_VIDEO_ID;
  });
  return out;
};

interface RankingProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  points: number;
  city: string | null;
  isChild?: boolean;
}

interface RankingClub {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  member_count: number;
}

const fetchNetworkData = async () => {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

  const [
    { data: realBladersCount },
    { count: clubsCount },
    { count: tournamentsYear },
    { count: tournamentsUpcoming },
    { count: rankedTournamentsYear },
    { data: regionsData },
    { data: profiles },
    { data: children },
    { data: clubsList },
    countsRes,
  ] = await Promise.all([
    supabase.rpc("get_real_bladers_count" as any),
    supabase.from("clubs").select("*", { count: "exact", head: true }),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .gte("event_date", yearStart),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .gte("event_date", new Date().toISOString()),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .gte("event_date", yearStart)
      .eq("is_ranked", true)
      .eq("status", "completed"),
    supabase.from("clubs").select("region_id").not("region_id", "is", null),
    supabase
      .from("profiles")
      .select("id, display_name, username, points, city")
      .gt("points", 0)
      .not("display_name", "ilike", "[BOT]%")
      .not("display_name", "ilike", "[Guest]%")
      .order("points", { ascending: false })
      .limit(15),
    supabase
      .from("child_profiles")
      .select("id, display_name, points, city")
      .gt("points", 0)
      .order("points", { ascending: false })
      .limit(15),
    supabase.from("clubs").select("id, name, city, logo_url").eq("is_active", true),
    supabase.rpc("get_club_member_counts"),
  ]);

  const regions = new Set((regionsData ?? []).map((r: any) => r.region_id)).size;

  const top10: RankingProfile[] = [
    ...(profiles ?? []).map((p) => ({ ...p, isChild: false })),
    ...(children ?? []).map((c) => ({
      id: c.id,
      display_name: c.display_name,
      username: null,
      points: c.points,
      city: c.city,
      isChild: true,
    })),
  ]
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  const countMap = new Map<string, number>();
  for (const row of ((countsRes as any)?.data || [])) {
    countMap.set(row.club_id, Number(row.member_count));
  }
  const top10Clubs: RankingClub[] = (clubsList ?? [])
    .map((c: any) => ({ ...c, member_count: countMap.get(c.id) || 0 }))
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 10);

  return {
    stats: {
      bladers: typeof realBladersCount === "number" ? realBladersCount : 0,
      clubs: clubsCount ?? 0,
      regions,
      tournamentsYear: tournamentsYear ?? 0,
      tournamentsUpcoming: tournamentsUpcoming ?? 0,
      rankedTournamentsYear: rankedTournamentsYear ?? 0,
    },
    top10,
    top10Clubs,
  };
};

const profileLink = (p: RankingProfile) =>
  p.isChild ? `/profilo/child/${p.id}` : p.username ? `/profilo/${p.username}` : "#";

const formatStat = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("it-IT") : "—";

const StatBlock = ({
  icon: Icon,
  iconKey,
  value,
  label,
}: {
  icon: any;
  iconKey?: string;
  value: number | string;
  label: string;
  accent?: boolean;
}) => (
  <div className="ibnf-arena-card ibnf-arena-card--static">
    <span className="ibnf-arena-ico">
      {iconKey ? <CustomIcon iconKey={iconKey} fallback={Icon} size={56} /> : <Icon size={56} strokeWidth={2.2} />}
    </span>
    <span className="ibnf-arena-body">
      <span className="ibnf-arena-val">{value}</span>
      <span className="ibnf-arena-lbl">{label}</span>
    </span>
  </div>
);

const RankIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return <Crown size={14} className="text-yellow-400" />;
  if (rank === 2) return <Medal size={14} className="text-gray-300" />;
  if (rank === 3) return <Award size={14} className="text-amber-600" />;
  return <span className="text-xs font-medium text-muted-foreground tabular-nums">{rank}</span>;
};

export const NetworkRecap = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const initialYear: VideoYear = (VIDEO_YEARS as readonly number[]).includes(currentYear)
    ? (currentYear as VideoYear)
    : 2025;
  const [selectedYear, setSelectedYear] = useState<VideoYear>(initialYear);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [rankingTab, setRankingTab] = useState<"national" | "clubs">("national");

  useEffect(() => {
    if (!user) {
      setUserClubId(null);
      return;
    }
    supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setUserClubId(data?.club_id || null));
  }, [user]);

  const { data, isLoading } = useQuery({
    queryKey: ["network-recap-v2"],
    queryFn: fetchNetworkData,
    staleTime: 15 * 60 * 1000,
  });

  const { data: videos } = useQuery({
    queryKey: ["home-videos"],
    queryFn: fetchHomeVideos,
    staleTime: 30 * 60 * 1000,
  });

  const stats = data?.stats;
  const top10 = data?.top10 ?? [];
  const top10Clubs = data?.top10Clubs ?? [];
  const videoId = videos?.[selectedYear] || DEFAULT_VIDEO_ID;

  useEffect(() => {
    setVideoLoaded(false);
  }, [selectedYear]);

  const handleEditVideo = async () => {
    const current = videos?.[selectedYear] || "";
    const input = window.prompt(
      `URL o ID YouTube per il video ${selectedYear}:`,
      current
    );
    if (input === null) return;
    const newId = extractYouTubeId(input);
    if (!newId) {
      toast.error("ID video non valido");
      return;
    }
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: `home_video_${selectedYear}`, value: newId }, { onConflict: "key" });
    if (error) {
      toast.error("Errore nel salvataggio");
      return;
    }
    toast.success("Video aggiornato");
    queryClient.invalidateQueries({ queryKey: ["home-videos"] });
  };


  return (
    <section
      className="relative py-12 md:py-16 overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Background — aurora + liquid orbs */}
      <div className="fib-aurora opacity-70" />
      <div className="liquid-orbs">
        <span /><span /><span />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 fib-grid opacity-30" />
      </div>


      <div className="container mx-auto px-4 relative z-10">
        {/* Hero header — minimal, unified */}
        <div className="flex flex-col items-center text-center mb-10 md:mb-14 animate-fade-in">
          <BrandLogo className="h-20 md:h-24 w-auto mb-4 drop-shadow-[0_0_40px_hsl(var(--neon-1)/0.45)]" />
          <span className="text-primary font-semibold uppercase tracking-[0.35em] text-[10px] md:text-xs">
            Stagione {currentYear}
          </span>
          <h1 className="font-display text-3xl md:text-5xl tracking-wide mt-2">
            IL <span className="neon-dual-text">CIRCUITO</span> FIBeGS
          </h1>
          <p className="mt-4 max-w-xl text-sm md:text-base text-muted-foreground leading-relaxed px-4">
            Il circuito competitivo più grande in Italia. Tornei, club e
            classifiche — un'app creata dai Bladers per i Bladers.
          </p>
          <div className="neon-divider w-32 mt-6" />
        </div>

        {/* Stats — 4 KPI essenziali */}
        <div className="ibnf-arena ibnf-arena--4 mb-10 md:mb-14">
          <StatBlock
            icon={bncFallback("community")}
            iconKey="kpi.bladers"
            value={formatStat(stats?.bladers)}
            label="Bladers"
          />
          <StatBlock icon={bncFallback("club")} iconKey="kpi.clubs" value={formatStat(stats?.clubs)} label="Club" />
          <StatBlock
            icon={bncFallback("arena")}
            iconKey="kpi.tournaments"
            value={formatStat(stats?.tournamentsYear)}
            label={`Tornei ${currentYear}`}
          />
          <StatBlock
            icon={bncFallback("calendar")}
            iconKey="kpi.upcoming"
            value={formatStat(stats?.tournamentsUpcoming)}
            label="In programma"
          />
        </div>

        <div className="neon-divider mb-10 md:mb-14" />


        {/* Video + Top 10 side by side on desktop */}
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8 items-stretch">
          {/* Video */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-display text-xl md:text-2xl tracking-wide">
                  TORNEI <span className="neon-dual-text">NAZIONALI</span>
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  Rivivi le tappe nazionali FIBeGS stagione per stagione.
                </p>
              </div>
              <div className="flex gap-1.5 p-1 rounded-lg border border-border bg-card/60">
                {VIDEO_YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold tabular-nums transition-all ${
                      selectedYear === y
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div className="glass-panel relative w-full overflow-hidden animate-fade-in p-0">

              {isAdmin && (
                <button
                  onClick={handleEditVideo}
                  className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/80 backdrop-blur border border-border text-xs hover:bg-background transition-colors"
                  title={`Modifica video ${selectedYear}`}
                >
                  <Pencil size={12} />
                  Modifica
                </button>
              )}
              {!videoLoaded ? (
                <button
                  onClick={() => setVideoLoaded(true)}
                  className="relative w-full aspect-video bg-black flex items-center justify-center group cursor-pointer"
                >
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                    alt={`Tornei nazionali FIBeGS ${selectedYear}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-300" />
                  <div className="relative z-10 w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Play size={26} className="text-primary-foreground ml-1" fill="currentColor" />
                  </div>
                </button>
              ) : (
                <div className="aspect-video">
                  <iframe
                    key={videoId}
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                    title={`Tornei nazionali FIBeGS ${selectedYear}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>

            {/* CTAs - pushed to bottom on desktop to align with leaderboard footer */}
            <div className="flex flex-col sm:flex-row gap-3 mt-auto">
              <Link to="/tournaments" className="w-full sm:flex-1">
                <Button variant="hero" size="lg" className="w-full gap-2">
                  <Trophy size={18} />
                  Esplora i tornei
                </Button>
              </Link>
              {userClubId ? (
                <Link to={`/clubs/${userClubId}`} className="w-full sm:flex-1">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full gap-2 border-border hover:border-primary/50"
                  >
                    <Shield size={18} />
                    Il tuo Club
                  </Button>
                </Link>
              ) : (
                <Link to="/clubs" className="w-full sm:flex-1">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full gap-2 border-border hover:border-primary/50"
                  >
                    <Search size={18} />
                    Trova un Club
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 flex">
            <div className="glass-panel overflow-hidden relative flex flex-col w-full p-0">


              {/* diagonal corner accent */}
              <div
                className="absolute -top-6 -right-6 w-24 h-24 opacity-30"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)/0.4), transparent 70%)",
                  transform: "rotate(15deg)",
                }}
              />
              <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 bg-secondary/30 relative gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Trophy size={16} className="text-primary shrink-0" />
                  <h3 className="font-display text-sm md:text-base flex items-center gap-1.5 leading-none">
                    <span className="hidden sm:inline text-foreground">TOP 10</span>
                    <button
                      type="button"
                      onClick={() => setRankingTab("national")}
                      className={`transition-all ${
                        rankingTab === "national"
                          ? "gradient-text"
                          : "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                    >
                      NAZIONALE
                    </button>
                    <span
                      aria-hidden
                      className="inline-block w-3 h-4 -mx-0.5 opacity-60"
                      style={{
                        background:
                          "linear-gradient(105deg, transparent 45%, hsl(var(--border)) 45%, hsl(var(--border)) 55%, transparent 55%)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setRankingTab("clubs")}
                      className={`transition-all ${
                        rankingTab === "clubs"
                          ? "gradient-text"
                          : "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                    >
                      CLUBS
                    </button>
                  </h3>
                </div>
                <Link
                  to={rankingTab === "national" ? "/rankings" : "/clubs"}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 shrink-0"
                >
                  Tutti <ChevronRight size={14} />
                </Link>
              </div>

              {isLoading ? (
                <div className="p-3 space-y-1">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-7 bg-secondary/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : rankingTab === "national" ? (
                top10.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nessun blader in classifica
                  </p>
                ) : (
                  <ul className="divide-y divide-border/30">
                    {top10.map((player, idx) => {
                      const rank = idx + 1;
                      const isPodium = rank <= 3;
                      return (
                        <li
                          key={player.id}
                          className={`flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/30 transition-colors ${
                            isPodium ? "bg-primary/[0.04]" : ""
                          }`}
                        >
                          <div className="w-5 flex justify-center shrink-0">
                            <RankIcon rank={rank} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link
                              to={profileLink(player)}
                              className={`text-xs md:text-sm font-medium truncate hover:underline block ${
                                !player.username && !player.isChild ? "pointer-events-none" : ""
                              }`}
                            >
                              {player.display_name || player.username || "Anonimo"}
                            </Link>
                            {player.city && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {player.city}
                              </p>
                            )}
                          </div>
                          <span className="text-xs md:text-sm font-bold text-primary tabular-nums shrink-0 text-right whitespace-nowrap">
                            {player.points} <span className="text-[9px] font-normal text-muted-foreground uppercase tracking-wider">pt</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : top10Clubs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nessun club attivo
                </p>
              ) : (
                <ul className="divide-y divide-border/30">
                  {top10Clubs.map((club, idx) => {
                    const rank = idx + 1;
                    const isPodium = rank <= 3;
                    const isMine = userClubId === club.id;
                    return (
                      <li
                        key={club.id}
                        className={`flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/30 transition-colors ${
                          isMine
                            ? "bg-primary/15 ring-1 ring-inset ring-primary/40"
                            : isPodium
                            ? "bg-primary/[0.04]"
                            : ""
                        }`}
                      >
                        <div className="w-5 flex justify-center shrink-0">
                          <RankIcon rank={rank} />
                        </div>
                        {club.logo_url ? (
                          <img
                            src={club.logo_url}
                            alt={club.name}
                            className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <Shield size={12} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/clubs/${club.id}`}
                            className="text-xs md:text-sm font-medium truncate hover:underline block"
                          >
                            {club.name}
                          </Link>
                          {club.city && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {club.city}
                            </p>
                          )}
                        </div>
                        <span className="text-xs md:text-sm font-bold text-primary tabular-nums shrink-0 text-right whitespace-nowrap">
                          {club.member_count} <span className="text-[9px] font-normal text-muted-foreground uppercase tracking-wider">membri</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
