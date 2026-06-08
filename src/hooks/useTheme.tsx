import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface ThemeDefinition {
  id: string;
  name: string;
  emoji: string;
  variant: "dark" | "light" | "mid";
  preview: { bg: string; primary: string; card: string; accent: string };
  vars: Record<string, string>;
}

/** Helper to build a light theme variant from an accent hue/sat/light triple */
function buildLightTheme(opts: {
  id: string;
  name: string;
  emoji: string;
  /** primary as "H S% L%" */
  primary: string;
  /** accent as "H S% L%" */
  accent: string;
  /** dark text on primary? */
  primaryFgDark?: boolean;
  /** preview hex */
  previewPrimary: string;
  previewAccent: string;
  /** gradient endpoints "H, S%, L%" pairs */
  gradFrom: string;
  gradTo: string;
}): ThemeDefinition {
  const [pH, pS, pL] = opts.primary.split(" ");
  return {
    id: opts.id,
    name: opts.name,
    emoji: opts.emoji,
    variant: "light",
    preview: { bg: "#f6f7f9", primary: opts.previewPrimary, card: "#ffffff", accent: opts.previewAccent },
    vars: {
      // Soft off-white background with a stronger blue undertone for more depth
      "--background": "220 28% 95%",
      "--foreground": "220 30% 10%",
      "--card": "0 0% 100%",
      "--card-foreground": "220 30% 10%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "220 30% 10%",
      "--primary": opts.primary,
      "--primary-foreground": opts.primaryFgDark ? "220 25% 12%" : "0 0% 100%",
      "--secondary": "220 22% 90%",
      "--secondary-foreground": "220 30% 14%",
      "--muted": "220 22% 88%",
      "--muted-foreground": "220 14% 36%",
      "--accent": opts.accent,
      "--accent-foreground": "220 25% 10%",
      "--destructive": "0 78% 50%",
      "--destructive-foreground": "0 0% 100%",
      "--border": "220 20% 82%",
      "--input": "220 20% 86%",
      "--ring": opts.primary,
      "--gradient-primary": `linear-gradient(135deg, hsl(${opts.gradFrom}) 0%, hsl(${opts.gradTo}) 100%)`,
      "--gradient-hero": "linear-gradient(180deg, hsl(220 28% 95%) 0%, hsl(220 32% 88%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(0 0% 100%) 0%, hsl(220 28% 93%) 100%)",
      "--glow-primary": `0 12px 48px hsl(${pH} ${pS} ${pL} / 0.4)`,
      "--shadow-card": "0 6px 12px -2px hsl(220 30% 18% / 0.12), 0 16px 40px -10px hsl(220 30% 18% / 0.22)",
    },
  };
}

/** Helper to build a "mid" theme: balanced between light and dark — slate/graphite surfaces */
function buildMidTheme(opts: {
  id: string;
  name: string;
  emoji: string;
  primary: string;
  accent: string;
  primaryFgDark?: boolean;
  previewPrimary: string;
  previewAccent: string;
  gradFrom: string;
  gradTo: string;
}): ThemeDefinition {
  const [pH, pS, pL] = opts.primary.split(" ");
  return {
    id: opts.id,
    name: opts.name,
    emoji: opts.emoji,
    variant: "mid",
    preview: { bg: "#3a4150", primary: opts.previewPrimary, card: "#454d5e", accent: opts.previewAccent },
    vars: {
      "--background": "220 14% 26%",
      "--foreground": "220 15% 95%",
      "--card": "220 14% 30%",
      "--card-foreground": "220 15% 95%",
      "--popover": "220 14% 30%",
      "--popover-foreground": "220 15% 95%",
      "--primary": opts.primary,
      "--primary-foreground": opts.primaryFgDark ? "220 20% 10%" : "0 0% 100%",
      "--secondary": "220 12% 34%",
      "--secondary-foreground": "220 15% 95%",
      "--muted": "220 12% 36%",
      "--muted-foreground": "220 10% 72%",
      "--accent": opts.accent,
      "--accent-foreground": "220 15% 95%",
      "--destructive": "0 80% 58%",
      "--destructive-foreground": "0 0% 100%",
      "--border": "220 12% 40%",
      "--input": "220 12% 38%",
      "--ring": opts.primary,
      "--gradient-primary": `linear-gradient(135deg, hsl(${opts.gradFrom}) 0%, hsl(${opts.gradTo}) 100%)`,
      "--gradient-hero": "linear-gradient(180deg, hsl(220 14% 26%) 0%, hsl(220 16% 20%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220 14% 32%) 0%, hsl(220 14% 26%) 100%)",
      "--glow-primary": `0 0 40px hsl(${pH} ${pS} ${pL} / 0.35)`,
      "--shadow-card": "0 8px 28px hsl(220 30% 8% / 0.45)",
    },
  };
}

export const themes: ThemeDefinition[] = [
  {
    id: "default",
    name: "Lime Einstein",
    emoji: "⚡",
    variant: "dark",
    preview: { bg: "#050607", primary: "#b8e636", card: "#0b0f12", accent: "#b8e636" },
    vars: {
      "--background": "210 22% 3%",
      "--foreground": "0 0% 98%",
      "--card": "210 18% 7%",
      "--card-foreground": "0 0% 98%",
      "--popover": "210 18% 6%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "83 78% 55%",
      "--primary-foreground": "224 71% 4%",
      "--secondary": "210 15% 11%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "210 14% 12%",
      "--muted-foreground": "84 10% 62%",
      "--accent": "83 78% 55%",
      "--accent-foreground": "210 22% 3%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "210 12% 16%",
      "--input": "210 12% 16%",
      "--ring": "83 78% 55%",
      "--neon-1": "83 78% 55%",
      "--neon-2": "83 78% 55%",
      "--gradient-primary": "linear-gradient(135deg, hsl(83, 78%, 55%) 0%, hsl(90, 80%, 65%) 100%)",
      "--gradient-hero": "radial-gradient(ellipse at 25% 0%, hsl(83 78% 55% / 0.16), transparent 52%), linear-gradient(180deg, hsl(210 22% 3%) 0%, hsl(210 24% 2%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(210 18% 8%) 0%, hsl(210 22% 4%) 100%)",
      "--glow-primary": "0 0 42px hsl(83 78% 55% / 0.34)",
      "--shadow-card": "0 18px 48px hsl(0 0% 0% / 0.56)",
    },
  },
  {
    id: "ocean",
    name: "Blue Dranzer",
    emoji: "🌊",
    variant: "dark",
    preview: { bg: "#0f1114", primary: "#3b82f6", card: "#171b21", accent: "#34d399" },
    vars: {
      "--background": "220 20% 6%",
      "--foreground": "0 0% 98%",
      "--card": "220 18% 10%",
      "--card-foreground": "0 0% 98%",
      "--popover": "220 18% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "217 91% 60%",
      "--primary-foreground": "0 0% 98%",
      "--secondary": "220 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 15% 18%",
      "--muted-foreground": "220 10% 60%",
      "--accent": "160 72% 52%",
      "--accent-foreground": "220 20% 6%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "220 15% 20%",
      "--input": "220 15% 20%",
      "--ring": "217 91% 60%",
      "--gradient-primary": "linear-gradient(135deg, hsl(217, 91%, 50%) 0%, hsl(199, 89%, 48%) 100%)",
      "--gradient-hero": "linear-gradient(180deg, hsl(220, 20%, 6%) 0%, hsl(220, 25%, 12%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220, 18%, 12%) 0%, hsl(220, 18%, 8%) 100%)",
      "--glow-primary": "0 0 40px hsl(217 91% 60% / 0.3)",
      "--shadow-card": "0 8px 32px hsl(0 0% 0% / 0.4)",
    },
  },
  {
    id: "crimson",
    name: "Red Gazzly",
    emoji: "🔥",
    variant: "dark",
    preview: { bg: "#0f1114", primary: "#ef4444", card: "#171b21", accent: "#4ade80" },
    vars: {
      "--background": "220 20% 6%",
      "--foreground": "0 0% 98%",
      "--card": "220 18% 10%",
      "--card-foreground": "0 0% 98%",
      "--popover": "220 18% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "0 84% 60%",
      "--primary-foreground": "0 0% 98%",
      "--secondary": "220 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 15% 18%",
      "--muted-foreground": "220 10% 60%",
      "--accent": "142 71% 55%",
      "--accent-foreground": "220 20% 6%",
      "--destructive": "30 90% 55%",
      "--destructive-foreground": "0 0% 98%",
      "--border": "220 15% 20%",
      "--input": "220 15% 20%",
      "--ring": "0 84% 60%",
      "--gradient-primary": "linear-gradient(135deg, hsl(0, 84%, 55%) 0%, hsl(15, 90%, 60%) 100%)",
      "--gradient-hero": "linear-gradient(180deg, hsl(220, 20%, 6%) 0%, hsl(220, 25%, 12%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220, 18%, 12%) 0%, hsl(220, 18%, 8%) 100%)",
      "--glow-primary": "0 0 40px hsl(0 84% 55% / 0.3)",
      "--shadow-card": "0 8px 32px hsl(0 0% 0% / 0.4)",
    },
  },
  {
    id: "gold",
    name: "Zeus Gold",
    emoji: "🏆",
    variant: "dark",
    preview: { bg: "#0f1114", primary: "#eab308", card: "#171b21", accent: "#4ade80" },
    vars: {
      "--background": "220 20% 6%",
      "--foreground": "0 0% 98%",
      "--card": "220 18% 10%",
      "--card-foreground": "0 0% 98%",
      "--popover": "220 18% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "48 96% 53%",
      "--primary-foreground": "220 20% 6%",
      "--secondary": "220 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 15% 18%",
      "--muted-foreground": "220 10% 60%",
      "--accent": "142 71% 55%",
      "--accent-foreground": "220 20% 6%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "220 15% 20%",
      "--input": "220 15% 20%",
      "--ring": "48 96% 53%",
      "--gradient-primary": "linear-gradient(135deg, hsl(45, 93%, 47%) 0%, hsl(36, 100%, 55%) 100%)",
      "--gradient-hero": "linear-gradient(180deg, hsl(220, 20%, 6%) 0%, hsl(220, 25%, 12%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220, 18%, 12%) 0%, hsl(220, 18%, 8%) 100%)",
      "--glow-primary": "0 0 40px hsl(48 96% 53% / 0.3)",
      "--shadow-card": "0 8px 32px hsl(0 0% 0% / 0.4)",
    },
  },
  {
    id: "violet",
    name: "Galman Purple",
    emoji: "💜",
    variant: "dark",
    preview: { bg: "#0f1114", primary: "#a855f7", card: "#171b21", accent: "#34d399" },
    vars: {
      "--background": "220 20% 6%",
      "--foreground": "0 0% 98%",
      "--card": "220 18% 10%",
      "--card-foreground": "0 0% 98%",
      "--popover": "220 18% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "271 81% 65%",
      "--primary-foreground": "0 0% 98%",
      "--secondary": "220 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 15% 18%",
      "--muted-foreground": "220 10% 60%",
      "--accent": "160 72% 52%",
      "--accent-foreground": "220 20% 6%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "220 15% 20%",
      "--input": "220 15% 20%",
      "--ring": "271 81% 65%",
      "--gradient-primary": "linear-gradient(135deg, hsl(271, 81%, 56%) 0%, hsl(290, 80%, 65%) 100%)",
      "--gradient-hero": "linear-gradient(180deg, hsl(220, 20%, 6%) 0%, hsl(220, 25%, 12%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220, 18%, 12%) 0%, hsl(220, 18%, 8%) 100%)",
      "--glow-primary": "0 0 40px hsl(271 81% 56% / 0.3)",
      "--shadow-card": "0 8px 32px hsl(0 0% 0% / 0.4)",
    },
  },
  {
    id: "emerald",
    name: "Emerald Forest",
    emoji: "🌿",
    variant: "dark",
    preview: { bg: "#0f1114", primary: "#10b981", card: "#171b21", accent: "#4ade80" },
    vars: {
      "--background": "220 20% 6%",
      "--foreground": "0 0% 98%",
      "--card": "220 18% 10%",
      "--card-foreground": "0 0% 98%",
      "--popover": "220 18% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "160 84% 39%",
      "--primary-foreground": "0 0% 98%",
      "--secondary": "220 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 15% 18%",
      "--muted-foreground": "220 10% 60%",
      "--accent": "142 71% 55%",
      "--accent-foreground": "220 20% 6%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "220 15% 20%",
      "--input": "220 15% 20%",
      "--ring": "160 84% 39%",
      "--gradient-primary": "linear-gradient(135deg, hsl(160, 84%, 35%) 0%, hsl(145, 65%, 45%) 100%)",
      "--gradient-hero": "linear-gradient(180deg, hsl(220, 20%, 6%) 0%, hsl(220, 25%, 12%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220, 18%, 12%) 0%, hsl(220, 18%, 8%) 100%)",
      "--glow-primary": "0 0 40px hsl(160 84% 39% / 0.3)",
      "--shadow-card": "0 8px 32px hsl(0 0% 0% / 0.4)",
    },
  },
  {
    id: "rose",
    name: "Galux Pink",
    emoji: "🌸",
    variant: "dark",
    preview: { bg: "#0f1114", primary: "#f472b6", card: "#171b21", accent: "#34d399" },
    vars: {
      "--background": "220 20% 6%",
      "--foreground": "0 0% 98%",
      "--card": "220 18% 10%",
      "--card-foreground": "0 0% 98%",
      "--popover": "220 18% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "330 81% 71%",
      "--primary-foreground": "220 20% 6%",
      "--secondary": "220 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 15% 18%",
      "--muted-foreground": "220 10% 60%",
      "--accent": "160 72% 52%",
      "--accent-foreground": "220 20% 6%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "220 15% 20%",
      "--input": "220 15% 20%",
      "--ring": "330 81% 71%",
      "--gradient-primary": "linear-gradient(135deg, hsl(330, 81%, 65%) 0%, hsl(350, 80%, 72%) 100%)",
      "--gradient-hero": "linear-gradient(180deg, hsl(220, 20%, 6%) 0%, hsl(220, 25%, 12%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220, 18%, 12%) 0%, hsl(220, 18%, 8%) 100%)",
      "--glow-primary": "0 0 40px hsl(330 81% 65% / 0.3)",
      "--shadow-card": "0 8px 32px hsl(0 0% 0% / 0.4)",
    },
  },
  {
    id: "cyan",
    name: "Cyan Poseidon",
    emoji: "❄️",
    variant: "dark",
    preview: { bg: "#0f1114", primary: "#22d3ee", card: "#171b21", accent: "#4ade80" },
    vars: {
      "--background": "220 20% 6%",
      "--foreground": "0 0% 98%",
      "--card": "220 18% 10%",
      "--card-foreground": "0 0% 98%",
      "--popover": "220 18% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "188 94% 53%",
      "--primary-foreground": "220 20% 6%",
      "--secondary": "220 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 15% 18%",
      "--muted-foreground": "220 10% 60%",
      "--accent": "142 71% 55%",
      "--accent-foreground": "220 20% 6%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "220 15% 20%",
      "--input": "220 15% 20%",
      "--ring": "188 94% 53%",
      "--gradient-primary": "linear-gradient(135deg, hsl(188, 94%, 45%) 0%, hsl(175, 80%, 50%) 100%)",
      "--gradient-hero": "linear-gradient(180deg, hsl(220, 20%, 6%) 0%, hsl(220, 25%, 12%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220, 18%, 12%) 0%, hsl(220, 18%, 8%) 100%)",
      "--glow-primary": "0 0 40px hsl(188 94% 53% / 0.3)",
      "--shadow-card": "0 8px 32px hsl(0 0% 0% / 0.4)",
    },
  },
  {
    id: "sunset",
    name: "Sunset Blaze",
    emoji: "🌅",
    variant: "dark",
    preview: { bg: "#0f1114", primary: "#fb923c", card: "#171b21", accent: "#34d399" },
    vars: {
      "--background": "220 20% 6%",
      "--foreground": "0 0% 98%",
      "--card": "220 18% 10%",
      "--card-foreground": "0 0% 98%",
      "--popover": "220 18% 10%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "27 96% 61%",
      "--primary-foreground": "220 20% 6%",
      "--secondary": "220 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 15% 18%",
      "--muted-foreground": "220 10% 60%",
      "--accent": "160 72% 52%",
      "--accent-foreground": "220 20% 6%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "220 15% 20%",
      "--input": "220 15% 20%",
      "--ring": "27 96% 61%",
      "--gradient-primary": "linear-gradient(135deg, hsl(27, 96%, 55%) 0%, hsl(15, 90%, 60%) 100%)",
      "--gradient-hero": "linear-gradient(180deg, hsl(220, 20%, 6%) 0%, hsl(220, 25%, 12%) 100%)",
      "--gradient-card": "linear-gradient(145deg, hsl(220, 18%, 12%) 0%, hsl(220, 18%, 8%) 100%)",
      "--glow-primary": "0 0 40px hsl(27 96% 55% / 0.3)",
      "--shadow-card": "0 8px 32px hsl(0 0% 0% / 0.4)",
    },
  },
  // ===== LIGHT THEMES =====
  buildLightTheme({
    id: "light-default",
    name: "Lime Einstein",
    emoji: "⚡",
    primary: "83 70% 42%",
    accent: "83 70% 42%",
    primaryFgDark: false,
    previewPrimary: "#7fb928",
    previewAccent: "#7fb928",
    gradFrom: "83 70% 42%",
    gradTo: "95 75% 50%",
  }),
  buildLightTheme({
    id: "light-ocean",
    name: "Blue Dranzer",
    emoji: "🌊",
    primary: "217 91% 52%",
    accent: "160 70% 42%",
    previewPrimary: "#2563eb",
    previewAccent: "#10b981",
    gradFrom: "217 91% 52%",
    gradTo: "199 89% 48%",
  }),
  buildLightTheme({
    id: "light-crimson",
    name: "Red Gazzly",
    emoji: "🔥",
    primary: "0 75% 52%",
    accent: "142 65% 42%",
    previewPrimary: "#dc2626",
    previewAccent: "#16a34a",
    gradFrom: "0 75% 52%",
    gradTo: "15 85% 56%",
  }),
  buildLightTheme({
    id: "light-gold",
    name: "Zeus Gold",
    emoji: "🏆",
    primary: "38 92% 48%",
    accent: "142 65% 42%",
    primaryFgDark: true,
    previewPrimary: "#eab308",
    previewAccent: "#16a34a",
    gradFrom: "38 92% 48%",
    gradTo: "30 95% 55%",
  }),
  buildLightTheme({
    id: "light-violet",
    name: "Galman Purple",
    emoji: "💜",
    primary: "271 76% 56%",
    accent: "160 70% 42%",
    previewPrimary: "#9333ea",
    previewAccent: "#10b981",
    gradFrom: "271 76% 56%",
    gradTo: "290 75% 60%",
  }),
  buildLightTheme({
    id: "light-emerald",
    name: "Emerald Forest",
    emoji: "🌿",
    primary: "160 78% 36%",
    accent: "142 65% 42%",
    previewPrimary: "#0d9268",
    previewAccent: "#16a34a",
    gradFrom: "160 78% 36%",
    gradTo: "145 65% 42%",
  }),
  buildLightTheme({
    id: "light-rose",
    name: "Galux Pink",
    emoji: "🌸",
    primary: "330 75% 58%",
    accent: "160 70% 42%",
    previewPrimary: "#e84393",
    previewAccent: "#10b981",
    gradFrom: "330 75% 58%",
    gradTo: "350 78% 65%",
  }),
  buildLightTheme({
    id: "light-cyan",
    name: "Cyan Poseidon",
    emoji: "❄️",
    primary: "188 85% 42%",
    accent: "142 65% 42%",
    previewPrimary: "#0891b2",
    previewAccent: "#16a34a",
    gradFrom: "188 85% 42%",
    gradTo: "175 75% 45%",
  }),
  buildLightTheme({
    id: "light-sunset",
    name: "Sunset Blaze",
    emoji: "🌅",
    primary: "20 90% 52%",
    accent: "160 70% 42%",
    previewPrimary: "#ea580c",
    previewAccent: "#10b981",
    gradFrom: "20 90% 52%",
    gradTo: "10 88% 55%",
  }),
  // ===== MID THEMES (slate / graphite — between light and dark) =====
  buildMidTheme({
    id: "mid-default", name: "Lime Einstein", emoji: "⚡",
    primary: "83 75% 52%", accent: "83 75% 52%", primaryFgDark: true,
    previewPrimary: "#a3d629", previewAccent: "#a3d629",
    gradFrom: "83 75% 52%", gradTo: "95 78% 60%",
  }),
  buildMidTheme({
    id: "mid-ocean", name: "Blue Dranzer", emoji: "🌊",
    primary: "217 88% 62%", accent: "160 68% 50%",
    previewPrimary: "#3b82f6", previewAccent: "#22c4a0",
    gradFrom: "217 88% 55%", gradTo: "199 85% 52%",
  }),
  buildMidTheme({
    id: "mid-crimson", name: "Red Gazzly", emoji: "🔥",
    primary: "0 80% 60%", accent: "142 65% 55%",
    previewPrimary: "#ef4444", previewAccent: "#34d27a",
    gradFrom: "0 80% 56%", gradTo: "15 85% 60%",
  }),
  buildMidTheme({
    id: "mid-gold", name: "Zeus Gold", emoji: "🏆",
    primary: "45 95% 55%", accent: "142 65% 55%", primaryFgDark: true,
    previewPrimary: "#eab308", previewAccent: "#34d27a",
    gradFrom: "45 95% 50%", gradTo: "32 95% 58%",
  }),
  buildMidTheme({
    id: "mid-violet", name: "Galman Purple", emoji: "💜",
    primary: "271 78% 65%", accent: "160 68% 50%",
    previewPrimary: "#a855f7", previewAccent: "#22c4a0",
    gradFrom: "271 78% 58%", gradTo: "290 75% 65%",
  }),
  buildMidTheme({
    id: "mid-emerald", name: "Emerald Forest", emoji: "🌿",
    primary: "160 78% 45%", accent: "142 65% 55%",
    previewPrimary: "#10b981", previewAccent: "#34d27a",
    gradFrom: "160 78% 40%", gradTo: "145 70% 48%",
  }),
  buildMidTheme({
    id: "mid-rose", name: "Galux Pink", emoji: "🌸",
    primary: "330 78% 68%", accent: "160 68% 50%", primaryFgDark: true,
    previewPrimary: "#f472b6", previewAccent: "#22c4a0",
    gradFrom: "330 78% 62%", gradTo: "350 78% 70%",
  }),
  buildMidTheme({
    id: "mid-cyan", name: "Cyan Poseidon", emoji: "❄️",
    primary: "188 90% 52%", accent: "142 65% 55%", primaryFgDark: true,
    previewPrimary: "#22d3ee", previewAccent: "#34d27a",
    gradFrom: "188 90% 46%", gradTo: "175 78% 50%",
  }),
  buildMidTheme({
    id: "mid-sunset", name: "Sunset Blaze", emoji: "🌅",
    primary: "25 92% 58%", accent: "160 68% 50%", primaryFgDark: true,
    previewPrimary: "#fb923c", previewAccent: "#22c4a0",
    gradFrom: "25 92% 54%", gradTo: "12 90% 60%",
  }),
];
interface ThemeContextType {
  currentTheme: string;
  setTheme: (id: string) => void;
  theme: ThemeDefinition;
  toggleVariant: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: "default",
  setTheme: () => {},
  theme: themes[0],
  toggleVariant: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function applyTheme(theme: ThemeDefinition) {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value, "important");
  });
  // Update html background color for safe-area
  const bgParts = theme.vars["--background"].split(" ");
  if (bgParts.length === 3) {
    root.style.setProperty(
      "background-color",
      `hsl(${bgParts[0]}, ${bgParts[1]}, ${bgParts[2]})`,
      "important"
    );
  }
  // Toggle theme variant classes + native color-scheme so form controls/scrollbars adapt
  root.classList.toggle("theme-light", theme.variant === "light");
  root.classList.toggle("theme-mid", theme.variant === "mid");
  root.classList.toggle("theme-dark", theme.variant === "dark");
  root.style.setProperty("color-scheme", theme.variant === "light" ? "light" : "dark");
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem("ibna-theme") || "default";
  });

  const theme = themes.find((t) => t.id === currentTheme) || themes[0];

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setThemeAndSave = (id: string) => {
    localStorage.setItem("ibna-theme", id);
    setCurrentTheme(id);
  };

  const toggleVariant = () => {
    const current = theme;
    // Cycle: light → mid → dark → light
    const order: Array<"light" | "mid" | "dark"> = ["light", "mid", "dark"];
    const idx = order.indexOf(current.variant);
    const targetVariant = order[(idx + 1) % order.length];
    // Strip any variant prefix to get the base id
    const baseId = current.id.replace(/^(light|mid)-/, "");
    const targetId =
      targetVariant === "dark" ? baseId : `${targetVariant}-${baseId}`;
    const targetTheme = themes.find((t) => t.id === targetId);
    if (targetTheme) {
      setThemeAndSave(targetTheme.id);
    } else {
      const fallback = themes.find((t) => t.variant === targetVariant);
      if (fallback) setThemeAndSave(fallback.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme: setThemeAndSave, theme, toggleVariant }}>
      {children}
    </ThemeContext.Provider>
  );
};
