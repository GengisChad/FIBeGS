import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function PrimaryButton({ className, children, ...p }: Props) {
  return (
    <button {...p} className={cn(
      "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3",
      "font-display text-sm font-extrabold uppercase italic text-primary-foreground",
      "shadow-[0_0_30px_-6px_hsl(var(--primary)/0.6)] transition hover:brightness-110", className,
    )}>{children}</button>
  );
}

export function SecondaryButton({ className, children, ...p }: Props) {
  return (
    <button {...p} className={cn(
      "inline-flex items-center justify-center gap-2 rounded-xl border border-violet/60 bg-violet/10 px-5 py-3",
      "font-display text-sm font-extrabold uppercase italic text-[hsl(var(--violet-2))]",
      "shadow-[0_0_28px_-12px_hsl(var(--violet)/0.8)] transition hover:bg-violet/20", className,
    )}>{children}</button>
  );
}
