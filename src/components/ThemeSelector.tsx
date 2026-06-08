import { useTheme, themes } from "@/hooks/useTheme";
import { Palette, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const ThemeSelector = () => {
  const { currentTheme, setTheme, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const variant = theme.variant;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Palette size={16} />
          Tema del sito
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wider">Scegli il tuo tema</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          {variant === "dark"
            ? "Stai vedendo i temi scuri."
            : variant === "mid"
            ? "Stai vedendo i temi mid (intermedi)."
            : "Stai vedendo i temi chiari."}{" "}
          Usa l'icona ☀️/◐/🌙 nella barra in alto per cambiare modalità.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {themes.filter((t) => t.variant === variant).map((t) => {
            const isActive = currentTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={`relative rounded-xl border-2 p-3 transition-all text-left ${
                  isActive
                    ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
                    : "border-border hover:border-muted-foreground/40"
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
  );
};
