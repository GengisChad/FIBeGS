import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Wand2, Play, Pause, Download, Loader2, Palette, Film, Sparkles, Layout, Zap } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import ibnaLogo from "@/assets/logo.png";
import { ComponentPicker, type ComponentSelection } from "@/components/decks/ComponentPicker";
import { BLADE_TYPES, getComponentFields, type BladeType } from "@/components/decks/DeckCreatorDialog";

type Player = {
  user_id: string;
  name: string;
  avatar: string | null;
  placement: 1 | 2 | 3;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  top3: Player[];
  standings: any[];
  playerMap: Map<string, string>;
  avatarMap: Map<string, string | null>;
  tournamentId: string;
  tournamentTitle: string;
  tournamentDate: string;
  club: { id: string; name: string; logo_url?: string | null; banner_url?: string | null } | null;
  isRanked?: boolean;
  participantCount: number;
}

type Theme = [string, string, string]; // [primary, dark bg, accent]
const PRESETS: { name: string; colors: Theme }[] = [
  { name: "FIBeGS",     colors: ["#f59e0b", "#0a0f1d", "#ffd166"] },
  { name: "Vulcano",  colors: ["#dc2626", "#1a0a0a", "#fbbf24"] },
  { name: "Cyber",    colors: ["#a855f7", "#0b0b1f", "#22d3ee"] },
  { name: "Foresta",  colors: ["#16a34a", "#0a1a12", "#fde047"] },
  { name: "Oceano",   colors: ["#0ea5e9", "#06121e", "#67e8f9"] },
  { name: "Oro Nero", colors: ["#facc15", "#080808", "#ffffff"] },
  { name: "Neon Mint",colors: ["#2dd4bf", "#04130f", "#f472b6"] },
  { name: "Crimson",  colors: ["#f43f5e", "#0a0006", "#fde047"] },
];

type Pattern = "grid" | "diagonals" | "dots" | "noise" | "circuit" | "none";
type LayoutKind = "split" | "centered" | "diagonal";
type StingerKind = "xcross" | "panels" | "iris" | "shutter" | "slash";

const PATTERNS: { id: Pattern; name: string }[] = [
  { id: "grid", name: "Griglia" },
  { id: "diagonals", name: "Diagonali" },
  { id: "dots", name: "Punti" },
  { id: "circuit", name: "Circuit" },
  { id: "noise", name: "Noise" },
  { id: "none", name: "Pulito" },
];
const LAYOUTS: { id: LayoutKind; name: string }[] = [
  { id: "split", name: "Split 9:16" },
  { id: "centered", name: "Centrato" },
  { id: "diagonal", name: "Diagonale" },
];
const STINGERS: { id: StingerKind; name: string }[] = [
  { id: "xcross", name: "X Cross" },
  { id: "panels", name: "Pannelli" },
  { id: "iris", name: "Iris" },
  { id: "shutter", name: "Shutter" },
  { id: "slash", name: "Slash" },
];

const CANVAS_W = 1080;
const CANVAS_H = 1080;
const FPS = 30;

type ComponentInfo = { id: string; name: string; image_url: string | null };
type Bey = { id: string; name: string; components: ComponentInfo[]; blade_type?: BladeType; ratchet_type?: "ratchet" | "ribs"; componentSelections?: Record<string, ComponentSelection | null> };
type PlayerDeck = { deckName: string; beys: Bey[] };

interface PlayerAsset {
  photo: HTMLImageElement | null;
  rawDataUrl: string | null;
  deck: PlayerDeck | null;
  componentImgs: Record<string, HTMLImageElement | null>;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

const loadImageSafe = async (src: string | null | undefined): Promise<HTMLImageElement | null> => {
  if (!src) return null;
  try { return await loadImage(src); } catch { return null; }
};

// ---- Background removal (lazy CDN import, with timeout & abort safety) ----
let _bgRemovalPromise: Promise<any> | null = null;
const loadBgRemoval = (): Promise<any> => {
  if (_bgRemovalPromise) return _bgRemovalPromise;
  const url = "https://esm.sh/@imgly/background-removal@1.6.0?bundle";
  _bgRemovalPromise = (new Function("u", "return import(u)") as any)(url)
    .catch((err: any) => { _bgRemovalPromise = null; throw err; });
  return _bgRemovalPromise;
};

const removeBgWithTimeout = async (dataUrl: string): Promise<string> => {
  const mod: any = await Promise.race([
    loadBgRemoval(),
    new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout caricamento modello AI (60s)")), 60000)),
  ]);
  const removeBackground = mod.default || mod.removeBackground || mod;
  const blob: Blob = await Promise.race([
    removeBackground(dataUrl),
    new Promise<Blob>((_, rej) => setTimeout(() => rej(new Error("Timeout rimozione sfondo (90s)")), 90000)),
  ]);
  return URL.createObjectURL(blob);
};

// ============= Color extraction from logo =============
const extractThemeFromLogo = async (logoUrl: string): Promise<Theme | null> => {
  try {
    const img = await loadImage(logoUrl);
    const size = 64;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const buckets: Record<number, { r: number; g: number; b: number; n: number }> = {};
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 180) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 25) continue;
      if (max < 40) continue;
      const key = Math.round(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5));
      const e = buckets[key] || (buckets[key] = { r: 0, g: 0, b: 0, n: 0 });
      e.r += r; e.g += g; e.b += b; e.n++;
    }
    const sorted = Object.values(buckets).sort((a, x) => x.n - a.n);
    if (sorted.length === 0) return null;
    const top = sorted[0];
    const primary = `rgb(${Math.round(top.r/top.n)},${Math.round(top.g/top.n)},${Math.round(top.b/top.n)})`;
    const accent = sorted[1]
      ? `rgb(${Math.round(sorted[1].r/sorted[1].n)},${Math.round(sorted[1].g/sorted[1].n)},${Math.round(sorted[1].b/sorted[1].n)})`
      : "#ffffff";
    return [primary, "#070b14", accent];
  } catch { return null; }
};

// ============= Drawing helpers =============
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

const withAlpha = (color: string, alpha: number): string => {
  if (typeof color !== "string") return `rgba(0,0,0,${alpha})`;
  const c = color.trim();
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split("").map((h) => h + h).join("");
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  const m = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
  return c;
};

const drawPattern = (ctx: CanvasRenderingContext2D, pattern: Pattern, theme: Theme, frame: number) => {
  const [p, , acc] = theme;
  ctx.save();
  if (pattern === "grid") {
    ctx.strokeStyle = withAlpha(p, 0.08);
    ctx.lineWidth = 1;
    const step = 60;
    const off = (frame * 0.5) % step;
    for (let x = -off; x < CANVAS_W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
    for (let y = -off; y < CANVAS_H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }
  } else if (pattern === "diagonals") {
    ctx.strokeStyle = withAlpha(acc, 0.07);
    ctx.lineWidth = 2;
    const step = 40;
    const off = (frame * 0.6) % step;
    for (let i = -CANVAS_H; i < CANVAS_W + CANVAS_H; i += step) {
      ctx.beginPath(); ctx.moveTo(i - off, 0); ctx.lineTo(i + CANVAS_H - off, CANVAS_H); ctx.stroke();
    }
  } else if (pattern === "dots") {
    ctx.fillStyle = withAlpha(p, 0.18);
    const step = 32;
    const off = (frame * 0.3) % step;
    for (let y = -off; y < CANVAS_H; y += step) {
      for (let x = -off; x < CANVAS_W; x += step) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (pattern === "circuit") {
    ctx.strokeStyle = withAlpha(acc, 0.12);
    ctx.lineWidth = 1.5;
    const seed = (n: number) => Math.sin(n * 12.9898) * 43758.5453 % 1;
    for (let i = 0; i < 28; i++) {
      const sx = Math.abs(seed(i)) * CANVAS_W;
      const sy = Math.abs(seed(i + 100)) * CANVAS_H;
      const len = 80 + Math.abs(seed(i + 200)) * 220;
      const dir = Math.floor(Math.abs(seed(i + 300)) * 4);
      ctx.beginPath(); ctx.moveTo(sx, sy);
      if (dir === 0) { ctx.lineTo(sx + len, sy); ctx.lineTo(sx + len, sy + len / 2); }
      else if (dir === 1) { ctx.lineTo(sx, sy + len); ctx.lineTo(sx + len / 2, sy + len); }
      else if (dir === 2) { ctx.lineTo(sx - len, sy); ctx.lineTo(sx - len, sy - len / 2); }
      else { ctx.lineTo(sx, sy - len); ctx.lineTo(sx - len / 2, sy - len); }
      ctx.stroke();
      ctx.fillStyle = withAlpha(p, 0.4);
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (pattern === "noise") {
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let i = 0; i < 600; i++) {
      const x = (Math.sin(i * 1.3 + frame * 0.05) * 0.5 + 0.5) * CANVAS_W;
      const y = (Math.cos(i * 2.1 + frame * 0.07) * 0.5 + 0.5) * CANVAS_H;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.restore();
};

const drawBg = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  frame: number,
  pattern: Pattern,
  effects: { scanlines: boolean; vignette: boolean; glow: boolean },
) => {
  const [p, dark, acc] = theme;
  const g = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  g.addColorStop(0, dark);
  g.addColorStop(1, "#000");
  ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawPattern(ctx, pattern, theme, frame);

  if (effects.glow) {
    const t = (frame * 0.012) % (Math.PI * 2);
    const cx = CANVAS_W / 2 + Math.cos(t) * 100;
    const cy = CANVAS_H / 2 + Math.sin(t) * 80;
    const rg = ctx.createRadialGradient(cx, cy, 50, cx, cy, 700);
    rg.addColorStop(0, withAlpha(p, 0.22));
    rg.addColorStop(0.5, withAlpha(acc, 0.07));
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  if (effects.scanlines) {
    ctx.fillStyle = "rgba(255,255,255,0.022)";
    for (let y = 0; y < CANVAS_H; y += 4) ctx.fillRect(0, y, CANVAS_W, 1);
  }

  if (effects.vignette) {
    const vg = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.25, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
};

const drawCircleImg = (
  ctx: CanvasRenderingContext2D, img: HTMLImageElement | null,
  cx: number, cy: number, r: number, ring: string,
) => {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
  ctx.clip();
  if (img) {
    const ar = img.width / img.height;
    let dw = r * 2, dh = r * 2;
    if (ar > 1) dw = r * 2 * ar; else dh = r * 2 / ar;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "#222"; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 4; ctx.strokeStyle = ring;
  ctx.shadowBlur = 22; ctx.shadowColor = ring;
  ctx.stroke();
  ctx.shadowBlur = 0;
};

const drawText = (
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number,
  opts: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; font?: string } = {},
) => {
  const { size = 32, weight = 700, color = "#fff", align = "center", baseline = "alphabetic", font = "Inter, system-ui, sans-serif" } = opts;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
};

// Fit text into a maxWidth by shrinking font size
const fitText = (
  ctx: CanvasRenderingContext2D, text: string, maxW: number,
  baseSize: number, weight = 900, minSize = 18, font = "Inter, system-ui, sans-serif",
) => {
  let size = baseSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${font}`;
    if (ctx.measureText(text).width <= maxW) return size;
    size -= 2;
  }
  return minSize;
};

// Corner brackets — aggressive frame
const drawCornerBrackets = (
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  size: number, thickness: number, color: string,
) => {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.lineCap = "square";
  ctx.shadowBlur = 14; ctx.shadowColor = color;
  // TL
  ctx.beginPath(); ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(x + w - size, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + size); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(x + w, y + h - size); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - size, y + h); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(x + size, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - size); ctx.stroke();
  ctx.restore();
};

// 9:16 framed photo with neon dividers
const drawPortrait916 = (
  ctx: CanvasRenderingContext2D, img: HTMLImageElement | null,
  x: number, y: number, w: number, h: number, color: string, accent: string,
) => {
  ctx.save();
  // outer frame plate
  roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 6);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fill();

  // clip
  ctx.save();
  roundRect(ctx, x, y, w, h, 2); ctx.clip();
  if (img) {
    const ar = img.width / img.height;
    const target = w / h;
    let dw = w, dh = h, dx = x, dy = y;
    if (ar > target) { dh = h; dw = h * ar; dx = x - (dw - w) / 2; }
    else { dw = w; dh = w / ar; dy = y - (dh - h) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "rgba(30,30,40,0.9)"); g.addColorStop(1, "rgba(10,10,18,0.95)");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = withAlpha(color, 0.18);
    ctx.font = "900 120px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("?", x + w / 2, y + h / 2);
  }
  // bottom gradient overlay for text legibility
  const og = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
  og.addColorStop(0, "rgba(0,0,0,0)"); og.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = og; ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
  ctx.restore();

  // Neon side dividers
  ctx.save();
  ctx.shadowBlur = 18; ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillRect(x - 14, y, 3, h);
  ctx.fillRect(x + w + 11, y, 3, h);
  ctx.shadowColor = accent;
  ctx.fillStyle = accent;
  ctx.fillRect(x - 22, y + h * 0.2, 2, h * 0.6);
  ctx.fillRect(x + w + 20, y + h * 0.2, 2, h * 0.6);
  ctx.restore();

  // Corner brackets
  drawCornerBrackets(ctx, x - 4, y - 4, w + 8, h + 8, 28, 3, color);
  ctx.restore();
};

// Vertical bey component stack (right side)
const drawBeyStackVertical = (
  ctx: CanvasRenderingContext2D, bey: Bey | null, imgs: Record<string, HTMLImageElement | null>,
  x: number, y: number, w: number, h: number, theme: Theme, beyLocalT: number,
) => {
  const [p, , acc] = theme;
  const compN = bey ? bey.components.length : 3;
  const gap = 12;
  const tileH = (h - gap * (compN - 1)) / compN;

  // Background spine
  ctx.save();
  ctx.fillStyle = withAlpha(p, 0.04);
  roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 14); ctx.fill();
  ctx.strokeStyle = withAlpha(p, 0.4); ctx.lineWidth = 1.5;
  roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 14); ctx.stroke();
  ctx.restore();

  for (let i = 0; i < compN; i++) {
    const ty = y + i * (tileH + gap);
    const cmp = bey?.components[i];
    const delay = i * 0.07;
    const a = clamp01((beyLocalT - delay) / 0.35);
    const ea = easeOutExpo(a);
    const ox = (1 - ea) * 80;

    ctx.save();
    ctx.globalAlpha = ea;
    // tile
    roundRect(ctx, x + ox, ty, w, tileH, 10);
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fill();
    ctx.strokeStyle = withAlpha(acc, 0.55); ctx.lineWidth = 2; ctx.stroke();

    // accent corner cut (diagonal)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + ox + w - 24, ty);
    ctx.lineTo(x + ox + w, ty);
    ctx.lineTo(x + ox + w, ty + 24);
    ctx.closePath();
    ctx.fillStyle = p; ctx.fill();
    ctx.restore();

    // image
    const innerPad = 10;
    const imgArea = tileH - innerPad * 2;
    const img = cmp ? imgs[cmp.id] : null;
    if (img) {
      const ar = img.width / img.height;
      let iw = imgArea, ih = imgArea;
      if (ar > 1) ih = imgArea / ar; else iw = imgArea * ar;
      ctx.drawImage(img, x + ox + innerPad + (imgArea - iw) / 2, ty + innerPad + (imgArea - ih) / 2, iw, ih);
    } else {
      // placeholder
      ctx.strokeStyle = withAlpha(p, 0.4); ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x + ox + innerPad, ty + innerPad, imgArea, imgArea);
      ctx.setLineDash([]);
      ctx.fillStyle = withAlpha(p, 0.5);
      ctx.font = "900 32px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("◇", x + ox + innerPad + imgArea / 2, ty + innerPad + imgArea / 2);
    }

    // label
    const labelX = x + ox + innerPad + imgArea + 12;
    const labelMaxW = w - (imgArea + innerPad * 2 + 12);
    const name = cmp?.name || "—";
    ctx.fillStyle = "#fff";
    ctx.font = "800 18px Inter, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let display = name.toUpperCase();
    while (ctx.measureText(display).width > labelMaxW && display.length > 3) display = display.slice(0, -2);
    if (display !== name.toUpperCase()) display = display.slice(0, -1) + "…";
    ctx.fillText(display, labelX, ty + tileH / 2 - 2);
    ctx.fillStyle = withAlpha(acc, 0.9);
    ctx.font = "700 11px Inter, sans-serif";
    ctx.fillText(`COMPONENTE ${String(i + 1).padStart(2, "0")}`, labelX, ty + tileH / 2 + 18);

    ctx.restore();
  }
};

// ============= Scene definitions =============
type SceneId = "briefing" | "player" | "stats" | "top10";
interface SceneSpec {
  id: SceneId;
  duration: number;
  data?: any;
}

export const TournamentAnimationStudio = ({
  open, onOpenChange, top3, standings, playerMap, avatarMap,
  tournamentId, tournamentTitle, tournamentDate, club, isRanked = true, participantCount,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [theme, setTheme] = useState<Theme>(PRESETS[0].colors);
  const [autoFromLogo, setAutoFromLogo] = useState(true);
  const [includeBriefing, setIncludeBriefing] = useState(true);
  const [includeStats, setIncludeStats] = useState(true);
  const [includeTop10, setIncludeTop10] = useState(true);
  const [pattern, setPattern] = useState<Pattern>("diagonals");
  const [layoutKind, setLayoutKind] = useState<LayoutKind>("split");
  const [stingerKind, setStingerKind] = useState<StingerKind>("xcross");
  const [fxScanlines, setFxScanlines] = useState(true);
  const [fxVignette, setFxVignette] = useState(true);
  const [autoBgRemove, setAutoBgRemove] = useState(true);
  const [bgWorking, setBgWorking] = useState<string | null>(null);
  const [fxGlow, setFxGlow] = useState(true);

  const [assets, setAssets] = useState<Record<string, PlayerAsset>>({});
  const [clubLogo, setClubLogo] = useState<HTMLImageElement | null>(null);
  const [ibnaImg, setIbnaImg] = useState<HTMLImageElement | null>(null);
  const [venueLogo, setVenueLogo] = useState<HTMLImageElement | null>(null);
  const [venueRaw, setVenueRaw] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string>("");
  const [sponsorLogos, setSponsorLogos] = useState<{ img: HTMLImageElement; raw: string }[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const deckStorageKey = useMemo(() => `podium-animation-decks:${tournamentId}`, [tournamentId]);

  const loadSavedDeckAssets = useCallback(async (): Promise<Record<string, Partial<PlayerAsset>>> => {
    try {
      const raw = localStorage.getItem(deckStorageKey);
      const saved = raw ? JSON.parse(raw) as Record<string, PlayerDeck> : {};
      const out: Record<string, Partial<PlayerAsset>> = {};
      for (const [playerId, deck] of Object.entries(saved)) {
        const imgs: Record<string, HTMLImageElement | null> = {};
        for (const bey of deck.beys || []) for (const c of bey.components || []) {
          if (c.image_url) imgs[c.id] = await loadImageSafe(c.image_url);
        }
        out[playerId] = { deck, componentImgs: imgs };
      }
      return out;
    } catch { return {}; }
  }, [deckStorageKey]);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, PlayerAsset> = {};
    top3.forEach(p => { init[p.user_id] = { photo: null, rawDataUrl: null, deck: null, componentImgs: {} }; });
    setAssets(init);
  }, [open, top3]);

  useEffect(() => {
    if (!open) return;
    loadImageSafe(ibnaLogo).then(setIbnaImg);
    if (club?.logo_url) loadImageSafe(club.logo_url).then(setClubLogo);
    else setClubLogo(null);
  }, [open, club?.logo_url]);

  // Auto-load venue/shop logo from club_venues (primary shop) if user hasn't set one manually
  useEffect(() => {
    if (!open || !club?.id || venueRaw) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("club_venues")
        .select("name, shop_logo_url, is_shop, is_primary")
        .eq("club_id", club.id)
        .eq("is_shop", true)
        .order("is_primary", { ascending: false })
        .limit(1);
      const v = data?.[0];
      if (cancelled || !v?.shop_logo_url) return;
      const img = await loadImageSafe(v.shop_logo_url);
      if (cancelled || !img) return;
      setVenueLogo(img);
      setVenueRaw(v.shop_logo_url);
      setVenueName(v.name || "");
    })();
    return () => { cancelled = true; };
  }, [open, club?.id, venueRaw]);

  useEffect(() => {
    if (!open || !autoFromLogo || !club?.logo_url) return;
    extractThemeFromLogo(club.logo_url).then(t => { if (t) setTheme(t); });
  }, [open, autoFromLogo, club?.logo_url]);

  useEffect(() => {
    if (!open || top3.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      const newAssets: Record<string, PlayerAsset> = {};
      for (const p of top3) {
        const photo = await loadImageSafe(p.avatar);
        newAssets[p.user_id] = { photo, rawDataUrl: null, deck: null, componentImgs: {} };
      }
      const ids = top3.map(p => p.user_id);
      const { data: sels } = await (supabase as any)
        .from("tournament_deck_selections")
        .select("user_id, deck_id")
        .eq("tournament_id", tournamentId).in("user_id", ids);
      const deckIds = (sels || []).map((s: any) => s.deck_id);
      if (deckIds.length > 0) {
        const [{ data: decksData }, { data: beysData }] = await Promise.all([
          (supabase as any).from("decks").select("id, name").in("id", deckIds),
          (supabase as any).from("deck_beyblades").select("id, deck_id, position").in("deck_id", deckIds).order("position"),
        ]);
        const beyIds = (beysData || []).map((b: any) => b.id);
        const { data: comps } = beyIds.length ? await (supabase as any)
          .from("deck_beyblade_components")
          .select("deck_beyblade_id, component_type, component_id, variant_id")
          .in("deck_beyblade_id", beyIds) : { data: [] };
        const compIds = [...new Set((comps || []).map((c: any) => c.component_id))] as string[];
        const varIds = (comps || []).filter((c: any) => c.variant_id).map((c: any) => c.variant_id) as string[];
        const [{ data: components }, { data: variants }] = await Promise.all([
          compIds.length ? (supabase as any).from("collection_components").select("id, name, image_url").in("id", compIds) : Promise.resolve({ data: [] }),
          varIds.length ? (supabase as any).from("collection_component_variants").select("id, variant_name, image_url").in("id", varIds) : Promise.resolve({ data: [] }),
        ]);
        const compMap = new Map((components || []).map((c: any) => [c.id, c]));
        const varMap = new Map((variants || []).map((v: any) => [v.id, v]));
        const ORDER: Record<string, number> = { blade: 0, lock_chip: 0, main_blade: 1, over_blade: 1, metal_blade: 2, assist_blade: 3, ratchet: 10, ribs: 10, bit: 11 };

        for (const sel of sels || []) {
          const deck = (decksData || []).find((d: any) => d.id === sel.deck_id);
          if (!deck) continue;
          const dBeys = (beysData || []).filter((b: any) => b.deck_id === sel.deck_id).map((b: any) => {
            const myComps = (comps || [])
              .filter((c: any) => c.deck_beyblade_id === b.id)
              .sort((a: any, x: any) => (ORDER[a.component_type] ?? 5) - (ORDER[x.component_type] ?? 5));
            const picks: ComponentInfo[] = myComps.map((c: any) => {
              const variant = c.variant_id ? varMap.get(c.variant_id) as any : null;
              const comp = compMap.get(c.component_id) as any;
              return {
                id: variant?.id || comp?.id || `${b.id}-${c.component_type}`,
                name: comp?.name || variant?.variant_name || "?",
                image_url: variant?.image_url || comp?.image_url || null,
              };
            });
            return { id: b.id, name: picks.map(p => p.name).join(" "), components: picks };
          }).filter((b: any) => b.components.length > 0);
          if (dBeys.length > 0) {
            const playerDeck: PlayerDeck = { deckName: deck.name, beys: dBeys };
            const imgs: Record<string, HTMLImageElement | null> = {};
            for (const bey of dBeys) for (const c of bey.components) {
              if (c.image_url && !imgs[c.id]) imgs[c.id] = await loadImageSafe(c.image_url);
            }
            newAssets[sel.user_id] = { ...newAssets[sel.user_id], deck: playerDeck, componentImgs: imgs };
          }
        }
      }
      const saved = await loadSavedDeckAssets();
      Object.entries(saved).forEach(([playerId, patch]) => {
        if (!newAssets[playerId]) return;
        newAssets[playerId] = { ...newAssets[playerId], ...patch, componentImgs: { ...newAssets[playerId].componentImgs, ...(patch.componentImgs || {}) } };
      });
      if (!cancelled) { setAssets(newAssets); setLoadingData(false); }
    })();
    return () => { cancelled = true; };
  }, [open, top3, tournamentId, loadSavedDeckAssets]);

  useEffect(() => {
    if (!open) return;
    const saved: Record<string, PlayerDeck> = {};
    Object.entries(assets).forEach(([playerId, asset]) => { if (asset.deck) saved[playerId] = asset.deck; });
    if (Object.keys(saved).length > 0) localStorage.setItem(deckStorageKey, JSON.stringify(saved));
  }, [assets, deckStorageKey, open]);

  // Player stats from standings
  const statsByUser = useMemo(() => {
    const m = new Map<string, { wins: number; losses: number; points: number; resistance: number; rank: number }>();
    const sorted = [...standings]
      .filter((s: any) => !s.dropped)
      .sort((a: any, b: any) => (b.points || 0) - (a.points || 0) || (b.resistance || 0) - (a.resistance || 0));
    sorted.forEach((s: any, i: number) => {
      m.set(s.user_id, {
        wins: s.wins || 0, losses: s.losses || 0,
        points: s.points || 0, resistance: s.resistance || 0, rank: i + 1,
      });
    });
    return m;
  }, [standings]);

  const scenes = useMemo<SceneSpec[]>(() => {
    const list: SceneSpec[] = [];
    if (includeBriefing) list.push({ id: "briefing", duration: 5 });
    for (const p of [...top3].sort((a, b) => b.placement - a.placement)) {
      list.push({ id: "player", duration: 8.5, data: { player: p } });
    }
    if (includeStats) list.push({ id: "stats", duration: 5 });
    if (includeTop10) list.push({ id: "top10", duration: 6.5 });
    return list;
  }, [includeBriefing, includeStats, includeTop10, top3]);

  const totalDuration = useMemo(() => scenes.reduce((a, s) => a + s.duration, 0), [scenes]);
  const STINGER = 0.9;

  // ============= BRIEFING =============
  const drawBriefing = useCallback((ctx: CanvasRenderingContext2D, localT: number, dur: number) => {
    const enter = clamp01(localT / 1.2);
    const e = easeOutCubic(enter);
    const [p, , acc] = theme;

    // Diagonal accent band — grows symmetrically from center
    ctx.save();
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
    ctx.rotate(-Math.PI / 12);
    const bandW = CANVAS_W * 1.6 * e;
    ctx.fillStyle = withAlpha(p, 0.12);
    ctx.fillRect(-bandW / 2, -CANVAS_H * 0.05 - 140, bandW, 280);
    ctx.restore();

    // Kicker tag (bigger)
    ctx.globalAlpha = e;
    ctx.save();
    ctx.fillStyle = p;
    ctx.fillRect(CANVAS_W / 2 - 260, 198, 520 * e, 52);
    ctx.fillStyle = "#000";
    ctx.font = "900 30px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("◤  TOURNAMENT BRIEFING  ◢", CANVAS_W / 2, 224);
    ctx.restore();

    // Title (auto-fit to canvas)
    const title = tournamentTitle.toUpperCase();
    const ts = fitText(ctx, title, CANVAS_W - 160, 96, 900, 36);
    drawText(ctx, title, CANVAS_W / 2, 350 - (1 - e) * 40, { size: ts, weight: 900, color: "#fff" });

    // Separator with arrow caps
    const lineW = 620 * e;
    ctx.save();
    ctx.fillStyle = p;
    ctx.fillRect(CANVAS_W / 2 - lineW / 2, 355, lineW, 4);
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2 - lineW / 2 - 14, 357);
    ctx.lineTo(CANVAS_W / 2 - lineW / 2, 345); ctx.lineTo(CANVAS_W / 2 - lineW / 2, 369); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2 + lineW / 2 + 14, 357);
    ctx.lineTo(CANVAS_W / 2 + lineW / 2, 345); ctx.lineTo(CANVAS_W / 2 + lineW / 2, 369); ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Info cards
    const dt = new Date(tournamentDate);
    const dateStr = isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
    const items = [
      { label: "DATA", value: dateStr },
      { label: "CLUB", value: club?.name || "—" },
      { label: "PARTECIPANTI", value: String(participantCount) },
      { label: "FORMATO", value: isRanked ? "RANKED" : "NORMAL" },
    ];
    items.forEach((it, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const cx = CANVAS_W / 2 + (col === 0 ? -245 : 245);
      const cy = 470 + row * 170;
      const delay = 0.4 + i * 0.13;
      const a = clamp01((localT - delay) / 0.5);
      const ae = easeOutExpo(a);
      const ox = (1 - ae) * (col === 0 ? -60 : 60);
      ctx.globalAlpha = ae;
      // Card with diagonal corner cut
      ctx.save();
      ctx.beginPath();
      const cw = 380, ch = 130, cxL = cx - cw / 2 + ox, cyT = cy - ch / 2;
      ctx.moveTo(cxL, cyT);
      ctx.lineTo(cxL + cw - 22, cyT);
      ctx.lineTo(cxL + cw, cyT + 22);
      ctx.lineTo(cxL + cw, cyT + ch);
      ctx.lineTo(cxL + 22, cyT + ch);
      ctx.lineTo(cxL, cyT + ch - 22);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fill();
      ctx.strokeStyle = withAlpha(p, 0.6); ctx.lineWidth = 2; ctx.stroke();
      // accent bar left
      ctx.fillStyle = p; ctx.fillRect(cxL, cyT + 22, 4, ch - 44);
      ctx.restore();

      drawText(ctx, it.label, cx + ox - 165, cy - 22, { size: 20, color: acc, weight: 800, align: "left" });
      drawText(ctx, it.value, cx + ox - 165, cy + 30, { size: 38, color: "#fff", weight: 900, align: "left" });
      ctx.globalAlpha = 1;
    });

    // (Bottom logos removed — corner badges already display FIBeGS + Club on every slide)
    ctx.globalAlpha = 1;
  }, [theme, tournamentTitle, tournamentDate, club, isRanked, participantCount, ibnaImg, clubLogo]);

  // ============= PLAYER SCENE =============
  const drawPlayerScene = useCallback((ctx: CanvasRenderingContext2D, localT: number, dur: number, player: Player) => {
    const a = assets[player.user_id];
    const [p, , acc] = theme;
    const placementColor = player.placement === 1 ? "#facc15" : player.placement === 2 ? "#e5e7eb" : "#f59e0b";
    const placementLabel = player.placement === 1 ? "CHAMPION" : player.placement === 2 ? "RUNNER-UP" : "BRONZE";
    const placementNum = `0${player.placement}`;

    const enterT = clamp01(localT / 0.8);
    const ee = easeOutExpo(enterT);

    // ===== Photo on the LEFT (9:16) =====
    const photoW = 380;
    const photoH = Math.round(photoW * 16 / 9); // 9:16 → portrait => h > w. Here 9:16 ratio means width:height=9:16. So h = w * 16/9
    const photoX = 60 - (1 - ee) * 120;
    const photoY = (CANVAS_H - photoH) / 2 - 30;

    ctx.save();
    ctx.globalAlpha = ee;
    drawPortrait916(ctx, a?.photo || null, photoX, photoY, photoW, photoH, placementColor, acc);
    ctx.restore();

    // Massive placement number watermark behind photo
    ctx.save();
    ctx.globalAlpha = 0.12 * ee;
    ctx.fillStyle = placementColor;
    ctx.font = "900 480px Inter, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(placementNum, photoX - 40, photoY + 380);
    ctx.restore();

    // Name + placement tag overlay on bottom of photo
    const labelA = clamp01((localT - 0.4) / 0.5);
    ctx.globalAlpha = labelA;
    ctx.save();
    // placement chip
    ctx.fillStyle = placementColor;
    ctx.fillRect(photoX, photoY + photoH - 110, 130, 32);
    drawText(ctx, placementLabel, photoX + 65, photoY + photoH - 87, { size: 16, weight: 900, color: "#000" });
    // name
    const nameMax = photoW - 8;
    let name = player.name.toUpperCase();
    ctx.font = "900 36px Inter, sans-serif";
    while (ctx.measureText(name).width > nameMax && name.length > 4) name = name.slice(0, -1);
    if (name !== player.name.toUpperCase()) name = name.slice(0, -1) + "…";
    drawText(ctx, name, photoX + 4, photoY + photoH - 40, { size: 36, weight: 900, color: "#fff", align: "left" });
    // accent underline
    ctx.fillStyle = acc; ctx.fillRect(photoX + 4, photoY + photoH - 26, 60, 3);
    ctx.restore();

    // ===== Stats row UNDER photo =====
    const st = statsByUser.get(player.user_id);
    const statsA = clamp01((localT - 0.7) / 0.6);
    const statsE = easeOutExpo(statsA);
    ctx.globalAlpha = statsE;
    const statY = photoY + photoH + 28;
    const stats = [
      { l: "RANK", v: st ? `#${st.rank}` : "—" },
      { l: "W", v: String(st?.wins ?? "—") },
      { l: "L", v: String(st?.losses ?? "—") },
      { l: "PT", v: String(st?.points ?? "—") },
    ];
    const sW = photoW + 28; // span same as photo + bracket
    const cellW = sW / stats.length;
    ctx.save();
    roundRect(ctx, photoX - 14, statY, sW, 80, 8);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill();
    ctx.strokeStyle = withAlpha(p, 0.6); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    stats.forEach((s, i) => {
      const cx = photoX - 14 + cellW * i + cellW / 2;
      drawText(ctx, s.l, cx, statY + 28, { size: 13, color: acc, weight: 800 });
      drawText(ctx, s.v, cx, statY + 62, { size: 26, color: "#fff", weight: 900 });
      if (i > 0) {
        ctx.fillStyle = withAlpha(p, 0.4);
        ctx.fillRect(photoX - 14 + cellW * i, statY + 18, 1, 44);
      }
    });
    ctx.globalAlpha = 1;

    // ===== RIGHT: deck vertical stack =====
    const rightX = photoX + photoW + 70;
    const rightW = CANVAS_W - rightX - 60;
    const rightY = photoY + 70;
    const rightH = photoH - 70;

    // Header
    const headerA = clamp01((localT - 0.5) / 0.5);
    ctx.globalAlpha = headerA;
    // tag
    ctx.save();
    ctx.fillStyle = p; ctx.fillRect(rightX, rightY - 60, 130, 28);
    drawText(ctx, "DECK", rightX + 65, rightY - 41, { size: 16, weight: 900, color: "#000" });
    ctx.restore();
    drawText(ctx, (a?.deck?.deckName || "—").toUpperCase(), rightX, rightY - 16, { size: 22, weight: 900, color: "#fff", align: "left" });

    const deck = a?.deck;
    if (deck && deck.beys.length > 0) {
      const deckStart = 1.0;
      const deckEnd = dur - 0.6;
      const deckDur = deckEnd - deckStart;
      const beysShown = deck.beys.length;
      const perBey = deckDur / beysShown;
      const localDeckT = localT - deckStart;

      // BEY navigator (combo pills) at top right
      const pillsY = rightY - 44;
      const pillW = (rightW - (beysShown - 1) * 8) / beysShown;
      for (let i = 0; i < beysShown; i++) {
        const px = rightX + i * (pillW + 8);
        const active = localDeckT >= i * perBey && localDeckT < (i + 1) * perBey;
        ctx.fillStyle = active ? acc : withAlpha(acc, 0.18);
        ctx.fillRect(px, pillsY, pillW, 4);
      }

      if (localDeckT >= 0 && localDeckT <= deckDur) {
        const beyIdx = Math.min(beysShown - 1, Math.floor(localDeckT / perBey));
        const localBeyT = (localDeckT - beyIdx * perBey) / perBey;
        const bey = deck.beys[beyIdx];

        const fadeIn = clamp01(localBeyT / 0.18);
        const fadeOut = 1 - clamp01((localBeyT - 0.82) / 0.18);
        const beyAlpha = Math.min(fadeIn, fadeOut);

        ctx.globalAlpha = beyAlpha;
        // combo label
        drawText(ctx, `COMBO ${String(beyIdx + 1).padStart(2, "0")} / ${String(beysShown).padStart(2, "0")}`, rightX + rightW, rightY - 16, { size: 16, weight: 900, color: acc, align: "right" });

        drawBeyStackVertical(ctx, bey, a.componentImgs, rightX, rightY + 16, rightW, rightH - 16, theme, localBeyT);
      }
    } else {
      ctx.globalAlpha = headerA;
      drawBeyStackVertical(ctx, null, {}, rightX, rightY + 16, rightW, rightH - 16, theme, 1);
      drawText(ctx, "DECK NON DISPONIBILE", rightX + rightW / 2, rightY + rightH + 10, { size: 14, color: withAlpha("#fff", 0.5), weight: 700 });
    }
    ctx.globalAlpha = 1;
  }, [assets, theme, statsByUser]);

  // ============= STATS =============
  const drawStats = useCallback((ctx: CanvasRenderingContext2D, localT: number, dur: number) => {
    const [p, , acc] = theme;
    const totalMatches = standings.reduce((acc: number, s: any) => acc + (s.wins || 0) + (s.losses || 0), 0) / 2;
    const champion = top3.find(p => p.placement === 1);
    const enter = easeOutExpo(clamp01(localT / 0.8));

    // Diagonal slab background — grows symmetrically from center
    ctx.save();
    ctx.translate(CANVAS_W / 2, 230);
    ctx.rotate(-Math.PI / 24);
    const slabW = CANVAS_W * 2 * enter;
    ctx.fillStyle = withAlpha(p, 0.18);
    ctx.fillRect(-slabW / 2, -50, slabW, 100);
    ctx.restore();

    ctx.globalAlpha = enter;
    drawText(ctx, "TOURNAMENT", CANVAS_W / 2, 200, { size: 36, color: acc, weight: 800 });
    drawText(ctx, "STATS", CANVAS_W / 2, 282, { size: 104, weight: 900, color: "#fff" });
    ctx.globalAlpha = 1;

    const items = [
      { label: "GIOCATORI", value: String(participantCount), icon: "◆" },
      { label: "MATCH GIOCATI", value: String(Math.round(totalMatches)), icon: "◇" },
      { label: "CAMPIONE", value: (champion?.name || "—").toUpperCase().slice(0, 14), icon: "★" },
      { label: "FORMATO", value: isRanked ? "RANKED" : "NORMAL", icon: "▲" },
    ];
    items.forEach((it, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const cx = CANVAS_W / 2 + (col === 0 ? -230 : 230);
      const cy = 480 + row * 230;
      const delay = 0.35 + i * 0.14;
      const a = easeOutExpo(clamp01((localT - delay) / 0.55));
      const ox = (1 - a) * (col === 0 ? -100 : 100);
      ctx.globalAlpha = a;
      // diagonal-cut card
      const cw = 400, ch = 180, cxL = cx - cw / 2 + ox, cyT = cy - ch / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cxL, cyT);
      ctx.lineTo(cxL + cw, cyT);
      ctx.lineTo(cxL + cw, cyT + ch - 28);
      ctx.lineTo(cxL + cw - 28, cyT + ch);
      ctx.lineTo(cxL, cyT + ch);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
      ctx.strokeStyle = withAlpha(p, 0.7); ctx.lineWidth = 2; ctx.stroke();
      // top band
      ctx.fillStyle = p; ctx.fillRect(cxL, cyT, cw, 6);
      ctx.restore();
      // icon
      drawText(ctx, it.icon, cxL + 30, cyT + 56, { size: 34, color: acc, align: "left", weight: 900 });
      drawText(ctx, it.label, cxL + 30, cyT + 92, { size: 22, color: acc, weight: 800, align: "left" });
      drawText(ctx, it.value, cxL + 30, cyT + 154, { size: 52, weight: 900, color: "#fff", align: "left" });
      ctx.globalAlpha = 1;
    });
  }, [standings, participantCount, top3, theme, isRanked]);

  // ============= TOP 10 =============
  const drawTop10 = useCallback((ctx: CanvasRenderingContext2D, localT: number, dur: number) => {
    const [p, , acc] = theme;
    const top10 = [...standings]
      .filter((s: any) => !s.dropped)
      .sort((a: any, b: any) => (b.points || 0) - (a.points || 0) || (b.resistance || 0) - (a.resistance || 0))
      .slice(0, 10);
    const enter = easeOutExpo(clamp01(localT / 0.7));

    // Header — centered, no full-width bar (looked like a connector between corner logos)
    ctx.save();
    ctx.globalAlpha = enter;
    const titleW = (CANVAS_W - 280) * enter; // small accent bar under the title only
    drawText(ctx, "CLASSIFICA", CANVAS_W / 2, 168, { size: 72, weight: 900, color: "#fff" });
    ctx.fillStyle = p;
    ctx.fillRect(CANVAS_W / 2 - Math.min(260, titleW / 2), 184, Math.min(520, titleW), 4);
    drawText(ctx, "TOP 10 · FINAL STANDINGS", CANVAS_W / 2, 214, { size: 18, weight: 800, color: acc });
    ctx.restore();

    const rowH = 72, startY = 248;
    top10.forEach((s: any, i: number) => {
      const delay = 0.25 + i * 0.055;
      const ra = easeOutExpo(clamp01((localT - delay) / 0.45));
      const xOff = (1 - ra) * 160;
      ctx.globalAlpha = ra;
      const y = startY + i * rowH;
      const x0 = 60 + xOff;
      const w = CANVAS_W - 120;
      const isPodium = i < 3;
      const plColor = i === 0 ? "#facc15" : i === 1 ? "#e5e7eb" : i === 2 ? "#f59e0b" : acc;
      const h = rowH - 10;

      // Row bar with diagonal cut on right
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w - 28, y);
      ctx.lineTo(x0 + w, y + 28);
      ctx.lineTo(x0 + w, y + h);
      ctx.lineTo(x0, y + h);
      ctx.closePath();
      // subtle gradient fill
      const rg = ctx.createLinearGradient(x0, y, x0 + w, y);
      if (isPodium) {
        rg.addColorStop(0, withAlpha(plColor, 0.28));
        rg.addColorStop(0.6, withAlpha(p, 0.08));
        rg.addColorStop(1, "rgba(255,255,255,0.02)");
      } else {
        rg.addColorStop(0, "rgba(255,255,255,0.06)");
        rg.addColorStop(1, "rgba(255,255,255,0.02)");
      }
      ctx.fillStyle = rg; ctx.fill();
      ctx.strokeStyle = isPodium ? withAlpha(plColor, 0.85) : withAlpha("#fff", 0.10);
      ctx.lineWidth = isPodium ? 2 : 1.2; ctx.stroke();
      ctx.restore();

      // Left aggressive rank block (parallelogram)
      ctx.save();
      ctx.fillStyle = plColor;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + 92, y);
      ctx.lineTo(x0 + 72, y + h);
      ctx.lineTo(x0, y + h);
      ctx.closePath();
      ctx.fill();
      if (isPodium) {
        ctx.shadowBlur = 18; ctx.shadowColor = plColor;
        ctx.strokeStyle = withAlpha(plColor, 0.6); ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.fillStyle = "#000";
      ctx.font = "900 32px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1).padStart(2, "0"), x0 + 46, y + h / 2 + 1);
      ctx.restore();

      // Accent vertical tick after rank
      ctx.fillStyle = withAlpha(plColor, 0.7);
      ctx.fillRect(x0 + 102, y + 12, 2, h - 24);

      // Name — auto-fit
      const nameRaw = (playerMap.get(s.user_id) || "Utente").toUpperCase();
      const nameMaxW = w - 360;
      const ns = fitText(ctx, nameRaw, nameMaxW, 30, 800, 16);
      drawText(ctx, nameRaw, x0 + 118, y + h / 2 + ns / 3, { size: ns, weight: 800, color: "#fff", align: "left" });

      // W-L pill
      const wl = `${s.wins || 0}W · ${s.losses || 0}L`;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      const wlW = 130;
      roundRect(ctx, x0 + w - 218, y + h / 2 - 18, wlW, 36, 6); ctx.fill();
      ctx.strokeStyle = withAlpha(acc, 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      drawText(ctx, wl, x0 + w - 218 + 65, y + h / 2 + 6, { size: 18, weight: 800, color: "#fff" });

      // Points — large
      drawText(ctx, `${s.points || 0}`, x0 + w - 40, y + h / 2 - 4, { size: 38, weight: 900, color: acc, align: "right" });
      drawText(ctx, "PT", x0 + w - 40, y + h / 2 + 26, { size: 13, weight: 800, color: withAlpha(acc, 0.75), align: "right" });

      ctx.globalAlpha = 1;
    });
  }, [standings, playerMap, theme]);

  // ============= STINGER =============
  // Full coverage at midpoint; opens to reveal new scene.
  const drawStinger = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const [p, , acc] = theme;
    const cover = Math.sin(t * Math.PI); // 0→1→0 over t

    ctx.save();

    if (stingerKind === "xcross") {
      // ===== X CROSS — 3 phases =====
      // Phase A (t 0 → 0.45): 4 triangular wedges slide from each edge to center, X glow grows
      // Phase B (t 0.45 → 0.55): full cover + pulsing X + logos
      // Phase C (t 0.55 → 1.0): top/left/right wedges retract; bottom wedge keeps V glow and descends
      const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
      const W = CANVAS_W, H = CANVAS_H;

      // Triangle helpers: each wedge is an isoceles triangle with base on its edge & apex at center
      // We translate the wedge by an offset away from center to retract it off-screen.
      const drawTri = (pts: [number, number][], dx: number, dy: number, fill: string) => {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.lineTo(pts[1][0], pts[1][1]);
        ctx.lineTo(pts[2][0], pts[2][1]);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      // wedge geometry (apex at center, base at edge)
      const topTri:   [number, number][] = [[cx, cy], [-W * 0.2, 0], [W * 1.2, 0]];
      const botTri:   [number, number][] = [[cx, cy], [-W * 0.2, H], [W * 1.2, H]];
      const leftTri:  [number, number][] = [[cx, cy], [0, -H * 0.2], [0, H * 1.2]];
      const rightTri: [number, number][] = [[cx, cy], [W, -H * 0.2], [W, H * 1.2]];

      let topOff = 0, botOff = 0, leftOff = 0, rightOff = 0;
      let xProgress = 0;
      let vDrop = 0;
      let vMode = false;

      if (t < 0.45) {
        // entry: wedges slide in to form full X cover
        const e = easeInOutCubic(t / 0.45);
        topOff   = -H * (1 - e);
        botOff   =  H * (1 - e);
        leftOff  = -W * (1 - e);
        rightOff =  W * (1 - e);
        xProgress = e;
      } else if (t < 0.55) {
        xProgress = 1;
      } else {
        // exit: all 4 wedges retract symmetrically; bottom retracts with a slight delay
        // so the V glow trails downward briefly
        const k = (t - 0.55) / 0.45;
        const eOut = easeInOutCubic(Math.min(1, k * 1.4));
        topOff   = -H * eOut;
        leftOff  = -W * eOut;
        rightOff =  W * eOut;
        // bottom retracts slightly delayed for V trail effect, but still retracts to reveal scene
        const bottomLag = clamp01((k - 0.15) / 0.85);
        const eBot = easeInOutCubic(bottomLag);
        botOff = H * eBot;
        // V glow visual drop (faster than wedge so it descends past the retracting wedge)
        vDrop = H * easeInOutCubic(clamp01(k * 1.2)) * 0.9;
        vMode = true;
        xProgress = 1 - eOut;
      }

      // Fill wedges (black coverage)
      drawTri(topTri,   0, topOff,   "#000");
      drawTri(botTri,   0, botOff,   "#000");
      drawTri(leftTri,  leftOff, 0,  "#000");
      drawTri(rightTri, rightOff, 0, "#000");

      // ===== Glowing X / V — SINGLE color (primary) =====
      ctx.save();
      ctx.lineCap = "round";
      const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI * 6);
      const lineW = 12 + 10 * pulse;

      if (!vMode) {
        const reach = Math.hypot(W, H) / 2;
        const len = reach * easeOutExpo(xProgress);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.shadowBlur = 60 * pulse; ctx.shadowColor = p;
        ctx.strokeStyle = p; ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(-len * 0.707, -len * 0.707); ctx.lineTo(len * 0.707, len * 0.707);
        ctx.moveTo(-len * 0.707, len * 0.707);  ctx.lineTo(len * 0.707, -len * 0.707);
        ctx.stroke();
        ctx.restore();
      } else {
        const reach = Math.hypot(W, H) / 2;
        ctx.save();
        ctx.translate(cx, cy + vDrop);
        ctx.shadowBlur = 60 * pulse; ctx.shadowColor = p;
        ctx.strokeStyle = p; ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(reach * 0.707, reach * 0.707);
        ctx.moveTo(0, 0); ctx.lineTo(-reach * 0.707, reach * 0.707);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } else if (stingerKind === "panels") {
      const half = t < 0.5 ? t * 2 : (1 - t) * 2;
      const e = easeInOutCubic(half);
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      const off = CANVAS_W * (1 - e);
      ctx.moveTo(-off, 0);
      ctx.lineTo(CANVAS_W / 2 - off, 0);
      ctx.lineTo(CANVAS_W / 2 - off + 120, CANVAS_H);
      ctx.lineTo(-off, CANVAS_H);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = p; ctx.lineWidth = 6; ctx.shadowBlur = 18; ctx.shadowColor = p;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2 - off, 0);
      ctx.lineTo(CANVAS_W / 2 - off + 120, CANVAS_H);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      const off2 = CANVAS_W * (1 - e);
      ctx.moveTo(CANVAS_W / 2 + off2 - 120, 0);
      ctx.lineTo(CANVAS_W + off2, 0);
      ctx.lineTo(CANVAS_W + off2, CANVAS_H);
      ctx.lineTo(CANVAS_W / 2 + off2, CANVAS_H);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.shadowBlur = 18; ctx.shadowColor = acc;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2 + off2 - 120, 0);
      ctx.lineTo(CANVAS_W / 2 + off2, CANVAS_H);
      ctx.stroke();
      ctx.restore();
    } else if (stingerKind === "iris") {
      const half = t < 0.5 ? t * 2 : (1 - t) * 2;
      const e = easeInOutCubic(half);
      const radius = (1 - e) * Math.hypot(CANVAS_W, CANVAS_H) / 2;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.rect(0, 0, CANVAS_W, CANVAS_H);
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2, radius, 0, Math.PI * 2, true);
      ctx.fill("evenodd");
      ctx.strokeStyle = p; ctx.lineWidth = 6; ctx.shadowBlur = 22; ctx.shadowColor = p;
      ctx.beginPath(); ctx.arc(CANVAS_W / 2, CANVAS_H / 2, Math.max(0, radius - 6), 0, Math.PI * 2); ctx.stroke();
    } else if (stingerKind === "shutter") {
      const half = t < 0.5 ? t * 2 : (1 - t) * 2;
      const e = easeInOutCubic(half);
      const bars = 10;
      const bh = CANVAS_H / bars;
      ctx.fillStyle = "#000";
      for (let i = 0; i < bars; i++) {
        const dirI = i % 2 === 0 ? 1 : -1;
        const off = (1 - e) * CANVAS_W * dirI;
        ctx.fillRect(off, i * bh, CANVAS_W, bh);
      }
      ctx.fillStyle = p;
      for (let i = 0; i < bars; i++) {
        const dirI = i % 2 === 0 ? 1 : -1;
        const off = (1 - e) * CANVAS_W * dirI;
        ctx.fillRect(off + (dirI > 0 ? 0 : CANVAS_W - 4), i * bh, 4, bh);
      }
    } else { // slash
      const half = t < 0.5 ? t * 2 : (1 - t) * 2;
      const e = easeInOutCubic(half);
      ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
      ctx.rotate(-Math.PI / 7);
      const w = CANVAS_W * 2;
      const h = CANVAS_H * 1.4 * e;
      ctx.fillStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = p; ctx.fillRect(-w / 2, -h / 2, w, 6);
      ctx.fillStyle = acc; ctx.fillRect(-w / 2, h / 2 - 6, w, 6);
    }

    ctx.restore();

    // Logos when covered
    if (cover > 0.3) {
      const la = clamp01((cover - 0.3) / 0.35);
      const scale = 0.9 + 0.1 * la;
      const gx = CANVAS_W / 2, gy = CANVAS_H / 2;

      // Determine layout: if venueLogo provided → FIBeGS on TOP, venue replaces club side.
      const sideLogo = venueLogo || clubLogo;
      const sideLabel = venueLogo ? (venueName || "VENUE") : (club?.name || "CLUB");

      // Spread logos further to the sides, much larger
      const sideOffset = 330;
      const circleR = 160;

      ctx.save();
      ctx.globalAlpha = la;

      if (venueLogo && ibnaImg) {
        // FIBeGS on top center, larger
        const tlh = 190, tlw = tlh * (ibnaImg.width / ibnaImg.height);
        ctx.drawImage(ibnaImg, gx - tlw / 2, gy - 360, tlw, tlh);
      }

      // Left logo (side)
      if (sideLogo) {
        ctx.save();
        ctx.translate(gx - sideOffset, gy);
        ctx.scale(scale, scale);
        drawCircleImg(ctx, sideLogo, 0, 0, circleR, p);
        ctx.restore();
      }
      // Center X glyph (bigger)
      ctx.save();
      ctx.translate(gx, gy);
      ctx.scale(scale, scale);
      ctx.fillStyle = p;
      ctx.font = "900 150px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowBlur = 40; ctx.shadowColor = p;
      ctx.fillText("×", 0, 10);
      ctx.restore();
      // Right logo
      ctx.save();
      ctx.translate(gx + sideOffset, gy);
      ctx.scale(scale, scale);
      if (!venueLogo && ibnaImg) {
        const lh = 280, lw = lh * (ibnaImg.width / ibnaImg.height);
        ctx.drawImage(ibnaImg, -lw / 2, -lh / 2, lw, lh);
      } else if (venueLogo && clubLogo) {
        drawCircleImg(ctx, clubLogo, 0, 0, circleR, acc);
      } else if (ibnaImg) {
        const lh = 280, lw = lh * (ibnaImg.width / ibnaImg.height);
        ctx.drawImage(ibnaImg, -lw / 2, -lh / 2, lw, lh);
      }
      ctx.restore();

      // Bottom tag (bigger)
      ctx.fillStyle = "#fff";
      ctx.font = "900 32px Inter, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("◤ FIBeGS × " + sideLabel.toUpperCase() + " ◢", gx, gy + 250);

      // Sponsors row at bottom (bigger)
      if (sponsorLogos.length > 0) {
        const maxH = 90;
        const gap = 36;
        const widths = sponsorLogos.map(s => maxH * (s.img.width / s.img.height));
        const totalW = widths.reduce((a, b) => a + b, 0) + gap * (sponsorLogos.length - 1);
        let cx = gx - totalW / 2;
        const sy = CANVAS_H - 170;
        // label
        ctx.fillStyle = withAlpha(acc, 0.85);
        ctx.font = "800 16px Inter, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("SPONSORS", gx, sy - 24);
        // line
        ctx.fillStyle = withAlpha(p, 0.6);
        ctx.fillRect(gx - 60, sy - 14, 120, 1);
        sponsorLogos.forEach((s, i) => {
          const w = widths[i];
          ctx.drawImage(s.img, cx, sy, w, maxH);
          cx += w + gap;
        });
      }
      ctx.restore();
    }
  }, [theme, clubLogo, ibnaImg, stingerKind, club, venueLogo, venueName, sponsorLogos]);

  // ============= Corner badges (FIBeGS + club on every slide) =============
  const drawCornerBadges = useCallback((ctx: CanvasRenderingContext2D) => {
    const [p, , acc] = theme;
    // top-left: FIBeGS — bigger
    if (ibnaImg) {
      const h = 120, w = h * (ibnaImg.width / ibnaImg.height);
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(ibnaImg, 40, 36, w, h);
      ctx.restore();
    }
    // top-right: club (or venue beside) — bigger
    const right = CANVAS_W - 40;
    let xCursor = right;
    if (clubLogo) {
      const r = 64;
      ctx.save();
      drawCircleImg(ctx, clubLogo, xCursor - r, 36 + r, r, p);
      ctx.restore();
      xCursor -= r * 2 + 20;
    }
    if (venueLogo) {
      const r = 56;
      ctx.save();
      drawCircleImg(ctx, venueLogo, xCursor - r, 36 + r + 6, r, acc);
      ctx.restore();
    }
  }, [theme, ibnaImg, clubLogo, venueLogo]);

  // ============= Footer (no connector line — looked like it joined the corner logos) =============
  const drawFooter = useCallback((ctx: CanvasRenderingContext2D) => {
    const dt = new Date(tournamentDate);
    const year = isNaN(dt.getTime()) ? "" : String(dt.getFullYear());
    const txt = [`FIBeGS${club?.name ? ` × ${club.name}` : ""}`, isRanked ? "RANKED" : "NORMAL", year].filter(Boolean).join("  ·  ");
    ctx.save();
    ctx.globalAlpha = 0.75;
    drawText(ctx, txt, CANVAS_W / 2, CANVAS_H - 22, { size: 16, weight: 700, color: "#fff" });
    ctx.restore();
  }, [tournamentDate, club, isRanked, theme]);

  // ============= MAIN RENDER =============
  const renderAt = useCallback((time: number) => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;

    let acc = 0;
    let sceneIdx = 0;
    let localT = 0;
    for (let i = 0; i < scenes.length; i++) {
      if (time < acc + scenes[i].duration) { sceneIdx = i; localT = time - acc; break; }
      acc += scenes[i].duration;
      sceneIdx = i; localT = scenes[i].duration;
    }

    const frame = Math.floor(time * FPS);
    drawBg(ctx, theme, frame, pattern, { scanlines: fxScanlines, vignette: fxVignette, glow: fxGlow });

    const scene = scenes[sceneIdx];
    if (!scene) return;
    if (scene.id === "briefing") drawBriefing(ctx, localT, scene.duration);
    else if (scene.id === "player") drawPlayerScene(ctx, localT, scene.duration, scene.data.player);
    else if (scene.id === "stats") drawStats(ctx, localT, scene.duration);
    else if (scene.id === "top10") drawTop10(ctx, localT, scene.duration);

    drawCornerBadges(ctx);
    drawFooter(ctx);

    // Stinger overlay
    const stEnd = STINGER;
    const stStart = scene.duration - STINGER;
    if (sceneIdx > 0 && localT < stEnd) {
      drawStinger(ctx, 0.5 + (localT / stEnd) * 0.5);
    } else if (sceneIdx < scenes.length - 1 && localT > stStart) {
      drawStinger(ctx, ((localT - stStart) / STINGER) * 0.5);
    }
  }, [scenes, theme, pattern, fxScanlines, fxVignette, fxGlow, drawBriefing, drawPlayerScene, drawStats, drawTop10, drawStinger, drawFooter, drawCornerBadges]);

  // ============= Playback =============
  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startTimeRef.current = null;
    setIsPlaying(false);
  }, []);

  const tick = useCallback(() => {
    if (startTimeRef.current == null) startTimeRef.current = performance.now();
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    if (elapsed >= totalDuration) {
      renderAt(totalDuration - 0.01);
      setProgress(1);
      stop();
      return;
    }
    renderAt(elapsed);
    setProgress(elapsed / totalDuration);
    rafRef.current = requestAnimationFrame(tick);
  }, [totalDuration, renderAt, stop]);

  const play = useCallback(() => {
    setIsPlaying(true);
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    if (!open) return;
    renderAt(0);
  }, [open, renderAt, theme, scenes, pattern, fxScanlines, fxVignette, fxGlow, stingerKind, layoutKind, venueLogo, sponsorLogos, ibnaImg, clubLogo, assets]);

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const onPhotoFile = useCallback(async (playerId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      try {
        const img = await loadImage(raw);
        setAssets(prev => ({ ...prev, [playerId]: { ...prev[playerId], photo: img, rawDataUrl: raw } }));
        if (autoBgRemove) {
          setBgWorking(playerId);
          const tid = toast.loading("Rimuovo lo sfondo… (può richiedere ~30s al primo uso)");
          try {
            const cutoutUrl = await removeBgWithTimeout(raw);
            const cutImg = await loadImage(cutoutUrl);
            setAssets(prev => ({ ...prev, [playerId]: { ...prev[playerId], photo: cutImg } }));
            toast.success("Sfondo rimosso");
          } catch (e: any) {
            toast.error(e?.message || "Rimozione sfondo fallita");
          } finally {
            toast.dismiss(tid);
            setBgWorking(null);
          }
        }
      } catch { toast.error("Impossibile caricare la foto"); }
    };
    reader.readAsDataURL(file);
  }, [autoBgRemove]);

  const reRunBgRemoval = useCallback(async (playerId: string) => {
    const raw = assets[playerId]?.rawDataUrl;
    if (!raw) { toast.error("Carica prima una foto"); return; }
    setBgWorking(playerId);
    const tid = toast.loading("Rimuovo lo sfondo…");
    try {
      const cutoutUrl = await removeBgWithTimeout(raw);
      const cutImg = await loadImage(cutoutUrl);
      setAssets(prev => ({ ...prev, [playerId]: { ...prev[playerId], photo: cutImg } }));
      toast.success("Sfondo rimosso");
    } catch (e: any) {
      toast.error(e?.message || "Rimozione sfondo fallita");
    } finally {
      toast.dismiss(tid);
      setBgWorking(null);
    }
  }, [assets]);

  const onVenueFile = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      try {
        const img = await loadImage(raw);
        setVenueLogo(img); setVenueRaw(raw);
      } catch { toast.error("Impossibile caricare il logo sede"); }
    };
    reader.readAsDataURL(file);
  }, []);

  const onSponsorFiles = useCallback(async (files: FileList) => {
    const arr = Array.from(files).slice(0, 8 - sponsorLogos.length);
    for (const file of arr) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const raw = reader.result as string;
          try {
            const img = await loadImage(raw);
            setSponsorLogos(prev => [...prev, { img, raw }]);
          } catch { toast.error("Logo sponsor non valido"); }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
  }, [sponsorLogos.length]);

  // ============= Deck editor =============
  const emptyBey = (playerId: string, beyIdx: number, count = 3): Bey => {
    const ts = Date.now();
    return {
      id: `manual-${playerId}-${ts}-${beyIdx}`,
      name: "Nuovo Beyblade",
      components: Array.from({ length: count }).map((_, ci) => ({
        id: `manual-${playerId}-${ts}-${beyIdx}-${ci}-${Math.random().toString(36).slice(2, 7)}`,
        name: "",
        image_url: null,
      })),
    };
  };

  const initDeck = useCallback((playerId: string) => {
    setAssets(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || { photo: null, rawDataUrl: null, deck: null, componentImgs: {} }),
        deck: { deckName: "Deck personalizzato", beys: [0, 1, 2].map(i => emptyBey(playerId, i)) },
      },
    }));
  }, []);

  const mutateDeck = useCallback((playerId: string, fn: (d: PlayerDeck) => PlayerDeck) => {
    setAssets(prev => {
      const a = prev[playerId]; if (!a?.deck) return prev;
      return { ...prev, [playerId]: { ...a, deck: fn(a.deck) } };
    });
  }, []);

  const setDeckName = (playerId: string, name: string) =>
    mutateDeck(playerId, d => ({ ...d, deckName: name }));
  const setBeyName = (playerId: string, beyIdx: number, name: string) =>
    mutateDeck(playerId, d => ({ ...d, beys: d.beys.map((b, i) => i === beyIdx ? { ...b, name } : b) }));
  const setCompName = (playerId: string, beyIdx: number, ci: number, name: string) =>
    mutateDeck(playerId, d => ({
      ...d,
      beys: d.beys.map((b, i) => i !== beyIdx ? b : {
        ...b,
        components: b.components.map((c, j) => j === ci ? { ...c, name } : c),
      }),
    }));
  const addBey = (playerId: string) => mutateDeck(playerId, d => d.beys.length >= 3 ? d : ({ ...d, beys: [...d.beys, emptyBey(playerId, d.beys.length)] }));
  const removeBey = (playerId: string, beyIdx: number) => mutateDeck(playerId, d => ({ ...d, beys: d.beys.filter((_, i) => i !== beyIdx) }));
  const addComp = (playerId: string, beyIdx: number) =>
    mutateDeck(playerId, d => ({
      ...d,
      beys: d.beys.map((b, i) => i !== beyIdx ? b : {
        ...b,
        components: [...b.components, {
          id: `manual-${playerId}-${beyIdx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: "",
          image_url: null,
        }],
      }),
    }));
  const removeComp = (playerId: string, beyIdx: number, ci: number) =>
    mutateDeck(playerId, d => ({
      ...d,
      beys: d.beys.map((b, i) => i !== beyIdx ? b : {
        ...b,
        components: b.components.filter((_, j) => j !== ci),
      }),
    }));

  const onCompImageFile = useCallback(async (playerId: string, beyIdx: number, ci: number, file: File) => {
    const raw = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    try {
      const img = await loadImage(raw);
      setAssets(prev => {
        const a = prev[playerId]; if (!a?.deck) return prev;
        const bey = a.deck.beys[beyIdx]; if (!bey) return prev;
        const comp = bey.components[ci]; if (!comp) return prev;
        return {
          ...prev,
          [playerId]: {
            ...a,
            deck: {
              ...a.deck,
              beys: a.deck.beys.map((b, i) => i !== beyIdx ? b : {
                ...b,
                components: b.components.map((c, j) => j === ci ? { ...c, image_url: raw } : c),
              }),
            },
            componentImgs: { ...a.componentImgs, [comp.id]: img },
          },
        };
      });
    } catch { toast.error("Immagine non valida"); }
  }, []);



  // ============= Recording =============
  const startRecording = useCallback(async () => {
    const c = canvasRef.current; if (!c) return;
    if (recording) return;
    try {
      const stream = c.captureStream(FPS);
      // Try MP4 first (Safari/Chrome desktop on some builds), then fall back to WebM
      const candidates = [
        "video/mp4;codecs=h264",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mime = candidates.find(m => MediaRecorder.isTypeSupported(m));
      if (!mime) { toast.error("Il browser non supporta MediaRecorder"); return; }
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        const filename = `ibnf-Animation-${(tournamentTitle || "torneo").replace(/[^a-z0-9]+/gi, "-")}.${ext}`;
        const link = document.createElement("a");
        link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setRecording(false);
        toast.success(`Animazione esportata (.${ext})`);
      };
      recorderRef.current = rec;
      rec.start(200);
      setRecording(true);
      toast.info("Registrazione avviata, riproduco l'animazione...");
      stop();
      startTimeRef.current = performance.now();
      setIsPlaying(true);
      const recordedTick = () => {
        if (startTimeRef.current == null) startTimeRef.current = performance.now();
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        if (elapsed >= totalDuration) {
          renderAt(totalDuration - 0.01);
          setProgress(1);
          if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          setIsPlaying(false);
          try { rec.stop(); } catch {}
          return;
        }
        renderAt(elapsed);
        setProgress(elapsed / totalDuration);
        rafRef.current = requestAnimationFrame(recordedTick);
      };
      rafRef.current = requestAnimationFrame(recordedTick);
    } catch (e: any) {
      console.error(e);
      toast.error("Impossibile registrare: " + (e?.message || "errore"));
      setRecording(false);
    }
  }, [recording, totalDuration, renderAt, stop, tournamentTitle]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stop(); onOpenChange(v); }}>
      <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] h-[94vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Film size={20} /> Animazione Torneo
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),480px] xl:grid-cols-[minmax(0,1fr),620px] gap-6">
          <div className="flex flex-col gap-2 min-h-0">
            <div className="relative bg-black rounded-lg overflow-hidden mx-auto flex-1 min-h-0 aspect-square" style={{ maxHeight: "calc(94vh - 180px)" }}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="w-full h-full block" />
              {loadingData && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" onClick={() => { if (isPlaying) stop(); else play(); }} disabled={recording}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span className="ml-1">{isPlaying ? "Pausa" : "Play"}</span>
              </Button>
              <Button size="sm" variant="outline" onClick={startRecording} disabled={recording || loadingData}>
                {recording ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                <span className="ml-1">{recording ? "Registrando..." : "Esporta video"}</span>
              </Button>
              <div className="ml-auto text-xs text-muted-foreground tabular-nums">
                {(progress * totalDuration).toFixed(1)}s / {totalDuration}s
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => {
                if (isPlaying) stop();
                const v = Number(e.target.value) / 1000;
                setProgress(v);
                startTimeRef.current = performance.now() - v * totalDuration * 1000;
                renderAt(Math.min(v * totalDuration, totalDuration - 0.01));
              }}
              className="w-full h-2 accent-primary cursor-pointer flex-shrink-0"
              aria-label="Timeline"
            />
          </div>

          <div className="space-y-4 overflow-y-auto pr-2 min-h-0">
            <Tabs defaultValue="scenes">
              <TabsList className="w-full grid grid-cols-6">
                <TabsTrigger value="scenes">Scene</TabsTrigger>
                <TabsTrigger value="theme"><Palette size={14} className="mr-1" />Tema</TabsTrigger>
                <TabsTrigger value="fx"><Zap size={14} className="mr-1" />FX</TabsTrigger>
                <TabsTrigger value="brand">Brand</TabsTrigger>
                <TabsTrigger value="players">Foto</TabsTrigger>
                <TabsTrigger value="deck">Deck</TabsTrigger>
              </TabsList>

              <TabsContent value="scenes" className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Briefing iniziale</Label>
                  <Switch checked={includeBriefing} onCheckedChange={setIncludeBriefing} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Statistiche torneo</Label>
                  <Switch checked={includeStats} onCheckedChange={setIncludeStats} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Top 10 classifica</Label>
                  <Switch checked={includeTop10} onCheckedChange={setIncludeTop10} />
                </div>
                <div className="pt-3 border-t border-border space-y-1">
                  <Label className="text-xs text-muted-foreground">Sequenza</Label>
                  {scenes.map((s, i) => (
                    <div key={i} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50">
                      <span>{s.id === "player" ? `${(s.data.player as Player).placement}° ${(s.data.player as Player).name}` : s.id.toUpperCase()}</span>
                      <span className="text-muted-foreground">{s.duration}s</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="theme" className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-1"><Wand2 size={14} /> Estrai dal logo</Label>
                  <Switch checked={autoFromLogo} onCheckedChange={setAutoFromLogo} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Preset</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map(p => (
                      <button
                        key={p.name}
                        onClick={() => { setAutoFromLogo(false); setTheme(p.colors); }}
                        className={`p-2 rounded-md border ${theme.join() === p.colors.join() ? "border-primary" : "border-border"} hover:border-primary/60 transition-colors`}
                      >
                        <div className="flex gap-1 mb-1">
                          {p.colors.map((c, i) => <div key={i} className="h-4 flex-1 rounded" style={{ background: c }} />)}
                        </div>
                        <div className="text-xs text-left">{p.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fx" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Layout size={12} /> Pattern sfondo</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PATTERNS.map(pt => (
                      <button
                        key={pt.id}
                        onClick={() => setPattern(pt.id)}
                        className={`px-2 py-1.5 rounded text-xs border transition-colors ${pattern === pt.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}
                      >{pt.name}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Stinger</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {STINGERS.map(st => (
                      <button
                        key={st.id}
                        onClick={() => setStingerKind(st.id)}
                        className={`px-2 py-1.5 rounded text-xs border transition-colors ${stingerKind === st.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}
                      >{st.name}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Scanlines</Label>
                    <Switch checked={fxScanlines} onCheckedChange={setFxScanlines} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Vignette</Label>
                    <Switch checked={fxVignette} onCheckedChange={setFxVignette} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Glow animato</Label>
                    <Switch checked={fxGlow} onCheckedChange={setFxGlow} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="brand" className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Logo sede / negozio (opzionale)</Label>
                  <p className="text-[11px] text-muted-foreground">Se impostato, sostituisce il logo del club nello stinger e FIBeGS viene mostrato in alto.</p>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-14 rounded bg-muted flex items-center justify-center overflow-hidden border border-border">
                      {venueRaw ? <img src={venueRaw} alt="" className="w-full h-full object-contain" /> : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onVenueFile(f); }} />
                      <Button size="sm" variant="outline" asChild><span><Upload size={14} className="mr-1" />Carica logo</span></Button>
                    </label>
                    {venueLogo && (
                      <Button size="sm" variant="ghost" onClick={() => { setVenueLogo(null); setVenueRaw(null); setVenueName(""); }}>
                        Rimuovi
                      </Button>
                    )}
                  </div>
                  {venueLogo && (
                    <input
                      type="text"
                      placeholder="Nome sede"
                      value={venueName}
                      onChange={e => setVenueName(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                    />
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Loghi sponsor (max 8)</Label>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) onSponsorFiles(e.target.files); }} />
                      <Button size="sm" variant="outline" asChild><span><Upload size={14} className="mr-1" />Aggiungi</span></Button>
                    </label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Mostrati nella parte inferiore dello stinger X.</p>
                  {sponsorLogos.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {sponsorLogos.map((s, i) => (
                        <div key={i} className="relative group">
                          <div className="aspect-square rounded bg-muted/50 border border-border flex items-center justify-center overflow-hidden">
                            <img src={s.raw} alt="" className="w-full h-full object-contain" />
                          </div>
                          <button
                            onClick={() => setSponsorLogos(prev => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">Nessuno sponsor caricato</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="players" className="space-y-3 mt-3">
                <div className="flex items-center justify-between p-2 rounded bg-muted/40 border border-border">
                  <Label className="text-xs flex items-center gap-1">
                    <Sparkles size={12} /> Rimuovi sfondo automaticamente
                  </Label>
                  <Switch checked={autoBgRemove} onCheckedChange={setAutoBgRemove} />
                </div>
                {top3.sort((a, b) => a.placement - b.placement).map(p => (
                  <div key={p.user_id} className="p-2 rounded border border-border space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0 relative">
                        {assets[p.user_id]?.photo && (
                          <img src={assets[p.user_id]?.rawDataUrl || p.avatar || ""} className="w-full h-full object-cover" alt="" />
                        )}
                        {bgWorking === p.user_id && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="animate-spin text-primary" size={14} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.placement}° {p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {assets[p.user_id]?.deck ? `Deck: ${assets[p.user_id]?.deck?.deckName}` : "Nessun deck registrato"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onPhotoFile(p.user_id, f); }} />
                        <Button size="sm" variant="outline" asChild><span><Upload size={14} className="mr-1" />Carica</span></Button>
                      </label>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" capture="user" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onPhotoFile(p.user_id, f); }} />
                        <Button size="sm" variant="outline" asChild><span>📷 Scatta</span></Button>
                      </label>
                      {assets[p.user_id]?.rawDataUrl && (
                        <Button size="sm" variant="outline" onClick={() => reRunBgRemoval(p.user_id)} disabled={bgWorking === p.user_id}>
                          <Wand2 size={14} className="mr-1" />Rimuovi sfondo
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sparkles size={12} /> Usa foto verticali 9:16 per la resa migliore.
                </div>
              </TabsContent>

              <TabsContent value="deck" className="space-y-4 mt-3">
                <p className="text-[11px] text-muted-foreground">
                  Modifica o crea il deck dei 3 giocatori. Le modifiche sono usate solo per questa animazione e non toccano i deck salvati.
                </p>
                {[...top3].sort((a, b) => a.placement - b.placement).map(p => {
                  const a = assets[p.user_id];
                  const deck = a?.deck;
                  return (
                    <div key={p.user_id} className="p-3 rounded border border-border space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold truncate">{p.placement}° {p.name}</div>
                        {deck ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => addBey(p.user_id)} disabled={deck.beys.length >= 3}>+ Bey</Button>
                            <Button size="sm" variant="ghost" onClick={() => mutateDeck(p.user_id, () => ({ deckName: "Deck personalizzato", beys: [0,1,2].map(i => emptyBey(p.user_id, i)) }))}>Reset</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => initDeck(p.user_id)}>Crea deck</Button>
                        )}
                      </div>

                      {deck && (
                        <>
                          <input
                            type="text"
                            value={deck.deckName}
                            onChange={e => setDeckName(p.user_id, e.target.value)}
                            placeholder="Nome deck"
                            className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background font-medium"
                          />

                          <div className="space-y-3">
                            {deck.beys.map((bey, bi) => (
                              <div key={bey.id} className="p-2 rounded border border-border bg-background/60 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-muted-foreground w-10">BEY {bi + 1}</span>
                                  <input
                                    type="text"
                                    value={bey.name}
                                    onChange={e => setBeyName(p.user_id, bi, e.target.value)}
                                    placeholder="Nome del beyblade"
                                    className="flex-1 px-2 py-1 text-sm rounded border border-border bg-background"
                                  />
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeBey(p.user_id, bi)}>×</Button>
                                </div>

                                <div className="space-y-1.5 pl-2 border-l-2 border-primary/40">
                                  {bey.components.map((c, ci) => (
                                    <div key={c.id} className="flex items-center gap-2">
                                      <div className="w-9 h-9 rounded bg-muted border border-border overflow-hidden flex-shrink-0">
                                        {c.image_url ? (
                                          <img src={c.image_url} alt="" className="w-full h-full object-contain" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">◇</div>
                                        )}
                                      </div>
                                      <input
                                        type="text"
                                        value={c.name}
                                        onChange={e => setCompName(p.user_id, bi, ci, e.target.value)}
                                        placeholder={`Componente ${ci + 1}`}
                                        className="flex-1 px-2 py-1 text-xs rounded border border-border bg-background"
                                      />
                                      <label className="cursor-pointer">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={e => { const f = e.target.files?.[0]; if (f) onCompImageFile(p.user_id, bi, ci, f); }}
                                        />
                                        <Button size="sm" variant="outline" asChild className="h-7 px-2"><span><Upload size={12} /></span></Button>
                                      </label>
                                      <button
                                        onClick={() => removeComp(p.user_id, bi, ci)}
                                        className="text-destructive text-sm px-1"
                                        title="Rimuovi"
                                      >×</button>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addComp(p.user_id, bi)}>+ Componente</Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="text-xs text-muted-foreground flex-shrink-0">
          Export in MP4 quando il browser lo supporta, altrimenti WebM. Il file viene salvato sul tuo dispositivo.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
