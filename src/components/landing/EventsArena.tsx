import { useEffect, useState } from "react";
import { MapPin, Settings, MonitorSmartphone, ShoppingCart, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { nextEvent as mockNextEvent, services } from "@/lib/fib-landing-data";

const SICON = { pin: MapPin, gear: Settings, stream: MonitorSmartphone, shop: ShoppingCart, qr: QrCode } as const;

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => { const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000); return () => clearInterval(t); }, []);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function Tile({ s }: { s: typeof services[number] }) {
  const Icon = SICON[s.icon];
  const violet = s.group === "media";
  return (
    <div className={cn("cursor-pointer rounded-xl border border-white/[0.08] p-3 text-center text-[11px] transition",
      violet ? "hover:border-violet/50 hover:shadow-[0_0_20px_-10px_hsl(var(--violet)/0.7)]" : "hover:border-primary/50 hover:shadow-[0_0_20px_-10px_hsl(var(--primary)/0.6)]")}>
      <Icon className={cn("mx-auto mb-1.5 h-5 w-5", violet ? "text-[hsl(var(--violet-2))]" : "text-primary")} />
      {s.label}
    </div>
  );
}

export function EventsArena({ nextEvent = mockNextEvent }: { nextEvent?: typeof mockNextEvent }) {
  const cd = useCountdown(nextEvent.startsInSeconds);
  const arene = services.filter((s) => s.group === "arene");
  const media = services.filter((s) => s.group === "media");
  return (
    <div>
      <h3 className="mb-3 font-display text-xl font-extrabold uppercase italic">Prossimi eventi e arene</h3>
      <div className="rounded-2xl border-2 border-primary/80 bg-gradient-to-b from-primary/[0.06] to-card p-4 text-center shadow-[0_0_30px_-12px_hsl(var(--primary)/0.55)]">
        <div className="font-display text-[11px] font-extrabold uppercase italic tracking-widest text-primary">Prossimo evento</div>
        <div className="mt-2 flex items-center justify-center gap-1.5 font-semibold"><MapPin className="h-4 w-4 text-primary" />{nextEvent.place}</div>
        <div className="mt-1 text-xs text-muted-foreground">{nextEvent.date} · Check-in {nextEvent.checkin}</div>
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-background py-3 font-display text-3xl font-extrabold italic tracking-wider tabular-nums">{cd}</div>
      </div>
      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-card p-4">
        <div className="mb-2 text-center font-display text-[11px] font-extrabold uppercase italic tracking-wider text-muted-foreground">Arene Xtreme</div>
        <div className="grid grid-cols-3 gap-2.5">{arene.map((s) => <Tile key={s.label} s={s} />)}</div>
        <div className="mb-2 mt-3 text-center font-display text-[11px] font-extrabold uppercase italic tracking-wider text-muted-foreground">Media</div>
        <div className="grid grid-cols-3 gap-2.5">{media.map((s) => <Tile key={s.label} s={s} />)}</div>
      </div>
    </div>
  );
}
