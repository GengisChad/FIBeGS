import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { RefreshCw } from "lucide-react";

/**
 * Simple pull-to-refresh for the Capacitor Android shell.
 * Listens at the document level; only active when scrollY === 0
 * and the user drags down more than THRESHOLD px.
 */
export const NativePullToRefresh = () => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const THRESHOLD = 80;
    let startY = 0;
    let tracking = false;
    let current = 0;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 4) return;
      tracking = true;
      startY = e.touches[0].clientY;
      current = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { setPull(0); return; }
      current = Math.min(dy * 0.5, THRESHOLD * 1.5);
      setPull(current);
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (current >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPull(THRESHOLD);
        setTimeout(() => window.location.reload(), 250);
      } else {
        setPull(0);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing]);

  if (!Capacitor.isNativePlatform() || pull <= 0) return null;

  const progress = Math.min(1, pull / 80);
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] flex justify-center pointer-events-none"
      style={{ transform: `translateY(${Math.min(pull, 100) - 40}px)`, transition: refreshing ? "transform 200ms" : "none" }}
    >
      <div
        className="h-10 w-10 rounded-full bg-background border border-border shadow flex items-center justify-center"
        style={{ opacity: progress }}
      >
        <RefreshCw
          size={18}
          className={`text-primary ${refreshing ? "animate-spin" : ""}`}
          style={{ transform: `rotate(${progress * 360}deg)` }}
        />
      </div>
    </div>
  );
};

export default NativePullToRefresh;
