import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { FibSidebar } from "./FibSidebar";

/**
 * Shell responsive della Home FIB.
 * - mobile: header sticky in alto + bottom nav fissa in basso
 * - desktop (lg+): sidebar a sinistra al posto della bottom nav + griglie larghe
 */
export function FibAppShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <div className="fib-scope min-h-screen bg-background text-foreground">
      <div className="lg:flex">
        <FibSidebar active={active} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <SiteHeader />
          <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-5 pb-28 lg:max-w-6xl lg:space-y-10 lg:px-8 lg:py-8 lg:pb-10">
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav active={active} />
    </div>
  );
}
