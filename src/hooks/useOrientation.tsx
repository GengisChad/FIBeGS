import { useEffect, useState } from "react";

export type Orientation = "portrait" | "landscape";

/**
 * Tracks viewport orientation. Works on any browser (mobile + desktop)
 * by checking innerWidth vs innerHeight. Updates on resize/orientationchange.
 */
export function useOrientation(): Orientation {
  const get = (): Orientation => {
    if (typeof window === "undefined") return "portrait";
    return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
  };

  const [orientation, setOrientation] = useState<Orientation>(get);

  useEffect(() => {
    const update = () => setOrientation(get());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return orientation;
}

/**
 * True only on small viewports (touch phones) in landscape.
 * Avoids triggering fullscreen VAR on a desktop monitor.
 */
export function useMobileLandscape(): boolean {
  const orientation = useOrientation();
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  useEffect(() => {
    const check = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      // Many modern phones (Pixel, Galaxy S+) are >500px tall in landscape.
      // Use 640px and require touch + reasonable phone-like aspect to avoid desktops.
      const isShort = window.innerHeight <= 640;
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      setIsMobileLandscape(isLandscape && isShort && isTouch);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, [orientation]);

  return isMobileLandscape;
}
