import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import type { Player } from "@/lib/fib-data";

export function PlayerRankCard({ player, featured }: { player: Player; featured?: boolean }) {
  const rankColor =
    player.rank === 1 ? "text-primary" : player.rank === 2 ? "text-foreground" : "text-violet-2";
  return (
    <div className={cn(
      "flex flex-col items-center rounded-2xl border p-4 text-center",
      featured ? "border-violet/50 bg-violet/[0.06] shadow-glow-violet" : "border-white/[0.08] bg-card/60",
    )}>
      {featured && <Crown className="mb-1 h-5 w-5 text-primary" />}
      <div className={cn("font-display text-2xl font-extrabold italic", rankColor)}>{player.rank}</div>
      <div className="my-2 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-surface-2 font-display font-bold">
        {player.name.charAt(0).toUpperCase()}
      </div>
      <div className="w-full truncate text-sm font-semibold">{player.name}</div>
      <div className="mt-0.5 font-display text-sm font-bold italic text-primary">{player.points} PT</div>
    </div>
  );
}
