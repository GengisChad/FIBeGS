// SVG visual diagrams used in CreateTournamentDialog to explain each structural choice.
// All colors use design-system tokens via currentColor / Tailwind classes.

import { ReactNode } from "react";

const Box = ({ x, y, w = 28, h = 8, fill = "fill-muted", stroke = "stroke-border" }: any) => (
  <rect x={x} y={y} width={w} height={h} rx={1.5} className={`${fill} ${stroke}`} strokeWidth={0.6} />
);
const Line = ({ d }: { d: string }) => <path d={d} className="stroke-border" strokeWidth={0.6} fill="none" />;

// ─── FORMAT diagrams ───────────────────────────────────────────────
export const FormatDiagram = ({ format }: { format: string }) => {
  const common = "w-full h-20";
  switch (format) {
    case "swiss_top_cut":
      return (
        <svg viewBox="0 0 120 50" className={common}>
          {[0, 1, 2].map(i => <Box key={i} x={4 + i * 18} y={6} w={14} fill="fill-primary/15" stroke="stroke-primary/40" />)}
          <text x={31} y={26} className="fill-muted-foreground" fontSize="5" textAnchor="middle">Swiss</text>
          <Line d="M58 12 L66 12" />
          {[0, 1].map(i => <Box key={i} x={68} y={4 + i * 12} w={14} fill="fill-accent/20" stroke="stroke-accent/40" />)}
          <Line d="M82 8 L92 14" /><Line d="M82 20 L92 14" />
          <Box x={92} y={10} w={14} h={8} fill="fill-primary/30" stroke="stroke-primary/60" />
          <text x={99} y={32} className="fill-muted-foreground" fontSize="5" textAnchor="middle">Top Cut</text>
        </svg>
      );
    case "swiss":
      return (
        <svg viewBox="0 0 120 50" className={common}>
          {[0, 1, 2, 3, 4].map(i => <Box key={i} x={6 + i * 22} y={20} w={18} fill="fill-primary/15" stroke="stroke-primary/40" />)}
          {[0, 1, 2, 3].map(i => <Line key={i} d={`M${24 + i * 22} 24 L${28 + i * 22} 24`} />)}
          <text x={60} y={42} className="fill-muted-foreground" fontSize="5" textAnchor="middle">N turni Swiss · classifica finale</text>
        </svg>
      );
    case "round_robin":
      return (
        <svg viewBox="0 0 120 50" className={common}>
          {Array.from({ length: 5 }).map((_, i) => {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const x = 60 + Math.cos(angle) * 16, y = 22 + Math.sin(angle) * 16;
            return <circle key={i} cx={x} cy={y} r={4} className="fill-primary/20 stroke-primary/50" strokeWidth={0.6} />;
          })}
          {Array.from({ length: 5 }).map((_, i) =>
            Array.from({ length: 5 }).map((_, j) => {
              if (j <= i) return null;
              const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
              const a2 = (j / 5) * Math.PI * 2 - Math.PI / 2;
              return <line key={`${i}-${j}`} x1={60 + Math.cos(a1) * 16} y1={22 + Math.sin(a1) * 16}
                x2={60 + Math.cos(a2) * 16} y2={22 + Math.sin(a2) * 16}
                className="stroke-border" strokeWidth={0.4} />;
            })
          )}
          <text x={60} y={46} className="fill-muted-foreground" fontSize="5" textAnchor="middle">Tutti contro tutti</text>
        </svg>
      );
    case "round_robin_top_cut":
      return (
        <svg viewBox="0 0 120 50" className={common}>
          {Array.from({ length: 4 }).map((_, i) => {
            const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
            const x = 25 + Math.cos(angle) * 12, y = 22 + Math.sin(angle) * 12;
            return <circle key={i} cx={x} cy={y} r={3.5} className="fill-primary/20 stroke-primary/50" strokeWidth={0.6} />;
          })}
          <Line d="M42 22 L56 22" />
          {[0, 1].map(i => <Box key={i} x={58} y={6 + i * 16} w={14} fill="fill-accent/20" stroke="stroke-accent/40" />)}
          <Line d="M72 10 L86 22" /><Line d="M72 26 L86 22" />
          <Box x={86} y={18} w={14} fill="fill-primary/30" stroke="stroke-primary/60" />
          <text x={60} y={46} className="fill-muted-foreground" fontSize="5" textAnchor="middle">Round Robin → Top Cut</text>
        </svg>
      );
    case "single_elimination":
      return (
        <svg viewBox="0 0 120 50" className={common}>
          {[0, 1, 2, 3].map(i => <Box key={i} x={6} y={4 + i * 10} w={20} fill="fill-primary/15" stroke="stroke-primary/40" />)}
          {[0, 1].map(i => <Box key={i} x={36} y={9 + i * 20} w={20} fill="fill-accent/20" stroke="stroke-accent/40" />)}
          <Box x={66} y={19} w={20} fill="fill-primary/30" stroke="stroke-primary/60" />
          <Box x={96} y={19} w={20} fill="fill-primary/50" stroke="stroke-primary" />
          <Line d="M26 8 L36 13" /><Line d="M26 18 L36 13" /><Line d="M26 28 L36 33" /><Line d="M26 38 L36 33" />
          <Line d="M56 13 L66 23" /><Line d="M56 33 L66 23" /><Line d="M86 23 L96 23" />
          <text x={60} y={46} className="fill-muted-foreground" fontSize="5" textAnchor="middle">Eliminazione diretta</text>
        </svg>
      );
  }
  return null;
};

// ─── TOP CUT bracket diagram (4/8/16/32) ───────────────────────────
// Shows only the actual matches that will be played, e.g. Top 8 = QF + SF + F.
export const TopCutDiagram = ({ size }: { size: number }) => {
  const rounds = Math.log2(size); // 4→2 (SF, F), 8→3 (QF, SF, F), 16→4, 32→5
  const roundLabels = ["1/32", "1/16", "Ottavi", "Quarti", "Semi", "Finale"];
  // Pick the last `rounds` labels so the rightmost is always "Finale".
  const labels = roundLabels.slice(-rounds);
  const W = 120, H = 64;
  const colW = (W - 4) / rounds;
  const matchH = 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
      {Array.from({ length: rounds }).map((_, r) => {
        const matchesInRound = size / Math.pow(2, r + 1); // r=0 → size/2 matches
        const slot = (H - 12) / matchesInRound;
        const x = 2 + r * colW;
        const boxW = colW - 6;
        const isFinal = r === rounds - 1;
        return (
          <g key={r}>
            <text x={x + boxW / 2} y={4} fontSize="3.5" textAnchor="middle" className="fill-muted-foreground">
              {labels[r]}
            </text>
            {Array.from({ length: matchesInRound }).map((_, i) => {
              const y = 8 + slot * i + slot / 2 - matchH / 2;
              return (
                <g key={i}>
                  <Box x={x} y={y} w={boxW} h={matchH}
                    fill={isFinal ? "fill-primary/50" : "fill-primary/20"}
                    stroke={isFinal ? "stroke-primary" : "stroke-primary/40"} />
                  {!isFinal && i % 2 === 0 && (() => {
                    const y2 = 8 + slot * (i + 1) + slot / 2 - matchH / 2;
                    const midY = (y + y2) / 2 + matchH / 2;
                    const xR = x + boxW;
                    const xNext = 2 + (r + 1) * colW;
                    return (
                      <g>
                        <Line d={`M${xR} ${y + matchH / 2} L${xR + 2} ${y + matchH / 2} L${xR + 2} ${midY} L${xR + 2} ${y2 + matchH / 2} L${xR} ${y2 + matchH / 2}`} />
                        <Line d={`M${xR + 2} ${midY} L${xNext} ${midY}`} />
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        );
      })}
      <text x={W / 2} y={H - 1} fontSize="5" textAnchor="middle" className="fill-muted-foreground">
        Top {size} · {size / 2} match al 1° turno
      </text>
    </svg>
  );
};

// ─── TIEBREAKER depth visualization ────────────────────────────────
// Renders the actual placement matches: rapid = single match per coppia,
// advanced = mini bracket completo che ordina tutta la fascia.
export const TiebreakerDiagram = ({ depth, mode }: { depth: number; mode: "rapid" | "advanced" }) => {
  if (depth === 0) {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-14">
        <text x={60} y={18} fontSize="7" textAnchor="middle" className="fill-muted-foreground">— Nessuno spareggio —</text>
        <text x={60} y={28} fontSize="5" textAnchor="middle" className="fill-muted-foreground">Solo posizioni della Top Cut</text>
      </svg>
    );
  }

  // Bands of losers per round (Top Cut depth → fasce di pareggio):
  // depth 4 → 3°/4° place (semifinalisti perdenti, 2 player)
  // depth 8 → 5°-8° (quartifinalisti perdenti, 4 player)
  // depth 16 → 9°-16° (ottavi perdenti, 8 player) ecc.
  // Mostriamo le 2 fasce più rilevanti per altezza limitata.
  // Bands ordinati dalle posizioni più basse (sinistra) alla finale 3°/4° (destra),
  // così l'ordine di lettura rispecchia la progressione verso il podio.
  const bands: { label: string; size: number }[] = (() => {
    if (depth === 4) return [{ label: "3°/4°", size: 2 }];
    if (depth === 8) return [
      { label: "5°-8°", size: 4 },
      { label: "3°/4°", size: 2 },
    ];
    if (depth === 16) return [
      { label: "9°-16°", size: 8 },
      { label: "5°-8°", size: 4 },
    ];
    return [
      { label: "17°-32°", size: 16 },
      { label: "9°-16°", size: 8 },
    ];
  })();

  const W = 120, H = 64;
  const bandW = (W - 4) / bands.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
      {bands.map((band, bi) => {
        const bx = 2 + bi * bandW;
        const inner = bandW - 6;

        if (mode === "rapid") {
          // Un solo match per coppia: size/2 match in colonna.
          const pairs = band.size / 2;
          const matchH = 6;
          const gap = (H - 18) / pairs;
          return (
            <g key={bi}>
              <text x={bx + inner / 2} y={6} fontSize="4" textAnchor="middle" className="fill-accent font-medium">{band.label}</text>
              {Array.from({ length: pairs }).map((_, i) => {
                const y = 10 + gap * i + (gap - matchH) / 2;
                return (
                  <g key={i}>
                    <Box x={bx} y={y} w={inner} h={matchH} fill="fill-accent/25" stroke="stroke-accent/60" />
                    <text x={bx + inner / 2} y={y + 4.2} fontSize="3.3" textAnchor="middle" className="fill-foreground">VS</text>
                  </g>
                );
              })}
              <text x={bx + inner / 2} y={H - 2} fontSize="3.5" textAnchor="middle" className="fill-muted-foreground">
                {pairs} match secchi
              </text>
            </g>
          );
        }

        // ADVANCED: mini-bracket completo per la fascia (size player → log2(size) turni)
        const rounds = Math.max(1, Math.log2(band.size));
        const colW = inner / rounds;
        const matchH = 4;
        return (
          <g key={bi}>
            <text x={bx + inner / 2} y={6} fontSize="4" textAnchor="middle" className="fill-accent font-medium">{band.label}</text>
            {Array.from({ length: rounds }).map((_, r) => {
              const matchesInRound = band.size / Math.pow(2, r + 1);
              const slot = (H - 18) / matchesInRound;
              const x = bx + r * colW;
              const boxW = colW - 2;
              const isFinal = r === rounds - 1;
              return (
                <g key={r}>
                  {Array.from({ length: matchesInRound }).map((_, i) => {
                    const y = 10 + slot * i + slot / 2 - matchH / 2;
                    return (
                      <g key={i}>
                        <Box x={x} y={y} w={boxW} h={matchH}
                          fill={isFinal ? "fill-accent/50" : "fill-accent/20"}
                          stroke={isFinal ? "stroke-accent" : "stroke-accent/50"} />
                        {!isFinal && i % 2 === 0 && (() => {
                          const y2 = 10 + slot * (i + 1) + slot / 2 - matchH / 2;
                          const midY = (y + y2) / 2 + matchH / 2;
                          const xR = x + boxW;
                          return (
                            <g>
                              <Line d={`M${xR} ${y + matchH / 2} L${xR + 1} ${y + matchH / 2} L${xR + 1} ${y2 + matchH / 2} L${xR} ${y2 + matchH / 2}`} />
                              <Line d={`M${xR + 1} ${midY} L${x + colW} ${midY}`} />
                            </g>
                          );
                        })()}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <text x={bx + inner / 2} y={H - 2} fontSize="3.5" textAnchor="middle" className="fill-muted-foreground">
              bracket {band.size}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── GROUPS diagram ────────────────────────────────────────────────
export const GroupsDiagram = ({ count }: { count: number }) => {
  if (count === 0) {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-14">
        <rect x={8} y={8} width={104} height={24} rx={3} className="fill-primary/15 stroke-primary/40" strokeWidth={0.6} />
        {Array.from({ length: 8 }).map((_, i) => (
          <circle key={i} cx={16 + i * 12} cy={20} r={2.5} className="fill-primary/50" />
        ))}
        <text x={60} y={38} fontSize="5" textAnchor="middle" className="fill-muted-foreground">Pool unica · tutti insieme</text>
      </svg>
    );
  }
  const W = 120;
  const groupW = (W - 8) / count - 2;
  return (
    <svg viewBox={`0 0 ${W} 44`} className="w-full h-14">
      {Array.from({ length: count }).map((_, g) => {
        const x = 4 + g * (groupW + 2);
        return (
          <g key={g}>
            <rect x={x} y={6} width={groupW} height={26} rx={2}
              className="fill-accent/15 stroke-accent/50" strokeWidth={0.6} />
            <text x={x + groupW / 2} y={14} fontSize="4.5" textAnchor="middle" className="fill-accent font-medium">
              G{g + 1}
            </text>
            {Array.from({ length: 3 }).map((_, i) => (
              <circle key={i} cx={x + groupW / 2 - 6 + i * 6} cy={24} r={1.8} className="fill-accent/70" />
            ))}
          </g>
        );
      })}
      <text x={W / 2} y={40} fontSize="5" textAnchor="middle" className="fill-muted-foreground">
        {count} gironi Swiss separati
      </text>
    </svg>
  );
};

// ─── SWISS rounds diagram ──────────────────────────────────────────
export const SwissDiagram = ({ rounds }: { rounds: number }) => {
  const W = 120;
  const gap = (W - 8) / rounds;
  return (
    <svg viewBox={`0 0 ${W} 36`} className="w-full h-12">
      {Array.from({ length: rounds }).map((_, i) => (
        <g key={i}>
          <Box x={4 + i * gap} y={8} w={gap - 4} h={10} fill="fill-primary/20" stroke="stroke-primary/50" />
          <text x={4 + i * gap + (gap - 4) / 2} y={15} fontSize="5" textAnchor="middle" className="fill-foreground">R{i + 1}</text>
        </g>
      ))}
      <text x={W / 2} y={30} fontSize="5" textAnchor="middle" className="fill-muted-foreground">{rounds} turni · pairing per punteggio</text>
    </svg>
  );
};

// ─── Generic example card wrapper ─────────────────────────────────
export const ExampleCard = ({ active, onClick, disabled, title, subtitle, diagram, badge }: {
  active: boolean; onClick: () => void; disabled?: boolean;
  title: string; subtitle?: string; diagram: ReactNode; badge?: string;
}) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className={`relative text-left p-3 rounded-xl border-2 transition-all ${
      disabled ? "opacity-40 cursor-not-allowed border-border" :
      active ? "border-primary bg-primary/5 ring-2 ring-primary/20" :
      "border-border hover:border-primary/40 bg-card/40"
    }`}>
    {badge && (
      <span className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">
        {badge}
      </span>
    )}
    <div className="rounded-lg bg-background/40 border border-border/40 p-1.5 mb-2 overflow-hidden">
      {diagram}
    </div>
    <div className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>{title}</div>
    {subtitle && <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{subtitle}</div>}
  </button>
);
