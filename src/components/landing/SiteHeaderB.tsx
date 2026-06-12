import { Bell } from "lucide-react";
import fibLogo from "@/assets/fib-logo.png";

export function SiteHeaderB() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-background/80 px-5 py-3 backdrop-blur-lg">
      <img src={fibLogo} alt="FIBeGS" className="h-7 w-auto" />
      <nav className="hidden gap-7 md:flex">
        {["Tornei", "Classifiche", "Clubs", "Arene"].map((l) => (
          <a key={l} className="cursor-pointer text-sm font-semibold text-foreground/80 transition hover:text-primary">{l}</a>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <button className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-card/60 text-muted-foreground transition hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-violet px-1 text-[10px] font-bold text-white">3</span>
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet to-[hsl(var(--violet-2))] font-display text-sm font-bold text-white">G</div>
      </div>
    </header>
  );
}
