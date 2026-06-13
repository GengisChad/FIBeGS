import { useCallback, useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, MapPin, HelpCircle, Coffee, ChevronDown } from "lucide-react";
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

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Classifica", href: "/rankings" },
  { label: "ELO", href: "/elo" },
  { label: "Tornei", href: "/tournaments" },
  { label: "Club", href: "/clubs" },
  { label: "Forum", href: "/forum" },
  { label: "Market", href: "/market" },
  { label: "Collezione", href: "/collezione" },
  { label: "Decks", href: "/decks" },
  // { label: "Media", href: "/media" }, // Temporaneamente nascosto
  { label: "Regole", href: "/rules" },
  { label: "FAQ", href: "/faq" },
];
export { navLinks };

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
  const [visibleNavCount, setVisibleNavCount] = useState(navLinks.length);
  const navSlotRef = useRef<HTMLDivElement | null>(null);
  const navItemMeasureRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const moreMeasureRef = useRef<HTMLButtonElement | null>(null);
  const { data: rankData } = useUserRankAndPoints();
  const { count: unreadCount } = useUnreadPrivateMessages();
  const isActive = (path: string) => location.pathname === path;
  const visibleNavLinks = navLinks.slice(0, visibleNavCount);
  const overflowNavLinks = navLinks.slice(visibleNavCount);
  const hasOverflowNavLinks = overflowNavLinks.length > 0;
  const inOverflow = overflowNavLinks.some(l => isActive(l.href));

  const updateVisibleNavLinks = useCallback(() => {
    const slot = navSlotRef.current;
    const more = moreMeasureRef.current;
    if (!slot || !more) return;

    const linkWidths = navLinks.map((_, index) => navItemMeasureRefs.current[index]?.offsetWidth ?? 0);
    if (linkWidths.some(width => width === 0)) return;

    const availableWidth = slot.clientWidth - 10;
    const gap = 2;
    const moreWidth = more.offsetWidth;

    const getWidth = (count: number, includeMore: boolean) => {
      const itemCount = count + (includeMore ? 1 : 0);
      const gapsWidth = Math.max(0, itemCount - 1) * gap;
      const linksWidth = linkWidths.slice(0, count).reduce((sum, width) => sum + width, 0);

      return linksWidth + (includeMore ? moreWidth : 0) + gapsWidth;
    };

    if (getWidth(navLinks.length, false) <= availableWidth) {
      setVisibleNavCount(navLinks.length);
      return;
    }

    for (let count = navLinks.length - 1; count >= 0; count -= 1) {
      if (getWidth(count, true) <= availableWidth) {
        setVisibleNavCount(count);
        return;
      }
    }

    setVisibleNavCount(0);
  }, []);

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

  useLayoutEffect(() => {
    updateVisibleNavLinks();

    const slot = navSlotRef.current;
    const observer = typeof ResizeObserver !== "undefined" && slot
      ? new ResizeObserver(() => updateVisibleNavLinks())
      : null;

    observer?.observe(slot);
    window.addEventListener("resize", updateVisibleNavLinks);
    document.fonts?.ready.then(updateVisibleNavLinks).catch(() => undefined);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateVisibleNavLinks);
    };
  }, [updateVisibleNavLinks]);

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

  // On homepage the hero shows a large FIBeGS logo: cross-fade with the navbar logo on scroll.
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
                className="ibnf-rail-capsule ibnf-rail-capsule--profile flex items-center gap-2.5 transition hover:brightness-110"
              >
                <Avatar className="h-9 w-9 shrink-0 lg:rounded-[11px]">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName || "Profilo"} /> : null}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0 max-w-[40vw] sm:max-w-[180px]">
                  {displayName && (
                    <span className="font-display italic uppercase text-[13px] leading-tight w-full overflow-hidden whitespace-nowrap text-ellipsis">
                      {displayName}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="ibnf-rail-rank">{rankLabel}</span>
                    <span className="ibnf-rail-pt tabular-nums">{pointsLabel} PT</span>
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

          {/* CENTER (mobile/tablet): FIBeGS logo (hidden on lg+, and on devices with notch) */}
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

          {/* Desktop: capsula nav — primarie + menu Altro */}
          <div ref={navSlotRef} className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 justify-center">
            <div
              className="ibnf-rail-capsule ibnf-rail-capsule--pill relative flex items-center gap-0.5 p-[5px] max-w-full overflow-hidden"
            >
              {visibleNavLinks.map(link => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`ibnf-rail-link shrink-0 ${isActive(link.href) ? "ibnf-rail-link--active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
              {hasOverflowNavLinks && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`ibnf-rail-link shrink-0 inline-flex items-center gap-1 ${inOverflow ? "ibnf-rail-link--active" : ""}`}
                      aria-label="Altre sezioni"
                    >
                      Altro <ChevronDown size={12} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {overflowNavLinks.map(link => (
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
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none invisible fixed -left-[9999px] top-0 flex items-center gap-0.5 p-[5px]"
              >
                {navLinks.map((link, index) => (
                  <Link
                    key={link.href}
                    ref={(node) => { navItemMeasureRefs.current[index] = node; }}
                    to={link.href}
                    tabIndex={-1}
                    className="ibnf-rail-link shrink-0"
                  >
                    {link.label}
                  </Link>
                ))}
                <button
                  ref={moreMeasureRef}
                  type="button"
                  tabIndex={-1}
                  className="ibnf-rail-link shrink-0 inline-flex items-center gap-1"
                >
                  Altro <ChevronDown size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: capsula strumenti — Tema → (Feedback/Donate mobile) → Admin/Referente → Notifiche */}
          <div className="ibnf-rail-capsule ibnf-rail-capsule--pill flex items-center gap-1 shrink-0">
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
