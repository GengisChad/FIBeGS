import { cn } from "@/lib/utils";
import { useState } from "react";

export function Chips({ options, value, onChange }: {
  options: string[]; value?: string; onChange?: (v: string) => void;
}) {
  const [active, setActive] = useState(value ?? options[0]);
  return (
    <div className="flex gap-2">
      {options.map((o) => {
        const on = o === active;
        return (
          <button key={o} onClick={() => { setActive(o); onChange?.(o); }}
            className={cn("rounded-full border px-4 py-2 text-sm font-semibold transition",
              on ? "border-primary/60 text-primary" : "border-white/12 text-muted-foreground hover:text-foreground")}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
