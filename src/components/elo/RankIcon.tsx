/* ==================================================================
 *  RankIcon — badge rank/ELO premium (PNG e-sport, sfondo trasparente).
 *  Sostituisce gli emblemi vettoriali: stesso footprint, look molto piu
 *  epico. Solo presentazione, nessun dato/soglia/logica toccati.
 * ================================================================== */

const rankIconMap = {
  leggenda: "/assets/ranks/01-leggenda.png",
  gran_maestro: "/assets/ranks/02-gran-maestro.png",
  maestro: "/assets/ranks/03-maestro.png",
  elite: "/assets/ranks/04-elite.png",
  veterano: "/assets/ranks/05-veterano.png",
  combattente: "/assets/ranks/06-combattente.png",
  sfidante: "/assets/ranks/07-sfidante.png",
} as const;

/** Normalizza un nome tier ("Gran Maestro") nello slug della mappa ("gran_maestro"). */
function normalizeRankSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

type RankIconProps = {
  rank: string;
  unlocked?: boolean;
  current?: boolean;
  size?: number;
  /** Colore tier per il glow del tier corrente (default blu-violetto). */
  tint?: string;
  className?: string;
};

export function RankIcon({
  rank,
  unlocked = true,
  current = false,
  size = 64,
  tint,
  className = "",
}: RankIconProps) {
  const slug = normalizeRankSlug(rank);
  const src = rankIconMap[slug as keyof typeof rankIconMap];

  if (!src) return null;

  return (
    <div
      className={[
        "relative grid place-items-center shrink-0",
        "transition-transform duration-300 ease-out",
        current ? "scale-110" : "",
        unlocked ? "opacity-100" : "opacity-35 grayscale",
        className,
      ].join(" ")}
      style={{
        width: size,
        height: size,
        color: tint,
        filter: current ? `drop-shadow(0 0 18px ${tint ? `${tint}73` : "rgba(125,150,255,0.45)"})` : undefined,
      }}
    >
      {current && (
        <span className="absolute inset-0 -z-10 rounded-full bg-current opacity-20 blur-2xl motion-safe:animate-pulse" />
      )}

      <img
        src={src}
        alt={`Rank ${rank}`}
        width={size}
        height={size}
        className="h-full w-full object-contain select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}

export default RankIcon;
