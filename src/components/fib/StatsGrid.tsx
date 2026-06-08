import type { Stat } from "@/lib/fib-data";
import { StatCard } from "./StatCard";

export function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-4 gap-3 max-[420px]:grid-cols-2">
      {stats.map((s) => <StatCard key={s.key} stat={s} />)}
    </div>
  );
}
