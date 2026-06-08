import { cn } from "@/lib/utils";
import { MapPin, Users } from "lucide-react";
import type { Tournament } from "@/lib/fib-data";

const KIND: Record<Tournament["kind"], string> = {
  Nazionale: "text-primary border-primary/40",
  Regionale: "text-violet border-violet/40",
  Club: "text-foreground border-white/15",
  Unranked: "text-muted-foreground border-white/10",
};

export function TournamentRow({ t }: { t: Tournament }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.07] py-3 last:border-0">
      <div className="w-12 shrink-0 text-center">
        <div className="font-display text-2xl font-extrabold italic leading-none">{t.day}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.month}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-base font-bold italic">{t.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{t.kind}</span><span>·</span>
          <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{t.city}</span></span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{t.entrants}</div>
        <span className={cn("mt-1 inline-block rounded-md border px-2 py-1 text-[10px] font-bold uppercase", KIND[t.kind])}>
          {t.open ? "Iscrizioni aperte" : "Dettagli"}
        </span>
      </div>
    </div>
  );
}
