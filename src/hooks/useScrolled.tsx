import { useEffect, useState } from "react";

export const useScrolled = (threshold = 120) => {
  const [scrolled, setScrolled] = useState(
    typeof window !== "undefined" ? window.scrollY > threshold : false
  );
  useEffect(() => {
    let raf = 0;
    let current = window.scrollY > threshold;
    const sync = () => {
      raf = 0;
      const next = window.scrollY > threshold;
      if (next !== current) {
        current = next;
        setScrolled(next);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);
  return scrolled;
};
