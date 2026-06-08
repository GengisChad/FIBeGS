import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export function SectionHeader({
  title, action, onAction, className,
}: { title: string; action?: string; onAction?: () => void; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between", className)}>
      <h2 className="font-display text-lg font-bold italic uppercase tracking-tight md:text-xl">{title}</h2>
      {action && (
        <button onClick={onAction} className="flex items-center gap-1 text-sm font-semibold text-primary transition hover:brightness-110">
          {action} <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
