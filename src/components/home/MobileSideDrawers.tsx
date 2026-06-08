import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight, ChevronLeft, Trophy, Shield, Users, Globe,
  MessageCircle, Plus, Search, Calendar, Sparkles, Medal, Target, TrendingUp, Award, MapPin, User as UserIcon, LogIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserRankAndPoints } from "@/hooks/useUserRankAndPoints";
import { CustomIcon } from "@/components/CustomIcon";

import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useEloRating, useEloTiers, tierFor } from "@/hooks/useBetaElo";
import { useFriends } from "@/hooks/useFriends";
import { useTeam } from "@/hooks/useTeam";
import { useChatDock } from "@/stores/chatDockStore";
import { openOrCreateChat } from "@/hooks/usePrivateChat";
import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// LEFT PANEL — player snapshot (logged-in only)
// =====================================================================

const fetchMyClub = async (userId: string) => {
  const { data } = await supabase
    .from("club_members")
    .select("club_id, role, clubs(id, name, city, logo_url)")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
};

const fetchMyProfile = async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url, points, wins, city, region_id, regions(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const d: any = data;
  return {
    ...d,
    region: d?.regions?.name ?? null,
    losses: 0,
  };
};

const GuestLoginCard = ({
  title,
  description,
  onClose,
}: { title: string; description: string; onClose: () => void }) => (
  <div className="h-full flex flex-col overflow-hidden">
    <header className="px-4 py-3 border-b border-white/10 shrink-0">
      <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">
        Area riservata
      </div>
      <div className="font-display text-lg tracking-wider leading-none mt-1">
        {title}
      </div>
    </header>
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="h-16 w-16 rounded-full bg-primary/15 border border-primary/30 grid place-items-center">
        <LogIn size={28} className="text-primary" />
      </div>
      <div className="space-y-1">
        <div className="font-display text-base tracking-wider">Accedi per continuare</div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-[240px]">
        <Link to="/auth" onClick={onClose}>
          <Button size="sm" className="w-full text-[11px] uppercase tracking-wider">Accedi</Button>
        </Link>
        <Link to="/auth?mode=signup" onClick={onClose}>
          <Button size="sm" variant="outline" className="w-full text-[11px] uppercase tracking-wider">Registrati</Button>
        </Link>
      </div>
    </div>
  </div>
);

const LeftPanel = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { isRegionalReferent } = useUserRoles();
  const { data: tiers = [] } = useEloTiers();
  const { data: elo } = useEloRating(user?.id);
  const { data: rankInfo } = useUserRankAndPoints();
  const { data: profile } = useQuery({
    queryKey: ["drawer-my-profile", user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
  const { data: myClub } = useQuery({
    queryKey: ["drawer-my-club", user?.id],
    queryFn: () => fetchMyClub(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  if (!user) {
    return (
      <GuestLoginCard
        title="Profilo Blader"
        description="Accedi per vedere i tuoi punti, l'ELO, il tuo club e i ranking personali."
        onClose={onClose}
      />
    );
  }

  const tier = elo ? tierFor(elo.rating, tiers) : null;
  const totalMatches = (profile?.wins ?? 0) + (profile?.losses ?? 0);
  const winrate = totalMatches > 0 ? Math.round(((profile?.wins ?? 0) / totalMatches) * 100) : 0;
  const displayName = profile?.display_name || profile?.username || user.email?.split("@")[0] || "Giocatore";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-white/10 shrink-0">
        <Link to="/profile" onClick={onClose} className="flex items-center gap-3">
          <Avatar className="h-11 w-11 ring-2 ring-primary/40">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/15 text-primary">
              {profile?.display_name || profile?.username
                ? (profile.display_name || profile.username)[0]?.toUpperCase()
                : <UserIcon size={18} />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base tracking-wider leading-none truncate">
              {displayName}
            </div>
            {profile?.username && (
              <div className="text-[10px] text-muted-foreground mt-1 truncate">
                @{profile.username}
              </div>
            )}
            {(profile?.city || profile?.region) && (
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {[profile.city, profile.region].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </Link>
      </header>

      <div className="flex-1 min-h-0 p-3 space-y-3 overflow-y-auto">
        {/* Admin / Referente banners */}
        {isAdmin && (
          <Link
            to="/admin"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3 hover:bg-primary/15 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">Admin</div>
              <div className="text-xs font-semibold tracking-wider">Pannello amministratori</div>
            </div>
            <ChevronRight size={14} className="text-primary" />
          </Link>
        )}
        {!isAdmin && isRegionalReferent && (
          <Link
            to="/referente-regionale"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 hover:bg-amber-500/15 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <MapPin size={16} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-500 font-bold">Referente</div>
              <div className="text-xs font-semibold tracking-wider">Pannello regionale</div>
            </div>
            <ChevronRight size={14} className="text-amber-500" />
          </Link>
        )}


        {/* Ranking nazionale */}
        <Link
          to="/rankings"
          onClick={onClose}
          className="block rounded-xl border border-white/10 bg-white/[0.03] p-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold flex items-center gap-1">
                <Medal size={11} /> Ranking 2026
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-2xl tabular-nums leading-none">
                  {rankInfo?.rank ? `#${rankInfo.rank}` : "—"}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {rankInfo?.points ?? 0} pt
                </span>
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
        </Link>

        {/* ELO card */}
        <Link
          to="/elo"
          onClick={onClose}
          className="block rounded-xl border border-white/10 bg-white/[0.03] p-3"
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold flex items-center gap-1">
            <Sparkles size={11} /> Il tuo ELO
          </div>
          {elo ? (
            <>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className="font-display text-3xl tabular-nums leading-none"
                  style={{ color: tier?.color_hex || "hsl(var(--primary))" }}
                >
                  {elo.rating}
                </span>
                {tier && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border"
                    style={{ color: tier.color_hex, borderColor: `${tier.color_hex}55` }}
                  >
                    {tier.name}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2 text-center">
                <div className="rounded-md bg-white/5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Peak</div>
                  <div className="text-xs font-bold tabular-nums">{elo.peak_rating}</div>
                </div>
                <div className="rounded-md bg-white/5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Match</div>
                  <div className="text-xs font-bold tabular-nums">{elo.matches_played}</div>
                </div>
                <div className="rounded-md bg-white/5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">V/S</div>
                  <div className="text-xs font-bold tabular-nums">{elo.wins}/{elo.losses}</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Gioca il tuo primo ranked per ricevere un ELO.
            </p>
          )}
        </Link>

        {/* Stats riassuntive */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
            <Trophy size={12} className="text-primary mx-auto mb-1" />
            <div className="text-base font-display tabular-nums">{profile?.wins ?? 0}</div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Win</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
            <Target size={12} className="text-primary mx-auto mb-1" />
            <div className="text-base font-display tabular-nums">{totalMatches}</div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Match</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
            <TrendingUp size={12} className="text-primary mx-auto mb-1" />
            <div className="text-base font-display tabular-nums">{winrate}%</div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Winrate</div>
          </div>
        </div>

        {/* Club card */}
        {myClub?.clubs ? (
          <Link
            to={`/clubs/${myClub.club_id}`}
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="w-10 h-10 rounded-md bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
              {myClub.clubs.logo_url ? (
                <img src={myClub.clubs.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Shield size={16} className="text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">
                Club
              </div>
              <div className="font-display text-sm tracking-wider truncate leading-tight">
                {myClub.clubs.name}
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground" />
          </Link>
        ) : (
          <Link
            to="/clubs"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <Shield size={16} className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider flex-1">
              Trova un club
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </Link>
        )}

        {/* Quick links */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden divide-y divide-white/5">
          {[
            { to: "/tournaments", label: "Tornei", icon: Calendar, key: "sidebar.tournaments" },
            { to: "/rankings", label: "Classifica", icon: Trophy, key: "sidebar.rankings" },
            { to: "/elo", label: "Ranking ELO", icon: Sparkles, key: "sidebar.elo" },
            { to: "/achievements", label: "Achievement", icon: Award, key: "sidebar.achievements" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors"
            >
              <span className="text-primary">
                <CustomIcon iconKey={l.key} fallback={l.icon} size={14} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider flex-1">{l.label}</span>
              <ChevronRight size={13} className="text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// RIGHT PANEL — Social Hub (logged-in only)
// =====================================================================

type Club = { id: string; name: string; logo_url: string | null };

const RightHubPanel = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const { friends, profiles } = useFriends();
  const { team } = useTeam();
  const { openChat } = useChatDock();
  const [clubs, setClubs] = useState<Club[]>([]);

  useEffect(() => {
    if (!user) { setClubs([]); return; }
    (async () => {
      const { data: mems } = await supabase.from("club_members").select("club_id").eq("user_id", user.id);
      const ids = (mems || []).map((m: { club_id: string }) => m.club_id);
      if (ids.length === 0) { setClubs([]); return; }
      const { data: cs } = await supabase.from("clubs").select("id, name, logo_url").in("id", ids).eq("is_active", true);
      setClubs((cs || []) as Club[]);
    })();
  }, [user]);

  if (!user) {
    return (
      <GuestLoginCard
        title="Hub Sociale"
        description="Accedi per chattare con amici e club, gestire la tua squadra e ricevere notifiche."
        onClose={onClose}
      />
    );
  }

  const startChat = async (peerId: string, peer: any) => {
    const chatId = await openOrCreateChat(user!.id, peerId);
    if (!chatId) return;
    openChat({
      kind: "private",
      peerId, chatId,
      displayName: peer.display_name || peer.username || "Amico",
      avatarUrl: peer.avatar_url,
      username: peer.username,
    });
    onClose();
  };

  const openGlobal = () => {
    openChat({ kind: "global", displayName: "Chat Globale", avatarUrl: null, username: null });
    onClose();
  };

  const openClub = (c: Club) => {
    openChat({ kind: "club", clubId: c.id, displayName: c.name, avatarUrl: c.logo_url, username: null });
    onClose();
  };

  const visibleFriends = friends.slice(0, 4);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-white/10 shrink-0">
        <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">
          Community
        </div>
        <div className="font-display text-lg tracking-wider leading-none mt-1">
          HUB SOCIALE
        </div>
      </header>

      <div className="flex-1 min-h-0 p-3 space-y-3">
        {/* Chat */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden divide-y divide-white/5">
          <button
            onClick={openGlobal}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
              <Globe size={14} className="text-primary" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">
              Chat Globale
            </span>
            <MessageCircle size={13} className="text-muted-foreground" />
          </button>
          {clubs.slice(0, 2).map((c) => (
            <button
              key={c.id}
              onClick={() => openClub(c)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={c.logo_url || undefined} />
                <AvatarFallback className="text-[10px]"><Shield size={11} /></AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold tracking-wider flex-1 text-left truncate">
                {c.name}
              </span>
              <MessageCircle size={13} className="text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Friends */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="font-display text-xs tracking-widest">AMICI</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {friends.length}
            </span>
          </div>
          {visibleFriends.length === 0 ? (
            <div className="text-[11px] text-muted-foreground p-3 text-center">
              Nessun amico ancora.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {visibleFriends.map((r) => {
                const other = r.user_a === user!.id ? r.user_b : r.user_a;
                const p = profiles[other];
                if (!p) return null;
                const name = p.display_name || p.username || "?";
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => startChat(p.user_id, p)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate flex-1">{name}</span>
                      <MessageCircle size={12} className="text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Team */}
        {team ? (
          <Link
            to="/squadra"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={team.logo_url || undefined} />
              <AvatarFallback><Users size={13} /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">
                Squadra
              </div>
              <div className="text-xs font-bold truncate">{team.name}</div>
            </div>
            <ChevronRight size={13} className="text-muted-foreground" />
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Link to="/squadra" onClick={onClose}>
              <Button size="sm" variant="default" className="w-full gap-1.5 text-[11px]">
                <Plus size={12} /> Crea
              </Button>
            </Link>
            <Link to="/find-team" onClick={onClose}>
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-[11px]">
                <Search size={12} /> Trova
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================================
// WRAPPER — custom drawers, swipe + subtle glow handles
// =====================================================================

type Side = "left" | "right";
const DRAWER_VIEWPORT_MAX = 1024;
const SWIPE_TRIGGER = 38;
const SWIPE_CANCEL_Y = 64;

const Drawer = ({
  side, open, onClose, children,
}: { side: Side; open: boolean; onClose: () => void; children: React.ReactNode }) => {
  // close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sideClasses =
    side === "left"
      ? `left-2 ${open ? "translate-x-0" : "-translate-x-[110%]"}`
      : `right-2 ${open ? "translate-x-0" : "translate-x-[110%]"}`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`xl:hidden fixed inset-0 z-[88] bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* Panel — inset within layout (below top nav, above bottom nav) */}
      <aside
        className={`xl:hidden fixed top-[72px] bottom-[80px] z-[90] w-[82vw] max-w-[320px]
                    rounded-2xl border border-white/15 bg-background/60 backdrop-blur-2xl backdrop-saturate-150
                    shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]
                    transition-transform duration-300 ease-out ${sideClasses}`}
      >
        {open ? children : null}
      </aside>
    </>
  );
};

export const MobileSideDrawers = () => {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [pullSide, setPullSide] = useState<Side | null>(null);

  // Edge-swipe gesture — touch for mobile browsers + pointer for desktop preview
  const startRef = useRef<{ x: number; y: number; edge: Side | null; triggered: boolean } | null>(null);
  const beginSideGesture = useCallback((edge: Side, x: number, y: number) => {
    if (window.innerWidth >= DRAWER_VIEWPORT_MAX) { startRef.current = null; return; }
    if (leftOpen || rightOpen) { startRef.current = null; return; }
    startRef.current = { x, y, edge, triggered: false };
  }, [leftOpen, rightOpen]);
  const beginEdgeGesture = useCallback((x: number, y: number) => {
    const half = window.innerWidth / 2;
    beginSideGesture(x <= half ? "left" : "right", x, y);
  }, [beginSideGesture]);
  const continueGesture = useCallback((x: number, y: number, prevent?: () => void) => {
    const s = startRef.current;
    if (!s?.edge || s.triggered) return;
    const dx = x - s.x;
    const dy = Math.abs(y - s.y);
    if (dy > SWIPE_CANCEL_Y) { startRef.current = null; setPullSide(null); return; }
    if (Math.abs(dx) > 8 && Math.abs(dx) > dy) prevent?.();
    if (s.edge === "left"  && dx > 14) setPullSide("left");
    if (s.edge === "right" && dx < -14) setPullSide("right");
    if (s.edge === "left" && dx > SWIPE_TRIGGER) { setLeftOpen(true); s.triggered = true; setPullSide(null); }
    else if (s.edge === "right" && dx < -SWIPE_TRIGGER) { setRightOpen(true); s.triggered = true; setPullSide(null); }
  }, []);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) beginEdgeGesture(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) continueGesture(t.clientX, t.clientY, () => e.cancelable && e.preventDefault());
    };
    const onPointerDown = (e: PointerEvent) => {
      beginEdgeGesture(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      continueGesture(e.clientX, e.clientY);
    };
    const onUp = () => { startRef.current = null; setPullSide(null); };

    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", onUp, { passive: true, capture: true });
    document.addEventListener("touchcancel", onUp, { passive: true, capture: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true, capture: true });
    document.addEventListener("pointerup", onUp, { passive: true, capture: true });
    document.addEventListener("pointercancel", onUp, { passive: true, capture: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart, { capture: true } as EventListenerOptions);
      document.removeEventListener("touchmove", onTouchMove, { capture: true } as EventListenerOptions);
      document.removeEventListener("touchend", onUp, { capture: true } as EventListenerOptions);
      document.removeEventListener("touchcancel", onUp, { capture: true } as EventListenerOptions);
      document.removeEventListener("pointerdown", onPointerDown, { capture: true } as EventListenerOptions);
      document.removeEventListener("pointermove", onPointerMove, { capture: true } as EventListenerOptions);
      document.removeEventListener("pointerup", onUp, { capture: true } as EventListenerOptions);
      document.removeEventListener("pointercancel", onUp, { capture: true } as EventListenerOptions);
    };
  }, [beginEdgeGesture, continueGesture]);

  const glowLeft =
    "radial-gradient(ellipse 24px 60px at 0% 50%, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary) / 0.25) 35%, transparent 75%)";
  const glowRight =
    "radial-gradient(ellipse 24px 60px at 100% 50%, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary) / 0.25) 35%, transparent 75%)";

  return (
    <>
      {!leftOpen && !rightOpen && (
        <>
          <div aria-hidden className="pointer-events-none lg:hidden fixed left-0 inset-y-0 z-[85] w-1/2" style={{ touchAction: "pan-y" }} />
          <div aria-hidden className="pointer-events-none lg:hidden fixed right-0 inset-y-0 z-[85] w-1/2" style={{ touchAction: "pan-y" }} />
        </>
      )}

      {!leftOpen && (
        <span aria-hidden className={`ibnf-pull-label ibnf-pull-label--left lg:hidden ${pullSide === "left" ? "is-pulling" : ""}`}>
          PROFILO
        </span>
      )}
      {!rightOpen && (
        <span aria-hidden className={`ibnf-pull-label ibnf-pull-label--right lg:hidden ${pullSide === "right" ? "is-pulling" : ""}`}>
          CHAT
        </span>
      )}

      {!leftOpen && (
        <button
          type="button"
          aria-label="Apri profilo"
          onClick={() => setLeftOpen(true)}
          className="lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-[86] h-28 w-9"
          style={{ background: glowLeft, touchAction: "pan-y" }}
        />
      )}
      {!rightOpen && (
        <button
          type="button"
          aria-label="Apri hub sociale"
          onClick={() => setRightOpen(true)}
          className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-[86] h-28 w-9"
          style={{ background: glowRight, touchAction: "pan-y" }}
        />
      )}

      <Drawer side="left" open={leftOpen} onClose={() => setLeftOpen(false)}>
        <LeftPanel onClose={() => setLeftOpen(false)} />
      </Drawer>
      <Drawer side="right" open={rightOpen} onClose={() => setRightOpen(false)}>
        <RightHubPanel onClose={() => setRightOpen(false)} />
      </Drawer>
    </>
  );
};

export const DesktopLeftSidebar = () => {
  return (
    <aside
      className="hidden lg:flex fixed top-20 left-3 bottom-3 w-[236px] 2xl:w-[268px] glass-card !rounded-2xl z-40 flex-col overflow-hidden p-0 ibnf-left-profile-sidebar"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <LeftPanel onClose={() => undefined} />
    </aside>
  );
};

export default MobileSideDrawers;
