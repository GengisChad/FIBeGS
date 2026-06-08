import { useState } from "react";
import { Moon, Sun, Contrast, Palette, Check } from "lucide-react";
import { useTheme, themes } from "@/hooks/useTheme";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Variant = "light" | "mid" | "dark";

export const ThemeVariantToggle = () => {
  const { theme, currentTheme, setTheme } = useTheme();
  const variant = theme.variant as Variant;
  const [paletteOpen, setPaletteOpen] = useState(false);

  const switchTo = (target: Variant) => {
    if (target === variant) return;
    const baseId = theme.id.replace(/^(light|mid)-/, "");
    const targetId = target === "dark" ? baseId : `${target}-${baseId}`;
    const found = themes.find((t) => t.id === targetId)
      ?? themes.find((t) => t.variant === target);
    if (found) setTheme(found.id);
  };

  const options: { value: Variant; Icon: typeof Sun; label: string }[] = [
    { value: "light", Icon: Sun, label: "Tema chiaro" },
    { value: "mid", Icon: Contrast, label: "Tema mid" },
    { value: "dark", Icon: Moon, label: "Tema scuro" },
  ];

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Modalità tema"
        className="relative inline-flex items-center h-9 rounded-full bg-muted/60 border border-border p-0.5"
      >
        {options.map(({ value, Icon, label }) => {
          const active = variant === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={label}
              onClick={() => switchTo(value)}
              className={`relative z-10 flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={15} />
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Scegli palette colori"
          title="Palette colori"
          onClick={() => setPaletteOpen(true)}
          className="relative z-10 flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground transition-colors ml-0.5 border-l border-border/60"
        >
          <Palette size={15} />
        </button>
      </div>

      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-wider">Scegli la palette</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            {variant === "dark" ? "Stai vedendo le palette scure." : variant === "mid" ? "Stai vedendo le palette mid." : "Stai vedendo le palette chiare."}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {themes.filter((t) => t.variant === variant).map((t) => {
              const isActive = currentTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setPaletteOpen(false); }}
                  className={`relative rounded-xl border-2 p-3 transition-all text-left ${
                    isActive ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check size={12} className="text-primary-foreground" />
                    </div>
                  )}
                  <div className="flex gap-1.5 mb-2.5">
                    <div className="w-8 h-8 rounded-lg border border-black/10" style={{ backgroundColor: t.preview.bg }} />
                    <div className="w-8 h-8 rounded-lg border border-black/10" style={{ backgroundColor: t.preview.primary }} />
                    <div className="w-8 h-8 rounded-lg border border-black/10" style={{ backgroundColor: t.preview.card }} />
                    <div className="w-8 h-8 rounded-lg border border-black/10" style={{ backgroundColor: t.preview.accent }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{t.emoji}</span>
                    <span className="text-sm font-medium">{t.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
