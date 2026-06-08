import { ChevronsRight } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { PlayerRankCard } from "./PlayerRankCard";
import type { Player } from "@/lib/fib-data";

export function RankingPreview({ players }: { players: Player[] }) {
  return (
    <section>
      <SectionHeader title="Classifica Nazionale" action="Vedi classifica" />
      <div className="mx-auto grid max-w-md grid-cols-3 items-end gap-3 lg:max-w-lg">
        {players.map((p) => (
          <div key={p.rank} className={p.rank === 1 ? "-mt-3" : ""}>
            <PlayerRankCard player={p} featured={p.rank === 1} />
          </div>
        ))}
      </div>
      <button className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-card/50 px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/30">
        La classifica completa ti aspetta <ChevronsRight className="h-4 w-4 text-primary" />
      </button>
    </section>
  );
}
