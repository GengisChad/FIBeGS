/* ==================================================================
 *  RankMedallion — emblemi "vetrina" per la Scala dei Ranghi (ELO).
 *
 *  SVG ORIGINALI disegnati a mano (tema beyblade/gear), NON icone di
 *  libreria e NON insegne copiate da altri giochi. Un emblema distinto
 *  per tier; complessità del motivo e MATERIALE crescono salendo:
 *    level 0-2  → matte / acciaio (anello sottile, no glow)
 *    level 3    → metallo lucido (anello marcato, glow tenue)
 *    level 4-5  → gradient sull'emblema (doppio bordo, glow)
 *    level 6    → corona imperiale, sigillo olografico iridescente
 *
 *  SOLO presentazione: nessun dato/soglia/logica toccati.
 * ================================================================== */

interface RankMedallionProps {
  /** Lato in px. */
  size?: number;
  /** 0 = tier più basso … 6 = Leggenda. Guida materiale e complessità. */
  level: number;
  /** Colore tier (DB) — tinta della faccia, halo, accenti. */
  colorHex: string;
  /** Glow tier (DB) — halo e glow. */
  glowHex: string;
  className?: string;
}

const HEX_DEG = [-90, -30, 30, 90, 150, 210] as const;
const ptOnHex = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [32 + r * Math.cos(a), 32 + r * Math.sin(a)];
};
const hexPoints = (r: number) =>
  HEX_DEG.map((d) => ptOnHex(d, r).map((n) => n.toFixed(1)).join(",")).join(" ");

type Material = "steel" | "polished" | "gradient" | "holo";
const materialFor = (level: number): Material =>
  level >= 6 ? "holo" : level >= 4 ? "gradient" : level === 3 ? "polished" : "steel";

interface Ink {
  stroke: string;
  fill: string;
  gem: string;
  faint: string;
}
const inkFor = (m: Material): Ink => {
  switch (m) {
    case "holo":
    case "gradient":
      return { stroke: "hsl(0 0% 100% / 0.9)", fill: "hsl(160 24% 7% / 0.4)", gem: "hsl(0 0% 100% / 0.95)", faint: "hsl(0 0% 100% / 0.34)" };
    case "polished":
      return { stroke: "hsl(210 22% 88%)", fill: "hsl(210 20% 11% / 0.45)", gem: "hsl(0 0% 100% / 0.95)", faint: "hsl(210 20% 80% / 0.4)" };
    default: // steel
      return { stroke: "hsl(210 18% 75%)", fill: "hsl(210 20% 12% / 0.5)", gem: "hsl(210 22% 88%)", faint: "hsl(210 18% 70% / 0.32)" };
  }
};

const BLADE = "M32 15 C 35 20, 35 25, 32 30 C 29 25, 29 20, 32 15 Z";

const Rotor = ({ count, ink }: { count: number; ink: Ink }) => (
  <g fill={ink.fill} stroke={ink.stroke} strokeWidth={1.1} strokeLinejoin="round">
    {Array.from({ length: count }, (_, i) => Math.round((i * 360) / count)).map((deg) => (
      <path key={deg} d={BLADE} transform={`rotate(${deg} 32 32)`} />
    ))}
  </g>
);

const Teeth = ({ ink }: { ink: Ink }) => (
  <g fill={ink.faint}>
    {Array.from({ length: 12 }, (_, i) => i * 30 + 15).map((deg) => (
      <rect key={deg} x={30.6} y={1} width={2.8} height={4.2} rx={0.6} transform={`rotate(${deg} 32 32)`} />
    ))}
  </g>
);

const Nodes = ({ ink }: { ink: Ink }) => (
  <g fill={ink.gem}>
    {HEX_DEG.map((d, i) => {
      const [x, y] = ptOnHex(d, 26);
      return <circle key={i} cx={x} cy={y} r={1.4} />;
    })}
  </g>
);

const Core = ({ ink, gem = false }: { ink: Ink; gem?: boolean }) => (
  <g>
    <circle cx={32} cy={32} r={6.2} fill={ink.fill} stroke={ink.stroke} strokeWidth={1.2} />
    <polygon points="32,28 35.5,30 35.5,34 32,36 28.5,34 28.5,30" fill="none" stroke={ink.faint} strokeWidth={0.8} />
    <circle cx={32} cy={32} r={1.5} fill={ink.gem} />
    {gem && <path d="M32 23.6 L33.8 25.6 L32 27.6 L30.2 25.6 Z" fill={ink.gem} />}
  </g>
);

/* ---- Corona imperiale (solo Leggenda) ---- */
const CrownArt = ({ ink }: { ink: Ink }) => {
  const tips: [number, number][] = [[18, 27], [25, 22], [39, 22], [46, 27]];
  const rays = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <g stroke="hsl(0 0% 100% / 0.26)" strokeWidth={0.8}>
        {rays.map((deg, i) => (
          <line key={deg} x1={32} y1={32} x2={32} y2={i % 2 ? 7 : 4} transform={`rotate(${deg} 32 32)`} />
        ))}
      </g>
      <circle cx={32} cy={32} r={29} stroke={ink.stroke} strokeWidth={1.4} fill="none" />
      <circle cx={32} cy={32} r={24.5} stroke={ink.faint} strokeWidth={0.9} fill="none" />
      <g fill="hsl(0 0% 100% / 0.9)">
        {Array.from({ length: 8 }, (_, i) => i * 45).map((deg) => (
          <circle key={deg} cx={32} cy={3} r={1.1} transform={`rotate(${deg} 32 32)`} />
        ))}
      </g>
      <path
        d="M15 35.5 L18 27 L21.5 32 L25 22 L28.5 32 L32 15 L35.5 32 L39 22 L42.5 32 L46 27 L49 35.5 L15 35.5 Z"
        fill={ink.fill}
        stroke={ink.stroke}
        strokeWidth={1.5}
      />
      <path d="M18 27 Q 23 14 32 12.5" fill="none" stroke="hsl(0 0% 100% / 0.6)" strokeWidth={1.1} />
      <path d="M46 27 Q 41 14 32 12.5" fill="none" stroke="hsl(0 0% 100% / 0.6)" strokeWidth={1.1} />
      <circle cx={32} cy={12.3} r={2} fill={ink.fill} stroke={ink.stroke} strokeWidth={1.1} />
      <path d="M32 9.6 L32 5.5 M30 7.4 L34 7.4" stroke={ink.stroke} strokeWidth={1.2} />
      <g fill={ink.gem}>
        {tips.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.8} />
        ))}
      </g>
      <rect x={14.5} y={35} width={35} height={7.2} rx={2.6} fill="hsl(160 30% 7% / 0.55)" stroke={ink.stroke} strokeWidth={1.4} />
      <path d="M32 36.1 L34.3 38.6 L32 41.1 L29.7 38.6 Z" fill={ink.gem} />
      <circle cx={21} cy={38.6} r={1.5} fill={ink.gem} />
      <circle cx={43} cy={38.6} r={1.5} fill={ink.gem} />
      <path d="M26.5 37.2 L28 38.6 L26.5 40 L25 38.6 Z" fill="hsl(0 0% 100% / 0.8)" />
      <path d="M37.5 37.2 L39 38.6 L37.5 40 L36 38.6 Z" fill="hsl(0 0% 100% / 0.8)" />
    </g>
  );
};

/* ---- Emblema per livello ---- */
const TierArt = ({ level, ink }: { level: number; ink: Ink }) => {
  if (level >= 6) return <CrownArt ink={ink} />;

  // Sfidante — stella a 4 punte (scintilla dello sfidante)
  if (level <= 0) {
    return (
      <g strokeLinejoin="round">
        <polygon points={hexPoints(25)} fill="none" stroke={ink.faint} strokeWidth={1.1} />
        <path
          d="M32 16 L34.6 29.4 L48 32 L34.6 34.6 L32 48 L29.4 34.6 L16 32 L29.4 29.4 Z"
          fill={ink.fill}
          stroke={ink.stroke}
          strokeWidth={1.3}
        />
        <circle cx={32} cy={32} r={1.6} fill={ink.gem} />
      </g>
    );
  }

  // Combattente — due lame incrociate
  if (level === 1) {
    return (
      <g strokeLinejoin="round">
        <polygon points={hexPoints(25)} fill="none" stroke={ink.faint} strokeWidth={1.1} />
        <g fill={ink.fill} stroke={ink.stroke} strokeWidth={1.2}>
          <path d="M32 13 C 35 22, 35 27, 32 51 C 29 27, 29 22, 32 13 Z" transform="rotate(34 32 32)" />
          <path d="M32 13 C 35 22, 35 27, 32 51 C 29 27, 29 22, 32 13 Z" transform="rotate(-34 32 32)" />
        </g>
        <circle cx={32} cy={32} r={4} fill={ink.fill} stroke={ink.stroke} strokeWidth={1.2} />
        <circle cx={32} cy={32} r={1.4} fill={ink.gem} />
      </g>
    );
  }

  // Veterano — rotore a 4 lame
  if (level === 2) {
    return (
      <g strokeLinejoin="round">
        <polygon points={hexPoints(26)} fill="none" stroke={ink.faint} strokeWidth={1.1} />
        <Rotor count={4} ink={ink} />
        <Core ink={ink} />
        <Nodes ink={ink} />
      </g>
    );
  }

  // Elite — rotore a 6 lame + ingranaggio
  if (level === 3) {
    return (
      <g strokeLinejoin="round">
        <Teeth ink={ink} />
        <polygon points={hexPoints(26)} fill="none" stroke={ink.stroke} strokeWidth={1.2} />
        <Rotor count={6} ink={ink} />
        <Core ink={ink} />
        <Nodes ink={ink} />
      </g>
    );
  }

  // Maestro — rotore a 6 lame + doppio frame + gemma
  if (level === 4) {
    return (
      <g strokeLinejoin="round">
        <Teeth ink={ink} />
        <polygon points={hexPoints(26)} fill="none" stroke={ink.stroke} strokeWidth={1.3} />
        <polygon points={hexPoints(21)} fill="none" stroke={ink.faint} strokeWidth={0.9} />
        <Rotor count={6} ink={ink} />
        <Core ink={ink} gem />
        <Nodes ink={ink} />
      </g>
    );
  }

  // Gran Maestro — sunburst a 8 lame, doppio frame ornato + gemma in cima
  return (
    <g strokeLinejoin="round">
      <Teeth ink={ink} />
      <polygon points={hexPoints(26)} fill="none" stroke={ink.stroke} strokeWidth={1.4} />
      <polygon points={hexPoints(21)} fill="none" stroke={ink.faint} strokeWidth={0.9} />
      <Rotor count={8} ink={ink} />
      <Core ink={ink} gem />
      <Nodes ink={ink} />
      <path d="M32 3.5 L33.6 5.4 L32 7.3 L30.4 5.4 Z" fill={ink.gem} />
    </g>
  );
};

export const RankMedallion = ({
  size = 56,
  level,
  colorHex,
  glowHex,
  className = "",
}: RankMedallionProps) => {
  const material = materialFor(level);
  const isLegend = material === "holo";
  const ink = inkFor(material);

  return (
    <div
      className={`rank-medallion mat-${material} ${isLegend ? "is-legend is-round" : ""} ${className}`}
      style={
        { width: size, height: size, ["--tier" as string]: colorHex, ["--tier-glow" as string]: glowHex } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <span className="rm-halo" style={{ background: `radial-gradient(circle, ${glowHex}, ${colorHex}55 42%, transparent 70%)` }} />
      <span className="rm-face" />
      <span className="rm-ring" />
      <svg className="rm-art" viewBox="0 0 64 64" fill="none">
        <TierArt level={level} ink={ink} />
      </svg>
      <span className="rm-shimmer" />
    </div>
  );
};

export default RankMedallion;
