import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Calendar, MapPin, Shield, UserCheck, Star, Gamepad2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface UpcomingEvent {
  id: string;
  title: string;
  is_ranked: boolean;
  event_date: string;
  location: string | null;
  city: string | null;
  registered: number;
  max: number | null;
}

interface ClubBannerData {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  role: string;
  memberCount: number;
  tournamentsCount: number;
  rank: number | null;
  events: UpcomingEvent[];
}

const roleLabel = (role: string) => {
  switch (role) {
    case "leader": return "Fondatore";
    case "staff": return "Staff";
    default: return "Membro";
  }
};

const fetchClubData = async (userId: string): Promise<ClubBannerData | null> => {
  const { data: membership } = await supabase
    .from("club_members_public")
    .select("club_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership?.club_id) return null;

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, city, logo_url")
    .eq("id", membership.club_id)
    .maybeSingle();
  if (!club) return null;

  const todayIso = new Date().toISOString();

  const [
    { count: memberCount },
    { count: tournamentsCount },
    { data: tList },
    { data: clubMembers },
    { data: upcoming },
  ] = await Promise.all([
    supabase.from("club_members_public").select("*", { count: "exact", head: true }).eq("club_id", membership.club_id),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).eq("club_id", membership.club_id).eq("status", "completed"),
    supabase.from("tournaments").select("id").eq("club_id", membership.club_id),
    supabase.from("club_members_public").select("user_id").eq("club_id", membership.club_id),
    supabase
      .from("tournaments")
      .select("id, title, is_ranked, event_date, location, city, max_participants")
      .eq("club_id", membership.club_id)
      .gte("event_date", todayIso.slice(0, 10))
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("event_date", { ascending: true })
      .limit(6),
  ]);

  // Rank within club (include ALL members, even with 0 points)
  let rank: number | null = null;
  const tIds = (tList || []).map((t: any) => t.id);
  const memberIds = (clubMembers || []).map((m: any) => m.user_id);
  if (memberIds.length > 0) {
    const totals = new Map<string, number>();
    memberIds.forEach((uid: string) => totals.set(uid, 0));
    if (tIds.length > 0) {
      const { data: results } = await supabase
        .from("tournament_results")
        .select("user_id, scaled_points")
        .in("tournament_id", tIds);
      (results || []).forEach((r: any) => {
        if (totals.has(r.user_id)) {
          totals.set(r.user_id, (totals.get(r.user_id) || 0) + (Number(r.scaled_points) || 0));
        }
      });
    }
    const myPts = totals.get(userId) ?? 0;
    const sorted = Array.from(totals.values()).sort((a, b) => b - a);
    const idx = sorted.findIndex(p => p <= myPts);
    rank = (idx >= 0 ? idx : sorted.length - 1) + 1;
  }

  // Registrations counts for upcoming
  const upcomingIds = (upcoming || []).map((t: any) => t.id);
  const regCounts = new Map<string, number>();
  if (upcomingIds.length > 0) {
    const { data: regs } = await supabase
      .from("tournament_registrations")
      .select("tournament_id")
      .in("tournament_id", upcomingIds)
      .neq("status", "cancelled");
    (regs || []).forEach((r: any) => {
      regCounts.set(r.tournament_id, (regCounts.get(r.tournament_id) || 0) + 1);
    });
  }

  const events: UpcomingEvent[] = (upcoming || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    is_ranked: t.is_ranked,
    event_date: t.event_date,
    location: t.location,
    city: t.city,
    registered: regCounts.get(t.id) || 0,
    max: t.max_participants,
  }));

  return {
    id: club.id,
    name: club.name,
    city: club.city,
    logo_url: club.logo_url,
    role: membership.role,
    memberCount: memberCount || 0,
    tournamentsCount: tournamentsCount || 0,
    rank,
    events,
  };
};

const EventTicker = ({ events = [] }: { events?: UpcomingEvent[] }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (events.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % events.length), 4500);
    return () => clearInterval(id);
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground italic">
        Nessun evento in programma
      </div>
    );
  }

  const ev = events[idx];
  const dateStr = format(new Date(ev.event_date), "d MMM", { locale: it });
  const place = [ev.location, ev.city].filter(Boolean).join(" · ");

  return (
    <div className="relative h-full overflow-hidden">
      <div key={ev.id} className="flex flex-col gap-0.5 animate-fade-in h-full justify-center">
        {/* Riga 1: tipo + data */}
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] ${
              ev.is_ranked
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            }`}
          >
            {ev.is_ranked ? <Star size={9} /> : <Gamepad2 size={9} />}
            {ev.is_ranked ? "Ranked" : "Free Play"}
          </span>
          <span className="flex items-center gap-1 text-foreground font-semibold">
            <Calendar size={10} className="text-primary" />
            {dateStr}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground ml-auto shrink-0">
            <UserCheck size={10} className="text-primary" />
            <span className="font-semibold text-foreground">
              {ev.registered}{ev.max ? `/${ev.max}` : ""}
            </span>
          </span>
        </div>

        {/* Riga 2: location scrolling */}
        {place && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground overflow-hidden">
            <MapPin size={10} className="text-primary shrink-0" />
            <div className="relative flex-1 overflow-hidden whitespace-nowrap">
              <span className="inline-block animate-marquee font-medium text-foreground">
                {place}&nbsp;&nbsp;·&nbsp;&nbsp;{place}
              </span>
            </div>
          </div>
        )}

        {/* Indicatori */}
        {events.length > 1 && (
          <div className="flex gap-0.5 mt-0.5">
            {events.map((_, i) => (
              <span
                key={i}
                className={`h-0.5 flex-1 rounded-full transition-all ${
                  i === idx ? "bg-primary" : "bg-primary/20"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const HomeClubBanner = () => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["home-club-banner", user?.id],
    queryFn: () => fetchClubData(user!.id),
    enabled: !!user,
    staleTime: 15 * 60 * 1000,
  });

  if (!user || isLoading || !data) return null;

  const nextEvent = data.events[0];

  return (
    <div className="container mx-auto px-3 sm:px-4 pt-2">
      <Link
        to={`/clubs/${data.id}`}
        className="relative flex items-stretch gap-3 rounded-3xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 hover:from-primary/25 hover:via-primary/15 hover:to-primary/10 transition-all pl-2 pr-3 py-2 shadow-[0_2px_10px_-4px_hsl(var(--primary)/0.4)] overflow-hidden"
      >
        {/* SINISTRA: identità club */}
        <div className="flex items-center gap-2.5 lg:w-[42%] lg:shrink-0 min-w-0 flex-1 sm:flex-none">
          <div className="w-11 h-11 lg:w-14 lg:h-14 rounded-full overflow-hidden border border-primary/50 bg-background flex items-center justify-center shrink-0">
            {data.logo_url ? (
              <img src={data.logo_url} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              <Shield size={18} className="text-primary/60" />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[9px] uppercase tracking-[0.18em] text-primary/80 font-bold">
                Il tuo Club
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                <Shield size={10} className="text-primary" />
                <span className="font-semibold text-foreground">{roleLabel(data.role)}</span>
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-sm sm:text-base font-bold truncate leading-tight">{data.name}</span>
              {data.city && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                  <MapPin size={9} className="text-primary" />
                  <span className="truncate max-w-[80px]">{data.city}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1" title="La tua posizione nel club">
                <Trophy size={10} className="text-primary" />
                <span className="font-bold text-foreground">{data.rank ? `#${data.rank}` : "—"}</span>
                <span className="opacity-70">in club</span>
              </span>
              <span className="flex items-center gap-1" title="Membri">
                <Users size={10} className="text-primary" />
                <span className="font-bold text-foreground">{data.memberCount}</span>
                <span className="opacity-70">membri</span>
              </span>
              <span className="flex items-center gap-1" title="Tornei svolti">
                <Calendar size={10} className="text-primary" />
                <span className="font-bold text-foreground">{data.tournamentsCount}</span>
                <span className="opacity-70">tornei</span>
              </span>
            </div>
          </div>
        </div>

        <div
          className="hidden sm:block w-px shrink-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent, hsl(var(--primary)/0.5), transparent)",
            transform: "skewX(-18deg)",
          }}
          aria-hidden
        />

        <div className="hidden sm:flex flex-1 items-stretch min-w-0 pl-1">
          <div className="flex flex-col w-full min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[9px] uppercase tracking-[0.18em] text-primary/80 font-bold">
                {data.events.length > 0 ? "Prossimi eventi" : "Eventi del club"}
              </span>
              {data.events.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  <span className="font-bold text-foreground">{data.events.length}</span> in arrivo
                </span>
              )}
            </div>
            <div className="flex-1 min-h-[34px]">
              <EventTicker events={data.events} />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};
