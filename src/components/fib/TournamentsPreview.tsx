import { SectionHeader } from "./SectionHeader";
import { TournamentRow } from "./TournamentRow";
import type { Tournament } from "@/lib/fib-data";

export function TournamentsPreview({ tournaments }: { tournaments: Tournament[] }) {
  return (
    <section>
      <SectionHeader title="Prossimi tornei" action="Vedi tutti" />
      <div className="rounded-2xl border border-white/[0.08] bg-card/50 px-4">
        {tournaments.map((t) => <TournamentRow key={t.id} t={t} />)}
      </div>
    </section>
  );
}
