import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Users, Shield, MapPin, Trophy } from "lucide-react";
import type { Stat } from "@/lib/fib-data";

const ICONS = { users: Users, shield: Shield, pin: MapPin, trophy: Trophy } as const;

export function StatCard({ stat }: { stat: Stat }) {
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
    <div ref={ref} className="rounded-2xl border border-white/[0.08] bg-card/70 p-4 transition hover:border-primary/40 md:p-5">
      <Icon className="mb-3 h-5 w-5 text-primary" strokeWidth={1.8} />
      <div className="whitespace-nowrap font-display text-3xl font-extrabold italic leading-none tabular-nums text-foreground md:text-4xl">
        {n.toLocaleString("it-IT")}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground md:text-sm">{stat.label}</div>
    </div>
  );
}
