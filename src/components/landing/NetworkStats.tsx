import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Users, Shield, MapPin, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { stats as mockStats, type Stat } from "@/lib/ibnf-landing-data";

const ICONS = { users: Users, shield: Shield, pin: MapPin, trophy: Trophy } as const;

function StatCardB({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const Icon = ICONS[stat.icon];
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setN(stat.value); return; }
    const c = animate(0, stat.value, { duration: 1.4, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, stat.value, reduce]);
  return (
    <div ref={ref} className={cn(
      "group relative overflow-hidden rounded-2xl border bg-card p-5 transition",
      "hover:-translate-y-1 hover:shadow-[0_0_30px_-8px_hsl(var(--primary)/0.5),0_0_40px_-10px_hsl(var(--violet)/0.45)]",
      stat.premium ? "border-violet/60 shadow-[0_0_28px_-8px_hsl(var(--violet)/0.6)]" : "border-white/[0.08] hover:border-primary/50",
    )}>
      <Icon className="mb-3 h-5 w-5 text-primary" strokeWidth={1.8} />
      <div className="whitespace-nowrap font-display text-3xl font-extrabold italic leading-none tabular-nums text-primary">{n.toLocaleString("it-IT")}</div>
      <div className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</div>
      <Icon className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 text-white/[0.04]" strokeWidth={1.2} />
    </div>
  );
}

export function NetworkStats({ stats = mockStats }: { stats?: Stat[] }) {
  return (
    <section className="px-5 py-10">
      <h2 className="mb-6 text-center font-display text-2xl font-extrabold uppercase italic text-muted-foreground">Numeri del Network FIBeGS</h2>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => <StatCardB key={s.key} stat={s} />)}
      </div>
    </section>
  );
}
