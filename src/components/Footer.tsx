import { Link } from "react-router-dom";
import fibegsEmblem from "@/assets/brand/fibegs-emblem-ice.png";
import { Instagram, Youtube, Facebook, MessageCircle, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const socials = [
  { label: "Discord", href: "https://discord.com/invite/2VrhTduM95", Icon: MessageCircle },
  { label: "Instagram", href: "https://www.instagram.com/ibnabeybladeit/", Icon: Instagram },
  { label: "YouTube", href: "https://www.youtube.com/@ibnabeyblade", Icon: Youtube },
  { label: "Facebook", href: "https://www.facebook.com/groups/1578510069340499", Icon: Facebook },
];

const risorse = [
  { label: "Classifica", href: "/rankings" },
  { label: "Tornei", href: "/tournaments" },
  { label: "Club", href: "/clubs" },
  { label: "Forum", href: "/forum" },
  { label: "Regole", href: "/rules" },
  { label: "FAQ", href: "/faq" },
];

const legale = [
  { label: "Privacy", href: "/privacy" },
  { label: "Termini", href: "/termini" },
  { label: "Cookie", href: "/cookie" },
];

export const Footer = () => {
  const { user } = useAuth();
  return (
    <footer className="ibnf-ft" id="contatti">
      <div className="ibnf-wrap">
        {/* CTA banner — only for visitors */}
        {!user && (
          <div className="ibnf-ft-cta ibnf-card ibnf-cut">
            <div>
              <h3 className="ibnf-ft-cta-title">Pronto a entrare in arena?</h3>
              <p className="ibnf-muted">Crea il profilo, scegli un torneo, gira il tuo bey.</p>
            </div>
            <Link to="/auth" className="ibnf-btn ibnf-btn-primary ibnf-btn-lg">
              <Zap size={18} /> Accedi / Registrati
            </Link>
          </div>
        )}

        {/* Main */}
        <div className="ibnf-ft-main">
          <div className="ibnf-ft-brand">
            <Link to="/" className="ibnf-ft-logo">
              <img src={fibegsEmblem} alt="FIBeGS" />
              <span>
                <b>FIBeGS</b>
                <i>FIBeGS</i>
              </span>
            </Link>
            <p className="ibnf-ft-tag ibnf-muted">
              La casa ufficiale dei Blader italiani.<br />Gira. Combatti. Domina.
            </p>
            <div className="ibnf-ft-social">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="ibnf-ft-soc"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div className="ibnf-ft-cols">
            <div className="ibnf-ft-col">
              <h4>Risorse</h4>
              {risorse.map((l) => (
                <Link key={l.href} to={l.href}>{l.label}</Link>
              ))}
            </div>
            <div className="ibnf-ft-col">
              <h4>Legale</h4>
              {legale.map((l) => (
                <Link key={l.href} to={l.href}>{l.label}</Link>
              ))}
            </div>
            <div className="ibnf-ft-col">
              <h4>Social</h4>
              {socials.map(({ label, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
              ))}
            </div>
          </div>
        </div>

        <div className="ibnf-tricolore ibnf-ft-tri"><i /><i /><i /></div>
        <div className="ibnf-ft-legal">
          <span className="ibnf-muted">© 2026 FIBeGS — FIBeGS · Non affiliato Takara Tomy / Hasbro</span>
          <div className="ibnf-ft-legal-links">
            {legale.map((l) => (
              <Link key={l.href} to={l.href}>{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
