import { cn } from "@/lib/utils";

// Medaglie podio 1/2/3 (asset raster fissi oro/argento/bronzo — eccezione voluta:
// semantica metallo, NON re-skinnabile). Anello/aura DIETRO = token tema (--neon-*),
// gated: la medaglia resta fissa, l'aura "respira" col tema. Riga ornata solo a
// dimensione grande (>=sm); su mobile inline il workhorse e' l'esagono (regge il
// downscale dove l'ornato morirebbe sotto ~32px).
const META = {
  1: { label: "1° posto" },
  2: { label: "2° posto" },
  3: { label: "3° posto" },
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
      {/* mobile inline: badge esagonale compatto (asset dedicato, leggibile small) */}
      <picture className="sm:hidden">
        <source srcSet={`/ranks/badge-${rank}.webp`} type="image/webp" />
        <img
          src={`/ranks/badge-${rank}.png`}
          alt={m.label}
          width={28}
          height={33}
          loading="lazy"
          decoding="async"
          className="h-[30px] w-auto drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
        />
      </picture>
    </span>
  );
};

export default RankMedal;
