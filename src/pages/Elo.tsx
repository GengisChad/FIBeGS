import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Sparkles,
  Crown,
  Medal,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ShieldCheck,
  Flame,
  Info,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageShell } from "@/components/layout/PageShell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import {
  useEloTiers,
  useEloRating,
  useEloLeaderboard,
  useEloRecentMatches,
  tierFor,
  divisionFor,
  fullTierLabel,
} from "@/hooks/useBetaElo";

const Elo = () => {
  const { user } = useAuth();
  const { data: tiers = [] } = useEloTiers();
  const { data: myRating } = useEloRating(user?.id);
  const { data: leaderboard = [] } = useEloLeaderboard(50);
  const { data: recent = [] } = useEloRecentMatches(user?.id, 10);

  const myTier = useMemo(
    () => (myRating ? tierFor(myRating.rating, tiers) : undefined),
    [myRating, tiers]
  );
  const myDivision = useMemo(
    () => divisionFor(myRating?.rating ?? 1000, myTier, tiers),
    [myRating, myTier, tiers]
  );

  const winrate =
    myRating && myRating.matches_played > 0
      ? Math.round((myRating.wins / myRating.matches_played) * 100)
      : 0;

  return (
    <PageShell ambient="rich">
      <Navbar />
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-3 sm:px-4 max-w-5xl">
          {/* ====== HERO ====== */}
          <header className="relative overflow-hidden glass-panel p-6 sm:p-10 mb-8">
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground border border-white/10 rounded-full px-2 py-1 mb-3 bg-white/[0.03]">
                <Sparkles size={11} /> BNC Ladder Elo · v1.0
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-bold leading-tight">
                <span className="neon-dual-text">Leghe</span> &amp; Ranking ELO
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-2xl">
                Sistema permanente, sempre attivo, parallelo alla classifica stagionale.
                Ogni match ufficiale aggiorna il tuo Elo: scala i tier da{" "}
                <span className="text-foreground font-semibold">Sfidante</span> fino a{" "}
                <span className="text-foreground font-semibold">Leggenda</span>.
              </p>

              {myRating && myTier && (
                <PlayerHeroCard
                  rating={myRating.rating}
                  peak={myRating.peak_rating}
                  matches={myRating.matches_played}
                  wins={myRating.wins}
                  losses={myRating.losses}
                  winrate={winrate}
                  tier={myTier}
                  division={myDivision}
                />
              )}

              {!myRating && (
                <div className="mt-6 glass-tile px-4 py-3 inline-flex items-center gap-2 text-sm">
                  <Info size={14} className="text-primary" />
                  Gioca il tuo primo torneo Ranked per entrare nella Ladder Elo.
                </div>
              )}
            </div>
          </header>

          {/* ====== RECENT FORM ====== */}
          {recent.length > 0 && (
            <section className="mb-8 glass-card p-4 sm:p-5">
              <h2 className="font-display text-lg flex items-center gap-2 mb-3">
                <Flame size={18} className="text-primary" /> Ultima forma
              </h2>
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
            </section>
          )}

          {/* ====== SCALA DEI RANGHI (timeline verticale) ====== */}
          <section className="mb-10">
            <div className="flex items-end justify-between mb-4">
              <h2 className="font-display text-xl flex items-center gap-2">
                <Medal size={18} className="text-primary" /> Scala dei Ranghi
              </h2>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                7 Tier · 19 Divisioni
              </span>
            </div>

            <div className="relative">
              <ol className="space-y-3">
                {[...tiers].reverse().map((t) => (
                  <TierRow
                    key={t.key}
                    tier={t}
                    current={myRating?.rating ?? 0}
                    isMineTier={myTier?.key === t.key}
                    myDivisionIndex={myTier?.key === t.key ? myDivision.index : null}
                  />
                ))}
              </ol>
            </div>
          </section>

          {/* ====== LEADERBOARD ====== */}
          <section className="mb-10">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <Crown size={18} className="text-primary" /> Top 50 — Master Ladder
            </h2>
            <div className="glass-card overflow-hidden">
              {leaderboard.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  Nessun dato disponibile.
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {leaderboard.map((row: any, i: number) => {
                    const t = tierFor(row.rating, tiers);
                    const div = divisionFor(row.rating, t, tiers);
                    const isMe = row.user_id === user?.id;
                    const username = row.profile?.username;
                    const rankIcon =
                      i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                    return (
                      <li
                        key={row.user_id}
                        className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 transition-colors ${
                          isMe ? "bg-primary/10" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <span className="w-7 text-center text-xs font-bold text-muted-foreground tabular-nums">
                          {rankIcon || i + 1}
                        </span>
                        <Avatar className="h-8 w-8 shrink-0">
                          {row.profile?.avatar_url && (
                            <AvatarImage src={row.profile.avatar_url} />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {(row.profile?.display_name || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          {username ? (
                            <Link
                              to={`/profilo/${username}`}
                              className="text-sm font-semibold hover:text-primary transition-colors truncate block"
                            >
                              {row.profile?.display_name || username}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold truncate block">
                              {row.profile?.display_name || "Giocatore"}
                            </span>
                          )}
                          {t && (
                            <span
                              className="text-[10px] uppercase tracking-wider font-bold"
                              style={{ color: t.color_hex }}
                            >
                              {fullTierLabel(t, div)}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-base font-display font-bold tabular-nums">
                            {row.rating}
                          </div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            {row.wins}V · {row.losses}S
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* ====== COME FUNZIONA ====== */}
          <section className="mb-4">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" /> Come funziona
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoTile
                title="Permanente"
                body="L'Elo non si resetta mai. Smetti per mesi, il tuo grado è ancora lì."
              />
              <InfoTile
                title="Provvisorio"
                body="Parti da 1000 (Sfidante II). I primi 10 match usano K=40 per stabilire la tua fascia reale."
              />
              <InfoTile
                title="K-factor adattivo"
                body="Sotto Elite K=24, Elite K=16, Apex K=12. I tier alti sono più stabili."
              />
              <InfoTile
                title="Scudo retrocessione"
                body="Retrocedi di tier solo se scendi 25 punti sotto la soglia. I cambi di divisione invece sono immediati."
              />
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </PageShell>
  );
};

/* ================================================================== */
/*  HERO CARD GIOCATORE                                               */
/* ================================================================== */

interface PlayerHeroCardProps {
  rating: number;
  peak: number;
  matches: number;
  wins: number;
  losses: number;
  winrate: number;
  tier: NonNullable<ReturnType<typeof tierFor>>;
  division: ReturnType<typeof divisionFor>;
}

const PlayerHeroCard = ({
  rating,
  peak,
  matches,
  wins,
  losses,
  winrate,
  tier,
  division,
}: PlayerHeroCardProps) => {
  const label = fullTierLabel(tier, division);
  return (
    <div className="mt-6 glass-card p-4 sm:p-5 relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-30 blur-3xl"
        style={{ background: tier.glow_hex }}
        aria-hidden
      />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Crest */}
        <div
          className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 shrink-0 mx-auto sm:mx-0"
          style={{
            borderColor: tier.color_hex,
            background: `linear-gradient(135deg, ${tier.color_hex}33, transparent 70%)`,
            boxShadow: `0 0 30px -8px ${tier.glow_hex}`,
          }}
        >
          {tier.key === "leggenda" ? (
            <Crown size={26} style={{ color: tier.color_hex }} />
          ) : (
            <Trophy size={24} style={{ color: tier.color_hex }} />
          )}
          {division.label && (
            <span
              className="font-display text-xl leading-none mt-1 font-bold"
              style={{ color: tier.color_hex }}
            >
              {division.label}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div
            className="text-[10px] uppercase tracking-[0.25em] font-bold"
            style={{ color: tier.color_hex }}
          >
            {label}
          </div>
          <div className="flex items-baseline justify-center sm:justify-start gap-2 mt-0.5">
            <span className="text-4xl font-display font-bold tabular-nums">{rating}</span>
            <span className="text-xs text-muted-foreground">ELO</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Picco{" "}
            <span className="text-foreground font-semibold tabular-nums">{peak}</span>
            {" · "}
            {matches} match · {wins}V/{losses}S · {winrate}% WR
          </div>

          {/* Progress: divisione */}
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>
                {division.label
                  ? `Divisione ${division.label}`
                  : "Progresso tier"}
              </span>
              <span className="tabular-nums">
                {division.divisionMin} →{" "}
                {division.divisionMax === Infinity ? "∞" : division.divisionMax}
              </span>
            </div>
            <ProgressBar
              value={division.divisionProgress}
              color={tier.color_hex}
              glow={tier.glow_hex}
            />
            {division.nextLabel && (
              <div className="text-[10px] text-muted-foreground mt-1.5 text-right">
                +{division.pointsToNext} →{" "}
                <span className="font-semibold text-foreground">
                  {division.nextLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  TIER ROW (timeline verticale)                                     */
/* ================================================================== */

interface TierRowProps {
  tier: NonNullable<ReturnType<typeof tierFor>>;
  current: number;
  isMineTier: boolean;
  myDivisionIndex: number | null;
}

const DIVISION_LABELS = ["IV", "III", "II", "I"] as const;
const DIVISIONED = new Set(["sfidante", "combattente", "veterano", "elite"]);

const TierRow = ({ tier, current, isMineTier, myDivisionIndex }: TierRowProps) => {
  const hasDivisions = DIVISIONED.has(tier.key);
  const tierProgress =
    tier.max_rating != null
      ? Math.min(
          100,
          Math.max(
            0,
            ((current - tier.min_rating) /
              (tier.max_rating - tier.min_rating + 1)) *
              100,
          ),
        )
      : current >= tier.min_rating
        ? 100
        : 0;
  const reached = current >= tier.min_rating;

  return (
    <li className="relative">
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 transition-all glass-tile ${
          isMineTier ? "border-transparent" : "border-white/10"
        }`}
        style={
          isMineTier
            ? {
                background: `linear-gradient(135deg, ${tier.color_hex}1f, hsl(0 0% 100% / 0.04) 60%)`,
                boxShadow: `0 0 0 1px ${tier.color_hex}80, 0 0 40px -10px ${tier.glow_hex}`,
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Crest inside card to avoid clipping */}
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border-2 shrink-0"
            style={{
              borderColor: reached ? tier.color_hex : "hsl(0 0% 100% / 0.12)",
              background: reached
                ? `linear-gradient(135deg, ${tier.color_hex}30, transparent 70%)`
                : "hsl(0 0% 100% / 0.03)",
              boxShadow: isMineTier ? `0 0 24px -4px ${tier.glow_hex}` : undefined,
            }}
          >
            {tier.key === "leggenda" ? (
              <Crown size={18} style={{ color: reached ? tier.color_hex : "hsl(0 0% 100% / 0.3)" }} />
            ) : (
              <Trophy size={16} style={{ color: reached ? tier.color_hex : "hsl(0 0% 100% / 0.3)" }} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="font-display font-bold text-base sm:text-lg leading-tight"
              style={{ color: reached ? tier.color_hex : undefined }}
            >
              {tier.name}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {tier.min_rating}
              {tier.max_rating != null ? ` – ${tier.max_rating}` : "+"} ELO
            </div>
          </div>
          {isMineTier && (
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-current shrink-0"
              style={{ color: tier.color_hex }}
            >
              Tu
            </span>
          )}
        </div>


        {hasDivisions && (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {DIVISION_LABELS.map((lbl, i) => {
              const isCurrent = isMineTier && myDivisionIndex === i;
              const isPast = reached && (!isMineTier || (myDivisionIndex != null && i < myDivisionIndex));
              return (
                <div
                  key={lbl}
                  className="rounded-md py-1.5 text-center text-[11px] font-bold tabular-nums border transition-colors"
                  style={{
                    color: isCurrent ? "#0a0a0a" : isPast ? tier.color_hex : "hsl(0 0% 100% / 0.4)",
                    background: isCurrent
                      ? tier.color_hex
                      : isPast
                        ? `${tier.color_hex}18`
                        : "hsl(0 0% 100% / 0.03)",
                    borderColor: isCurrent
                      ? tier.color_hex
                      : isPast
                        ? `${tier.color_hex}55`
                        : "hsl(0 0% 100% / 0.08)",
                  }}
                >
                  {lbl}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3">
          <ProgressBar
            value={tierProgress}
            color={tier.color_hex}
            glow={tier.glow_hex}
            dimmed={!reached}
          />
        </div>
      </div>
    </li>
  );
};

/* ================================================================== */
/*  PROGRESS BAR                                                       */
/* ================================================================== */

const ProgressBar = ({
  value,
  color,
  glow,
  dimmed,
}: {
  value: number;
  color: string;
  glow: string;
  dimmed?: boolean;
}) => (
  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden relative">
    <div
      className="h-full rounded-full transition-all duration-500"
      style={{
        width: `${value}%`,
        background: `linear-gradient(90deg, ${color}, ${glow})`,
        boxShadow: dimmed ? "none" : `0 0 12px -2px ${glow}`,
        opacity: dimmed ? 0.4 : 1,
      }}
    />
  </div>
);

/* ================================================================== */
/*  INFO TILE                                                          */
/* ================================================================== */

const InfoTile = ({ title, body }: { title: string; body: string }) => (
  <div className="glass-tile p-4">
    <div className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">
      {title}
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
  </div>
);

export default Elo;
