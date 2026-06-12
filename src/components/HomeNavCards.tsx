import { useRef } from "react";
import { BncIcon, type BncIconName } from "@/components/icons/BncIcon";

/**
 * HomeNavCards — stack HUD delle azioni principali della home FIBeGS.
 *
 * Verde (--ibnf-acid)  = azione del blader (iscriviti)
 * Viola (--ibnf-violet) = navigazione / strumenti
 *
 * NOTA: il video resta gestito dal player inline dell'hero (toggle 2024/2025).
 * Qui NON c'è più una card "Video nazionale": era un doppione che non apriva nulla.
 *
 * Firma visiva: glow che insegue il puntatore + parentesi angolari che "agganciano"
 * al hover + scia luminosa sulla CTA. Tutto si disattiva con prefers-reduced-motion.
 *
 * Richiede in BncIconName: "bolt" | "trophy" | "search" (gia' aggiunti).
 */

type Row = { label: string; icon: BncIconName; href: string; cta?: boolean; meta?: string };

const ROWS: Row[] = [
  { label: "Iscriviti a un torneo", icon: "bolt", href: "/tournaments", cta: true, meta: "Eventi aperti" },
  { label: "Classifica nazionale", icon: "trophy", href: "/rankings" },
  { label: "Cerca un club", icon: "search", href: "/clubs" },
];

function Brackets() {
  // 4 parentesi ad angolo (stile HUD) che si agganciano verso l'interno al hover
  return (
    <>
      <i className="hnc-br hnc-br-tl" aria-hidden />
      <i className="hnc-br hnc-br-tr" aria-hidden />
      <i className="hnc-br hnc-br-bl" aria-hidden />
      <i className="hnc-br hnc-br-br" aria-hidden />
    </>
  );
}

function HudRow({ row }: { row: Row }) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <a
      ref={ref}
      href={row.href}
      onMouseMove={onMove}
      className={`hnc-row ibnf-font-display ${row.cta ? "hnc-cta" : "hnc-glass"}`}
    >
      <Brackets />
      <span className="hnc-edge" aria-hidden />
      <span className="hnc-ico">
        <BncIcon name={row.icon} size={row.cta ? 24 : 22} />
      </span>
      <span className="hnc-label">{row.label}</span>
      {row.meta ? (
        <span className="hnc-meta">{row.meta}</span>
      ) : (
        <span className="hnc-chevron" aria-hidden>&rsaquo;</span>
      )}
    </a>
  );
}

export default function HomeNavCards() {
  return (
    <nav aria-label="Azioni principali" className="hnc-scope">
      {ROWS.map((r) => (
        <HudRow key={r.href} row={r} />
      ))}

      <style>{`
        .hnc-scope{
          width:100%; max-width:700px; margin-inline:auto;
          display:grid; grid-template-columns:1fr; gap:11px;
        }
        .hnc-row.hnc-cta{ grid-column:1 / -1; }   /* CTA sempre a tutta larghezza */
        .hnc-row{
          --mx:50%; --my:50%;
          position:relative; isolation:isolate; overflow:hidden;
          display:flex; align-items:center; gap:14px;
          padding:16px 18px; border-radius:13px; text-decoration:none;
          transition:transform .18s ease, box-shadow .25s ease, border-color .25s ease;
        }
        .hnc-row:hover{ transform:translateY(-2px); }
        .hnc-row:focus-visible{ outline:2px solid var(--ibnf-violet); outline-offset:3px; }

        /* --- glass rows (nav) --- */
        .hnc-glass{
          background:var(--ibnf-glass);
          border:1px solid var(--ibnf-glass-border);
          box-shadow:var(--ibnf-glass-shadow);
          backdrop-filter:blur(10px) saturate(120%);
          -webkit-backdrop-filter:blur(10px) saturate(120%);
        }
        .hnc-glass .hnc-ico{ color:#b69cff; }
        .hnc-glass .hnc-label{ color:var(--ibnf-ink); }
        .hnc-glass:hover{ border-color:rgba(139,92,255,.55); box-shadow:0 0 26px -10px rgba(139,92,255,.6); }

        /* --- CTA row (blader) --- */
        .hnc-cta{
          background:linear-gradient(150deg,#5cf06e,var(--ibnf-acid) 62%);
          color:#0B2D12; border:1px solid rgba(70,232,92,.5);
          box-shadow:0 0 26px -10px rgba(70,232,92,.6), inset 0 1px 0 rgba(255,255,255,.35);
        }
        .hnc-cta .hnc-ico, .hnc-cta .hnc-label{ color:#0B2D12; }
        .hnc-cta:hover{ box-shadow:0 0 34px -8px rgba(70,232,92,.8), inset 0 1px 0 rgba(255,255,255,.45); }

        /* left accent edge */
        .hnc-edge{
          position:absolute; left:0; top:0; bottom:0; width:3px; z-index:2;
        }
        .hnc-glass .hnc-edge{ background:linear-gradient(var(--ibnf-violet),rgba(139,92,255,.25)); }
        .hnc-cta .hnc-edge{ background:rgba(11,45,18,.45); }

        .hnc-ico{ display:grid; place-items:center; flex:0 0 auto; z-index:2; }
        .hnc-label{
          z-index:2; font-weight:700; font-style:italic; text-transform:uppercase;
          letter-spacing:.01em; line-height:1.05;
          font-size:19px;
        }
        .hnc-cta .hnc-label{ font-size:20px; }
        .hnc-meta{
          z-index:2; margin-left:auto; font-family:var(--font-mono,ui-monospace,monospace);
          font-size:10px; letter-spacing:.14em; text-transform:uppercase;
          color:rgba(11,45,18,.7);
        }
        .hnc-chevron{
          z-index:2; margin-left:auto; font-size:22px; line-height:1;
          color:var(--ibnf-ink-mute); transition:transform .18s ease;
        }
        .hnc-row:hover .hnc-chevron{ transform:translateX(3px); }

        /* signature 1 — glow che insegue il puntatore */
        .hnc-row::before{
          content:""; position:absolute; inset:0; z-index:1; pointer-events:none;
          background:radial-gradient(160px circle at var(--mx) var(--my),
            rgba(139,92,255,.28), transparent 60%);
          opacity:0; transition:opacity .25s ease;
        }
        .hnc-cta::before{
          background:radial-gradient(180px circle at var(--mx) var(--my),
            rgba(255,255,255,.45), transparent 60%);
        }
        .hnc-row:hover::before{ opacity:1; }

        /* signature 2 — scia luminosa diagonale */
        .hnc-row::after{
          content:""; position:absolute; top:0; bottom:0; width:40%; z-index:1; pointer-events:none;
          left:-60%; transform:skewX(-18deg);
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);
          transition:left .55s ease;
        }
        .hnc-row:hover::after{ left:130%; }

        /* signature 3 — parentesi HUD che agganciano */
        .hnc-br{
          position:absolute; width:11px; height:11px; z-index:2; pointer-events:none;
          border:1.5px solid currentColor; opacity:0; transition:opacity .2s ease, transform .2s ease;
        }
        .hnc-glass .hnc-br{ color:rgba(139,92,255,.9); }
        .hnc-cta .hnc-br{ color:rgba(11,45,18,.6); }
        .hnc-br-tl{ top:7px; left:7px; border-right:0; border-bottom:0; transform:translate(4px,4px); }
        .hnc-br-tr{ top:7px; right:7px; border-left:0; border-bottom:0; transform:translate(-4px,4px); }
        .hnc-br-bl{ bottom:7px; left:7px; border-right:0; border-top:0; transform:translate(4px,-4px); }
        .hnc-br-br{ bottom:7px; right:7px; border-left:0; border-top:0; transform:translate(-4px,-4px); }
        .hnc-row:hover .hnc-br{ opacity:1; transform:translate(0,0); }

        @media (min-width:768px){
          .hnc-scope{ grid-template-columns:1fr 1fr; }
          .hnc-row{ padding:17px 20px; }
          .hnc-label{ font-size:20px; }
          .hnc-cta .hnc-label{ font-size:21px; }
        }

        @media (prefers-reduced-motion:reduce){
          .hnc-row, .hnc-row::after, .hnc-br, .hnc-chevron, .hnc-row::before{ transition:none; }
          .hnc-row:hover{ transform:none; }
          .hnc-row:hover::after{ left:-60%; }
          .hnc-row:hover .hnc-br{ transform:translate(0,0); }
        }
      `}</style>
    </nav>
  );
}
