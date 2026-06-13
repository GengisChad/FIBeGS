import { useEffect, useRef } from "react";

/**
 * Parallax/zoom dolce dell'immagine hero allo scroll (feel iOS): la foto si
 * ingrandisce leggermente mentre scorri, dando profondita. Gap-free (solo
 * scale, clippato dall'overflow del contenitore). Rispetta prefers-reduced-motion.
 * Solo presentazione. Legge ref.current ad ogni frame, quindi funziona anche se
 * l'immagine monta dopo (banner caricato in async).
 */
export function useBannerParallax<T extends HTMLElement = HTMLImageElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const sy = window.scrollY || document.documentElement.scrollTop || 0;
      const p = Math.min(1, Math.max(0, sy / 260));
      el.style.transform = `scale(${(1 + p * 0.14).toFixed(4)})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}
