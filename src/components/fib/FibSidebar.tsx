import { cn } from "@/lib/utils";
import { Home, Trophy, Swords, Users, User, Coins } from "lucide-react";
import fibLogo from "@/assets/fib-logo.png";
import { fibProfile } from "@/lib/fib-data";

const ITEMS = [
  { key: "home", label: "Home", icon: Home },
  { key: "classifica", label: "Classifica", icon: Trophy },
  { key: "tornei", label: "Tornei", icon: Swords },
  { key: "club", label: "Club", icon: Users },
  { key: "profilo", label: "Profilo", icon: User },
] as const;

export function FibSidebar({ active = "home" }: { active?: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-background/70 px-4 py-6 backdrop-blur-lg lg:flex">
      <img src={fibLogo} alt="FIB" className="mb-8 h-10 w-auto px-2" />

      <nav className="flex flex-col gap-1">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const on = active === it.key;
          return (
            <button
              key={it.key}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                on
                  ? "border border-primary/30 bg-primary/10 text-primary shadow-glow-green"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" /> {it.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-card/60 p-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-violet-2 font-display text-sm font-bold text-white">
          {fibProfile.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{fibProfile.name}</div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1 text-primary"><Trophy className="h-3 w-3" />#{fibProfile.rank}</span>
            <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{fibProfile.coins}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
