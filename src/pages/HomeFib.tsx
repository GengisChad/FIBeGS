import { FibAppShell } from "@/components/fib/FibAppShell";
import { HeroFederation } from "@/components/fib/HeroFederation";
import { StatsGrid } from "@/components/fib/StatsGrid";
import { RankingPreview } from "@/components/fib/RankingPreview";
import { ClubPreview } from "@/components/fib/ClubPreview";
import { TournamentsPreview } from "@/components/fib/TournamentsPreview";
import { SeasonProgress } from "@/components/fib/SeasonProgress";
import { CommunityVision } from "@/components/fib/CommunityVision";
import { useFibHomeData } from "@/components/fib/useFibHomeData";

export default function HomeFib() {
  const { stats, podium, clubs, tournaments, season } = useFibHomeData();

  return (
    <FibAppShell active="home">
      <HeroFederation />

      <StatsGrid stats={stats} />

      {/* desktop: griglie multi-colonna; mobile: impilato */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <RankingPreview players={podium} />
        <div className="space-y-6 lg:space-y-8">
          <TournamentsPreview tournaments={tournaments} />
          <SeasonProgress season={season} />
        </div>
      </div>

      <ClubPreview clubs={clubs} />

      <CommunityVision />
    </FibAppShell>
  );
}
