import { useEffect, useRef, useState } from "react";

/**
 * Conteggio animato (SOLO presentazione): il numero sale da 0 al valore con
 * ease-out su requestAnimationFrame. Rispetta prefers-reduced-motion (mostra
 * subito il valore). Non tocca i dati: anima solo il display.
 */
export function CountUp({
  value,
  durationMs = 1000,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value) || value <= 0) {
      setDisplay(Number.isFinite(value) ? value : 0);
      return;
    }
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      setDisplay(Math.round(value * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{display.toLocaleString()}</span>;
}
