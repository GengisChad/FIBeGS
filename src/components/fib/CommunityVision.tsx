import { Users } from "lucide-react";
import { PrimaryButton } from "./Button";
import fibLogo from "@/assets/fib-logo.png";

export function CommunityVision() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/[0.08]">
      <div className="grid items-center gap-6 p-6 md:grid-cols-[1.1fr_1.4fr_auto] md:p-8">
        {/* arena + logo */}
        <div className="fib-stage relative flex min-h-[150px] items-center justify-center overflow-hidden rounded-2xl">
          <div className="fib-glow-wash absolute inset-0" />
          <div className="fib-orbit g absolute animate-fib-pulse" style={{ width: 200, height: 70, bottom: 30 }} />
          <div className="fib-orbit v absolute animate-fib-pulse" style={{ width: 150, height: 52, bottom: 42 }} />
          <img src={fibLogo} alt="FIB" className="relative w-36 drop-shadow-[0_0_22px_hsl(var(--violet)/0.5)]" />
        </div>
        {/* testo */}
        <div>
          <h3 className="font-display text-3xl font-extrabold italic leading-[1.02] md:text-4xl">
            Una federazione.<br />Una community.<br /><span className="text-primary">Un movimento.</span>
          </h3>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">Insieme, costruiamo il futuro del Bladers italiano.</p>
          <PrimaryButton className="mt-5"><Users className="h-4 w-4" /> Trova il tuo club</PrimaryButton>
        </div>
        {/* icona */}
        <Users className="hidden h-24 w-24 text-violet/60 md:block" strokeWidth={1.4} />
      </div>
    </section>
  );
}
