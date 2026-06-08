import { useEffect, useState } from "react";

/**
 * Returns the value of env(safe-area-inset-top) in pixels.
 * Useful to detect notch / camera hole on mobile devices.
 */
export const useSafeAreaTop = () => {
  const [topInset, setTopInset] = useState(0);

  useEffect(() => {
    const measure = () => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;top:0;left:0;height:env(safe-area-inset-top);width:0;visibility:hidden;pointer-events:none;";
      document.body.appendChild(probe);
      const h = probe.getBoundingClientRect().height;
      document.body.removeChild(probe);
      setTopInset(h);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return topInset;
};
