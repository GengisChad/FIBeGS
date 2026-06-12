import { motion, useReducedMotion } from "framer-motion";
import { Trophy, ShieldQuestion } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "./Button";
import heroArena from "@/assets/fib-hero-arena.png";

/**
 * Hero fedele al riferimento: arena/portale come IMMAGINE reale (ancorata a destra),
 * testo + CTA "live" a sinistra. Il logo unico FIBeGS e' gia' incluso nell'immagine.
 * Per il pixel-perfect totale, `fib-hero-arena.png` puo' essere sostituita da un
 * export piu' pulito (arena + logo, senza testo). Override via prop `bgImage`.
 */
export function HeroFederation({ bgImage = heroArena }: { bgImage?: string }) {
  const reduce = useReducedMotion();
  return (
    <section className="fib-stage relative flex min-h-[320px] items-center overflow-hidden rounded-3xl border border-white/[0.08] md:min-h-[460px]">
      <img
        src={bgImage}
        alt=""
        className="pointer-events-none absolute inset-y-0 right-0 h-full w-full object-cover object-right opacity-40 [mask-image:linear-gradient(to_right,transparent,#000_24%)] [-webkit-mask-image:linear-gradient(to_right,transparent,#000_24%)] md:w-[62%] md:opacity-100"
      />
      {/* sfumatura per leggibilita' del testo a sinistra + blend del bordo immagine (niente seam) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a0b0e] via-[#0a0b0e]/85 to-transparent md:via-[#0a0b0e]/60" />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-[90%] p-7 md:max-w-[55%] md:p-12"
      >
        <h1 className="font-display text-3xl font-extrabold uppercase not-italic leading-[1.05] tracking-tight [word-break:normal] [overflow-wrap:normal] md:text-5xl lg:text-6xl">
          Una nuova era.<br />Una sola federazione.<br />Un solo <span className="text-primary">orizzonte.</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground md:text-base">
          FIBeGS è la nuova casa competitiva dei Bladers italiani.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryButton className="not-italic"><Trophy className="h-4 w-4" /> Esplora i tornei</PrimaryButton>
          <SecondaryButton className="not-italic"><ShieldQuestion className="h-4 w-4" /> Scopri la federazione</SecondaryButton>
        </div>
      </motion.div>
    </section>
  );
}
