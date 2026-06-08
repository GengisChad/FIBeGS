import { useEffect, useState, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, MessageCircle, MapPin, Trophy, Coins, HelpCircle, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
      className="glass-bar fixed top-0 left-0 right-0 z-50 border-b border-white/10"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-16 gap-2 relative">
          {/* LEFT: Profile block (avatar + name + rank/points) */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <Link
                to="/profile"
                aria-label="Vai al profilo"
                className="flex items-center gap-2 px-2 py-1 rounded-2xl border border-border hover:bg-secondary/50 transition-colors"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName || "Profilo"} /> : null}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0 max-w-[40vw] sm:max-w-[180px]">
                  {displayName && (
                    <span className="text-xs font-semibold leading-tight w-full overflow-hidden whitespace-nowrap text-ellipsis">
                      {displayName}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] leading-tight text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Trophy size={10} className="text-primary" />
                      <span className="font-semibold text-foreground">{rankLabel}</span>
                    </span>
                    <span className="opacity-40">·</span>
                    <span className="flex items-center gap-0.5">
                      <Coins size={10} className="text-primary" />
                      <span className="font-semibold text-foreground tabular-nums">{pointsLabel}</span>
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
            className={`hidden lg:flex items-center shrink-0 ml-3 ${logoClass}`}
            aria-label="Home"
            aria-hidden={!logoVisible}
          >
            <BrandLogo className="h-10 w-auto" />
          </Link>

          {/* Desktop: nav links centrati nello spazio rimanente */}
          <div className="hidden lg:flex items-center gap-1 flex-1 min-w-0 justify-center overflow-x-auto scrollbar-hide">
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className={`nav-link px-2 xl:px-3 py-2 font-medium text-xs xl:text-sm whitespace-nowrap shrink-0 ${isActive(link.href) ? "text-foreground" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </div>



          {/* RIGHT: Chat → Admin/Referente → Notifications */}
          <div className="flex items-center gap-1.5 shrink-0">
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
                  className="h-9 w-9 border-primary/50 text-primary hover:bg-primary/10"
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
                  className="h-9 w-9 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
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
