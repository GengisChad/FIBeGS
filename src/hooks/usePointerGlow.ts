import { useEffect, useRef } from "react";

/**
 * Sheen reattivo al puntatore (feel iOS/visionOS): un riflesso di luce segue
 * il cursore sulla superficie vetro. Attivo SOLO su dispositivi con hover
 * (desktop/trackpad); su touch resta statico. Scrive le CSS var --gx/--gy/--gop
 * lette da `.glass-sheen`. Solo presentazione.
 */
export function usePointerGlow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || !window.matchMedia?.("(hover: hover)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--gx", `${x}%`);
        el.style.setProperty("--gy", `${y}%`);
        el.style.setProperty("--gop", "1");
      });
    };
    const onLeave = () => el.style.setProperty("--gop", "0");
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}
