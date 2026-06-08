import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { leaderboard as mockLeaderboard, type Player } from "@/lib/fib-landing-data";

function Rank({ r }: { r: number }) {
  if (r === 1) return <Crown className="mx-auto h-4 w-4 text-[#f5c542]" />;
  if (r === 2) return <Medal className="mx-auto h-4 w-4 text-[#cfd3da]" />;
  if (r === 3) return <Medal className="mx-auto h-4 w-4 text-[#cd7f32]" />;
  return <span className="font-display font-extrabold italic text-muted-foreground">{r}</span>;
}

export function NationalLeaderboard({ leaderboard = mockLeaderboard }: { leaderboard?: Player[] }) {
  return (
    <div>
      <h3 className="mb-3 font-display text-xl font-extrabold uppercase italic">Classifica Nazionale</h3>
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card">
        <div className="grid grid-cols-[28px_1fr_70px] gap-2 border-b border-white/[0.08] bg-[#101016] px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="text-center"><Trophy className="mx-auto h-3 w-3 text-primary" /></span>
          <span>Nome Blader / Città</span><span className="text-right">Punti</span>
        </div>
        {leaderboard.map((p) => (
          <div key={p.rank} className={cn("grid grid-cols-[28px_1fr_70px] items-center gap-2 border-b border-white/[0.06] px-3 py-2 text-sm last:border-0",
            p.rank === 1 && "bg-gradient-to-r from-violet/15 to-transparent")}>
            <div className="text-center"><Rank r={p.rank} /></div>
            <div className="min-w-0"><span className="font-medium">{p.name}</span><span className="block text-[11px] text-muted-foreground">{p.city}</span></div>
            <div className="text-right font-display font-extrabold italic text-primary">{p.points}<span className="ml-0.5 text-[9px] not-italic text-muted-foreground">PT</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
