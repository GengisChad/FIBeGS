import { motion, useReducedMotion } from "framer-motion";
import type { fibSeason } from "@/lib/fib-data";

export function SeasonProgress({ season }: { season: typeof fibSeason }) {
  const { months, currentMonth, year, status } = season;
  const reduce = useReducedMotion();
  const pct = ((currentMonth + 0.5) / months.length) * 100;
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-card/50 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold italic uppercase md:text-lg">Stagione {year}</h3>
        <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">{status}</span>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground md:text-[11px]">
        {months.map((m, i) => <span key={m} className={i === currentMonth ? "font-bold text-primary" : ""}>{m}</span>)}
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-white/[0.08]">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-primary to-violet"
          initial={{ width: reduce ? `${pct}%` : 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, margin: "-40px" }}
          transition={reduce ? { duration: 0 } : { duration: 1, ease: "easeOut" }}
        />
        <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary shadow-glow-green" style={{ left: `calc(${pct}% - 6px)` }} />
      </div>
    </section>
  );
}
