import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Crown,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ShieldCheck,
  Shield,
  Flame,
  Info,
  Swords,
  Target,
  Star,
  Gem,
  Users,
  type LucideIcon,
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
import { RankMedallion } from "@/components/elo/RankMedallion";

/* ================================================================== */
/*  EMBLEMI TIER — mappa dichiarativa per posizione (prestigio cresc.) */
/*  L'array `tiers` arriva ordinato per sort_order asc dal backend:    */
/*  index 0 = tier più basso → index N = apice. Una icona distinta per */
/*  ogni gradino, così nessun tier condivide l'emblema. I dati (chiavi,*/
/*  soglie, colori) NON vengono toccati: questa è solo presentazione.  */
/* ================================================================== */
const TIER_ICON_RAMP: LucideIcon[] = [
  Swords, // Sfidante  — duello
  Flame, //  Combattente — grinta
  Target, // Veterano  — precisione
  Shield, // Elite     — scudo
  Star, //   Maestro   — stella
  Gem, //    Gran Maestro — gemma
  Crown, //  Leggenda  — corona
];
const tierIconForIndex = (index: number): LucideIcon =>
  TIER_ICON_RAMP[Math.min(Math.max(index, 0), TIER_ICON_RAMP.length - 1)];

const Elo = () => {
  const { user } = useAuth();
  const { data: tiers = [] } = useEloTiers();
  const { data: myRating } = useEloRating(user?.id);
  const { data: leaderboard = [] } = useEloLeaderboard(50);
  const { data: recent = [] } = useEloRecentMatches(user?.id, 10);

  // Popolazione reale per tier dalla Top 50 già caricata (nessuna query nuova).
  const populationByTier = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of leaderboard as any[]) {
      const t = tierFor(row.rating, tiers);
      if (t) m.set(t.key, (m.get(t.key) ?? 0) + 1);
    }
    return m;
  }, [leaderboard, tiers]);

  const myTier = useMemo(
    () => (myRating ? tierFor(myRating.rating, tiers) : undefined),
    [myRating, tiers]
  );
  const myDivision = useMemo(
    () => divisionFor(myRating?.rating ?? 1000, myTier, tiers),
    [myRating, myTier, tiers]
  );
  const myTierIndex = useMemo(
    () => (myTier ? tiers.findIndex((t) => t.key === myTier.key) : -1),
    [tiers, myTier],
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
                  icon={tierIconForIndex(myTierIndex)}
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
              <ol className="space-y-3 fib-stagger">
                {[...tiers].reverse().map((t, revIdx) => {
                  const ascIndex = tiers.length - 1 - revIdx;
                  return (
                    <TierRow
                      key={t.key}
                      tier={t}
                      index={ascIndex}
                      total={tiers.length}
                      population={populationByTier.get(t.key) ?? 0}
                      current={myRating?.rating ?? 0}
                      isMineTier={myTier?.key === t.key}
                      myDivisionIndex={myTier?.key === t.key ? myDivision.index : null}
                    />
                  );
                })}
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
                      i === 0 ? <Crown size={14} className="text-yellow-400 inline-block" aria-label="1° posto" />
                      : i === 1 ? <Medal size={13} className="text-gray-300 inline-block" aria-label="2° posto" />
                      : i === 2 ? <Award size={13} className="text-amber-600 inline-block" aria-label="3° posto" />
                      : null;
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
  icon: LucideIcon;
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
  icon: TierIcon,
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
          <TierIcon size={26} style={{ color: tier.color_hex }} />
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
  /** Posizione 0-based per sort_order asc (0 = tier più basso). */
  index: number;
  /** Numero totale di tier. */
  total: number;
  /** Giocatori a questo tier nella Top 50 (dato reale già caricato). */
  population: number;
  current: number;
  isMineTier: boolean;
  myDivisionIndex: number | null;
}

const DIVISION_LABELS = ["IV", "III", "II", "I"] as const;
const DIVISIONED = new Set(["sfidante", "combattente", "veterano", "elite"]);

const TierRow = ({
  tier,
  index,
  total,
  population,
  current,
  isMineTier,
  myDivisionIndex,
}: TierRowProps) => {
  const hasDivisions = DIVISIONED.has(tier.key);
  const reached = current >= tier.min_rating;
  const rankFromTop = total - 1 - index; // 0 = apice (Leggenda)
  const isLegend = rankFromTop === 0;
  const isApex = rankFromTop <= 3; // Elite, Maestro, Gran Maestro, Leggenda

  // Dimensione medaglione: cresce verso l'apice.
  const medSize = rankFromTop === 0 ? 64 : rankFromTop === 1 ? 58 : rankFromTop === 2 ? 56 : rankFromTop === 3 ? 52 : 48;

  // Accento verticale sul bordo sinistro (gradient per la Leggenda).
  const accentStyle: CSSProperties = isLegend
    ? { background: "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--accent)))" }
    : { background: tier.color_hex, opacity: reached || isApex ? 1 : 0.5 };

  return (
    <li className="relative">
      <div
        className={`fib-tier-card relative overflow-hidden rounded-2xl border pl-5 pr-4 py-4 transition-all glass-tile ${
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
        {/* Accento verticale colore-tier */}
        <span
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-1.5"
          style={accentStyle}
          aria-hidden
        />

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Emblema tier — Rank Medallion, materiale che scala col tier */}
          <RankMedallion size={medSize} level={index} colorHex={tier.color_hex} glowHex={tier.glow_hex} />

          <div className="min-w-0 flex-1">
            <div
              className={`font-display font-bold text-base sm:text-lg leading-tight ${isLegend ? "rank-name-legend" : ""}`}
              style={isLegend ? undefined : { color: reached || isApex ? tier.color_hex : undefined }}
            >
              {tier.name}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {hasDivisions ? "4 divisioni · IV–I" : isLegend ? "Apice assoluto" : "Tier apice"}
            </div>
          </div>

          {/* Spazio destro riempito con dato reale */}
          <div className="text-right shrink-0">
            {isMineTier ? (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{
                  color: "#08130a",
                  background: tier.color_hex,
                  boxShadow: `0 0 0 3px ${tier.color_hex}33, 0 0 18px -4px ${tier.glow_hex}`,
                }}
              >
                Sei qui
              </span>
            ) : (
              <div className="leading-none">
                <div
                  className="font-display font-bold text-base sm:text-lg tabular-nums"
                  style={{ color: reached || isApex ? tier.color_hex : "hsl(0 0% 100% / 0.65)" }}
                >
                  {tier.min_rating}
                  <span className="text-xs opacity-60">+</span>
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  Soglia ELO
                </div>
              </div>
            )}
            {population > 0 && (
              <div className="mt-1 inline-flex items-center justify-end gap-1 text-[10px] text-muted-foreground tabular-nums">
                <Users size={10} /> {population}
                <span className="opacity-60">Top 50</span>
              </div>
            )}
          </div>
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
