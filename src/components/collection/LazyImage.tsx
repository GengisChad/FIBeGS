import { useState, useRef, useEffect, memo } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

// In-memory cache of already-loaded URLs to skip fade-in on re-render
const loadedCache = new Set<string>();

// Shared IntersectionObserver for all LazyImage instances (much more efficient than one per image)
let sharedObserver: IntersectionObserver | null = null;
const observerCallbacks = new Map<Element, () => void>();

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = observerCallbacks.get(entry.target);
            if (cb) {
              cb();
              observerCallbacks.delete(entry.target);
              sharedObserver!.unobserve(entry.target);
            }
          }
        }
      },
      { rootMargin: "400px" } // Larger margin = start loading earlier
    );
  }
  return sharedObserver;
}

const LazyImage = memo(({ src, alt, className }: LazyImageProps) => {
  const alreadyCached = loadedCache.has(src);
  const [loaded, setLoaded] = useState(alreadyCached);
  const [inView, setInView] = useState(alreadyCached);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (alreadyCached) return; // Already visible, skip observer
    const el = ref.current;
    if (!el) return;

    const observer = getSharedObserver();
    observerCallbacks.set(el, () => setInView(true));
    observer.observe(el);

    return () => {
      observer.unobserve(el);
      observerCallbacks.delete(el);
    };
  }, [alreadyCached]);

  const handleLoad = () => {
    loadedCache.add(src);
    setLoaded(true);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onLoad={handleLoad}
          className={cn(
            "w-full h-full object-contain select-none pointer-events-auto",
            alreadyCached
              ? "opacity-100"
              : loaded
                ? "opacity-100 transition-opacity duration-200"
                : "opacity-0"
          )}
        />
      )}
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded" />
      )}
    </div>
  );
});

LazyImage.displayName = "LazyImage";

export default LazyImage;
