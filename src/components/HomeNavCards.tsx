import { BncIcon, type BncIconName } from "@/components/icons/BncIcon";

/**
 * HomeNavCards — le 4 azioni principali della home FIBeGS.
 * Mobile: bento (CTA grande in alto, Classifica+Cerca affiancate, Video largo).
 * Desktop (md+): fila orizzontale Iscriviti · Classifica · Cerca, Video centrato sotto.
 *
 * Verde (--ibnf-acid)  = azione del blader (iscriviti)
 * Viola (--ibnf-violet) = navigazione / strumenti
 *
 * NB: aggiungi "bolt" | "trophy" | "search" | "video" al type BncIconName in BncIcon.tsx
 * e incolla i 4 <symbol> in public/icons.svg (file fibegs-new-icons.svg).
 */

type NavItem = {
  label: string;
  icon: BncIconName;
  href: string;
  hasMenu?: boolean;
};

const SECONDARY: NavItem[] = [
  { label: "Classifica nazionale", icon: "trophy", href: "/rankings" },
  { label: "Cerca un club", icon: "search", href: "/clubs" },
];

const VIDEO: NavItem = { label: "Video nazionale", icon: "video", href: "/media", hasMenu: true };

const glass: React.CSSProperties = {
  background: "var(--ibnf-glass)",
  border: "1px solid var(--ibnf-glass-border)",
  boxShadow: "var(--ibnf-glass-shadow)",
  backdropFilter: "blur(10px) saturate(120%)",
  WebkitBackdropFilter: "blur(10px) saturate(120%)",
};

function VioletEdge() {
  return (
    <span
      aria-hidden
      className="absolute left-0 top-0 bottom-0 w-[3px]"
      style={{ background: "linear-gradient(var(--ibnf-violet), rgba(139,92,255,.25))" }}
    />
  );
}

function PrimaryCard() {
  return (
    <a
      href="/tournaments"
      className="ibnf-font-display group relative overflow-hidden rounded-[14px] p-5 transition-transform duration-150 hover:-translate-y-0.5 md:flex md:items-center md:gap-3 md:py-4"
      style={{
        background: "linear-gradient(150deg,#5cf06e,var(--ibnf-acid) 60%)",
        boxShadow: "0 0 30px -8px rgba(70,232,92,.55), inset 0 1px 0 rgba(255,255,255,.4)",
        color: "#0B2D12",
      }}
    >
      <BncIcon name="bolt" size={26} />
      <div>
        <div className="mt-2 text-[25px] font-bold italic uppercase leading-none md:mt-0 md:text-[20px]">
          Iscriviti a un torneo
        </div>
        <div className="mt-1.5 font-mono text-[10px] tracking-[.12em] opacity-65 md:hidden">
          EVENTI APERTI ORA &rarr;
        </div>
      </div>
    </a>
  );
}

function GlassCard({ item, tall }: { item: NavItem; tall?: boolean }) {
  return (
    <a
      href={item.href}
      style={glass}
      className={`ibnf-font-display group relative flex overflow-hidden rounded-[14px] transition-transform duration-150 hover:-translate-y-0.5 ${
        tall ? "flex-col items-start p-[18px]" : "items-center justify-between p-[17px_20px]"
      }`}
    >
      <VioletEdge />
      <div className={tall ? "" : "flex items-center gap-3"}>
        <BncIcon name={item.icon} size={tall ? 24 : 22} style={{ color: "#b69cff" }} />
        <span
          className={`block font-bold italic uppercase leading-tight text-[var(--ibnf-ink)] ${
            tall ? "mt-3 text-[18px]" : "text-[20px]"
          }`}
        >
          {item.label}
        </span>
      </div>
      {item.hasMenu && (
        <BncIcon name="add" size={16} style={{ color: "var(--ibnf-ink-mute)", transform: "rotate(0deg)" }} />
      )}
    </a>
  );
}

export default function HomeNavCards() {
  return (
    <nav aria-label="Azioni principali" className="mx-auto w-full max-w-[var(--ibnf-maxw)]">
      {/* MOBILE — bento */}
      <div className="flex flex-col gap-[11px] md:hidden">
        <PrimaryCard />
        <div className="grid grid-cols-2 gap-[11px]">
          {SECONDARY.map((it) => (
            <GlassCard key={it.href} item={it} tall />
          ))}
        </div>
        <GlassCard item={VIDEO} />
      </div>

      {/* DESKTOP — fila 3 + video centrato */}
      <div className="hidden md:block">
        <div className="flex flex-wrap justify-center gap-[14px]">
          <PrimaryCard />
          {SECONDARY.map((it) => (
            <GlassCard key={it.href} item={it} />
          ))}
        </div>
        <div className="mt-[14px] flex justify-center">
          <div className="min-w-[300px]">
            <GlassCard item={VIDEO} />
          </div>
        </div>
      </div>
    </nav>
  );
}
