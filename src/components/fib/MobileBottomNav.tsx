import { cn } from "@/lib/utils";
import { Home, Trophy, Swords, Users, User } from "lucide-react";

const ITEMS = [
  { key: "home", label: "Home", icon: Home },
  { key: "classifica", label: "Classifica", icon: Trophy },
  { key: "tornei", label: "Tornei", icon: Swords, center: true },
  { key: "club", label: "Club", icon: Users },
  { key: "profilo", label: "Profilo", icon: User },
] as const;

export function MobileBottomNav({ active = "home" }: { active?: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center justify-around border-t border-white/[0.06] bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-lg lg:hidden">
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const on = active === it.key;
        if ("center" in it && it.center) {
          return (
            <button key={it.key} className="flex flex-col items-center gap-1">
              <span className="-mt-6 grid h-14 w-14 place-items-center rounded-full border-2 border-primary bg-background text-primary shadow-glow-green">
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{it.label}</span>
            </button>
          );
        }
        return (
          <button key={it.key} className={cn("flex flex-col items-center gap-1 text-[9px] uppercase tracking-wide", on ? "text-primary" : "text-muted-foreground")}>
            <Icon className="h-5 w-5" /> {it.label}
          </button>
        );
      })}
    </nav>
  );
}
