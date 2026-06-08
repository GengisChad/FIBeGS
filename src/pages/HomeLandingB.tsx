import { SiteHeaderB } from "@/components/landing/SiteHeaderB";
import { IdentityHero } from "@/components/landing/IdentityHero";
import { NetworkStats } from "@/components/landing/NetworkStats";
import { ClubsCarousel } from "@/components/landing/ClubsCarousel";
import { NationalLeaderboard } from "@/components/landing/NationalLeaderboard";
import { EventsArena } from "@/components/landing/EventsArena";
import { FooterB } from "@/components/landing/FooterB";
import { useFibLandingData } from "@/components/landing/useFibLandingData";

// Direzione B — "GIRA. COMBATTI. DOMINA." (landing brand/eventi).
// .fib-scope blinda il look FIB su qualunque tema attivo, senza toccare il resto dell'app.
// I token/font/vortice arrivano da src/styles/fib-theme.css (gia' importato in index.css).
export default function HomeLandingB() {
  const { stats, clubs, leaderboard, nextEvent } = useFibLandingData();
  return (
    <div className="fib-scope min-h-screen bg-background text-foreground">
      <SiteHeaderB />
      <main className="mx-auto max-w-6xl">
        <IdentityHero />
        <NetworkStats stats={stats} />
        <ClubsCarousel clubs={clubs} />
        <section className="grid gap-6 px-5 py-6 md:grid-cols-2">
          <NationalLeaderboard leaderboard={leaderboard} />
          <EventsArena nextEvent={nextEvent} />
        </section>
      </main>
      <FooterB />
    </div>
  );
}
