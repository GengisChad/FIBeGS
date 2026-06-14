import { Link, useLocation } from "react-router-dom";
import { Home, Trophy, Users, Menu, X, ShoppingBag, BookOpen, Layers, Crosshair, Film, MessageSquare, Shield, Swords } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeVariantToggle } from "@/components/ThemeVariantToggle";

// Pill indicatore tab attiva: UN solo elemento persistente in .nav-items, che
// framer fa scivolare (molla) sotto la voce attiva cambiando `left`. Niente
// mount/unmount per tab -> robusto ai cambi rotta/Suspense (no transform
// residuo). Avvolge icona+label; sta DIETRO il contenuto (z-10).
const NAV_ROUTES = ["/", "/rankings", "/tournaments", "/clubs"];
// Accenti tab da token tema (storia 2 colori): centro "Tornei" = accent, resto = primary.
// hsl(var(--token)) si risolve live a ogni cambio tema, su tutti i 27 temi.
const NAV_VARS = ["--primary", "--primary", "--accent", "--primary", "--primary"];

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
  // Indice voce attiva (Altro = 4 col menu aperto) -> posizione/colore pill.
  const activeIndex = menuOpen ? 4 : NAV_ROUTES.findIndex((r) => isActive(r));
  const pillVar = activeIndex >= 0 ? NAV_VARS[activeIndex] : null;

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

      {/* Bottom Nav Bar — liquid glass capsule, tutte le voci inline */}
      <nav
        className="fixed left-1/2 -translate-x-1/2 z-[100] lg:hidden ibnf-capsule-nav"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
      >
        <div className="nav-cap">
          <div className="nav-items">
            {/* Pill attiva unica: scivola sotto la voce attiva (transform =
                idx*100% della sua larghezza). Slide via transizione CSS:
                affidabile a ogni cambio rotta, molla-like + crossfade colore. */}
            <div
              aria-hidden
              className="nav-pill"
              data-i={Math.max(0, activeIndex)}
              style={{
                opacity: pillVar !== null ? 1 : 0,
                backgroundColor: `hsl(var(${pillVar ?? "--primary"}) / 0.11)`,
                borderColor: `hsl(var(${pillVar ?? "--primary"}) / 0.35)`,
                boxShadow: `0 0 14px -6px hsl(var(${pillVar ?? "--primary"}) / 0.4)`,
              }}
            />

            {/* Home → / */}
            <Link to="/" className={`nav-tab ${isActive("/") ? "is-active" : ""}`} aria-current={isActive("/") ? "page" : undefined}>
              <span className="nav-content" style={isActive("/") ? { color: "hsl(var(--primary))" } : undefined}>
                <Home aria-hidden="true" />
                <span className="nav-lbl">Home</span>
              </span>
            </Link>

            {/* Classifica → /rankings */}
            <Link to="/rankings" className={`nav-tab ${isActive("/rankings") ? "is-active" : ""}`} aria-current={isActive("/rankings") ? "page" : undefined}>
              <span className="nav-content" style={isActive("/rankings") ? { color: "hsl(var(--primary))" } : undefined}>
                <Trophy aria-hidden="true" />
                <span className="nav-lbl">Classifica</span>
              </span>
            </Link>

            {/* Tornei → /tournaments */}
            <Link to="/tournaments" className={`nav-tab nav-tab--core ${isActive("/tournaments") ? "is-active" : ""}`} aria-current={isActive("/tournaments") ? "page" : undefined}>
              <span className="nav-content" style={isActive("/tournaments") ? { color: "hsl(var(--accent))" } : undefined}>
                <Swords aria-hidden="true" />
                <span className="nav-lbl">Tornei</span>
              </span>
            </Link>

            {/* Club → /clubs */}
            <Link to="/clubs" className={`nav-tab ${isActive("/clubs") ? "is-active" : ""}`} aria-current={isActive("/clubs") ? "page" : undefined}>
              <span className="nav-content" style={isActive("/clubs") ? { color: "hsl(var(--primary))" } : undefined}>
                <Users aria-hidden="true" />
                <span className="nav-lbl">Club</span>
              </span>
            </Link>

            {/* Altro: handler drawer esistente, nessuna rotta */}
            <button type="button" onClick={() => setMenuOpen(!menuOpen)} className={`nav-tab ${menuOpen ? "is-active" : ""}`} aria-expanded={menuOpen} aria-label="Altro">
              <span className="nav-content" style={menuOpen ? { color: "hsl(var(--primary))" } : undefined}>
                {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                <span className="nav-lbl">Altro</span>
              </span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};
