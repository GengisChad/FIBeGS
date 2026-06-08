import { MapPin, Users, ShieldCheck } from "lucide-react";
import type { Club } from "@/lib/fib-data";

export function ClubCardWide({ club }: { club: Club }) {
  const initials = club.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-card/60 p-4">
      {club.logoUrl ? (
        <img
          src={club.logoUrl}
          alt={club.name}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-full border-2 border-violet/40 object-cover shadow-[0_0_16px_-4px_hsl(var(--violet)/0.6)]"
        />
      ) : (
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-violet/40 bg-gradient-to-br from-violet/30 to-surface-2 font-display text-lg font-bold italic text-white shadow-[0_0_16px_-4px_hsl(var(--violet)/0.6)]">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-lg font-extrabold italic uppercase">{club.name}</span>
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary/70" />
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{club.city || "—"}</div>
        <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-3.5 w-3.5" />{club.members} membri</div>
      </div>
    </div>
  );
}
