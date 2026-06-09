import { Link, useLocation } from "react-router-dom";
import { Home, Trophy, Users, Menu, X, ShoppingBag, BookOpen, Layers, Crosshair, Film, MessageSquare, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeVariantToggle } from "@/components/ThemeVariantToggle";
import { TorneiBolt } from "@/components/icons/TorneiBolt";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Trophy, label: "Classifica", href: "/rankings" },
  // center play button handled separately
  { icon: Users, label: "Club", href: "/clubs" },
  { icon: Menu, label: "Altro", href: "#menu" },
];

const moreLinks = [
  { icon: Shield, label: "Squadra", href: "/squadra" },
  { icon: BookOpen, label: "Forum", href: "/forum" },
  { icon: ShoppingBag, label: "Market", href: "/market" },
  { icon: Layers, label: "Collezione", href: "/collezione" },
  { icon: Crosshair, label: "Decks", href: "/decks" },
  // { icon: Film, label: "Media", href: "/media" }, // Temporaneamente nascosto
  { icon: BookOpen, label: "Regole", href: "/rules" },
  { icon: MessageSquare, label: "FAQ", href: "/faq" },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (path: string) => location.pathname === path;

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* More menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute bottom-[92px] left-3 right-3 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 animate-fade-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-colors ${
                    isActive(link.href)
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <link.icon size={20} />
                  <span className="text-[10px] font-medium">{link.label}</span>
                </Link>
              ))}
            </div>
            {/* Theme switcher */}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">Modalità tema</span>
              <ThemeVariantToggle />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar — liquid glass capsule + FAB Tornei */}
      <nav
        className="fixed left-1/2 -translate-x-1/2 z-[100] lg:hidden ibnf-capsule-nav"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
      >
        <div className="nav-cap">
          <div className="nav-items">
            {/* Home → / */}
            <Link to="/" className={`nav-tab ${isActive("/") ? "is-active" : ""}`} aria-current={isActive("/") ? "page" : undefined}>
              <Home aria-hidden="true" />
              <span className="dot" />
              <span className="lbl">Home</span>
            </Link>

            {/* Classifica → /rankings */}
            <Link to="/rankings" className={`nav-tab ${isActive("/rankings") ? "is-active" : ""}`} aria-current={isActive("/rankings") ? "page" : undefined}>
              <Trophy aria-hidden="true" />
              <span className="dot" />
              <span className="lbl">Classifica</span>
            </Link>

            {/* Slot centrale: occupato dal FAB Tornei (sotto) */}
            <span className="nav-tab nav-tab--center" aria-hidden="true" />

            {/* Club → /clubs */}
            <Link to="/clubs" className={`nav-tab ${isActive("/clubs") ? "is-active" : ""}`} aria-current={isActive("/clubs") ? "page" : undefined}>
              <Users aria-hidden="true" />
              <span className="dot" />
              <span className="lbl">Club</span>
            </Link>

            {/* Altro: handler drawer esistente, nessuna rotta */}
            <button type="button" onClick={() => setMenuOpen(!menuOpen)} className={`nav-tab ${menuOpen ? "is-active" : ""}`} aria-expanded={menuOpen} aria-label="Altro">
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
              <span className="dot" />
              <span className="lbl">Altro</span>
            </button>
          </div>
        </div>

        {/* FAB centrale Tornei → /tournaments */}
        <div className="nav-fab-wrap">
          <Link
            to="/tournaments"
            className={`nav-fab ${isActive("/tournaments") ? "is-active" : ""}`}
            aria-label="Tornei"
            aria-current={isActive("/tournaments") ? "page" : undefined}
          >
            <TorneiBolt />
          </Link>
          <span className="nav-fab-dot" />
          <span className="nav-fab-lbl">Tornei</span>
        </div>
      </nav>
    </>
  );
};
