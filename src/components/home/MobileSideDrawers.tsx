import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight, ChevronLeft, Trophy, Shield, Users, Globe,
  MessageCircle, Plus, Search, Calendar, Sparkles, Medal, Target, TrendingUp, Award, MapPin, User as UserIcon, LogIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserRankAndPoints } from "@/hooks/useUserRankAndPoints";
import { CustomIcon } from "@/components/CustomIcon";
import { BrandLogo } from "@/components/BrandLogo";

import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useScrolled } from "@/hooks/useScrolled";
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

  // --- token HUD ---
  const VIO = "var(--ibnf-violet)";
  const mono = { fontFamily: "var(--font-mono, ui-monospace, monospace)" } as const;
  const eyebrow = { ...mono, letterSpacing: "0.2em" } as const;
  const vioText = "var(--ibnf-hud-accent)";
  const tileVioBorder = { border: "1px solid color-mix(in srgb, var(--ibnf-violet) 24%, transparent)" } as const;
  const corners = ["tl", "tr", "bl", "br"] as const;
  const cornerStyle = (c: string) => {
    const s: React.CSSProperties = { position: "absolute", width: 9, height: 9, pointerEvents: "none" };
    const col = vioText;
    if (c.includes("t")) { s.top = 6; s.borderTop = `1.5px solid ${col}`; }
    if (c.includes("b")) { s.bottom = 6; s.borderBottom = `1.5px solid ${col}`; }
    if (c.includes("l")) { s.left = 6; s.borderLeft = `1.5px solid ${col}`; }
    if (c.includes("r")) { s.right = 6; s.borderRight = `1.5px solid ${col}`; }
    return s;
  };

  return (
    <div className="ibnf-hud-scope h-full flex flex-col overflow-hidden">
      {/* header */}
      <header className="relative px-4 py-3.5 border-b border-white/10 shrink-0">
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: "linear-gradient(var(--ibnf-violet), color-mix(in srgb, var(--ibnf-violet) 20%, transparent))" }} />
        <Link to="/profile" onClick={onClose} className="flex items-center gap-3">
          <span className="shrink-0 rounded-full p-[2px]"
            style={{ background: "conic-gradient(from 220deg, var(--ibnf-violet), var(--ibnf-acid), var(--ibnf-violet))", boxShadow: "0 0 16px -4px color-mix(in srgb, var(--ibnf-violet) 70%, transparent)" }}>
            <Avatar className="h-11 w-11">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/15 text-primary">
                {profile?.display_name || profile?.username
                  ? (profile.display_name || profile.username)[0]?.toUpperCase()
                  : <UserIcon size={18} />}
              </AvatarFallback>
            </Avatar>
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base italic uppercase tracking-wide leading-none truncate">
              {displayName}
            </div>
            {profile?.username && (
              <div className="text-[10px] text-muted-foreground mt-1 truncate" style={mono}>
                @{profile.username}
              </div>
            )}
            {(profile?.city || profile?.region) && (
              <div className="text-[10px] mt-0.5 truncate" style={{ ...mono, color: vioText, letterSpacing: "0.05em" }}>
                {[profile.city, profile.region].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </Link>
      </header>

      <div className="ibnf-left-panel-scroll flex-1 min-h-0 p-3 space-y-2.5 overflow-y-auto">
        {/* Admin / Referente */}
        {isAdmin && (
          <Link to="/admin" onClick={onClose}
            className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.04]"
            style={{ background: "color-mix(in srgb, var(--ibnf-violet) 8%, transparent)", ...tileVioBorder }}>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--ibnf-violet) 18%, transparent)" }}>
              <Shield size={16} style={{ color: VIO }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold" style={{ ...eyebrow, color: vioText }}>ADMIN</div>
              <div className="text-xs font-semibold tracking-wider">Pannello amministratori</div>
            </div>
            <ChevronRight size={14} style={{ color: VIO }} />
          </Link>
        )}
        {!isAdmin && isRegionalReferent && (
          <Link to="/referente-regionale" onClick={onClose}
            className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.04]"
            style={{ background: "color-mix(in srgb, #f59e0b 8%, transparent)", border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)" }}>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, #f59e0b 18%, transparent)" }}>
              <MapPin size={16} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-amber-500" style={eyebrow}>REFERENTE</div>
              <div className="text-xs font-semibold tracking-wider">Pannello regionale</div>
            </div>
            <ChevronRight size={14} className="text-amber-500" />
          </Link>
        )}

        {/* Ranking nazionale */}
        <Link to="/rankings" onClick={onClose}
          className="block rounded-xl bg-white/[0.03] p-3" style={tileVioBorder}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ ...eyebrow, color: vioText }}>
                <Medal size={11} /> RANKING 2026
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="font-display italic text-2xl leading-none" style={{ color: "var(--ibnf-ink)" }}>
                  {rankInfo?.rank ? `#${rankInfo.rank}` : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground" style={{ ...mono, letterSpacing: "0.1em" }}>
                  {rankInfo?.points ?? 0} PT
                </span>
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
        </Link>

        {/* ELO — cockpit */}
        <Link to="/elo" onClick={onClose} className="relative block rounded-xl p-3"
          style={{
            background: "linear-gradient(180deg, color-mix(in srgb, var(--ibnf-violet) 8%, transparent), rgba(255,255,255,0.02))",
            border: "1px solid color-mix(in srgb, var(--ibnf-violet) 32%, transparent)",
            boxShadow: "0 0 22px -10px color-mix(in srgb, var(--ibnf-violet) 55%, transparent)",
          }}>
          {corners.map((c) => <i key={c} aria-hidden style={cornerStyle(c)} />)}
          <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ ...eyebrow, color: vioText }}>
            <Sparkles size={11} /> IL TUO ELO
          </div>
          {elo ? (
            <>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="font-display italic text-[32px] leading-none"
                  style={{ color: tier?.color_hex
                    ? `color-mix(in srgb, ${tier.color_hex} 72%, var(--ibnf-ink))`
                    : "var(--ibnf-ink)" }}>
                  {elo.rating}
                </span>
                {tier && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border"
                    style={{ ...mono, letterSpacing: "0.12em", color: `color-mix(in srgb, ${tier.color_hex} 72%, var(--ibnf-ink))`, borderColor: `color-mix(in srgb, ${tier.color_hex} 60%, var(--ibnf-ink))` }}>
                    {tier.name}
                  </span>
                )}
              </div>
              <div className="flex mt-2.5 pt-2 border-t border-white/10">
                <div className="flex-1 text-center">
                  <div className="text-[9px]" style={{ ...mono, letterSpacing: "0.12em", color: "color-mix(in srgb, var(--ibnf-ink) 55%, transparent)" }}>PEAK</div>
                  <div className="font-display italic text-sm mt-0.5" style={{ color: "var(--ibnf-ink)" }}>{elo.peak_rating}</div>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex-1 text-center">
                  <div className="text-[9px]" style={{ ...mono, letterSpacing: "0.12em", color: "color-mix(in srgb, var(--ibnf-ink) 55%, transparent)" }}>MATCH</div>
                  <div className="font-display italic text-sm mt-0.5" style={{ color: "var(--ibnf-ink)" }}>{elo.matches_played}</div>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex-1 text-center">
                  <div className="text-[9px]" style={{ ...mono, letterSpacing: "0.12em", color: "color-mix(in srgb, var(--ibnf-ink) 55%, transparent)" }}>V/S</div>
                  <div className="font-display italic text-sm mt-0.5" style={{ color: "var(--ibnf-ink)" }}>{elo.wins}/{elo.losses}</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Gioca il tuo primo ranked per ricevere un ELO.
            </p>
          )}
        </Link>

        {/* Recap blader — acid su Win/Winrate, neutro su Match */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-2.5 text-center"
            style={{ background: "color-mix(in srgb, var(--ibnf-acid) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--ibnf-acid) 24%, transparent)" }}>
            <Trophy size={12} className="mx-auto mb-1" style={{ color: "var(--ibnf-acid)" }} />
            <div className="font-display italic text-base" style={{ color: "var(--ibnf-ink)" }}>{profile?.wins ?? 0}</div>
            <div className="text-[9px]" style={{ ...mono, letterSpacing: "0.14em", color: "color-mix(in srgb, var(--ibnf-ink) 55%, transparent)" }}>WIN</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 text-center">
            <Target size={12} className="mx-auto mb-1" style={{ color: VIO }} />
            <div className="font-display italic text-base" style={{ color: "var(--ibnf-ink)" }}>{totalMatches}</div>
            <div className="text-[9px]" style={{ ...mono, letterSpacing: "0.14em", color: "color-mix(in srgb, var(--ibnf-ink) 55%, transparent)" }}>MATCH</div>
          </div>
          <div className="rounded-xl p-2.5 text-center"
            style={{ background: "color-mix(in srgb, var(--ibnf-acid) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--ibnf-acid) 24%, transparent)" }}>
            <TrendingUp size={12} className="mx-auto mb-1" style={{ color: "var(--ibnf-acid)" }} />
            <div className="font-display italic text-base" style={{ color: "var(--ibnf-ink)" }}>{winrate}%</div>
            <div className="text-[9px]" style={{ ...mono, letterSpacing: "0.1em", color: "color-mix(in srgb, var(--ibnf-ink) 55%, transparent)" }}>WINRATE</div>
          </div>
        </div>

        {/* Club */}
        {myClub?.clubs ? (
          <Link to={`/clubs/${myClub.club_id}`} onClick={onClose}
            className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3" style={tileVioBorder}>
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--ibnf-violet) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--ibnf-violet) 30%, transparent)" }}>
              {myClub.clubs.logo_url
                ? <img src={myClub.clubs.logo_url} alt="" className="w-full h-full object-cover" />
                : <Shield size={16} style={{ color: VIO }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold" style={{ ...eyebrow, color: vioText }}>CLUB</div>
              <div className="font-display italic text-sm uppercase tracking-wide truncate leading-tight mt-0.5">
                {myClub.clubs.name}
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground" />
          </Link>
        ) : (
          <Link to="/clubs" onClick={onClose}
            className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3" style={tileVioBorder}>
            <Shield size={16} style={{ color: VIO }} />
            <span className="text-xs font-semibold uppercase tracking-wider flex-1" style={mono}>Trova un club</span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </Link>
        )}

        {/* Quick links */}
        <div className="rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden divide-y divide-white/5">
          {[
            { to: "/tournaments", label: "Tornei", icon: Calendar, key: "sidebar.tournaments" },
            { to: "/rankings", label: "Classifica", icon: Trophy, key: "sidebar.rankings" },
            { to: "/elo", label: "Ranking ELO", icon: Sparkles, key: "sidebar.elo" },
            { to: "/achievements", label: "Achievement", icon: Award, key: "sidebar.achievements" },
          ].map((l) => (
            <Link key={l.to} to={l.to} onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors">
              <span style={{ color: VIO }}>
                <CustomIcon iconKey={l.key} fallback={l.icon} size={14} />
              </span>
              <span className="text-[11px] font-bold uppercase flex-1" style={{ ...mono, letterSpacing: "0.12em" }}>{l.label}</span>
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
        className={`xl:hidden fixed top-[max(0.5rem,env(safe-area-inset-top))] bottom-[80px] z-[90] w-[82vw] max-w-[320px]
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

  // Mentre il drawer profilo (sinistra) è aperto, nascondi la capsula profilo
  // nella top-bar: avatar + nome sono già nell'header del drawer, quindi senza
  // questo l'identità appare duplicata.
  useEffect(() => {
    document.body.classList.toggle("ibnf-left-drawer-open", leftOpen);
    return () => { document.body.classList.remove("ibnf-left-drawer-open"); };
  }, [leftOpen]);

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
  const location = useLocation();
  const scrolled = useScrolled(140);
  const logoVisible = location.pathname !== "/" || scrolled;
  const logoClass = logoVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none";

  return (
    <aside
      className="hidden lg:flex fixed top-[9px] left-3 bottom-3 w-[236px] 2xl:w-[268px] glass-card !rounded-2xl z-40 flex-col overflow-hidden p-0 ibnf-left-profile-sidebar"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <LeftPanel onClose={() => undefined} />
      <Link
        to="/"
        aria-label="Home"
        aria-hidden={!logoVisible}
        className={`ibnf-sidebar-brand-logo absolute left-1/2 bottom-5 z-20 flex -translate-x-1/2 justify-center transition-all duration-300 ${logoClass}`}
      >
        <BrandLogo className="block h-auto w-full object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.58)]" />
      </Link>
    </aside>
  );
};

export default MobileSideDrawers;
