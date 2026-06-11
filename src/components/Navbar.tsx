import { useEffect, useState, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, MessageCircle, MapPin, Trophy, Coins, HelpCircle, Coffee, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserRoles } from "@/hooks/useUserRoles";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeVariantToggle } from "@/components/ThemeVariantToggle";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaTop } from "@/hooks/useSafeAreaTop";
import { useUserRankAndPoints } from "@/hooks/useUserRankAndPoints";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadPrivateMessages } from "@/hooks/useUnreadMessages";
import { BrandLogo } from "@/components/BrandLogo";
import { useScrolled } from "@/hooks/useScrolled";

const ChatHubDialog = lazy(() => import("@/components/chat/ChatHubDialog"));

/* Nav primarie in vista; secondarie nel menu "Altro" */
const primaryLinks = [
  { label: "Home", href: "/" },
  { label: "Classifica", href: "/rankings" },
  { label: "ELO", href: "/elo" },
  { label: "Tornei", href: "/tournaments" },
  { label: "Club", href: "/clubs" },
  { label: "Forum", href: "/forum" },
  { label: "Market", href: "/market" },
];
const secondaryLinks = [
  { label: "Collezione", href: "/collezione" },
  { label: "Decks", href: "/decks" },
  // { label: "Media", href: "/media" }, // Temporaneamente nascosto
  { label: "Regole", href: "/rules" },
  { label: "FAQ", href: "/faq" },
];
/* navLinks completo: usato dove serve la lista intera (es. menu mobile, se importato) */
export const navLinks = [...primaryLinks, ...secondaryLinks];

export const Navbar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { isRegionalReferent } = useUserRoles();
  const { theme } = useTheme();
  const safeTop = useSafeAreaTop();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [chatOpen, setChatOpen] = useState(false);
  const { data: rankData } = useUserRankAndPoints();
  const { count: unreadCount } = useUnreadPrivateMessages();
  const isActive = (path: string) => location.pathname === path;
  const inSecondary = secondaryLinks.some(l => isActive(l.href));

  const openChatFresh = () => {
    // Strip any deep-link params so we don't auto-open an old chat
    const url = new URL(window.location.href);
    if (url.searchParams.has("chat") || url.searchParams.has("kind")) {
      url.searchParams.delete("chat");
      url.searchParams.delete("kind");
      window.history.replaceState({}, "", url.toString());
    }
    setChatOpen(true);
  };

  useEffect(() => {
    if (!user) { setAvatarUrl(null); setDisplayName(""); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, display_name, username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setAvatarUrl((data as any)?.avatar_url ?? null);
      setDisplayName((data as any)?.display_name || (data as any)?.username || "");
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Auto-open chat dialog when arriving from a notification deep-link (?chat=...&kind=...)
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat")) setChatOpen(true);
  }, [user, location.pathname, location.search]);

  const initials = (displayName || user?.email || "?").slice(0, 1).toUpperCase();

  // Hide centered logo if device has notch/camera hole to avoid overlap
  const hasNotch = safeTop > 20;

  const rankLabel = rankData?.rank ? `#${rankData.rank}` : "—";
  const pointsLabel = rankData?.points ?? 0;

  // On homepage the hero shows a large FIB logo: cross-fade with the navbar logo on scroll.
  const isHome = location.pathname === "/";
  const scrolled = useScrolled(140);
  const logoVisible = !isHome || scrolled;
  const logoClass = `transition-all duration-300 ${
    logoVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
  }`;

  return (
    <nav
      className="glass-bar ibnf-rail-bar fixed top-0 left-0 right-0 z-50 border-b border-white/10"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-16 gap-2 lg:gap-3 relative">
          {/* LEFT: capsula profilo (avatar + nome + rank/points) */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <Link
                to="/profile"
                aria-label="Vai al profilo"
                className="ibnf-rail-capsule ibnf-rail-capsule--profile flex items-center gap-2.5 px-2 py-1 rounded-2xl border border-border hover:bg-secondary/50 transition-colors lg:border-0 lg:rounded-[13px] lg:hover:brightness-110"
              >
                <Avatar className="h-9 w-9 shrink-0 lg:rounded-[11px]">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName || "Profilo"} /> : null}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0 max-w-[40vw] sm:max-w-[180px]">
                  {displayName && (
                    <span className="text-xs font-semibold leading-tight w-full overflow-hidden whitespace-nowrap text-ellipsis lg:font-display lg:italic lg:uppercase lg:text-[13px]">
                      {displayName}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] leading-tight text-muted-foreground lg:mt-0.5">
                    {/* mobile: trofeo+coin come oggi */}
                    <span className="flex items-center gap-0.5 lg:hidden">
                      <Trophy size={10} className="text-primary" />
                      <span className="font-semibold text-foreground">{rankLabel}</span>
                    </span>
                    <span className="opacity-40 lg:hidden">·</span>
                    <span className="flex items-center gap-0.5 lg:hidden">
                      <Coins size={10} className="text-primary" />
                      <span className="font-semibold text-foreground tabular-nums">{pointsLabel}</span>
                    </span>
                    {/* desktop rail: chip verde + PT viola */}
                    <span className="hidden lg:inline-flex items-center gap-1.5">
                      <span className="ibnf-rail-rank">{rankLabel}</span>
                      <span className="ibnf-rail-pt tabular-nums">{pointsLabel} PT</span>
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="default" size="sm" className="h-9 px-3 text-xs font-semibold">
                  ACCEDI
                </Button>
              </Link>
            )}
          </div>

          {/* CENTER (mobile/tablet): FIB logo (hidden on lg+, and on devices with notch) */}
          {!hasNotch && (
            <Link
              to="/"
              className={`lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2 ${logoClass}`}
              aria-label="Home"
              aria-hidden={!logoVisible}
            >
              <BrandLogo className="h-10 sm:h-11 w-auto" />
            </Link>
          )}

          {/* Desktop: Logo FIB inline (subito dopo il profilo) */}
          <Link
            to="/"
            className={`hidden lg:flex items-center shrink-0 ml-1 ${logoClass}`}
            aria-label="Home"
            aria-hidden={!logoVisible}
          >
            <BrandLogo className="h-10 w-auto" />
          </Link>

          {/* Desktop: capsula nav — primarie + menu Altro */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 justify-center">
            <div className="ibnf-rail-capsule ibnf-rail-capsule--pill flex items-center gap-0.5 p-[5px] max-w-full overflow-x-auto scrollbar-hide">
              {primaryLinks.map(link => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`ibnf-rail-link shrink-0 ${isActive(link.href) ? "ibnf-rail-link--active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`ibnf-rail-link shrink-0 inline-flex items-center gap-1 ${inSecondary ? "ibnf-rail-link--active" : ""}`}
                    aria-label="Altre sezioni"
                  >
                    Altro <ChevronDown size={12} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  {secondaryLinks.map(link => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        to={link.href}
                        className={isActive(link.href) ? "font-semibold" : ""}
                      >
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* RIGHT: capsula strumenti — Tema → (Feedback/Donate mobile) → Admin/Referente → Notifiche */}
          <div className="ibnf-rail-capsule ibnf-rail-capsule--pill flex items-center gap-1.5 shrink-0 lg:gap-1">
            <div className="hidden lg:block">
              <ThemeVariantToggle />
            </div>
            {/* Mobile: Feedback + Donate (replace chat/admin/referente) */}
            {user && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Invia feedback"
                className="h-9 w-9 xl:hidden"
                onClick={() => window.dispatchEvent(new Event("open-feedback"))}
              >
                <HelpCircle size={16} />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label="Supporta il progetto"
              className="h-9 w-9 xl:hidden text-primary border-primary/50 hover:bg-primary/10"
              onClick={() => window.dispatchEvent(new Event("open-donate"))}
            >
              <Coffee size={16} />
            </Button>
            {/* Desktop only: admin/referente */}
            {user && isAdmin && (
              <Link to="/admin" aria-label="Pannello admin" className="hidden xl:inline-flex">
                <Button
                  variant="outline"
                  size="icon"
                  className="ibnf-rail-tool h-9 w-9 border-primary/50 text-primary hover:bg-primary/10 lg:border-0 lg:bg-transparent"
                >
                  <Shield size={16} />
                </Button>
              </Link>
            )}
            {user && !isAdmin && isRegionalReferent && (
              <Link to="/referente-regionale" aria-label="Pannello referente regionale" className="hidden xl:inline-flex">
                <Button
                  variant="outline"
                  size="icon"
                  className="ibnf-rail-tool h-9 w-9 border-amber-500/50 text-amber-500 hover:bg-amber-500/10 lg:border-0 lg:bg-transparent"
                >
                  <MapPin size={16} />
                </Button>
              </Link>
            )}
            <NotificationBell />
          </div>
        </div>
      </div>
      {user && (
        <Suspense fallback={null}>
          <ChatHubDialog open={chatOpen} onOpenChange={setChatOpen} />
        </Suspense>
      )}
    </nav>
  );
};
