import { Swords, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { clubs as mockClubs, type Club } from "@/lib/fib-landing-data";

export function ClubsCarousel({ clubs = mockClubs }: { clubs?: Club[] }) {
  return (
    <section className="py-10">
      <h2 className="text-center font-display text-2xl font-extrabold uppercase italic">Il nostro ecosistema: Club &amp; Regioni</h2>
      <p className="mt-1 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">I club della federazione</p>

      <div className="mt-7 flex gap-6 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center">
        {clubs.map((c) => (
          <div key={c.id} className={cn("flex shrink-0 flex-col items-center", c.featured ? "w-36" : "w-28")}>
            <div className="grid place-items-center rounded-full"
              style={{ width: c.featured ? 104 : 80, height: c.featured ? 104 : 80,
                background: "radial-gradient(circle at 38% 30%, #262433, #0e0d13)",
                boxShadow: `0 0 0 2px ${c.ring}, 0 0 20px -2px ${c.ring}` }}>
              <Swords className="opacity-90" style={{ color: c.ring }} size={c.featured ? 38 : 28} />
            </div>
            <div className={cn("mt-3 line-clamp-2 w-full text-center font-semibold leading-tight", c.featured ? "text-base text-primary" : "text-sm")}>{c.name}</div>
            <div className="w-full truncate text-center text-xs text-muted-foreground">{c.city}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-center gap-1.5">
        <span className="h-1 w-6 rounded bg-white/15" /><span className="h-1 w-6 rounded bg-primary" /><span className="h-1 w-6 rounded bg-white/15" />
      </div>

      <div className="mt-6 flex justify-center">
        <button className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-gradient-to-b from-[#20202a] to-[#16161d] px-6 py-3 text-sm font-bold text-white shadow-[0_0_26px_-10px_hsl(var(--violet)/0.8)] transition hover:brightness-110">
          Scopri tutti i club <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
