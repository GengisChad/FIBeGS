import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  useEloRating,
  useEloTiers,
  useEloRecentMatches,
  tierFor,
  divisionFor,
  fullTierLabel,
} from "@/hooks/useBetaElo";
import { RankIcon } from "@/components/elo/RankIcon";

interface Props {
  userId: string;
}

const BetaEloPanel = ({ userId }: Props) => {
  const { data: rating, isLoading } = useEloRating(userId);
  const { data: tiers = [] } = useEloTiers();
  const { data: recent = [] } = useEloRecentMatches(userId, 5);

  if (isLoading) {
    return (
      <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6 animate-pulse h-40" />
    );
  }

  const current = rating?.rating ?? 1000;
  const tier = tierFor(current, tiers);
  const division = divisionFor(current, tier, tiers);

  const winrate =
    rating && rating.matches_played > 0
      ? Math.round((rating.wins / rating.matches_played) * 100)
      : 0;

  return (
    <div className="relative overflow-hidden glass-card p-4 sm:p-6 mb-4 sm:mb-6">
      {tier && (
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-30 blur-3xl"
          style={{ background: tier.glow_hex }}
          aria-hidden
        />
      )}

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg flex items-center gap-2">
            <Sparkles size={18} className="text-primary" /> Ladder ELO
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-white/10 rounded-full px-1.5 py-0.5">
              Beta
            </span>
          </h2>
          <Link
            to="/elo"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Leghe <ChevronRight size={14} />
          </Link>
        </div>

        <div className="flex items-center gap-4 mb-5">
          {tier && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <RankIcon rank={tier.name} current size={92} tint={tier.color_hex} />
              {division.label && (
                <span
                  className="font-display text-sm leading-none font-bold uppercase tracking-wider"
                  style={{ color: tier.color_hex }}
                >
                  Div {division.label}
                </span>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold tabular-nums">
                {current}
              </span>
              <span className="text-xs text-muted-foreground">ELO</span>
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.2em] font-bold"
              style={{ color: tier?.color_hex }}
            >
              {tier ? fullTierLabel(tier, division) : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Picco{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {rating?.peak_rating ?? current}
              </span>
              {" · "}
              {rating?.matches_played ?? 0} match
            </div>
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${division.divisionProgress}%`,
                    background: tier
                      ? `linear-gradient(90deg, ${tier.color_hex}, ${tier.glow_hex})`
                      : undefined,
                    boxShadow: tier
                      ? `0 0 10px -2px ${tier.glow_hex}`
                      : undefined,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>
                  {division.label
                    ? `Divisione ${division.label}`
                    : tier?.name ?? "—"}
                </span>
                <span>
                  {division.nextLabel
                    ? `+${division.pointsToNext} → ${division.nextLabel}`
                    : "Tier massimo"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="Vittorie" value={rating?.wins ?? 0} accent="text-emerald-300" />
          <Stat label="Sconfitte" value={rating?.losses ?? 0} accent="text-rose-300" />
          <Stat label="Winrate" value={`${winrate}%`} accent="text-primary" />
        </div>

        {recent.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Ultimi match
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((m) => {
                const Icon =
                  m.delta > 0 ? TrendingUp : m.delta < 0 ? TrendingDown : Minus;
                const tone =
                  m.delta > 0
                    ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
                    : m.delta < 0
                      ? "text-rose-300 border-rose-400/40 bg-rose-500/10"
                      : "text-muted-foreground border-white/10 bg-white/[0.04]";
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border ${tone}`}
                  >
                    <Icon size={10} />
                    <span className="tabular-nums">
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) => (
  <div className="glass-tile p-2.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20">
    <div className={`text-xl font-display font-bold tabular-nums ${accent}`}>
      {value}
    </div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
  </div>
);

export default BetaEloPanel;
