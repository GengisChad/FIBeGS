import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  /**
   * Aurora intensity. `subtle` is the default for inner pages.
   */
  ambient?: "subtle" | "rich" | "off";
}

/**
 * Shared page wrapper: applies the liquid-glass/aurora ambient backdrop
 * used on the homepage to every core page, plus an extra safe horizontal
 * padding on mobile so that the side-drawer glow handles never overlap
 * page content.
 */
export const PageShell = ({ children, className, ambient = "subtle" }: PageShellProps) => {
  return (
    <div
      className={cn(
        "relative min-h-screen bg-background text-foreground overflow-hidden",
        "home-performance",
        className,
      )}
    >
      {ambient !== "off" && (
        <>
          <div
            aria-hidden
            className={cn(
              "fib-aurora absolute inset-0 pointer-events-none",
              ambient === "rich" ? "opacity-60" : "opacity-35",
            )}
          />
          <div
            aria-hidden
            className={cn(
              "liquid-orbs absolute inset-0 pointer-events-none",
              ambient === "rich" ? "opacity-60" : "opacity-30",
            )}
          >
            <span />
            <span />
            <span />
          </div>
        </>
      )}
      <div className="relative z-10 page-safe-x">{children}</div>
    </div>
  );
};

export default PageShell;
