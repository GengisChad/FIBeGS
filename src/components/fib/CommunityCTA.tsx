import { Users } from "lucide-react";

export function CommunityCTA() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet/[0.12] to-card/60 p-5">
      <h3 className="font-display text-xl font-extrabold italic uppercase leading-tight">
        Una federazione.<br />Una community.<br /><span className="text-primary">Un movimento.</span>
      </h3>
      <p className="mt-3 max-w-[42ch] text-sm text-muted-foreground">
        FIB nasce per unificare il competitivo italiano: dare struttura ai club, valorizzare i giocatori
        e costruire una scena nazionale piu' forte e riconoscibile.
      </p>
      <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-3 text-sm font-bold text-white transition hover:brightness-110">
        <Users className="h-4 w-4" /> Trova il tuo club
      </button>
      <Users className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-violet/20" strokeWidth={1} />
    </section>
  );
}
