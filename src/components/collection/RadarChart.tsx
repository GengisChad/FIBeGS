import { useMemo } from "react";

interface RadarChartProps {
  stats: { name: string; value: number }[];
  size?: number;
}

const RadarChart = ({ stats, size = 100 }: RadarChartProps) => {
  const n = stats.length;
  const cx = size / 2;
  const cy = size / 2;
  const padding = 38;
  const radius = size / 2 - padding;

  const points = useMemo(() => {
    return stats.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
  }, [stats, n, cx, cy, radius]);

  const dataPoints = useMemo(() => {
    return stats.map((s, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (s.value / 100) * radius;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }, [stats, n, cx, cy, radius]);

  const gridLevels = [0.25, 0.5, 0.75, 1];

  if (n < 3) return null;

  const neonWhite = "#EEFFEE";
  const neonFill = "rgba(255, 255, 255, 0.2)";
  const neonGlow = "rgba(255, 255, 255, 0.5)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: `drop-shadow(0 0 8px ${neonGlow})` }}>
      {/* Grid */}
      {gridLevels.map((level) => {
        const gridPoints = Array.from({ length: n }, (_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          return `${cx + radius * level * Math.cos(angle)},${cy + radius * level * Math.sin(angle)}`;
        }).join(" ");
        return (
          <polygon
            key={level}
            points={gridPoints}
            fill="none"
            stroke={neonWhite}
            strokeWidth={0.5}
            opacity={0.3}
          />
        );
      })}

      {/* Axes */}
      {points.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={neonWhite} strokeWidth={0.5} opacity={0.2} />
      ))}

      {/* Data polygon */}
      <polygon
        points={dataPoints.map(p => `${p.x},${p.y}`).join(" ")}
        fill={neonFill}
        stroke={neonWhite}
        strokeWidth={2}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={neonWhite} />
      ))}

      {/* Labels */}
      {stats.map((s, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const labelR = radius + 14;
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        const anchor = Math.abs(Math.cos(angle)) < 0.1 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
        const parts = s.name.split(" ");
        return (
          <text
            key={i}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="central"
            fill="white"
            fontSize={8}
            fontWeight="bold"
          >
            {parts.length > 1 ? parts.map((p, j) => (
              <tspan key={j} x={lx} dy={j === 0 ? `-${(parts.length - 1) * 4.5}` : "9"}>
                {p.toUpperCase()}
              </tspan>
            )) : s.name.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
};

export default RadarChart;
