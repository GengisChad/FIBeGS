import { MapPin, Users, ShieldCheck } from "lucide-react";
import type { Club } from "@/lib/fib-data";

export function ClubCard({ club }: { club: Club }) {
  const initials = club.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative w-36 shrink-0 rounded-2xl border border-white/[0.08] bg-card/60 p-3 lg:w-auto">
      <ShieldCheck className="absolute right-3 top-3 h-4 w-4 text-primary/70" />
      {club.logoUrl ? (
        <img
          src={club.logoUrl}
          alt={club.name}
          loading="lazy"
          className="mx-auto mb-2 h-14 w-14 rounded-xl border border-violet/30 object-cover"
        />
      ) : (
        <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-xl border border-violet/30 bg-gradient-to-br from-violet/30 to-surface-2 font-display font-bold text-white">
          {initials}
        </div>
      )}
      <div className="truncate text-center font-display text-sm font-bold italic uppercase">{club.name}</div>
      <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{club.city || "—"}</div>
      <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" />{club.members} membri</div>
    </div>
  );
}
