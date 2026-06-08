import { Bell, ScanLine, Trophy, Coins } from "lucide-react";
import fibLogo from "@/assets/fib-logo.png";
import { fibProfile } from "@/lib/fib-data";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-background/80 px-4 py-3 backdrop-blur-lg lg:justify-end lg:px-8">
      {/* logo solo su mobile: su desktop il logo unico vive nella sidebar (mai doppio logo) */}
      <img src={fibLogo} alt="FIB" className="h-7 w-auto lg:hidden" />
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-card/60 px-3 py-1.5 text-xs font-semibold text-primary sm:flex">
          <Trophy className="h-3.5 w-3.5" /> #{fibProfile.rank}
          <Coins className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{fibProfile.coins}</span>
        </div>
        <button className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-card/60 text-muted-foreground transition hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-violet px-1 text-[10px] font-bold text-white">
            {fibProfile.notifications}
          </span>
        </button>
        <button className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-card/60 text-muted-foreground transition hover:text-foreground">
          <ScanLine className="h-4 w-4" />
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet to-violet-2 font-display text-sm font-bold text-white">
          {fibProfile.name.charAt(0)}
        </div>
      </div>
    </header>
  );
}
