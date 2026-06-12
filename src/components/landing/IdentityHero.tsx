import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import fibLogo from "@/assets/fib-logo.png";

export function IdentityHero() {
  const reduce = useReducedMotion();
  const fade = (delay = 0, y = 12) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay } };

  return (
    <section className="fib-stage relative overflow-hidden px-5 py-14 text-center">
      <motion.h1
        {...fade(0)}
        className="relative z-10 font-display not-italic text-3xl font-extrabold uppercase tracking-tight md:text-5xl"
      >
        Gira. Combatti. <span className="text-primary">Domina.</span>
      </motion.h1>

      <div className="relative mx-auto mt-2 flex h-[320px] max-w-[520px] items-center justify-center md:h-[380px]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 md:h-[560px] md:w-[560px]">
          <div className="fib-vortex s1 absolute inset-0" />
          <div className="fib-vortex s2 absolute inset-[70px]" />
          <div className="fib-vortex core absolute inset-[33%]" />
        </div>
        <motion.img
          {...(reduce ? {} : { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.6, delay: 0.1 } })}
          src={fibLogo}
          alt="FIBeGS"
          className="relative z-10 w-52 drop-shadow-[0_0_30px_hsl(var(--violet)/0.6)] md:w-64"
        />
      </div>

      <motion.button
        {...fade(0.2, 10)}
        className="relative z-10 mx-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(var(--green-electric))] to-primary px-7 py-4 font-display text-sm font-extrabold uppercase not-italic text-primary-foreground shadow-[0_0_34px_-4px_hsl(var(--primary)/0.65),0_0_60px_-10px_hsl(var(--violet)/0.7)] transition hover:brightness-110"
      >
        Esplora il network completo <ChevronRight className="h-4 w-4" />
      </motion.button>
    </section>
  );
}
