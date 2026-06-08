import { useRef, useEffect, ReactNode, useCallback } from "react";

interface AutoScrollCarouselProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  enabled?: boolean;
}
const AutoScrollCarousel = ({ children, className, speed = 25, enabled = true }: AutoScrollCarouselProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const directionRef = useRef(1);
  const isDesktopRef = useRef(false);
  const isHoveringRef = useRef(false);

  // Mouse drag state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);
  const hasDragged = useRef(false);

  // Desktop behavior: auto-scroll only when hovered
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");

    const applyMode = () => {
      isDesktopRef.current = mq.matches;
      pausedRef.current = mq.matches ? !isHoveringRef.current : false;
    };

    applyMode();
    mq.addEventListener?.("change", applyMode);

    return () => {
      mq.removeEventListener?.("change", applyMode);
    };
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let raf: number;
    let last: number | null = null;

    const step = (ts: number) => {
      if (!pausedRef.current && !isDragging.current && last !== null) {
        const dt = (ts - last) / 1000;
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);

        if (maxScroll > 1) {
          el.scrollLeft += speed * dt * directionRef.current;
          if (el.scrollLeft >= maxScroll - 1) directionRef.current = -1;
          if (el.scrollLeft <= 1) directionRef.current = 1;
        }
      }

      last = ts;
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, enabled]);

  // Mouse drag handlers
  const handleMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    if (isDesktopRef.current && !isDragging.current) {
      pausedRef.current = false;
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartLeft.current = el.scrollLeft;
    pausedRef.current = true;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 3) hasDragged.current = true;
    el.scrollLeft = scrollStartLeft.current - dx;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const el = ref.current;
    if (el) {
      el.style.cursor = "";
      el.style.userSelect = "";
      // If user dragged, suppress the next click so variants don't toggle
      if (hasDragged.current) {
        const suppress = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
        };
        el.addEventListener("click", suppress, { capture: true, once: true });
      }
    }

    setTimeout(() => {
      pausedRef.current = isDesktopRef.current ? !isHoveringRef.current : false;
    }, 250);
  }, []);

  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;

    if (isDragging.current) {
      isDragging.current = false;
      const el = ref.current;
      if (el) {
        el.style.cursor = "";
        el.style.userSelect = "";
      }
    }

    pausedRef.current = isDesktopRef.current ? true : false;
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ scrollSnapType: isDragging.current ? "none" : undefined }}
      onTouchStart={() => { pausedRef.current = true; }}
      onTouchEnd={() => { setTimeout(() => { pausedRef.current = isDesktopRef.current ? !isHoveringRef.current : false; }, 600); }}
      onMouseEnter={handleMouseEnter}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
};

export default AutoScrollCarousel;
