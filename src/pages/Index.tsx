import { useState, useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Zap, Trophy, Flame, MapPin, Crown, Shield, User, Check,
  Sparkles, ArrowRight, Plus, Users, CalendarClock, Medal,
  Star, Globe, Building2, Home as HomeIcon, Calendar as CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { HomeEditableText } from "@/components/home/HomeEditableText";
import { CustomIcon } from "@/components/CustomIcon";
import { bncFallback } from "@/components/icons/BncIcon";
import { ArenaMark } from "@/components/icons/ArenaMark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useEloRating,
  useEloTiers,
  useEloLeaderboard,
  tierFor,
  divisionFor,
  fullTierLabel,
} from "@/hooks/useBetaElo";
import { useUserRankAndPoints } from "@/hooks/useUserRankAndPoints";

// ============================================================
// Data hooks
// ============================================================

const fetchHomeKpis = async () => {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const now = new Date().toISOString();
  const [
    { data: bladers },
    { count: clubs },
    { count: tournamentsYear },
    { count: ranked },
    { count: upcoming },
  ] = await Promise.all([
    supabase.rpc("get_real_bladers_count" as any),
    supabase.from("clubs").select("*", { count: "exact", head: true }),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).gte("event_date", yearStart),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).gte("event_date", yearStart).eq("is_ranked", true).eq("status", "completed"),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).gte("event_date", now),
  ]);
  return {
    bladers: typeof bladers === "number" ? bladers : 0,
    clubs: clubs ?? 0,
    tournamentsYear: tournamentsYear ?? 0,
    ranked: ranked ?? 0,
    upcoming: upcoming ?? 0,
  };
};

const fetchUpcomingEvents = async () => {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("tournaments")
    .select("id, title, city, event_date, max_participants, is_ranked, image_url, status, club_id, clubs(name, logo_url, banner_url)")
    .gte("event_date", now)
    .neq("status", "cancelled")
    .order("event_date", { ascending: true })
    .limit(6);
  const list = data || [];
  if (list.length === 0) return [];
  // Fetch registrations counts in parallel
  const counts = await Promise.all(
    list.map((t: any) =>
      supabase
        .from("tournament_registrations")
        .select("*", { count: "exact", head: true })
        .eq("tournament_id", t.id)
        .then(({ count }) => count ?? 0)
    )
  );
  return list.map((t: any, i: number) => ({ ...t, registered_count: counts[i] }));
};

const fetchTopClubs = async () => {
  const [{ data: clubs }, countsRes] = await Promise.all([
    supabase.from("clubs").select("id, name, city, logo_url").eq("is_active", true),
    supabase.rpc("get_club_member_counts"),
  ]);
  const counts = new Map<string, number>();
  for (const row of ((countsRes as any)?.data || [])) {
    counts.set(row.club_id, Number(row.member_count));
  }
  return (clubs || [])
    .map((c: any) => ({ ...c, member_count: counts.get(c.id) || 0 }))
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 8);
};

const fetchLatestNews = async () => {
  const { data } = await supabase
    .from("forum_posts")
    .select("id, title, content, category, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  return data || [];
};

const fetchMyClub = async (userId: string) => {
  const { data: m } = await supabase
    .from("club_members")
    .select("club_id, role, clubs(id, name, city, logo_url)")
    .eq("user_id", userId)
    .maybeSingle();
  return m;
};

const fetchMyProfile = async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url, city, region_id, points")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
};

const fetchMyRegionName = async (regionId: string | null | undefined) => {
  if (!regionId) return null;
  const { data } = await supabase.from("regions").select("name").eq("id", regionId).maybeSingle();
  return data?.name || null;
};

// Larger ELO leaderboard for client-side scope filtering (Nazionale / Regione / Città / Club)
const fetchEloScoped = async () => {
  const { data: ratings } = await (supabase as any)
    .from("beta_elo_ratings")
    .select("user_id,rating,matches_played,wins,losses,tier_key")
    .order("rating", { ascending: false })
    .limit(1000);
  const list = ratings || [];
  if (list.length === 0) return [];
  const ids = list.map((r: any) => r.user_id);
  const [{ data: profiles }, { data: members }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, username, avatar_url, city, region_id").in("user_id", ids),
    supabase.from("club_members").select("user_id, club_id").in("user_id", ids),
  ]);
  const pMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  const cMap = new Map((members || []).map((m: any) => [m.user_id, m.club_id]));
  return list.map((r: any) => ({ ...r, profile: pMap.get(r.user_id) || null, club_id: cMap.get(r.user_id) || null }));
};

// Top profiles by BFL points (season) for scoped BFL leaderboard
const fetchBflScoped = async () => {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, username, avatar_url, city, region_id, points, wins")
    .gte("points", 0)
    .not("display_name", "like", "[BOT]%")
    .not("display_name", "like", "[Guest]%")
    .order("points", { ascending: false })
    .order("wins", { ascending: false })
    .limit(1000);
  const list = profiles || [];
  if (list.length === 0) return [];
  const ids = list.map((p: any) => p.user_id);
  const { data: members } = await supabase.from("club_members").select("user_id, club_id").in("user_id", ids);
  const cMap = new Map((members || []).map((m: any) => [m.user_id, m.club_id]));
  return list.map((p: any) => ({
    user_id: p.user_id,
    points: p.points,
    profile: p,
    club_id: cMap.get(p.user_id) || null,
  }));
};

// ============================================================
// Helpers
// ============================================================

const fmt = (n: number | undefined | null) =>
  typeof n === "number" ? n.toLocaleString("it-IT") : "—";

const monoFor = (name: string) =>
  (name || "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 3)
    .join("")
    .toUpperCase() || "—";

const CCHIP_TONES = ["acid", "violet", "acid", "violet"] as const;
const CCHIP_RING: Record<string, string> = {
  acid: "var(--ibnf-acid)",
  violet: "var(--ibnf-violet)",
  cyan: "var(--ibnf-cyan)",
  coral: "var(--ibnf-coral)",
};

const CAT_TONE: Record<string, string> = {
  strategia: "violet",
  tornei: "acid",
  generale: "acid",
  mercato: "coral",
  guide: "violet",
  annunci_staff: "coral",
};

const CAT_LABEL: Record<string, string> = {
  strategia: "Strategia",
  tornei: "Tornei",
  generale: "Generale",
  mercato: "Mercato",
  guide: "Guide",
  annunci_staff: "Annunci",
};

// ============================================================
// Bento blocks
// ============================================================

// --- Arena stat icons (match reference image: hex/crest/spin) ---
const HexPointsIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    <path d="M32 4 L56 17 L56 47 L32 60 L8 47 L8 17 Z" />
    <path d="M20 23 L44 23" />
    <path d="M18 32 L46 32" />
    <path d="M20 41 L44 41" />
  </svg>
);
const CrownWinsIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    {/* Corona */}
    <path d="M18 14 L24 22 L32 10 L40 22 L46 14 L44 24 L20 24 Z" />
    {/* Crest a V con scariche laterali */}
    <path d="M12 26 L20 26 L32 56 L44 26 L52 26 L46 30 L38 28 L32 38 L26 28 L18 30 Z" />
    {/* Saette laterali */}
    <path d="M8 32 L14 34 L10 40" />
    <path d="M56 32 L50 34 L54 40" />
  </svg>
);
const ShootBeyIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    {/* Orbit (motion ring) */}
    <path d="M10 38 C 18 30, 46 30, 54 38" />
    <path d="M54 38 C 50 44, 30 48, 14 44" />
    {/* Beyblade top */}
    <ellipse cx="32" cy="32" rx="13" ry="5" />
    <path d="M19 32 L32 18 L45 32" />
    <path d="M24 32 L32 38 L40 32" />
    {/* Tip */}
    <path d="M32 38 L32 44" />
    {/* Speed flick */}
    <path d="M44 18 L52 14" />
    <path d="M46 24 L54 22" />
  </svg>
);

const ArenaStats = ({ kpis }: { kpis: any }) => {
  const { user } = useAuth();
  const { data: rankInfo } = useUserRankAndPoints();
  const { data: profile } = useQuery({
    queryKey: ["arena-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("wins, points")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as { wins: number | null; points: number | null } | null) ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });


  // Logged-in: PUNTI / VITTORIE / SHOOT (player-centric, come da reference).
  // Guest: fallback su KPI globali del sito.
  if (user) {
    const items = [
      { Icon: bncFallback("points"), value: rankInfo?.points ?? profile?.points ?? 0, label: "Punti",    to: "/rankings", iconKey: "arena.points" },
      { Icon: bncFallback("crown"), value: profile?.wins ?? 0,                       label: "Vittorie", to: "/profile",  iconKey: "arena.wins" },
      { Icon: bncFallback("comet"),  value: "-",                                       label: "Shoot",    to: "/profile",  iconKey: "arena.shoot" },
    ];
    return (
      <div className="ibnf-arena">
        {items.map((it) => (
          <Link key={it.label} to={it.to} className="ibnf-arena-card">
            <span className="ibnf-arena-ico">
              <CustomIcon iconKey={it.iconKey} fallback={it.Icon as any} size={56} />
            </span>
            <span className="ibnf-arena-body">
              <span className="ibnf-arena-val">{typeof it.value === "number" ? fmt(it.value) : it.value}</span>
              <span className="ibnf-arena-lbl">{it.label}</span>
            </span>
          </Link>
        ))}
      </div>
    );
  }

  const items = [
    { Icon: bncFallback("community"), value: kpis?.bladers,  label: "Bladers", to: "/rankings",    iconKey: "arena.guest.bladers" },
    { Icon: bncFallback("club"), value: kpis?.clubs,    label: "Club",    to: "/clubs",       iconKey: "arena.guest.clubs" },
    { Icon: bncFallback("calendar"),  value: kpis?.upcoming, label: "Eventi",  to: "/tournaments", iconKey: "arena.guest.events" },
  ];
  return (
    <div className="ibnf-arena">
      {items.map((it) => (
        <Link key={it.label} to={it.to} className="ibnf-arena-card">
          <span className="ibnf-arena-ico">
            <CustomIcon iconKey={it.iconKey} fallback={it.Icon as any} size={56} />
          </span>
          <span className="ibnf-arena-body">
            <span className="ibnf-arena-val">{fmt(it.value)}</span>
            <span className="ibnf-arena-lbl">{it.label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
};


const EventBadge = ({ t }: { t: any }) => {
  if (t.is_ranked) {
    return <span className="ibnf-chip ibnf-chip-acid"><Flame size={12} /> Ranked</span>;
  }
  return <span className="ibnf-chip ibnf-chip-violet"><Sparkles size={12} /> Free play</span>;
};

const SlotBar = ({ current, max }: { current: number; max: number | null | undefined }) => {
  if (!max || max <= 0) return null;
  const pct = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  const remaining = Math.max(0, max - current);
  const tone = pct >= 90 ? "danger" : pct >= 60 ? "warn" : "ok";
  return (
    <div className="ibnf-slot">
      <div className="ibnf-slot-head">
        <span>Iscritti {remaining > 0 ? `· ${remaining} liberi` : "· Sold out"}</span>
        <span><b>{current}</b><em>/{max}</em></span>
      </div>
      <div className={`ibnf-slot-bar ibnf-slot-${tone}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
};

const EventErow = ({ t }: { t: any }) => {
  const d = new Date(t.event_date);
  const dd = format(d, "d", { locale: it });
  const mm = format(d, "MMM", { locale: it }).toUpperCase();
  const time = format(d, "HH:mm", { locale: it });
  return (
    <Link to={`/tournaments/${t.id}`} className="ibnf-erow">
      <div className="ibnf-erow-date"><b>{dd}</b><span>{mm}</span></div>
      <div className="ibnf-erow-info">
        <div className="ibnf-erow-top">
          <span className="ibnf-erow-name">{t.title}</span>
          <EventBadge t={t} />
        </div>
        <span className="ibnf-erow-sub"><MapPin size={12} />{[t.city, time].filter(Boolean).join(" · ")}</span>
        {t.max_participants ? (
          <div className="ibnf-erow-slots">
            <SlotBar current={t.registered_count || 0} max={t.max_participants} />
          </div>
        ) : null}
      </div>
      <span className="ibnf-erow-cta"><Zap size={13} />Apri</span>
    </Link>
  );
};

const EventiCard = ({ events }: { events: any[] }) => {
  const featured = events[0];
  const rest = events.slice(1);
  return (
    <div className="ibnf-card ibnf-bento-eventi ibnf-cut">
      <div className="ibnf-bento-h">
        <h3><Zap size={16} /> Prossimi eventi</h3>
        <Link to="/tournaments">Tutti i tornei <ArrowRight size={14} /></Link>
      </div>
      {featured ? (
        <Link to={`/tournaments/${featured.id}`} className="ibnf-ev-hi">
          {featured.image_url || featured.clubs?.banner_url ? (
            <div className="ibnf-ev-hi-bg" style={{ backgroundImage: `url(${featured.image_url || featured.clubs?.banner_url})` }} aria-hidden />
          ) : null}
          <div className="ibnf-ev-hi-l">
            <EventBadge t={featured} />
            <h4 className="ibnf-ev-hi-name">{featured.title}</h4>
            <span className="ibnf-ev-hi-sub">
              <MapPin size={13} />
              {[featured.city, featured.clubs?.name, format(new Date(featured.event_date), "d MMM HH:mm", { locale: it })]
                .filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="ibnf-ev-hi-r">
            <SlotBar current={featured.registered_count || 0} max={featured.max_participants} />
            <span className="ibnf-btn ibnf-btn-primary"><Zap size={15} /> Iscriviti</span>
          </div>
        </Link>
      ) : (
        <div className="ibnf-empty">Nessun torneo in arrivo al momento.</div>
      )}
      {rest.length > 0 && (
        <div className="ibnf-erows">
          {rest.map((t) => <EventErow key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
};

type Scope = "naz" | "reg" | "city" | "club";
type ClassMode = "elo" | "bfl";

const ClassificaCard = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<ClassMode>("elo");
  const [scope, setScope] = useState<Scope>("naz");
  const { data: tiers = [] } = useEloTiers();
  const { data: topElo = [] } = useEloLeaderboard(10);
  const { data: scopedElo = [] } = useQuery({
    queryKey: ["home-elo-scoped"],
    queryFn: fetchEloScoped,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });
  const { data: scopedBfl = [] } = useQuery({
    queryKey: ["home-bfl-scoped"],
    queryFn: fetchBflScoped,
    staleTime: 5 * 60 * 1000,
  });
  const { data: myProfile } = useQuery({
    queryKey: ["home-my-profile", user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
  const { data: myClub } = useQuery({
    queryKey: ["home-my-club", user?.id],
    queryFn: () => fetchMyClub(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const list = useMemo(() => {
    const source: any[] = mode === "elo"
      ? (scope === "naz" || !user ? (topElo as any[]) : (scopedElo as any[]))
      : (scopedBfl as any[]);

    if (scope === "naz") return source.slice(0, 10);
    if (!user) return source.slice(0, 10);

    if (scope === "reg") {
      const r = myProfile?.region_id;
      if (!r) return [];
      return source.filter((p) => p.profile?.region_id === r).slice(0, 10);
    }
    if (scope === "city") {
      const c = (myProfile?.city || "").toLowerCase();
      if (!c) return [];
      return source.filter((p) => (p.profile?.city || "").toLowerCase() === c).slice(0, 10);
    }
    if (scope === "club") {
      const cid = myClub?.club_id;
      if (!cid) return [];
      return source.filter((p) => p.club_id === cid).slice(0, 10);
    }
    return [];
  }, [mode, scope, topElo, scopedElo, scopedBfl, myProfile, myClub, user]);

  const tabs: { id: Scope; label: string; ic: any; disabled?: boolean }[] = [
    { id: "naz", label: "Nazionale", ic: Globe },
    { id: "reg", label: "Regione", ic: HomeIcon, disabled: !myProfile?.region_id },
    { id: "city", label: "Città", ic: MapPin, disabled: !myProfile?.city },
    { id: "club", label: "Club", ic: Building2, disabled: !myClub?.club_id },
  ];

  const getValue = (p: any) => fmt(Number(mode === "elo" ? p.rating : p.points) || 0);
  const getValueColor = (p: any) => {
    if (mode === "bfl") return undefined;
    const t = tierFor(p.rating, tiers);
    return t?.color_hex ? { color: t.color_hex } : undefined;
  };
  const getSubLabel = (p: any) => {
    if (mode === "bfl") return "PUNTI BFL";
    const t = tierFor(p.rating, tiers);
    return t?.name || "—";
  };
  const detailLink = mode === "elo" ? "/elo" : "/rankings";

  return (
    <div className={`ibnf-card ibnf-bento-classifica ibnf-classifica-${mode}`}>
      <div className="ibnf-bento-h">
        <h3><Crown size={16} /> Classifica</h3>
        <div className="ibnf-mode-switch" role="tablist" aria-label="Tipo classifica">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "bfl"}
            onClick={() => setMode("bfl")}
            className={`ibnf-mode-btn tone-violet${mode === "bfl" ? " is-active" : ""}`}
          >
            <Trophy size={12} /> BFL
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "elo"}
            onClick={() => setMode("elo")}
            className={`ibnf-mode-btn${mode === "elo" ? " is-active" : ""}`}
          >
            <Crown size={12} /> ELO
          </button>
        </div>
        <Link to={detailLink}>Completa <ArrowRight size={14} /></Link>
      </div>
      <div className="ibnf-scope-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={scope === t.id}
            disabled={t.disabled}
            onClick={() => setScope(t.id)}
            className={`ibnf-scope-tab${scope === t.id ? " is-active" : ""}`}
            title={t.disabled ? "Disponibile dopo aver completato il profilo" : t.label}
          >
            <t.ic size={13} /> {t.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="ibnf-empty">Nessun blader in classifica per questo ambito.</div>
      ) : (
        <div className="ibnf-lbm">
          <div className="ibnf-podium">
            {list.slice(0, 3).map((p: any, idx: number) => {
              const rank = idx + 1;
              const profile = p.profile;
              const link = profile?.username ? `/profilo/${profile.username}` : "/rankings";
              const medalIcons = [Crown, Medal, Star];
              const MI = medalIcons[idx];
              return (
                <Link key={p.user_id} to={link} className={`ibnf-podium-card r${rank}`}>
                  <span className="ibnf-podium-medal"><MI size={16} /></span>
                  {profile?.avatar_url ? (
                    <img className="ibnf-podium-av" src={profile.avatar_url} alt="" />
                  ) : (
                    <span className="ibnf-podium-av ibnf-podium-av--mono">{monoFor(profile?.display_name || profile?.username || "?")}</span>
                  )}
                  <b className="ibnf-podium-name">{profile?.display_name || profile?.username || "Anonimo"}</b>
                  <span className="ibnf-podium-pts" style={getValueColor(p)}>{getValue(p)}</span>
                  <i className="ibnf-podium-tier">{getSubLabel(p)}</i>
                </Link>
              );
            })}
          </div>
          {list.slice(3).map((p: any, idx: number) => {
            const rank = idx + 4;
            const profile = p.profile;
            const link = profile?.username ? `/profilo/${profile.username}` : "/rankings";
            return (
              <Link key={p.user_id} to={link} className="ibnf-lbm-row">
                <span className="ibnf-lbm-rank">{rank}</span>
                {profile?.avatar_url ? (
                  <img className="ibnf-lbm-av" src={profile.avatar_url} alt="" />
                ) : (
                  <span className="ibnf-lbm-av ibnf-lbm-av--mono">{monoFor(profile?.display_name || profile?.username || "?")}</span>
                )}
                <span className="ibnf-lbm-id">
                  <b>{profile?.display_name || profile?.username || "Anonimo"}</b>
                  <i>{getSubLabel(p)}</i>
                </span>
                <span className="ibnf-lbm-pts" style={getValueColor(p)}>
                  {getValue(p)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ClubCard = () => {
  const { data: topClubs = [] } = useQuery({
    queryKey: ["home-top-clubs"],
    queryFn: fetchTopClubs,
    staleTime: 15 * 60 * 1000,
  });
  return (
    <div className="ibnf-card ibnf-bento-club">
      <div className="ibnf-bento-h">
        <h3><Shield size={16} /> Club in evidenza</h3>
        <Link to="/clubs">Tutti i club <ArrowRight size={14} /></Link>
      </div>
      {topClubs.length === 0 ? (
        <div className="ibnf-empty">Nessun club attivo.</div>
      ) : (
        <div className="ibnf-club-showcase">
          {topClubs.slice(0, 8).map((c: any, i: number) => {
            const tone = CCHIP_TONES[i % CCHIP_TONES.length];
            return (
              <Link key={c.id} to={`/clubs/${c.id}`} className="ibnf-club-tile" style={{ "--ibnf-cr": CCHIP_RING[tone] } as CSSProperties}>
                <span className="ibnf-club-logo" aria-hidden={!c.logo_url}>
                  {c.logo_url ? <img src={c.logo_url} alt={c.name} loading="lazy" /> : <b>{monoFor(c.name)}</b>}
                </span>
                <span className="ibnf-club-meta">
                  <b>{c.name}</b>
                  <i>{c.city || "Italia"}</i>
                </span>
                <span className="ibnf-club-count"><Users size={11} /> {c.member_count}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ProfiloCard = () => {
  const { user } = useAuth();
  const { data: elo } = useEloRating(user?.id);
  const { data: tiers = [] } = useEloTiers();
  const { data: myClub } = useQuery({
    queryKey: ["home-my-club", user?.id],
    queryFn: () => fetchMyClub(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
  const { data: myProfile } = useQuery({
    queryKey: ["home-my-profile", user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
  const { data: regionName } = useQuery({
    queryKey: ["home-my-region", myProfile?.region_id],
    queryFn: () => fetchMyRegionName(myProfile?.region_id as any),
    enabled: !!myProfile?.region_id,
    staleTime: 60 * 60 * 1000,
  });
  const { data: rankInfo } = useUserRankAndPoints();
  const { data: scoped = [] } = useQuery({
    queryKey: ["home-elo-scoped"],
    queryFn: fetchEloScoped,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  // Compute regional / city / club ranks from scoped leaderboard (by ELO rating)
  const scopedRanks = useMemo(() => {
    if (!user || !elo) return { reg: null as number | null, city: null as number | null, club: null as number | null };
    const all = scoped as any[];
    const filterAndRank = (filter: (p: any) => boolean) => {
      const arr = all.filter(filter);
      const idx = arr.findIndex((p) => p.user_id === user.id);
      return idx >= 0 ? idx + 1 : null;
    };
    return {
      reg: myProfile?.region_id ? filterAndRank((p) => p.profile?.region_id === myProfile.region_id) : null,
      city: myProfile?.city ? filterAndRank((p) => (p.profile?.city || "").toLowerCase() === (myProfile.city || "").toLowerCase()) : null,
      club: myClub?.club_id ? filterAndRank((p) => p.club_id === myClub.club_id) : null,
    };
  }, [scoped, user, elo, myProfile, myClub]);

  if (!user) {
    return (
      <div className="ibnf-card ibnf-bento-profilo ibnf-cut">
        <div className="ibnf-bento-h">
          <h3><User size={16} /> Unisciti al circuito</h3>
        </div>
        <div className="ibnf-muted" style={{ marginTop: -4 }}>
          <HomeEditableText
            storageKey="guest-profile-copy"
            defaultText="Registra il tuo profilo, entra in un club ufficiale e scala la classifica ELO nazionale."
            as="span"
            multiline
          />
        </div>
        <Link to="/auth" className="ibnf-btn ibnf-btn-primary" style={{ marginTop: 14, alignSelf: "flex-start" }}>
          <Sparkles size={16} /> Accedi / Registrati
        </Link>
      </div>
    );
  }

  const tier = elo ? tierFor(elo.rating, tiers) : null;
  const division = elo ? divisionFor(elo.rating, tier, tiers) : null;
  const tierLabel = tier ? fullTierLabel(tier, division!) : "—";
  const name = myProfile?.display_name || myProfile?.username || "Blader";
  const bfl = rankInfo?.points ?? 0;

  return (
    <div className="ibnf-card ibnf-bento-profilo ibnf-cut">
      <div className="ibnf-bento-h">
        <h3><User size={16} /> Il tuo recap</h3>
        <Link to={myProfile?.username ? `/profilo/${myProfile.username}` : "/profile"}>Apri <ArrowRight size={14} /></Link>
      </div>
      <div className="ibnf-pm">
        <div className="ibnf-pm-head">
          {myProfile?.avatar_url ? (
            <img className="ibnf-pm-av ibnf-pm-av--img" src={myProfile.avatar_url} alt="" />
          ) : (
            <div className="ibnf-pm-av">{name.slice(0, 1).toUpperCase()}</div>
          )}
          <div className="ibnf-pm-id">
            <b>{name} <Check size={13} className="ibnf-pm-v" /></b>
            <i>{myClub?.clubs?.name ? `${myClub.clubs.name}${myClub.clubs.city ? " · " + myClub.clubs.city : ""}` : "Nessun club"}</i>
          </div>
          <div className="ibnf-pm-bfl" title="Punti BFL stagione">
            <Trophy size={14} />
            <b>{fmt(bfl)}</b>
            <i>BFL</i>
          </div>
        </div>

        {/* Recap grid: 4 ranks in 2x2 */}
        <div className="ibnf-recap ibnf-recap--4">
          <div className="ibnf-recap-cell ibnf-tone-violet">
            <span className="ibnf-recap-ic"><Globe size={14} /></span>
            <b>{rankInfo?.rank ? `#${rankInfo.rank}` : "—"}</b>
            <i>Naz · BFL</i>
          </div>
          <div className="ibnf-recap-cell ibnf-tone-acid">
            <span className="ibnf-recap-ic"><HomeIcon size={14} /></span>
            <b>{scopedRanks.reg ? `#${scopedRanks.reg}` : "—"}</b>
            <i>{regionName || "Regione"}</i>
          </div>
          <div className="ibnf-recap-cell ibnf-tone-violet">
            <span className="ibnf-recap-ic"><MapPin size={14} /></span>
            <b>{scopedRanks.city ? `#${scopedRanks.city}` : "—"}</b>
            <i>{myProfile?.city || "Città"}</i>
          </div>
          <div className="ibnf-recap-cell ibnf-tone-acid">
            <span className="ibnf-recap-ic"><Building2 size={14} /></span>
            <b>{scopedRanks.club ? `#${scopedRanks.club}` : "—"}</b>
            <i>{myClub?.clubs?.name || "Club"}</i>
          </div>
        </div>

        {/* ELO block at bottom with division progress bar */}
        {elo && tier && division && (
          <div className="ibnf-elo-block">
            <div className="ibnf-elo-row">
              <Crown size={15} style={tier.color_hex ? { color: tier.color_hex } : undefined} />
              <span className="ibnf-elo-tier" style={tier.color_hex ? { color: tier.color_hex } : undefined}>
                {tierLabel}
              </span>
              <span className="ibnf-elo-rating" style={tier.color_hex ? { color: tier.color_hex } : undefined}>
                {elo.rating} <small style={{ fontSize: 11, color: "var(--ibnf-ink-mute)", letterSpacing: ".1em" }}>ELO</small>
              </span>
            </div>
            <div className="ibnf-elo-bar" aria-label="Progresso divisione">
              <i style={{
                width: `${Math.max(2, Math.min(100, division.divisionProgress))}%`,
                background: tier.color_hex
                  ? `linear-gradient(90deg, ${tier.color_hex}99, ${tier.color_hex})`
                  : undefined,
                boxShadow: tier.glow_hex ? `0 0 16px -2px ${tier.glow_hex}` : undefined,
              }} />
            </div>
            <div className="ibnf-elo-meta">
              <span>{division.divisionMin} pt</span>
              {division.nextLabel ? (
                <span>
                  <b>+{division.pointsToNext}</b> a {division.nextLabel}
                </span>
              ) : (
                <span>Apex</span>
              )}
              <span>{Number.isFinite(division.divisionMax) ? `${division.divisionMax} pt` : "∞"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const OrganizzaCard = () => (
  <div className="ibnf-card ibnf-bento-organizza ibnf-cut">
    <div className="ibnf-org-tx">
      <span className="ibnf-eyebrow ibnf-eyebrow--violet"><Trophy size={12} /> Per organizzatori &amp; club</span>
      <HomeEditableText
        storageKey="organize-title"
        defaultText="Organizza il tuo torneo"
        as="h3"
        className="ibnf-org-title"
      />
    </div>
    <ul className="ibnf-org-steps">
      <li><span>1</span> Crea l'evento</li>
      <li><span>2</span> Apri le iscrizioni</li>
      <li><span>3</span> Gioca &amp; pubblica</li>
    </ul>
    <Link to="/tournaments" className="ibnf-btn ibnf-btn-violet ibnf-btn-lg">
      <Plus size={17} /> Crea un torneo
    </Link>
  </div>
);

const NewsCard = ({ news }: { news: any[] }) => {
  if (news.length === 0) return null;
  const [hero, ...rest] = news;
  const heroPreview = (hero?.content || "").replace(/<[^>]+>/g, "").slice(0, 180);
  const heroTone = CAT_TONE[hero?.category] || "violet";
  return (
    <div className="ibnf-card ibnf-bento-news ibnf-cut">
      <div className="ibnf-bento-h">
        <h3><Sparkles size={16} /> News &amp; discussioni</h3>
        <Link to="/forum">Forum <ArrowRight size={14} /></Link>
      </div>
      <div className="ibnf-news-grid">
        <Link to={`/forum/${hero.id}`} className={`ibnf-news-hero ibnf-tone-${heroTone}`}>
          <div className="ibnf-news-hero-meta">
            <span className={`ibnf-chip ibnf-chip-${heroTone}`}>{CAT_LABEL[hero.category] || hero.category}</span>
            <span className="ibnf-news-hero-date"><CalendarIcon size={11} /> {format(new Date(hero.created_at), "d MMM yyyy", { locale: it })}</span>
          </div>
          <h4 className="ibnf-news-hero-title">{hero.title}</h4>
          {heroPreview && <p className="ibnf-news-hero-preview">{heroPreview}…</p>}
          <span className="ibnf-news-hero-cta">Leggi <ArrowRight size={13} /></span>
        </Link>
        <div className="ibnf-news-side">
          {rest.slice(0, 4).map((p) => {
            const tone = CAT_TONE[p.category] || "violet";
            const preview = (p.content || "").replace(/<[^>]+>/g, "").slice(0, 90);
            return (
              <Link key={p.id} to={`/forum/${p.id}`} className={`ibnf-news-item ibnf-tone-${tone}`}>
                <div className="ibnf-news-item-meta">
                  <span className={`ibnf-chip ibnf-chip-${tone}`}>{CAT_LABEL[p.category] || p.category}</span>
                  <span className="ibnf-news-item-date">{format(new Date(p.created_at), "d MMM", { locale: it })}</span>
                </div>
                <h5 className="ibnf-news-item-title">{p.title}</h5>
                {preview && <p className="ibnf-news-item-preview">{preview}…</p>}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PAGE
// ============================================================

const Index = () => {
  const { data: kpis } = useQuery({
    queryKey: ["home-kpis"],
    queryFn: fetchHomeKpis,
    staleTime: 15 * 60 * 1000,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["home-upcoming"],
    queryFn: fetchUpcomingEvents,
    staleTime: 5 * 60 * 1000,
  });
  const { data: news = [] } = useQuery({
    queryKey: ["home-news-compact"],
    queryFn: fetchLatestNews,
    staleTime: 15 * 60 * 1000,
  });

  return (
    <div className="ibnf-page home-performance relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <div aria-hidden className="ibnf-home-ambient-layer fib-aurora pointer-events-none opacity-60" />
      <div aria-hidden className="ibnf-home-ambient-layer liquid-orbs pointer-events-none opacity-50">
        <span /><span /><span />
      </div>
      <div className="relative z-10">
        <Navbar />
        <HeroSection />

        <section className="ibnf-dash" id="dash">
          <div className="ibnf-wrap">
            <div className="ibnf-dash-head">
              <div className="ibnf-eyebrow"><ArenaMark className="arena-mark" /> <HomeEditableText storageKey="dash-eyebrow" defaultText="La tua arena" as="span" /></div>
              <Link to="/profile" className="ibnf-dash-head-link">Personalizza <ArrowRight size={15} /></Link>
            </div>

            <div className="ibnf-bento">
              <div className="ibnf-bento-stats"><ArenaStats kpis={kpis} /></div>
              <EventiCard events={events} />
              <ClassificaCard />
              <ClubCard />
              <ProfiloCard />
              <OrganizzaCard />
            </div>

            {news.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <NewsCard news={news} />
              </div>
            )}
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
};

export default Index;
