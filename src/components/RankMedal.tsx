import { cn } from "@/lib/utils";

// Medaglie podio 1/2/3 (asset raster fissi oro/argento/bronzo — eccezione voluta:
// semantica metallo, NON re-skinnabile). Anello/aura DIETRO = token tema (--neon-*),
// gated: la medaglia resta fissa, l'aura "respira" col tema. Riga ornata solo a
// dimensione grande (>=sm); su mobile inline il workhorse e' l'esagono (regge il
// downscale dove l'ornato morirebbe sotto ~32px).
const META = {
  1: { metal: "#f2c230", dark: "#a8801a", ink: "#5a3d00", label: "1° posto" },
  2: { metal: "#cdd6df", dark: "#8b97a4", ink: "#2c3a47", label: "2° posto" },
  3: { metal: "#cd864a", dark: "#8a4f24", ink: "#3d2008", label: "3° posto" },
} as const;

export const RankMedal = ({ rank, className }: { rank: 1 | 2 | 3; className?: string }) => {
  const m = META[rank];
  const src = `/ranks/rank-${rank}`;
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      {/* >= sm: medaglione ornato + aura token dietro */}
      <span className="relative hidden sm:inline-flex items-center justify-center">
        <span aria-hidden className="rank-aura" />
        <picture>
          <source srcSet={`${src}.webp`} type="image/webp" />
          <img
            src={`${src}.png`}
            alt={m.label}
            width={40}
            height={44}
            loading="lazy"
            decoding="async"
            className="relative z-[1] h-11 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          />
        </picture>
      </span>
      {/* mobile inline: esagono workhorse */}
      <svg className="sm:hidden" width={26} height={28} viewBox="0 0 24 26" role="img" aria-label={m.label}>
        <polygon points="12,1.5 21.5,7 21.5,19 12,24.5 2.5,19 2.5,7" fill={m.metal} stroke={m.dark} strokeWidth="1.2" />
        <text x="12" y="17.5" textAnchor="middle" fontSize="13" fontWeight="800" fill={m.ink} fontFamily="var(--ibnf-font-display)">
          {rank}
        </text>
      </svg>
    </span>
  );
};

export default RankMedal;
