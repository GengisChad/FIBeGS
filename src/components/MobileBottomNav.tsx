import { Link, useLocation } from "react-router-dom";
import { Home, Trophy, Swords, Users, Menu, X, ShoppingBag, BookOpen, Layers, Crosshair, Film, MessageSquare, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeVariantToggle } from "@/components/ThemeVariantToggle";

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

      {/* Bottom Nav Bar — capsule liquid glass */}
      <nav
        className="fixed left-1/2 -translate-x-1/2 z-[100] lg:hidden ibnf-capsule-nav"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
      >
        <div className="ibnf-capsule-nav__inner">
          <div className="ibnf-nav-row">
            {/* Home */}
            <Link to="/" className={`ibnf-nav-item ${isActive("/") ? "is-active" : ""}`}>
              <span className="ibnf-nav-ico"><Home size={23} strokeWidth={isActive("/") ? 2.4 : 2} /></span>
              <span className="ibnf-nav-dot" />
              <span className="ibnf-nav-lab">Home</span>
            </Link>

            {/* Classifica */}
            <Link to="/rankings" className={`ibnf-nav-item ${isActive("/rankings") ? "is-active" : ""}`}>
              <span className="ibnf-nav-ico"><Trophy size={23} strokeWidth={isActive("/rankings") ? 2.4 : 2} /></span>
              <span className="ibnf-nav-dot" />
              <span className="ibnf-nav-lab">Classifica</span>
            </Link>

            {/* Tornei (center circle, in-line) */}
            <Link to="/tournaments" className={`ibnf-nav-item ibnf-nav-tornei ${isActive("/tournaments") ? "is-active" : ""}`}>
              <span className="ibnf-nav-ico">
                <span className="ibnf-nav-ring"><Swords size={22} strokeWidth={2.2} /></span>
              </span>
              <span className="ibnf-nav-dot" />
              <span className="ibnf-nav-lab">Tornei</span>
            </Link>

            {/* Club */}
            <Link to="/clubs" className={`ibnf-nav-item ${isActive("/clubs") ? "is-active" : ""}`}>
              <span className="ibnf-nav-ico"><Users size={23} strokeWidth={isActive("/clubs") ? 2.4 : 2} /></span>
              <span className="ibnf-nav-dot" />
              <span className="ibnf-nav-lab">Club</span>
            </Link>

            {/* Altro */}
            <button onClick={() => setMenuOpen(!menuOpen)} className={`ibnf-nav-item ${menuOpen ? "is-active" : ""}`}>
              <span className="ibnf-nav-ico">{menuOpen ? <X size={23} strokeWidth={2.4} /> : <Menu size={23} />}</span>
              <span className="ibnf-nav-dot" />
              <span className="ibnf-nav-lab">Altro</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};
