import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OptionToggleGroupProps {
  label: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
  /** Return null if available, or a string reason if disabled */
  getDisabledReason?: (option: number) => string | null;
  prefix?: string;
  formatLabel?: (option: number) => string;
}

export const OptionToggleGroup = ({
  label,
  options,
  value,
  onChange,
  getDisabledReason,
  prefix = "",
  formatLabel,
}: OptionToggleGroupProps) => {
  return (
    <div className="w-full">
      {label && <label className="text-sm font-medium text-muted-foreground mb-2 block">{label}</label>}
      <div className="flex w-full rounded-lg border-2 border-border overflow-hidden">
        {options.map((opt, i) => {
          const reason = getDisabledReason?.(opt) ?? null;
          const isDisabled = reason !== null;
          const isActive = value === opt;

          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (isDisabled) {
                  toast.info(reason);
                } else {
                  onChange(opt);
                }
              }}
              className={cn(
                "flex-1 min-w-0 px-1 sm:px-2 py-1.5 text-xs sm:text-sm font-semibold transition-colors text-center leading-tight whitespace-nowrap",
                i < options.length - 1 && "border-r border-border",
                isActive && !isDisabled
                  ? "bg-primary text-primary-foreground"
                  : isDisabled
                    ? "bg-muted/30 text-muted-foreground/30 cursor-not-allowed"
                    : "bg-background text-foreground hover:bg-accent cursor-pointer"
              )}
            >
              {formatLabel ? formatLabel(opt) : `${prefix}${opt}`}
            </button>
          );
        })}
      </div>
    </div>
  );
};
