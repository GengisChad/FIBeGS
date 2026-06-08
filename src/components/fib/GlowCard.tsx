import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Glow = "none" | "green" | "violet";

export function GlowCard({
  children, glow = "none", hover = true, className,
}: { children: ReactNode; glow?: Glow; hover?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      whileHover={hover && !reduce ? { y: -3 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "relative rounded-2xl border border-white/[0.08] bg-card/70 backdrop-blur-sm",
        glow === "green" && "shadow-glow-green border-primary/40",
        glow === "violet" && "shadow-glow-violet border-violet/40",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
