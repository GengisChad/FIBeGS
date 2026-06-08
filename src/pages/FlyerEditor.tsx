import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, Download, Type, QrCode, Image as ImageIcon,
  Trash2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  ChevronUp, ChevronDown, RotateCcw, Copy, Layers, Paintbrush,
  Plus, Sparkles, Settings2, Eye, EyeOff, ChevronRight,
  Square, Circle, Star, Hexagon, Diamond,
  Grip, X, FileText,
  Droplets, Zap, Lock, Unlock,
  Hash, Waves, Cloud, Snowflake, Flower2, Leaf,
  Crosshair, Grid3X3, Triangle, Pentagon, Octagon,
  Maximize2, Minus, MoreHorizontal, Scan, Focus, Shapes,
  Save, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import decalStripesPattern from "@/assets/flyer-patterns/decal-stripes-background.svg";
import decalRacingStripPattern from "@/assets/flyer-patterns/decal-racing-strip-background.svg";
import scratchedGrungePattern from "@/assets/flyer-patterns/black-scratched-grunge-background.svg";
import ibnaLogoSquare from "@/assets/ibna-logo-square.png";

// ── Types ──────────────────────────────────────────────────────────────────────
interface FlyerLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

interface FlyerElement {
  id: string;
  type: "text" | "qrcode" | "image" | "shape" | "info-group";
  x: number; y: number; width: number; height: number;
  content: string;
  layerId: string;
  style: {
    fontSize?: number; fontFamily?: string; fontWeight?: string; fontStyle?: string;
    textDecoration?: string; textAlign?: string; color?: string; backgroundColor?: string;
    padding?: number; borderRadius?: number; opacity?: number; letterSpacing?: number;
    lineHeight?: number; textShadow?: string; boxShadow?: string;
    borderWidth?: number; borderColor?: string; rotate?: number; gradient?: string;
    textTransform?: string;
  };
  zIndex: number; locked?: boolean; visible?: boolean; groupChildren?: InfoField[];
}

interface InfoField {
  key: string; label: string; value: string; icon: string;
  style: { fontSize: number; fontWeight: string; color: string; fontFamily: string; textAlign?: string; textTransform?: string; };
}

interface TournamentData {
  id: string; title: string; event_date: string; city: string; location: string;
  max_participants: number | null; format: string | null; entry_fee: number | null;
  description: string | null; registration_deadline: string;
}

interface Preset {
  name: string; emoji: string; background: string; textColor: string; accentColor: string;
  bgBlur: number; bgDarken: number; decorations: string[];
  starterElements: (t: TournamentData | null, club: string, cw: number, ch: number) => Partial<FlyerElement>[];
}

// ── Aspect Ratios ──────────────────────────────────────────────────────────────
const ASPECT_RATIOS = [
  { label: "9:16", name: "Storie/Reels", w: 1080, h: 1920 },
  { label: "4:5", name: "Post verticale", w: 1080, h: 1350 },
  { label: "1:1", name: "Quadrato", w: 1080, h: 1080 },
  { label: "1.91:1", name: "Orizzontale", w: 1080, h: 566 },
];

const FONT_FAMILIES = [
  "Inter", "Arial", "Georgia", "Impact", "Trebuchet MS",
  "Verdana", "Lucida Console", "Courier New", "Times New Roman",
  "Palatino", "Garamond", "Bookman", "Comic Sans MS",
];

const TEXT_SHADOWS = [
  { name: "Nessuna", value: "none" },
  { name: "Ombra morbida", value: "0 2px 8px rgba(0,0,0,0.5)" },
  { name: "Ombra dura", value: "2px 2px 0px rgba(0,0,0,0.8)" },
  { name: "Glow chiaro", value: "0 0 10px rgba(255,255,255,0.5)" },
  { name: "Glow colorato", value: "0 0 15px rgba(99,102,241,0.6)" },
  { name: "Neon", value: "0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #5271ff" },
  { name: "3D", value: "1px 1px 0 #555, 2px 2px 0 #444, 3px 3px 0 #333" },
];

const BOX_SHADOWS = [
  { name: "Nessuna", value: "none" },
  { name: "Leggera", value: "0 4px 12px rgba(0,0,0,0.15)" },
  { name: "Media", value: "0 8px 24px rgba(0,0,0,0.3)" },
  { name: "Forte", value: "0 12px 40px rgba(0,0,0,0.5)" },
  { name: "Glow", value: "0 0 20px rgba(99,102,241,0.4)" },
  { name: "Inset", value: "inset 0 2px 10px rgba(0,0,0,0.3)" },
];

// ── Decoration type ────────────────────────────────────────────────────────────
type DecoCategory = "forme" | "pattern" | "accenti" | "cornici";
interface Decoration {
  name: string;
  category: DecoCategory;
  icon: React.ReactNode;
  isPattern?: boolean; // tiles automatically across background
  assetUrl?: string;
  svg?: (c: string, o: number, w: number, h: number) => string;
}

const DECORATIONS: Decoration[] = [
  // ── FORME (scattered decorative shapes) ──
  { name: "Cerchi", category: "forme", icon: <Circle size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><circle cx="${w*0.14}" cy="${h*0.08}" r="${w*0.11}" fill="${c}" opacity="${o}"/><circle cx="${w*0.86}" cy="${h*0.16}" r="${w*0.07}" fill="${c}" opacity="${o*0.6}"/><circle cx="${w*0.19}" cy="${h*0.89}" r="${w*0.15}" fill="${c}" opacity="${o*0.4}"/><circle cx="${w*0.81}" cy="${h*0.83}" r="${w*0.09}" fill="${c}" opacity="${o*0.7}"/><circle cx="${w*0.5}" cy="${h*0.96}" r="${w*0.06}" fill="${c}" opacity="${o*0.5}"/></svg>` },
  { name: "Diamanti", category: "forme", icon: <Diamond size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polygon points="${w/2},${h*0.02} ${w/2+w*0.07},${h*0.06} ${w/2},${h*0.1} ${w/2-w*0.07},${h*0.06}" fill="${c}" opacity="${o}"/><polygon points="${w*0.09},${h*0.42} ${w*0.15},${h*0.45} ${w*0.09},${h*0.48} ${w*0.04},${h*0.45}" fill="${c}" opacity="${o*0.6}"/><polygon points="${w*0.91},${h*0.31} ${w*0.96},${h*0.34} ${w*0.91},${h*0.38} ${w*0.85},${h*0.34}" fill="${c}" opacity="${o*0.5}"/><polygon points="${w*0.19},${h*0.83} ${w*0.26},${h*0.88} ${w*0.19},${h*0.92} ${w*0.11},${h*0.88}" fill="${c}" opacity="${o*0.7}"/><polygon points="${w*0.81},${h*0.91} ${w*0.87},${h*0.94} ${w*0.81},${h*0.97} ${w*0.76},${h*0.94}" fill="${c}" opacity="${o*0.4}"/></svg>` },
  { name: "Stelle", category: "forme", icon: <Star size={14} />,
    svg: (c, o, w, h) => { const star = (cx: number, cy: number, r: number, op: number) => { let pts = ""; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5; const rad = i % 2 === 0 ? r : r * 0.4; pts += `${cx + Math.cos(a) * rad},${cy - Math.sin(a) * rad} `; } return `<polygon points="${pts.trim()}" fill="${c}" opacity="${op}"/>`; }; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${star(w*0.14, h*0.05, w*0.06, o)}${star(w*0.86, h*0.12, w*0.05, o*0.6)}${star(w*0.09, h*0.89, w*0.07, o*0.5)}${star(w*0.91, h*0.86, w*0.06, o*0.7)}${star(w*0.5, h*0.03, w*0.04, o*0.8)}</svg>`; } },
  { name: "Triangoli", category: "forme", icon: <Triangle size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polygon points="${w*0.1},${h*0.15} ${w*0.18},${h*0.05} ${w*0.26},${h*0.15}" fill="${c}" opacity="${o}"/><polygon points="${w*0.74},${h*0.22} ${w*0.82},${h*0.12} ${w*0.9},${h*0.22}" fill="${c}" opacity="${o*0.6}"/><polygon points="${w*0.05},${h*0.85} ${w*0.15},${h*0.72} ${w*0.25},${h*0.85}" fill="${c}" opacity="${o*0.5}"/><polygon points="${w*0.8},${h*0.9} ${w*0.88},${h*0.8} ${w*0.96},${h*0.9}" fill="${c}" opacity="${o*0.7}"/></svg>` },
  { name: "Esagoni", category: "forme", icon: <Hexagon size={14} />,
    svg: (c, o, w, h) => { const hex = (cx: number, cy: number, r: number, op: number) => { let pts = ""; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 6; pts += `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r} `; } return `<polygon points="${pts.trim()}" fill="none" stroke="${c}" stroke-width="2" opacity="${op}"/>`; }; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${hex(w*0.14, h*0.06, w*0.06, o)}${hex(w*0.83, h*0.12, w*0.05, o*0.6)}${hex(w*0.5, h*0.89, w*0.06, o*0.5)}${hex(w*0.11, h*0.78, w*0.05, o*0.7)}</svg>`; } },
  { name: "Cuori", category: "forme", icon: <span className="text-[12px]">♥</span>,
    svg: (c, o, w, h) => { const heart = (cx: number, cy: number, s: number, op: number) => `<path d="M${cx},${cy+s*0.3} C${cx},${cy-s*0.2} ${cx-s*0.5},${cy-s*0.5} ${cx-s*0.5},${cy} C${cx-s*0.5},${cy+s*0.3} ${cx},${cy+s*0.6} ${cx},${cy+s*0.8} C${cx},${cy+s*0.6} ${cx+s*0.5},${cy+s*0.3} ${cx+s*0.5},${cy} C${cx+s*0.5},${cy-s*0.5} ${cx},${cy-s*0.2} ${cx},${cy+s*0.3} Z" fill="${c}" opacity="${op}"/>`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${heart(w*0.15, h*0.06, w*0.08, o)}${heart(w*0.85, h*0.12, w*0.06, o*0.6)}${heart(w*0.1, h*0.88, w*0.07, o*0.5)}${heart(w*0.9, h*0.85, w*0.05, o*0.7)}</svg>`; } },
  { name: "Scintille", category: "forme", icon: <Sparkles size={14} />,
    svg: (c, o, w, h) => { const sparkle = (cx: number, cy: number, s: number, op: number) => `<path d="M${cx},${cy-s} L${cx+s*0.15},${cy-s*0.15} L${cx+s},${cy} L${cx+s*0.15},${cy+s*0.15} L${cx},${cy+s} L${cx-s*0.15},${cy+s*0.15} L${cx-s},${cy} L${cx-s*0.15},${cy-s*0.15} Z" fill="${c}" opacity="${op}"/>`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${sparkle(w*0.12, h*0.08, w*0.04, o)}${sparkle(w*0.88, h*0.06, w*0.03, o*0.7)}${sparkle(w*0.75, h*0.15, w*0.02, o*0.5)}${sparkle(w*0.2, h*0.92, w*0.04, o*0.6)}${sparkle(w*0.85, h*0.88, w*0.035, o*0.8)}${sparkle(w*0.5, h*0.04, w*0.025, o*0.5)}${sparkle(w*0.08, h*0.5, w*0.03, o*0.4)}</svg>`; } },
  { name: "Nuvole", category: "forme", icon: <Cloud size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><ellipse cx="${w*0.2}" cy="${h*0.06}" rx="${w*0.12}" ry="${h*0.025}" fill="${c}" opacity="${o*0.3}"/><ellipse cx="${w*0.7}" cy="${h*0.1}" rx="${w*0.15}" ry="${h*0.03}" fill="${c}" opacity="${o*0.25}"/><ellipse cx="${w*0.35}" cy="${h*0.92}" rx="${w*0.18}" ry="${h*0.028}" fill="${c}" opacity="${o*0.3}"/><ellipse cx="${w*0.85}" cy="${h*0.88}" rx="${w*0.1}" ry="${h*0.02}" fill="${c}" opacity="${o*0.2}"/></svg>` },
  { name: "Fiocchi", category: "forme", icon: <Snowflake size={14} />,
    svg: (c, o, w, h) => { const flake = (cx: number, cy: number, s: number, op: number) => { let lines = ""; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; lines += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * s}" y2="${cy + Math.sin(a) * s}" stroke="${c}" stroke-width="1.5" opacity="${op}"/>`; lines += `<line x1="${cx + Math.cos(a) * s * 0.5}" y1="${cy + Math.sin(a) * s * 0.5}" x2="${cx + Math.cos(a + 0.4) * s * 0.7}" y2="${cy + Math.sin(a + 0.4) * s * 0.7}" stroke="${c}" stroke-width="1" opacity="${op * 0.8}"/>`; } return lines; }; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${flake(w*0.15, h*0.08, w*0.05, o)}${flake(w*0.85, h*0.15, w*0.04, o*0.6)}${flake(w*0.1, h*0.85, w*0.05, o*0.5)}${flake(w*0.9, h*0.9, w*0.035, o*0.7)}${flake(w*0.5, h*0.03, w*0.03, o*0.4)}</svg>`; } },
  { name: "Foglie", category: "forme", icon: <Leaf size={14} />,
    svg: (c, o, w, h) => { const leaf = (cx: number, cy: number, s: number, rot: number, op: number) => `<g transform="rotate(${rot},${cx},${cy})"><path d="M${cx},${cy-s} Q${cx+s*0.6},${cy-s*0.3} ${cx},${cy+s} Q${cx-s*0.6},${cy-s*0.3} ${cx},${cy-s}" fill="${c}" opacity="${op}"/><line x1="${cx}" y1="${cy-s}" x2="${cx}" y2="${cy+s}" stroke="${c}" stroke-width="1" opacity="${op*0.5}"/></g>`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${leaf(w*0.12, h*0.08, w*0.04, 30, o)}${leaf(w*0.88, h*0.1, w*0.035, -20, o*0.6)}${leaf(w*0.08, h*0.9, w*0.04, 45, o*0.5)}${leaf(w*0.92, h*0.88, w*0.03, -35, o*0.7)}</svg>`; } },
  { name: "Fiori", category: "forme", icon: <Flower2 size={14} />,
    svg: (c, o, w, h) => { const flower = (cx: number, cy: number, s: number, op: number) => { let petals = ""; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; petals += `<ellipse cx="${cx + Math.cos(a) * s * 0.5}" cy="${cy + Math.sin(a) * s * 0.5}" rx="${s * 0.35}" ry="${s * 0.18}" transform="rotate(${i * 72},${cx + Math.cos(a) * s * 0.5},${cy + Math.sin(a) * s * 0.5})" fill="${c}" opacity="${op}"/>`; } petals += `<circle cx="${cx}" cy="${cy}" r="${s * 0.15}" fill="${c}" opacity="${op * 1.2}"/>`; return petals; }; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${flower(w*0.15, h*0.07, w*0.05, o)}${flower(w*0.85, h*0.12, w*0.04, o*0.6)}${flower(w*0.1, h*0.9, w*0.045, o*0.5)}${flower(w*0.9, h*0.85, w*0.035, o*0.7)}</svg>`; } },
  { name: "Lampi", category: "forme", icon: <Zap size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${w*0.12},${h*0.02} L${w*0.08},${h*0.07} L${w*0.14},${h*0.06} L${w*0.1},${h*0.12}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/><path d="M${w*0.88},${h*0.08} L${w*0.84},${h*0.13} L${w*0.9},${h*0.12} L${w*0.86},${h*0.18}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="${o*0.6}"/><path d="M${w*0.08},${h*0.85} L${w*0.04},${h*0.9} L${w*0.1},${h*0.89} L${w*0.06},${h*0.95}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="${o*0.5}"/><path d="M${w*0.92},${h*0.88} L${w*0.88},${h*0.93} L${w*0.94},${h*0.92} L${w*0.9},${h*0.97}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${o*0.7}"/></svg>` },
  { name: "Spirali", category: "forme", icon: <span className="text-[12px]">🌀</span>,
    svg: (c, o, w, h) => { const spiral = (cx: number, cy: number, s: number, op: number) => { let d = `M${cx},${cy}`; for (let i = 0; i < 20; i++) { const a = i * 0.5; const r = s * 0.05 * i; d += ` L${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`; } return `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.5" opacity="${op}"/>`; }; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${spiral(w*0.12, h*0.06, w*0.06, o)}${spiral(w*0.88, h*0.1, w*0.05, o*0.6)}${spiral(w*0.08, h*0.9, w*0.055, o*0.5)}${spiral(w*0.92, h*0.87, w*0.04, o*0.7)}</svg>`; } },
  { name: "Croci", category: "forme", icon: <Plus size={14} />,
    svg: (c, o, w, h) => { const cross = (cx: number, cy: number, s: number, op: number) => `<g><line x1="${cx-s}" y1="${cy}" x2="${cx+s}" y2="${cy}" stroke="${c}" stroke-width="2.5" opacity="${op}"/><line x1="${cx}" y1="${cy-s}" x2="${cx}" y2="${cy+s}" stroke="${c}" stroke-width="2.5" opacity="${op}"/></g>`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cross(w*0.1, h*0.06, w*0.03, o)}${cross(w*0.9, h*0.12, w*0.025, o*0.6)}${cross(w*0.15, h*0.88, w*0.03, o*0.5)}${cross(w*0.85, h*0.92, w*0.02, o*0.7)}${cross(w*0.5, h*0.03, w*0.02, o*0.4)}</svg>`; } },

  // ── PATTERN (repeating tiles that cover the whole background) ──
  { name: "Puntini", category: "pattern", icon: <Grip size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="2" fill="${c}" opacity="${o}"/></svg>` },
  { name: "Griglia", category: "pattern", icon: <Grid3X3 size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><line x1="0" y1="0" x2="60" y2="0" stroke="${c}" stroke-width="0.5" opacity="${o*0.4}"/><line x1="0" y1="0" x2="0" y2="60" stroke="${c}" stroke-width="0.5" opacity="${o*0.4}"/></svg>` },
  { name: "Linee diag.", category: "pattern", icon: <Zap size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><line x1="0" y1="40" x2="40" y2="0" stroke="${c}" stroke-width="0.8" opacity="${o*0.3}"/></svg>` },
  { name: "Incrociate", category: "pattern", icon: <Hash size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><line x1="0" y1="40" x2="40" y2="0" stroke="${c}" stroke-width="0.6" opacity="${o*0.25}"/><line x1="0" y1="0" x2="40" y2="40" stroke="${c}" stroke-width="0.6" opacity="${o*0.25}"/></svg>` },
  { name: "Zigzag", category: "pattern", icon: <Waves size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="20" viewBox="0 0 60 20"><polyline points="0,15 15,5 30,15 45,5 60,15" fill="none" stroke="${c}" stroke-width="1" opacity="${o*0.4}"/></svg>` },
  { name: "Mattoni", category: "pattern", icon: <Square size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30" viewBox="0 0 60 30"><rect x="0" y="0" width="28" height="13" fill="none" stroke="${c}" stroke-width="0.6" opacity="${o*0.3}"/><rect x="30" y="0" width="28" height="13" fill="none" stroke="${c}" stroke-width="0.6" opacity="${o*0.3}"/><rect x="15" y="15" width="28" height="13" fill="none" stroke="${c}" stroke-width="0.6" opacity="${o*0.3}"/><rect x="-13" y="15" width="28" height="13" fill="none" stroke="${c}" stroke-width="0.6" opacity="${o*0.3}"/><rect x="45" y="15" width="28" height="13" fill="none" stroke="${c}" stroke-width="0.6" opacity="${o*0.3}"/></svg>` },
  { name: "Stelle rip.", category: "pattern", icon: <Star size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => { let pts = ""; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5; const r = i % 2 === 0 ? 8 : 3.5; pts += `${20 + Math.cos(a) * r},${20 - Math.sin(a) * r} `; } return `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><polygon points="${pts.trim()}" fill="${c}" opacity="${o*0.3}"/></svg>`; } },
  { name: "Cerchi rip.", category: "pattern", icon: <Circle size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r="8" fill="none" stroke="${c}" stroke-width="1" opacity="${o*0.3}"/></svg>` },
  { name: "Diamanti rip.", category: "pattern", icon: <Diamond size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><polygon points="20,5 35,20 20,35 5,20" fill="none" stroke="${c}" stroke-width="0.8" opacity="${o*0.3}"/></svg>` },
  { name: "Esagoni rip.", category: "pattern", icon: <Hexagon size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => { let pts = ""; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 6; pts += `${20 + Math.cos(a) * 10},${20 + Math.sin(a) * 10} `; } return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="40" viewBox="0 0 36 40"><polygon points="${pts.trim()}" fill="none" stroke="${c}" stroke-width="0.8" opacity="${o*0.3}"/></svg>`; } },
  { name: "Trattini", category: "pattern", icon: <Minus size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><line x1="5" y1="15" x2="25" y2="15" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="${o*0.3}"/></svg>` },
  { name: "Plus", category: "pattern", icon: <Plus size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><line x1="20" y1="12" x2="20" y2="28" stroke="${c}" stroke-width="1.2" opacity="${o*0.3}"/><line x1="12" y1="20" x2="28" y2="20" stroke="${c}" stroke-width="1.2" opacity="${o*0.3}"/></svg>` },
  { name: "X rip.", category: "pattern", icon: <X size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><line x1="10" y1="10" x2="20" y2="20" stroke="${c}" stroke-width="1" opacity="${o*0.25}"/><line x1="20" y1="10" x2="10" y2="20" stroke="${c}" stroke-width="1" opacity="${o*0.25}"/></svg>` },
  { name: "Triangoli rip.", category: "pattern", icon: <Triangle size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="36" viewBox="0 0 40 36"><polygon points="20,4 36,32 4,32" fill="none" stroke="${c}" stroke-width="0.8" opacity="${o*0.3}"/></svg>` },
  { name: "Fiocchi rip.", category: "pattern", icon: <Snowflake size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => { let lines = ""; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; lines += `<line x1="15" y1="15" x2="${15 + Math.cos(a) * 8}" y2="${15 + Math.sin(a) * 8}" stroke="${c}" stroke-width="0.8" opacity="${o * 0.3}"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">${lines}</svg>`; } },
  { name: "Onde rip.", category: "pattern", icon: <Waves size={14} />, isPattern: true,
    svg: (c, o, _w, _h) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20" viewBox="0 0 80 20"><path d="M0,10 Q20,0 40,10 Q60,20 80,10" fill="none" stroke="${c}" stroke-width="1" opacity="${o*0.3}"/></svg>` },
  { name: "Decal strisce", category: "pattern", icon: <Zap size={14} />, isPattern: false, assetUrl: decalStripesPattern },
  { name: "Racing stripes", category: "pattern", icon: <Shapes size={14} />, isPattern: false, assetUrl: decalRacingStripPattern },
  { name: "Grunge graffiato", category: "pattern", icon: <Hash size={14} />, isPattern: false, assetUrl: scratchedGrungePattern },

  // ── ACCENTI (visual accents and effects) ──
  { name: "Onde", category: "accenti", icon: <Droplets size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M0,${h*0.83} Q${w*0.25},${h*0.79} ${w*0.5},${h*0.83} Q${w*0.75},${h*0.88} ${w},${h*0.83} L${w},${h} L0,${h} Z" fill="${c}" opacity="${o*0.3}"/><path d="M0,${h*0.86} Q${w*0.25},${h*0.82} ${w*0.5},${h*0.86} Q${w*0.75},${h*0.9} ${w},${h*0.86} L${w},${h} L0,${h} Z" fill="${c}" opacity="${o*0.2}"/><path d="M0,${h*0.05} Q${w*0.25},${h*0.09} ${w*0.5},${h*0.05} Q${w*0.75},${h*0.01} ${w},${h*0.05} L${w},0 L0,0 Z" fill="${c}" opacity="${o*0.2}"/></svg>` },
  { name: "Gradiente alto", category: "accenti", icon: <span className="text-[10px]">▽</span>,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${w}" height="${h*0.4}" fill="url(#gt)"/></svg>` },
  { name: "Gradiente basso", category: "accenti", icon: <span className="text-[10px]">△</span>,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="gb" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="${h*0.6}" width="${w}" height="${h*0.4}" fill="url(#gb)"/></svg>` },
  { name: "Vignetta", category: "accenti", icon: <Crosshair size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><radialGradient id="vig" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}" stop-opacity="${o}"/></radialGradient></defs><rect x="0" y="0" width="${w}" height="${h}" fill="url(#vig)"/></svg>` },
  { name: "Rumore", category: "accenti", icon: <MoreHorizontal size={14} />,
    svg: (c, o, w, h) => { let dots = ""; const seed = 42; for (let i = 0; i < 200; i++) { const px = ((seed * (i + 1) * 7) % w); const py = ((seed * (i + 1) * 13) % h); const r = 0.5 + (i % 3) * 0.5; dots += `<circle cx="${px}" cy="${py}" r="${r}" fill="${c}" opacity="${o * 0.15}"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${dots}</svg>`; } },
  { name: "Confetti", category: "accenti", icon: <Sparkles size={14} />,
    svg: (c, o, w, h) => { let rects = ""; const seed = 17; for (let i = 0; i < 40; i++) { const px = ((seed * (i + 1) * 7) % w); const py = ((seed * (i + 1) * 13) % h); const rot = (i * 37) % 360; const sw = 3 + (i % 4) * 2; const sh = 8 + (i % 3) * 4; rects += `<rect x="${px}" y="${py}" width="${sw}" height="${sh}" rx="1" fill="${c}" opacity="${o * 0.3}" transform="rotate(${rot},${px+sw/2},${py+sh/2})"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rects}</svg>`; } },
  { name: "Pennellata", category: "accenti", icon: <Paintbrush size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${w*0.05},${h*0.92} Q${w*0.15},${h*0.88} ${w*0.3},${h*0.9} Q${w*0.5},${h*0.93} ${w*0.7},${h*0.89} Q${w*0.85},${h*0.86} ${w*0.95},${h*0.9}" fill="none" stroke="${c}" stroke-width="${w*0.025}" stroke-linecap="round" opacity="${o*0.4}"/><path d="M${w*0.05},${h*0.07} Q${w*0.2},${h*0.04} ${w*0.4},${h*0.06} Q${w*0.6},${h*0.09} ${w*0.8},${h*0.05} Q${w*0.9},${h*0.03} ${w*0.95},${h*0.06}" fill="none" stroke="${c}" stroke-width="${w*0.018}" stroke-linecap="round" opacity="${o*0.3}"/></svg>` },
  { name: "Strisciate", category: "accenti", icon: <Minus size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${w*0.02},${h*0.15} Q${w*0.1},${h*0.13} ${w*0.25},${h*0.16} Q${w*0.4},${h*0.19} ${w*0.5},${h*0.14}" fill="none" stroke="${c}" stroke-width="${w*0.035}" stroke-linecap="round" opacity="${o*0.35}"/><path d="M${w*0.55},${h*0.85} Q${w*0.65},${h*0.82} ${w*0.8},${h*0.86} Q${w*0.9},${h*0.89} ${w*0.98},${h*0.84}" fill="none" stroke="${c}" stroke-width="${w*0.03}" stroke-linecap="round" opacity="${o*0.3}"/><path d="M${w*0.7},${h*0.08} Q${w*0.8},${h*0.05} ${w*0.92},${h*0.09}" fill="none" stroke="${c}" stroke-width="${w*0.02}" stroke-linecap="round" opacity="${o*0.25}"/></svg>` },
  { name: "Graffi", category: "accenti", icon: <Hash size={14} />,
    svg: (c, o, w, h) => { let lines = ""; const seed = 31; for (let i = 0; i < 15; i++) { const x1 = (seed * (i+1) * 7) % w; const y1 = (seed * (i+1) * 13) % h; const len = 20 + (i % 5) * 15; const angle = (i * 47) % 180; const x2 = x1 + Math.cos(angle * Math.PI / 180) * len; const y2 = y1 + Math.sin(angle * Math.PI / 180) * len; lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${0.8 + (i%3)*0.4}" stroke-linecap="round" opacity="${o * 0.2}"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${lines}</svg>`; } },
  { name: "Schizzi", category: "accenti", icon: <Droplets size={14} />,
    svg: (c, o, w, h) => { let dots = ""; const seed = 53; for (let i = 0; i < 50; i++) { const px = (seed * (i+1) * 11) % w; const py = (seed * (i+1) * 17) % h; const r = 1 + (i % 4) * 1.5; dots += `<circle cx="${px}" cy="${py}" r="${r}" fill="${c}" opacity="${o * (0.15 + (i%3)*0.1)}"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${dots}</svg>`; } },
  { name: "Grad. laterale", category: "accenti", icon: <span className="text-[10px]">◁</span>,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="${w*0.4}" height="${h}" fill="url(#gl)"/></svg>` },
  { name: "Macchie", category: "accenti", icon: <Cloud size={14} />,
    svg: (c, o, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><ellipse cx="${w*0.15}" cy="${h*0.1}" rx="${w*0.08}" ry="${w*0.06}" fill="${c}" opacity="${o*0.15}" transform="rotate(20,${w*0.15},${h*0.1})"/><ellipse cx="${w*0.85}" cy="${h*0.2}" rx="${w*0.06}" ry="${w*0.05}" fill="${c}" opacity="${o*0.12}" transform="rotate(-15,${w*0.85},${h*0.2})"/><ellipse cx="${w*0.1}" cy="${h*0.85}" rx="${w*0.09}" ry="${w*0.07}" fill="${c}" opacity="${o*0.18}" transform="rotate(35,${w*0.1},${h*0.85})"/><ellipse cx="${w*0.9}" cy="${h*0.9}" rx="${w*0.07}" ry="${w*0.05}" fill="${c}" opacity="${o*0.14}" transform="rotate(-25,${w*0.9},${h*0.9})"/></svg>` },

  // ── CORNICI (border/frame decorations) ──
  { name: "Angoli", category: "cornici", icon: <Scan size={14} />,
    svg: (c, o, w, h) => { const s = w * 0.18; const t = 8; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M0,0 L${s},0 L${s},${t} L${t},${t} L${t},${s} L0,${s} Z" fill="${c}" opacity="${o}"/><path d="M${w},0 L${w-s},0 L${w-s},${t} L${w-t},${t} L${w-t},${s} L${w},${s} Z" fill="${c}" opacity="${o}"/><path d="M0,${h} L${s},${h} L${s},${h-t} L${t},${h-t} L${t},${h-s} L0,${h-s} Z" fill="${c}" opacity="${o}"/><path d="M${w},${h} L${w-s},${h} L${w-s},${h-t} L${w-t},${h-t} L${w-t},${h-s} L${w},${h-s} Z" fill="${c}" opacity="${o}"/></svg>`; } },
  { name: "Bordo linea", category: "cornici", icon: <Maximize2 size={14} />,
    svg: (c, o, w, h) => { const m = 30; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="${m}" y="${m}" width="${w-m*2}" height="${h-m*2}" fill="none" stroke="${c}" stroke-width="2" opacity="${o}" rx="4"/></svg>`; } },
  { name: "Bordo doppio", category: "cornici", icon: <Square size={14} />,
    svg: (c, o, w, h) => { const m1 = 24; const m2 = 36; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="${m1}" y="${m1}" width="${w-m1*2}" height="${h-m1*2}" fill="none" stroke="${c}" stroke-width="1.5" opacity="${o}"/><rect x="${m2}" y="${m2}" width="${w-m2*2}" height="${h-m2*2}" fill="none" stroke="${c}" stroke-width="1" opacity="${o*0.6}"/></svg>`; } },
  { name: "Bordo tratteg.", category: "cornici", icon: <Square size={14} />,
    svg: (c, o, w, h) => { const m = 30; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="${m}" y="${m}" width="${w-m*2}" height="${h-m*2}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="12,6" opacity="${o}" rx="8"/></svg>`; } },
  { name: "Cornice grunge", category: "cornici", icon: <Hash size={14} />,
    svg: (c, o, w, h) => { let edges = ""; const seed = 29; for (let i = 0; i < 30; i++) { const side = i % 4; let x1, y1, x2, y2; const off = (seed * (i+1) * 7) % 40; if (side === 0) { x1 = (i*w/8)%w; y1 = 0; x2 = x1 + off - 20; y2 = 15 + off/3; } else if (side === 1) { x1 = w; y1 = (i*h/8)%h; x2 = w - 15 - off/3; y2 = y1 + off - 20; } else if (side === 2) { x1 = (i*w/8)%w; y1 = h; x2 = x1 + off - 20; y2 = h - 15 - off/3; } else { x1 = 0; y1 = (i*h/8)%h; x2 = 15 + off/3; y2 = y1 + off - 20; } edges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${1+i%2}" opacity="${o*0.4}"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${edges}</svg>`; } },
  { name: "Angoli rotondi", category: "cornici", icon: <Circle size={14} />,
    svg: (c, o, w, h) => { const s = w * 0.12; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${s},0 A${s},${s} 0 0,0 0,${s}" fill="none" stroke="${c}" stroke-width="3" opacity="${o}"/><path d="M${w-s},0 A${s},${s} 0 0,1 ${w},${s}" fill="none" stroke="${c}" stroke-width="3" opacity="${o}"/><path d="M0,${h-s} A${s},${s} 0 0,0 ${s},${h}" fill="none" stroke="${c}" stroke-width="3" opacity="${o}"/><path d="M${w},${h-s} A${s},${s} 0 0,1 ${w-s},${h}" fill="none" stroke="${c}" stroke-width="3" opacity="${o}"/></svg>`; } },
  { name: "Bordo interno", category: "cornici", icon: <Maximize2 size={14} />,
    svg: (c, o, w, h) => { const m = 50; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="${m}" y="${m}" width="${w-m*2}" height="${h-m*2}" fill="none" stroke="${c}" stroke-width="1" opacity="${o*0.5}" rx="12"/><rect x="${m+8}" y="${m+8}" width="${w-m*2-16}" height="${h-m*2-16}" fill="none" stroke="${c}" stroke-width="0.5" opacity="${o*0.3}" rx="8"/></svg>`; } },
  { name: "Tape angoli", category: "cornici", icon: <Scan size={14} />,
    svg: (c, o, w, h) => { const tape = (x: number, y: number, rot: number) => `<rect x="${x-20}" y="${y-5}" width="40" height="10" rx="1" fill="${c}" opacity="${o*0.5}" transform="rotate(${rot},${x},${y})"/>`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${tape(35, 35, 45)}${tape(w-35, 35, -45)}${tape(35, h-35, -45)}${tape(w-35, h-35, 45)}</svg>`; } },
];

const DECO_CATEGORIES: { id: DecoCategory; label: string }[] = [
  { id: "forme", label: "Forme" },
  { id: "pattern", label: "Pattern" },
  { id: "accenti", label: "Accenti" },
  { id: "cornici", label: "Cornici" },
];

let nextId = 1;
const genId = () => `el-${nextId++}`;

// ── Helpers ────────────────────────────────────────────────────────────────────
const makeText = (content: string, x: number, y: number, w: number, opts: Partial<FlyerElement["style"]> & { zIndex?: number } = {}): Partial<FlyerElement> => ({
  type: "text", x, y, width: w, height: 80, content,
  style: {
    fontSize: 48, fontFamily: "Inter", fontWeight: "700", fontStyle: "normal",
    textDecoration: "none", textAlign: "center", color: "#ffffff",
    backgroundColor: "transparent", padding: 8, borderRadius: 0, opacity: 1,
    letterSpacing: 0, lineHeight: 1.2, textShadow: "none", boxShadow: "none",
    borderWidth: 0, borderColor: "transparent", rotate: 0, ...opts,
  },
  zIndex: opts.zIndex ?? 1,
});

const makeQR = (tid: string, x: number, y: number, size: number, zIndex = 1): Partial<FlyerElement> => ({
  type: "qrcode", x, y, width: size, height: size,
  content: `${window.location.origin}/tournaments/${tid}`,
  style: { padding: 16, backgroundColor: "#ffffff", borderRadius: 16, opacity: 1 },
  zIndex,
});

const makeInfoGroup = (t: TournamentData, clubName: string, x: number, y: number, w: number, accent: string, textColor: string): Partial<FlyerElement> => ({
  type: "info-group", x, y, width: w, height: 600, content: "info",
  style: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 24, padding: 40, opacity: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  groupChildren: [
    { key: "club", label: "Club", value: clubName.toUpperCase(), icon: "shield", style: { fontSize: 28, fontWeight: "600", color: accent, fontFamily: "Inter" } },
    { key: "title", label: "Titolo", value: t.title.toUpperCase(), icon: "trophy", style: { fontSize: 56, fontWeight: "900", color: textColor, fontFamily: "Inter" } },
    { key: "fee", label: "Quota", value: t.entry_fee ? `ISCRIZIONE: ${t.entry_fee}€` : "ISCRIZIONE GRATUITA", icon: "info", style: { fontSize: 34, fontWeight: "700", color: accent, fontFamily: "Inter" } },
    { key: "date", label: "Data", value: format(new Date(t.event_date), "EEEE d MMMM yyyy", { locale: it }).toUpperCase(), icon: "calendar", style: { fontSize: 36, fontWeight: "600", color: textColor, fontFamily: "Inter" } },
    { key: "time", label: "Orario", value: `INIZIO: ${format(new Date(t.event_date), "HH:mm", { locale: it })}`, icon: "clock", style: { fontSize: 30, fontWeight: "500", color: "rgba(255,255,255,0.7)", fontFamily: "Inter" } },
    ...(t.registration_deadline ? [{ key: "deadline", label: "Scadenza", value: `CHIUSURA ISCRIZIONI: ${format(new Date(t.registration_deadline), "HH:mm", { locale: it })}`, icon: "clock", style: { fontSize: 28, fontWeight: "500", color: "rgba(255,255,255,0.6)", fontFamily: "Inter" } }] : []),
    { key: "location", label: "Luogo", value: (t.location || t.city).toUpperCase(), icon: "map", style: { fontSize: 32, fontWeight: "600", color: textColor, fontFamily: "Inter" } },
    { key: "city", label: "Città", value: t.city.toUpperCase(), icon: "pin", style: { fontSize: 24, fontWeight: "500", color: "rgba(255,255,255,0.5)", fontFamily: "Inter" } },
  ],
  zIndex: 5,
});

// ── Presets ─────────────────────────────────────────────────────────────────────
const PRESETS: Preset[] = [
  {
    name: "Vuoto", emoji: "✨", background: "#ffffff",
    textColor: "#1a1a2e", accentColor: "#f59e0b", bgBlur: 0, bgDarken: 0, decorations: [],
    starterElements: () => [],
  },
  {
    name: "Classico", emoji: "🏆",
    background: "linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 40%, #0f0f23 100%)",
    textColor: "#ffffff", accentColor: "#f59e0b", bgBlur: 0, bgDarken: 0, decorations: ["Angoli"],
    starterElements: (t, club, cw, ch) => {
      if (!t) return [];
      return [
        { ...makeInfoGroup(t, club, 40, ch * 0.1, cw - 80, "#f59e0b", "#ffffff") },
        makeQR(t.id, cw / 2 - 150, ch * 0.68, 300, 10),
        makeText("SCANSIONA PER ISCRIVERTI", cw * 0.18, ch * 0.85, cw * 0.63, { fontSize: 24, fontWeight: "600", color: "#888899", textAlign: "center", zIndex: 11 }),
      ];
    },
  },
  {
    name: "Fuoco", emoji: "🔥",
    background: "linear-gradient(180deg, #1a0000 0%, #4a0000 40%, #8b0000 80%, #1a0000 100%)",
    textColor: "#ffffff", accentColor: "#ff6b35", bgBlur: 0, bgDarken: 0, decorations: ["Stelle"],
    starterElements: (t, club, cw, ch) => {
      if (!t) return [];
      return [
        { ...makeInfoGroup(t, club, 40, ch * 0.09, cw - 80, "#ff6b35", "#ffffff") },
        makeQR(t.id, cw / 2 - 150, ch * 0.7, 300, 10),
        makeText("ISCRIVITI ORA!", cw * 0.18, ch * 0.87, cw * 0.63, { fontSize: 28, fontWeight: "800", color: "#ff6b35", textAlign: "center", zIndex: 11 }),
      ];
    },
  },
  {
    name: "Ghiaccio", emoji: "❄️",
    background: "linear-gradient(180deg, #0c1445 0%, #1e3a5f 50%, #0a2647 100%)",
    textColor: "#e0f0ff", accentColor: "#38bdf8", bgBlur: 0, bgDarken: 0, decorations: ["Fiocchi"],
    starterElements: (t, club, cw, ch) => {
      if (!t) return [];
      return [
        { ...makeInfoGroup(t, club, 40, ch * 0.1, cw - 80, "#38bdf8", "#e0f0ff") },
        makeQR(t.id, cw / 2 - 140, ch * 0.7, 280, 10),
      ];
    },
  },
  {
    name: "Neon", emoji: "💜",
    background: "linear-gradient(180deg, #0a0015 0%, #1a0030 50%, #2d004d 100%)",
    textColor: "#f0e0ff", accentColor: "#c084fc", bgBlur: 0, bgDarken: 0, decorations: ["Esagoni rip."],
    starterElements: (t, club, cw, ch) => {
      if (!t) return [];
      return [
        { ...makeInfoGroup(t, club, 40, ch * 0.1, cw - 80, "#c084fc", "#f0e0ff") },
        makeQR(t.id, cw / 2 - 140, ch * 0.7, 280, 10),
      ];
    },
  },
  {
    name: "Oro", emoji: "👑",
    background: "linear-gradient(180deg, #1a1000 0%, #2d1f00 50%, #1a1000 100%)",
    textColor: "#fde68a", accentColor: "#f59e0b", bgBlur: 0, bgDarken: 0, decorations: ["Diamanti"],
    starterElements: (t, club, cw, ch) => {
      if (!t) return [];
      return [
        { ...makeInfoGroup(t, club, 40, ch * 0.1, cw - 80, "#f59e0b", "#fde68a") },
        makeQR(t.id, cw / 2 - 140, ch * 0.7, 280, 10),
      ];
    },
  },
  {
    name: "Minimal", emoji: "⬜",
    background: "linear-gradient(180deg, #f8f9fa 0%, #e9ecef 50%, #dee2e6 100%)",
    textColor: "#1a1a2e", accentColor: "#6366f1", bgBlur: 0, bgDarken: 0, decorations: ["Puntini"],
    starterElements: (t, club, cw, ch) => {
      if (!t) return [];
      return [
        { ...makeInfoGroup(t, club, 40, ch * 0.13, cw - 80, "#6366f1", "#1a1a2e") },
        makeQR(t.id, cw / 2 - 130, ch * 0.73, 260, 10),
      ];
    },
  },
  {
    name: "Foresta", emoji: "🌿",
    background: "linear-gradient(180deg, #0a1f0a 0%, #1a3a1a 50%, #0d2b0d 100%)",
    textColor: "#e0ffe0", accentColor: "#4ade80", bgBlur: 0, bgDarken: 0, decorations: ["Foglie"],
    starterElements: (t, club, cw, ch) => {
      if (!t) return [];
      return [
        { ...makeInfoGroup(t, club, 40, ch * 0.1, cw - 80, "#4ade80", "#e0ffe0") },
        makeQR(t.id, cw / 2 - 140, ch * 0.72, 280, 10),
      ];
    },
  },
];

// ── Component ──────────────────────────────────────────────────────────────────
const FlyerEditor = () => {
  const navigate = useNavigate();
  const { clubId } = useParams<{ clubId: string }>();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournament");
  const isMobile = useIsMobile();

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Aspect ratio
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const currentRatio = ASPECT_RATIOS.find((r) => r.label === aspectRatio) || ASPECT_RATIOS[0];
  const CANVAS_WIDTH = currentRatio.w;
  const CANVAS_HEIGHT = currentRatio.h;

  const [elements, setElements] = useState<FlyerElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backgroundStyle, setBackgroundStyle] = useState(PRESETS[0].background);
  // Gradient background controls
  const [bgMode, setBgMode] = useState<"solid" | "gradient">("gradient");
  const [bgColor1, setBgColor1] = useState("#ffffff");
  const [bgColor2, setBgColor2] = useState("#000000");
  const [bgColor3, setBgColor3] = useState<string | null>(null);
  const [bgGradientType, setBgGradientType] = useState<"linear" | "radial">("linear");
  const [bgGradientAngle, setBgGradientAngle] = useState(180);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [bgImageFit, setBgImageFit] = useState<"cover" | "fitWidth" | "fitHeight" | "stretch">("cover");
  const [bgImagePosX, setBgImagePosX] = useState(50);
  const [bgImagePosY, setBgImagePosY] = useState(50);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [otherClubs, setOtherClubs] = useState<{id: string; name: string; logo_url: string | null}[]>([]);

  const buildGradientFromState = useCallback(() => {
    if (bgMode === "solid") return bgColor1;
    const stops = bgColor3
      ? `${bgColor1} 0%, ${bgColor2} 50%, ${bgColor3} 100%`
      : `${bgColor1} 0%, ${bgColor2} 100%`;
    return bgGradientType === "radial"
      ? `radial-gradient(circle, ${stops})`
      : `linear-gradient(${bgGradientAngle}deg, ${stops})`;
  }, [bgMode, bgColor1, bgColor2, bgColor3, bgGradientType, bgGradientAngle]);

  // Sync gradient state → backgroundStyle whenever controls change
  useEffect(() => {
    if (!backgroundImage) {
      setBackgroundStyle(buildGradientFromState());
    }
  }, [bgMode, bgColor1, bgColor2, bgColor3, bgGradientType, bgGradientAngle, backgroundImage, buildGradientFromState]);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(tournamentId || "");
  const [clubName, setClubName] = useState("");
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startW: number; startH: number; startX: number; startY: number; startElX: number; startElY: number; dir: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseScale, setBaseScale] = useState(0.35);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const scale = baseScale * canvasZoom;
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ startX: number; startY: number; startOffX: number; startOffY: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);
  const [presetColor, setPresetColor] = useState(PRESETS[0].textColor);
  const [presetAccent, setPresetAccent] = useState(PRESETS[0].accentColor);
  const [bgBlur, setBgBlur] = useState(0);
  const [bgDarken, setBgDarken] = useState(0);
  const [activeDecorations, setActiveDecorations] = useState<string[]>([]);
  const [decoSettings, setDecoSettings] = useState<Record<string, { color: string; opacity: number }>>({});
  const defaultDecoColor = "#ffffff";
  const defaultDecoOpacity = 0.3;
  const [rightPanel, setRightPanel] = useState<"style" | "layers" | null>("style");
  const [editingGroupField, setEditingGroupField] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"add" | "style" | "layers" | "bg" | "deco" | "preset" | "actions">("add");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [decoCategory, setDecoCategory] = useState<DecoCategory>("forme");

  // ── Layer system ──
  const DEFAULT_LAYER_ID = "layer-default";
  const [layers, setLayers] = useState<FlyerLayer[]>([
    { id: DEFAULT_LAYER_ID, name: "Livello 1", visible: true, locked: false, order: 0 },
  ]);
  const [activeLayerId, setActiveLayerId] = useState(DEFAULT_LAYER_ID);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);

  const selectedElement = elements.find((e) => e.id === selectedId) || null;

  const getEffectiveZIndex = useCallback((el: FlyerElement) => {
    const layer = layers.find((l) => l.id === el.layerId);
    const layerOrder = layer ? layer.order : 0;
    return (layerOrder + 1) * 100 + el.zIndex;
  }, [layers]);

  const isElementInteractable = useCallback((el: FlyerElement) => {
    const layer = layers.find((l) => l.id === el.layerId);
    if (!layer) return true;
    return layer.visible && !layer.locked;
  }, [layers]);

  const isElementVisible = useCallback((el: FlyerElement) => {
    if (el.visible === false) return false;
    const layer = layers.find((l) => l.id === el.layerId);
    return layer ? layer.visible : true;
  }, [layers]);

  const addLayer = () => {
    const maxOrder = Math.max(...layers.map((l) => l.order), -1);
    const newLayer: FlyerLayer = {
      id: `layer-${Date.now()}`,
      name: `Livello ${layers.length + 1}`,
      visible: true, locked: false, order: maxOrder + 1,
    };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  };

  const deleteLayer = (layerId: string) => {
    if (layers.length <= 1) return;
    const fallback = layers.find((l) => l.id !== layerId)!;
    setElements((prev) => prev.map((el) => el.layerId === layerId ? { ...el, layerId: fallback.id } : el));
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
    if (activeLayerId === layerId) setActiveLayerId(fallback.id);
  };

  const moveLayer = (layerId: string, dir: "up" | "down") => {
    setLayers((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((l) => l.id === layerId);
      if (dir === "up" && idx < sorted.length - 1) {
        const tmp = sorted[idx].order; sorted[idx].order = sorted[idx + 1].order; sorted[idx + 1].order = tmp;
      } else if (dir === "down" && idx > 0) {
        const tmp = sorted[idx].order; sorted[idx].order = sorted[idx - 1].order; sorted[idx - 1].order = tmp;
      }
      return [...sorted];
    });
  };

  // ── Fetch club & tournaments ───────────────────────────────────────────────
  useEffect(() => {
    if (!clubId) return;
    (async () => {
      const [{ data: clubData }, { data: tourData }, { data: allClubs }] = await Promise.all([
        supabase.from("clubs").select("name, logo_url").eq("id", clubId).single(),
        supabase.from("tournaments").select("id, title, event_date, city, location, max_participants, format, entry_fee, description, registration_deadline").eq("club_id", clubId).order("event_date", { ascending: false }),
        supabase.from("clubs").select("id, name, logo_url").neq("id", clubId).order("name"),
      ]);
      if (clubData) {
        setClubName((clubData as any).name);
        setClubLogoUrl((clubData as any).logo_url);
      }
      if (tourData) setTournaments(tourData as any);
      if (allClubs) setOtherClubs(allClubs as any);
    })();
  }, [clubId]);

  // ── Sync tournament from selection ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedTournamentId) { setTournament(null); return; }
    const found = tournaments.find((t) => t.id === selectedTournamentId);
    if (found) setTournament(found);
  }, [selectedTournamentId, tournaments]);

  useEffect(() => {
    if (!isMobile) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [isMobile]);

  // ── Scale canvas ───────────────────────────────────────────────────────────
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const padX = isMobile ? 16 : 40;
      const padY = isMobile ? 16 : 40;
      const scaleX = (rect.width - padX) / CANVAS_WIDTH;
      const scaleY = (rect.height - padY) / CANVAS_HEIGHT;
      setBaseScale(Math.max(0.05, Math.min(scaleX, scaleY)));
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", updateScale);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [isMobile, rightPanel, mobileSheetOpen, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Reset zoom/offset when ratio changes
  useEffect(() => {
    setCanvasZoom(1);
    setCanvasOffset({ x: 0, y: 0 });
  }, [aspectRatio]);

  // ── Wheel zoom toward cursor (correct coordinate math) ────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - containerRect.left;
    const my = e.clientY - containerRect.top;

    const oldZoom = canvasZoom;
    const newZoom = Math.max(0.2, Math.min(5, oldZoom - e.deltaY * 0.002));
    const factor = newZoom / oldZoom;

    // Calculate current visual position of canvas (centered by flexbox + offset)
    const oldScaledW = CANVAS_WIDTH * baseScale * oldZoom;
    const oldScaledH = CANVAS_HEIGHT * baseScale * oldZoom;
    const newScaledW = CANVAS_WIDTH * baseScale * newZoom;
    const newScaledH = CANVAS_HEIGHT * baseScale * newZoom;
    const cw = containerRect.width;
    const ch = containerRect.height;

    // Current canvas visual top-left (flex centering + offset)
    const oldLeft = (cw - oldScaledW) / 2 + canvasOffset.x;
    const oldTop = (ch - oldScaledH) / 2 + canvasOffset.y;

    // Mouse position relative to canvas
    const relX = mx - oldLeft;
    const relY = my - oldTop;

    // After zoom, the same point should be at same mouse position
    const newRelX = relX * factor;
    const newRelY = relY * factor;

    const newCenterLeft = (cw - newScaledW) / 2;
    const newCenterTop = (ch - newScaledH) / 2;

    setCanvasOffset({
      x: mx - newRelX - newCenterLeft,
      y: my - newRelY - newCenterTop,
    });
    setCanvasZoom(newZoom);
  }, [canvasZoom, baseScale, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // ── Pan with left mouse on canvas bg ───────────────────────────────────────
  const handleCanvasBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return;
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      setSelectedId(null);
      setPresetOpen(false);
      setPanning({ startX: e.clientX, startY: e.clientY, startOffX: canvasOffset.x, startOffY: canvasOffset.y });
    }
  }, [canvasOffset]);

  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      setCanvasOffset({ x: panning.startOffX + (e.clientX - panning.startX), y: panning.startOffY + (e.clientY - panning.startY) });
    };
    const onUp = () => setPanning(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [panning]);

  // ── Touch pinch zoom + single-finger pan + two-finger pan ───────────────────
  const lastSingleTouch = useRef<{ x: number; y: number; startOffX: number; startOffY: number } | null>(null);

  const handleCanvasTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastSingleTouch.current = null;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      // Single finger pan on canvas background
      lastSingleTouch.current = {
        x: e.touches[0].clientX, y: e.touches[0].clientY,
        startOffX: canvasOffset.x, startOffY: canvasOffset.y,
      };
    }
  }, [canvasOffset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastSingleTouch.current = null;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastPinchDist.current !== null) {
          const delta = dist / lastPinchDist.current;
          setCanvasZoom((prev) => Math.max(0.2, Math.min(5, prev * delta)));
        }
        lastPinchDist.current = dist;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if ((e as any)._lastMidX !== undefined) {
          setCanvasOffset((prev) => ({ x: prev.x + (midX - (e as any)._lastMidX), y: prev.y + (midY - (e as any)._lastMidY) }));
        }
        (e as any)._lastMidX = midX;
        (e as any)._lastMidY = midY;
      } else if (e.touches.length === 1 && lastSingleTouch.current) {
        e.preventDefault();
        const touch = e.touches[0];
        setCanvasOffset({
          x: lastSingleTouch.current.startOffX + (touch.clientX - lastSingleTouch.current.x),
          y: lastSingleTouch.current.startOffY + (touch.clientY - lastSingleTouch.current.y),
        });
      }
    };
    const onTouchEnd = () => { lastPinchDist.current = null; lastSingleTouch.current = null; };
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    return () => { container.removeEventListener("touchmove", onTouchMove); container.removeEventListener("touchend", onTouchEnd); };
  }, []);

  const resetView = useCallback(() => {
    setCanvasZoom(1);
    setCanvasOffset({ x: 0, y: 0 });
  }, []);

  // ── Drag handling ──────────────────────────────────────────────────────────
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    }, [scale]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent, elId: string) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const el = elements.find((el) => el.id === elId);
      if (el?.locked || !isElementInteractable(el!)) return;
      setSelectedId(elId);
      const coords = getCanvasCoords(e);
      if (!el) return;
      setDragging({ id: elId, offsetX: coords.x - el.x, offsetY: coords.y - el.y });
    }, [elements, getCanvasCoords, isElementInteractable]
  );

  const onResizeDown = useCallback(
    (e: React.MouseEvent, elId: string, dir: string = "se") => {
      e.stopPropagation(); e.preventDefault();
      const el = elements.find((el) => el.id === elId);
      if (!el) return;
      setResizing({ id: elId, startW: el.width, startH: el.height, startX: e.clientX, startY: e.clientY, startElX: el.x, startElY: el.y, dir });
    }, [elements]
  );

  const applyResize = useCallback((startState: typeof resizing, dxRaw: number, dyRaw: number) => {
    if (!startState) return;
    const { id, startW, startH, startElX, startElY, dir } = startState;
    let newW = startW, newH = startH, newX = startElX, newY = startElY;
    if (dir.includes("e")) { newW = Math.max(40, startW + dxRaw); }
    if (dir.includes("w")) { newW = Math.max(40, startW - dxRaw); newX = startElX + (startW - newW); }
    if (dir.includes("s")) { newH = Math.max(30, startH + dyRaw); }
    if (dir.includes("n")) { newH = Math.max(30, startH - dyRaw); newY = startElY + (startH - newH); }
    setElements((prev) => prev.map((el) =>
      el.id === id ? { ...el, x: newX, y: newY, width: newW, height: newH } : el
    ));
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        const coords = getCanvasCoords(e);
        setElements((prev) => prev.map((el) =>
          el.id === dragging.id ? { ...el, x: Math.max(0, Math.min(CANVAS_WIDTH - el.width, coords.x - dragging.offsetX)), y: Math.max(0, Math.min(CANVAS_HEIGHT - el.height, coords.y - dragging.offsetY)) } : el
        ));
      }
      if (resizing) {
        const dx = (e.clientX - resizing.startX) / scale;
        const dy = (e.clientY - resizing.startY) / scale;
        applyResize(resizing, dx, dy);
      }
    };
    const onUp = () => { setDragging(null); setResizing(null); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, resizing, getCanvasCoords, scale, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // ── Touch handling ─────────────────────────────────────────────────────────
  const onTouchStart = useCallback(
    (e: React.TouchEvent, elId: string) => {
      e.stopPropagation();
      const el = elements.find((el) => el.id === elId);
      if (el?.locked || !isElementInteractable(el!)) return;
      setSelectedId(elId);
      const touch = e.touches[0];
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / scale;
      const y = (touch.clientY - rect.top) / scale;
      if (!el) return;
      setDragging({ id: elId, offsetX: x - el.x, offsetY: y - el.y });
    }, [elements, scale, isElementInteractable]
  );

  const onResizeTouchStart = useCallback(
    (e: React.TouchEvent, elId: string, dir: string = "se") => {
      e.stopPropagation(); e.preventDefault();
      const el = elements.find((el) => el.id === elId);
      if (!el) return;
      const touch = e.touches[0];
      setResizing({ id: elId, startW: el.width, startH: el.height, startX: touch.clientX, startY: touch.clientY, startElX: el.x, startElY: el.y, dir });
    }, [elements]
  );

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging && !resizing) return;
      if (!canvasRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (dragging) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (touch.clientX - rect.left) / scale;
        const y = (touch.clientY - rect.top) / scale;
        setElements((prev) => prev.map((el) =>
          el.id === dragging.id ? { ...el, x: Math.max(0, Math.min(CANVAS_WIDTH - el.width, x - dragging.offsetX)), y: Math.max(0, Math.min(CANVAS_HEIGHT - el.height, y - dragging.offsetY)) } : el
        ));
      }
      if (resizing) {
        const dx = (touch.clientX - resizing.startX) / scale;
        const dy = (touch.clientY - resizing.startY) / scale;
        applyResize(resizing, dx, dy);
      }
    };
    const onTouchEnd = () => { setDragging(null); setResizing(null); };
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => { window.removeEventListener("touchmove", onTouchMove); window.removeEventListener("touchend", onTouchEnd); };
  }, [dragging, resizing, scale, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // ── Element operations ─────────────────────────────────────────────────────
  const addTextElement = () => {
    const newEl: FlyerElement = {
      id: genId(), type: "text",
      x: 100, y: 200 + elements.length * 60, width: CANVAS_WIDTH - 200, height: 80, content: "Testo",
      layerId: activeLayerId,
      style: { fontSize: 48, fontFamily: "Inter", fontWeight: "700", fontStyle: "normal", textDecoration: "none", textAlign: "center", color: presetColor, backgroundColor: "transparent", padding: 8, borderRadius: 0, opacity: 1, letterSpacing: 0, lineHeight: 1.2, textShadow: "none", boxShadow: "none", borderWidth: 0, borderColor: "transparent", rotate: 0 },
      zIndex: elements.filter(e => e.layerId === activeLayerId).length + 1,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
    setRightPanel("style");
    if (isMobile) { setMobileTab("style"); setMobileSheetOpen(true); }
  };

  const addQRCode = () => {
    if (!tournament) { toast.error("Seleziona prima un torneo"); return; }
    const newEl: FlyerElement = {
      id: genId(), type: "qrcode",
      x: CANVAS_WIDTH / 2 - 150, y: CANVAS_HEIGHT - 500, width: 300, height: 300,
      content: `${window.location.origin}/tournaments/${tournament.id}`,
      layerId: activeLayerId,
      style: { padding: 16, backgroundColor: "#ffffff", borderRadius: 16, opacity: 1 },
      zIndex: elements.filter(e => e.layerId === activeLayerId).length + 1,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  };

  const addInfoGroup = () => {
    if (!tournament) { toast.error("Seleziona prima un torneo"); return; }
    const group = makeInfoGroup(tournament, clubName, 40, CANVAS_HEIGHT * 0.1, CANVAS_WIDTH - 80, presetAccent, presetColor);
    const newEl: FlyerElement = {
      id: genId(), type: group.type as any,
      x: group.x!, y: group.y!, width: group.width!, height: group.height!,
      content: group.content!, style: { ...group.style } as any,
      layerId: activeLayerId,
      zIndex: elements.filter(e => e.layerId === activeLayerId).length + 1, groupChildren: group.groupChildren,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
    setRightPanel("style");
    if (isMobile) { setMobileTab("style"); setMobileSheetOpen(true); }
  };

  const addImageElement = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const newEl: FlyerElement = {
          id: genId(), type: "image", x: 100, y: 300, width: 400, height: 400,
          content: reader.result as string,
          layerId: activeLayerId,
          style: { borderRadius: 0, opacity: 1, padding: 0 },
          zIndex: elements.filter(e => e.layerId === activeLayerId).length + 1,
        };
        setElements((prev) => [...prev, newEl]);
        setSelectedId(newEl.id);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const addLogoElement = (url: string) => {
    const newEl: FlyerElement = {
      id: genId(), type: "image", x: CANVAS_WIDTH / 2 - 150, y: 100, width: 300, height: 300,
      content: url, layerId: activeLayerId,
      style: { borderRadius: 0, opacity: 1, padding: 0 },
      zIndex: elements.filter(e => e.layerId === activeLayerId).length + 1,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  };

  const addClubLogo = () => {
    if (!clubLogoUrl) { toast.error("Nessun logo club disponibile"); return; }
    addLogoElement(clubLogoUrl);
  };

  const addSiteLogo = () => {
    addLogoElement(ibnaLogoSquare);
  };

  const addOtherClubLogo = (club: {id: string; name: string; logo_url: string | null}) => {
    if (!club.logo_url) { toast.error(`${club.name} non ha un logo`); return; }
    addLogoElement(club.logo_url);
  };

  const addSponsorLogo = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => addLogoElement(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const addLocalDecoElement = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*,.svg";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const newEl: FlyerElement = {
          id: genId(), type: "image",
          x: CANVAS_WIDTH / 2 - 200, y: CANVAS_HEIGHT / 2 - 200, width: 400, height: 400,
          content: reader.result as string, layerId: activeLayerId,
          style: { borderRadius: 0, opacity: 0.6, padding: 0 },
          zIndex: elements.filter(e => e.layerId === activeLayerId).length + 1,
        };
        setElements((prev) => [...prev, newEl]);
        setSelectedId(newEl.id);
        toast.success("Decorazione aggiunta come elemento");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const addShapeElement = (shapeType: string) => {
    const newEl: FlyerElement = {
      id: genId(), type: "shape",
      x: CANVAS_WIDTH / 2 - 100, y: CANVAS_HEIGHT / 2 - 100, width: 200, height: 200,
      content: shapeType,
      layerId: activeLayerId,
      style: { backgroundColor: presetAccent, borderRadius: shapeType === "circle" ? 9999 : shapeType === "rounded" ? 24 : 0, opacity: 0.8, borderWidth: 0, borderColor: "transparent", rotate: shapeType === "diamond" ? 45 : 0 },
      zIndex: elements.filter(e => e.layerId === activeLayerId).length + 1,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  };

  const updateElement = (id: string, updates: Partial<FlyerElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };
  const updateStyle = (id: string, stylePatch: Partial<FlyerElement["style"]>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, style: { ...el.style, ...stylePatch } } : el)));
  };
  const deleteElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const duplicateElement = (id: string) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    const dup: FlyerElement = { ...el, id: genId(), x: el.x + 30, y: el.y + 30, layerId: el.layerId, zIndex: elements.filter(e => e.layerId === el.layerId).length + 1, groupChildren: el.groupChildren ? [...el.groupChildren.map(f => ({ ...f, style: { ...f.style } }))] : undefined };
    setElements((prev) => [...prev, dup]);
    setSelectedId(dup.id);
  };
  const moveZIndex = (id: string, dir: "up" | "down") => {
    setElements((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((e) => e.id === id);
      if (dir === "up" && idx < sorted.length - 1) { const tmp = sorted[idx].zIndex; sorted[idx].zIndex = sorted[idx + 1].zIndex; sorted[idx + 1].zIndex = tmp; }
      else if (dir === "down" && idx > 0) { const tmp = sorted[idx].zIndex; sorted[idx].zIndex = sorted[idx - 1].zIndex; sorted[idx - 1].zIndex = tmp; }
      return sorted;
    });
  };

  const updateGroupField = (elId: string, fieldKey: string, stylePatch: Partial<InfoField["style"]>) => {
    setElements((prev) => prev.map((el) => {
      if (el.id !== elId || !el.groupChildren) return el;
      return { ...el, groupChildren: el.groupChildren.map((f) => f.key === fieldKey ? { ...f, style: { ...f.style, ...stylePatch } } : f) };
    }));
  };
  const updateGroupFieldValue = (elId: string, fieldKey: string, value: string) => {
    setElements((prev) => prev.map((el) => {
      if (el.id !== elId || !el.groupChildren) return el;
      return { ...el, groupChildren: el.groupChildren.map((f) => f.key === fieldKey ? { ...f, value } : f) };
    }));
  };
  const applyStyleToAllGroupFields = (elId: string, stylePatch: Partial<InfoField["style"]>) => {
    setElements((prev) => prev.map((el) => {
      if (el.id !== elId || !el.groupChildren) return el;
      return { ...el, groupChildren: el.groupChildren.map((f) => ({ ...f, style: { ...f.style, ...stylePatch } })) };
    }));
  };

  const handleBackgroundUpload = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setBackgroundImage(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const toggleDecoration = (name: string) => {
    setActiveDecorations((prev) => {
      if (prev.includes(name)) {
        setDecoSettings((s) => { const n = { ...s }; delete n[name]; return n; });
        return prev.filter((d) => d !== name);
      }
      setDecoSettings((s) => ({ ...s, [name]: { color: defaultDecoColor, opacity: defaultDecoOpacity } }));
      return [...prev, name];
    });
  };
  const updateDecoSetting = (name: string, patch: Partial<{ color: string; opacity: number }>) => {
    setDecoSettings((s) => ({ ...s, [name]: { ...(s[name] || { color: defaultDecoColor, opacity: defaultDecoOpacity }), ...patch } }));
  };

  const applyPreset = (preset: Preset) => {
    setBackgroundStyle(preset.background);
    setBackgroundImage(null);
    setPresetColor(preset.textColor);
    setPresetAccent(preset.accentColor);
    setBgBlur(preset.bgBlur);
    setBgDarken(preset.bgDarken);
    setActiveDecorations(preset.decorations);
    const newSettings: Record<string, { color: string; opacity: number }> = {};
    preset.decorations.forEach((d) => { newSettings[d] = { color: defaultDecoColor, opacity: defaultDecoOpacity }; });
    setDecoSettings(newSettings);
    const starterEls = preset.starterElements(tournament, clubName, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Reset layers to default
    const defLayer: FlyerLayer = { id: DEFAULT_LAYER_ID, name: "Livello 1", visible: true, locked: false, order: 0 };
    setLayers([defLayer]);
    setActiveLayerId(DEFAULT_LAYER_ID);
    const fullEls: FlyerElement[] = starterEls.map((el, i) => ({
      id: genId(), type: el.type || "text",
      x: el.x || 0, y: el.y || 0, width: el.width || CANVAS_WIDTH - 200, height: el.height || 80,
      content: el.content || "",
      layerId: DEFAULT_LAYER_ID,
      style: { fontSize: 48, fontFamily: "Inter", fontWeight: "700", fontStyle: "normal", textDecoration: "none", textAlign: "center", color: "#ffffff", backgroundColor: "transparent", padding: 8, borderRadius: 0, opacity: 1, letterSpacing: 0, lineHeight: 1.2, textShadow: "none", boxShadow: "none", borderWidth: 0, borderColor: "transparent", rotate: 0, ...el.style },
      zIndex: el.zIndex || i + 1, groupChildren: el.groupChildren,
    } as FlyerElement));
    setElements(fullEls);
    setSelectedId(null);
    setPresetOpen(false);
  };

  const exportPng = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    setSelectedId(null);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const opts = {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        pixelRatio: 2,
        cacheBust: true,
        includeQueryParams: true,
        style: { transform: "none", transformOrigin: "top left" },
        fetchRequestInit: { mode: "cors" as RequestMode, cache: "no-cache" as RequestCache },
      };
      // Multiple warm-up passes for cross-origin images
      let dataUrl = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          dataUrl = await toPng(canvasRef.current, opts);
          if (dataUrl && dataUrl.length > 1000) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!dataUrl || dataUrl.length < 1000) {
        throw new Error("render_fail");
      }
      const link = document.createElement("a");
      link.download = `locandina-${aspectRatio.replace(":", "x")}-${tournament?.title?.replace(/\s+/g, "-").toLowerCase() || "torneo"}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Locandina esportata!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Errore nell'esportazione. Prova a rimuovere immagini esterne e riprova.");
    }
    setExporting(false);
  };

  const saveToSystem = async () => {
    if (!canvasRef.current || !selectedTournamentId) {
      toast.error("Seleziona un torneo prima di salvare");
      return;
    }
    setSaving(true);
    setSelectedId(null);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const opts = {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        pixelRatio: 1,
        cacheBust: true,
        includeQueryParams: true,
        style: { transform: "none", transformOrigin: "top left" },
        fetchRequestInit: { mode: "cors" as RequestMode, cache: "no-cache" as RequestCache },
      };
      // Multiple warm-up passes
      let dataUrl = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          dataUrl = await toPng(canvasRef.current, opts);
          if (dataUrl && dataUrl.length > 1000) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!dataUrl || dataUrl.length < 1000) {
        throw new Error("render_fail");
      }
      
      // Convert to JPEG for compression
      const jpegBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = CANVAS_WIDTH;
          c.height = CANVAS_HEIGHT;
          const ctx = c.getContext("2d");
          if (!ctx) { reject(new Error("canvas_fail")); return; }
          ctx.drawImage(img, 0, 0);
          c.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("jpeg_fail"));
          }, "image/jpeg", 0.75);
        };
        img.onerror = () => reject(new Error("img_load_fail"));
        img.src = dataUrl;
      });
      
      const filePath = `${selectedTournamentId}.jpg`;
      
      // Upload with upsert
      const { error: uploadError } = await supabase.storage
        .from("tournament-flyers")
        .upload(filePath, jpegBlob, { contentType: "image/jpeg", upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL with cache-bust
      const { data: urlData } = supabase.storage
        .from("tournament-flyers")
        .getPublicUrl(filePath);
      
      const publicUrl = urlData.publicUrl + "?v=" + Date.now();
      
      // Save URL to tournament
      const { error: updateError } = await supabase
        .from("tournaments")
        .update({ image_url: publicUrl })
        .eq("id", selectedTournamentId);
      
      if (updateError) throw updateError;
      
      toast.success("Locandina salvata nel sistema!");
    } catch (err: any) {
      console.error("Save error:", err);
      const msg = err?.message || "";
      if (msg.includes("security") || msg.includes("policy")) {
        toast.error("Non hai i permessi per salvare. Verifica di essere staff del club.");
      } else if (msg === "render_fail") {
        toast.error("Errore nel rendering. Prova a rimuovere immagini esterne.");
      } else {
        toast.error("Errore nel salvataggio. Riprova tra qualche secondo.");
      }
    }
    setSaving(false);
  };


  const handleElementContextMenu = useCallback((e: React.MouseEvent, elId: string) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedId(elId);
    setContextMenu({ x: e.clientX, y: e.clientY, elementId: elId });
  }, []);

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    const el = elements.find((e) => e.id === contextMenu.elementId);
    if (!el) return null;
    return (
      <div className="fixed z-[9999] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={() => setContextMenu(null)}>
        <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {el.type === "text" ? "Testo" : el.type === "info-group" ? "Blocco Info" : el.type === "qrcode" ? "QR Code" : el.type === "shape" ? "Forma" : "Immagine"}
        </div>
        <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center gap-2" onClick={() => { duplicateElement(el.id); setContextMenu(null); }}><Copy size={12} /> Duplica</button>
        <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center gap-2" onClick={() => { moveZIndex(el.id, "up"); setContextMenu(null); }}><ChevronUp size={12} /> Porta avanti</button>
        <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center gap-2" onClick={() => { moveZIndex(el.id, "down"); setContextMenu(null); }}><ChevronDown size={12} /> Porta indietro</button>
        <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center gap-2" onClick={() => { updateElement(el.id, { locked: !el.locked }); setContextMenu(null); }}>
          {el.locked ? <Unlock size={12} /> : <Lock size={12} />} {el.locked ? "Sblocca" : "Blocca"}
        </button>
        <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center gap-2" onClick={() => { updateElement(el.id, { visible: el.visible === false ? true : false }); setContextMenu(null); }}>
          {el.visible === false ? <Eye size={12} /> : <EyeOff size={12} />} {el.visible === false ? "Mostra" : "Nascondi"}
        </button>
        <div className="my-1 h-px bg-border" />
        <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-destructive/10 text-destructive flex items-center gap-2" onClick={() => { deleteElement(el.id); setContextMenu(null); }}><Trash2 size={12} /> Elimina</button>
      </div>
    );
  };

  const resizeHandles = [
    { dir: "nw", style: { top: 0, left: 0, transform: "translate(-50%, -50%)", cursor: "nw-resize" } },
    { dir: "n",  style: { top: 0, left: "50%", transform: "translate(-50%, -50%)", cursor: "n-resize" } },
    { dir: "ne", style: { top: 0, right: 0, transform: "translate(50%, -50%)", cursor: "ne-resize" } },
    { dir: "w",  style: { top: "50%", left: 0, transform: "translate(-50%, -50%)", cursor: "w-resize" } },
    { dir: "e",  style: { top: "50%", right: 0, transform: "translate(50%, -50%)", cursor: "e-resize" } },
    { dir: "sw", style: { bottom: 0, left: 0, transform: "translate(-50%, 50%)", cursor: "sw-resize" } },
    { dir: "s",  style: { bottom: 0, left: "50%", transform: "translate(-50%, 50%)", cursor: "s-resize" } },
    { dir: "se", style: { bottom: 0, right: 0, transform: "translate(50%, 50%)", cursor: "se-resize" } },
  ] as const;

  const renderResizeHandles = (elId: string) => (
    <>
      {/* Selection border */}
      <div className="absolute inset-0 pointer-events-none" style={{ border: "2px solid hsl(var(--primary))", borderRadius: 2 }} />
      {/* 8 handles - large touch area (44px) with small visible dot (12px) */}
      {resizeHandles.map(({ dir, style }) => (
        <div
          key={dir}
          className="absolute z-50"
          style={{ ...style, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseDown={(e) => onResizeDown(e, elId, dir)}
          onTouchStart={(e) => onResizeTouchStart(e, elId, dir)}
        >
          <div
            className="rounded-full bg-primary border-2 border-primary-foreground shadow-md"
            style={{ width: dir.length === 1 ? 10 : 12, height: dir.length === 1 ? 10 : 12 }}
          />
        </div>
      ))}
    </>
  );

  // ── Render element on canvas ──────────────────────────────────────────────
  const renderElement = (el: FlyerElement) => {
    if (!isElementVisible(el)) return null;
    const isSelected = selectedId === el.id && !exporting;
    const interactable = isElementInteractable(el);
    const baseStyle: React.CSSProperties = {
      position: "absolute", left: el.x, top: el.y, width: el.width,
      height: el.type === "text" || el.type === "info-group" ? "auto" : el.height,
      minHeight: el.type === "text" ? 30 : undefined,
      zIndex: getEffectiveZIndex(el),
      cursor: !interactable || el.locked ? "default" : "move",
      outline: isSelected ? "3px solid hsl(83, 78%, 55%)" : "none", outlineOffset: 2,
      userSelect: "none" as const,
      transform: el.style.rotate ? `rotate(${el.style.rotate}deg)` : undefined,
      pointerEvents: interactable ? "auto" : "none",
    };

    if (el.type === "info-group" && el.groupChildren) {
      return (
        <div key={el.id} style={{ ...baseStyle, backgroundColor: el.style.backgroundColor, borderRadius: el.style.borderRadius, padding: el.style.padding, opacity: el.style.opacity, border: el.style.borderWidth ? `${el.style.borderWidth}px solid ${el.style.borderColor}` : undefined, boxShadow: el.style.boxShadow !== "none" ? el.style.boxShadow : undefined, display: "flex", flexDirection: "column", gap: 16 }}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => onMouseDown(e, el.id)} onTouchStart={(e) => onTouchStart(e, el.id)} onContextMenu={(e) => handleElementContextMenu(e, el.id)}>
          {el.groupChildren.map((field) => (
            <div key={field.key} style={{ fontSize: field.style.fontSize, fontWeight: field.style.fontWeight as any, color: field.style.color, fontFamily: field.style.fontFamily, textAlign: (field.style.textAlign || "left") as any, textTransform: (field.style.textTransform || "none") as any, lineHeight: 1.3, wordBreak: "break-word", cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); setEditingGroupField(field.key); setRightPanel("style"); }}
              onDoubleClick={(e) => { e.stopPropagation(); const v = prompt("Modifica testo:", field.value); if (v !== null) updateGroupFieldValue(el.id, field.key, v); }}>
              {field.value}
            </div>
          ))}
          {isSelected && renderResizeHandles(el.id)}
        </div>
      );
    }
    if (el.type === "text") {
      return (
        <div key={el.id} style={{ ...baseStyle, fontSize: el.style.fontSize, fontFamily: el.style.fontFamily, fontWeight: el.style.fontWeight as any, fontStyle: el.style.fontStyle, textDecoration: el.style.textDecoration, textAlign: el.style.textAlign as any, textTransform: el.style.textTransform as any, color: el.style.color, backgroundColor: el.style.backgroundColor, padding: el.style.padding, borderRadius: el.style.borderRadius, opacity: el.style.opacity, lineHeight: el.style.lineHeight || 1.2, letterSpacing: el.style.letterSpacing || 0, textShadow: el.style.textShadow !== "none" ? el.style.textShadow : undefined, boxShadow: el.style.boxShadow !== "none" ? el.style.boxShadow : undefined, border: el.style.borderWidth ? `${el.style.borderWidth}px solid ${el.style.borderColor}` : undefined, wordBreak: "break-word", whiteSpace: "pre-wrap" }}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => onMouseDown(e, el.id)} onTouchStart={(e) => onTouchStart(e, el.id)} onContextMenu={(e) => handleElementContextMenu(e, el.id)}
          onDoubleClick={() => { const c = prompt("Modifica testo:", el.content); if (c !== null) updateElement(el.id, { content: c }); }}>
          {el.content}
          {isSelected && renderResizeHandles(el.id)}
        </div>
      );
    }
    if (el.type === "qrcode") {
      return (
        <div key={el.id} style={{ ...baseStyle, backgroundColor: el.style.backgroundColor, borderRadius: el.style.borderRadius, padding: el.style.padding, display: "flex", alignItems: "center", justifyContent: "center", opacity: el.style.opacity }}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => onMouseDown(e, el.id)} onTouchStart={(e) => onTouchStart(e, el.id)} onContextMenu={(e) => handleElementContextMenu(e, el.id)}>
          <QRCodeSVG value={el.content} size={Math.min(el.width, el.height) - (el.style.padding || 0) * 2} level="H" />
          {isSelected && renderResizeHandles(el.id)}
        </div>
      );
    }
    if (el.type === "image") {
      return (
        <div key={el.id} style={{ ...baseStyle, opacity: el.style.opacity }}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => onMouseDown(e, el.id)} onTouchStart={(e) => onTouchStart(e, el.id)} onContextMenu={(e) => handleElementContextMenu(e, el.id)}>
          <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: el.style.borderRadius }}>
            <img src={el.content} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
          </div>
          {isSelected && renderResizeHandles(el.id)}
        </div>
      );
    }
    if (el.type === "shape") {
      return (
        <div key={el.id} style={{ ...baseStyle, backgroundColor: el.style.gradient || el.style.backgroundColor, borderRadius: el.style.borderRadius, opacity: el.style.opacity, border: el.style.borderWidth ? `${el.style.borderWidth}px solid ${el.style.borderColor}` : undefined, boxShadow: el.style.boxShadow !== "none" ? el.style.boxShadow : undefined }}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => onMouseDown(e, el.id)} onTouchStart={(e) => onTouchStart(e, el.id)} onContextMenu={(e) => handleElementContextMenu(e, el.id)}>
          {isSelected && renderResizeHandles(el.id)}
        </div>
      );
    }
    return null;
  };

  // ── Style / Layers panels ─────────────────────────────────────────────────
  const renderStylePanel = () => {
    if (!selectedElement) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Settings2 size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">Seleziona un elemento</p>
        </div>
      );
    }

    if (selectedElement.type === "info-group" && selectedElement.groupChildren) {
      const activeField = selectedElement.groupChildren.find((f) => f.key === editingGroupField);
      return (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Blocco Info</div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Contenitore</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1"><Label className="text-[10px]">Sfondo</Label><input type="color" value={selectedElement.style.backgroundColor?.startsWith("rgba") ? "#000000" : selectedElement.style.backgroundColor || "#000000"} onChange={(e) => updateStyle(selectedElement.id, { backgroundColor: e.target.value + "66" })} className="w-6 h-6 rounded cursor-pointer border border-border" /></div>
              <div className="flex items-center gap-1"><Label className="text-[10px]">Raggio</Label><Input type="number" className="h-7 text-[10px] w-14" value={selectedElement.style.borderRadius || 0} onChange={(e) => updateStyle(selectedElement.id, { borderRadius: Number(e.target.value) })} min={0} max={60} /></div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Stile globale campi</Label>
            <div className="flex items-center gap-2">
              <Select onValueChange={(v) => applyStyleToAllGroupFields(selectedElement.id, { fontFamily: v })}>
                <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue placeholder="Font globale..." /></SelectTrigger>
                <SelectContent>{FONT_FAMILIES.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}</SelectContent>
              </Select>
              <input type="color" value={presetColor} onChange={(e) => applyStyleToAllGroupFields(selectedElement.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border shrink-0" />
            </div>
          </div>
          <Separator />
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Campi (click per editare)</Label>
            {selectedElement.groupChildren.map((field) => (
              <button key={field.key} className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] transition-colors ${editingGroupField === field.key ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary"}`} onClick={() => setEditingGroupField(field.key)}>
                <span className="text-muted-foreground">{field.label}:</span> <span className="font-medium truncate">{field.value.slice(0, 25)}</span>
              </button>
            ))}
          </div>
          {activeField && (<>
            <Separator />
            <div className="space-y-2 p-2 bg-secondary/50 rounded-lg">
              <div className="text-[10px] font-semibold text-primary">{activeField.label}</div>
              <div className="flex items-center gap-1.5">
                <Input type="number" className="h-7 text-[10px] w-14" value={activeField.style.fontSize} onChange={(e) => updateGroupField(selectedElement.id, activeField.key, { fontSize: Number(e.target.value) })} min={10} max={120} />
                <Select value={activeField.style.fontWeight} onValueChange={(v) => updateGroupField(selectedElement.id, activeField.key, { fontWeight: v })}>
                  <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["400","500","600","700","800","900"].map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                </Select>
                <input type="color" value={activeField.style.color.startsWith("rgba") ? "#ffffff" : activeField.style.color} onChange={(e) => updateGroupField(selectedElement.id, activeField.key, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border shrink-0" />
              </div>
              <Select value={activeField.style.fontFamily} onValueChange={(v) => updateGroupField(selectedElement.id, activeField.key, { fontFamily: v })}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>{FONT_FAMILIES.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-0.5 flex-wrap">
                {["left", "center", "right"].map((a) => (
                  <Button key={a} variant={(activeField.style.textAlign || "left") === a ? "default" : "outline"} size="sm" className="h-6 w-6 p-0" onClick={() => updateGroupField(selectedElement.id, activeField.key, { textAlign: a } as any)}>
                    {a === "left" ? <AlignLeft size={11} /> : a === "center" ? <AlignCenter size={11} /> : <AlignRight size={11} />}
                  </Button>
                ))}
                <div className="w-px h-6 bg-border mx-0.5" />
                {[{ label: "Aa", value: "none" }, { label: "AA", value: "uppercase" }, { label: "aa", value: "lowercase" }].map((t) => (
                  <Button key={t.value} variant={(activeField.style.textTransform || "none") === t.value ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => updateGroupField(selectedElement.id, activeField.key, { textTransform: t.value } as any)}>
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
          </>)}
          {renderCommonActions()}
        </div>
      );
    }

    if (selectedElement.type === "text") {
      return (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Testo</div>
          <Select value={selectedElement.style.fontFamily || "Inter"} onValueChange={(v) => updateStyle(selectedElement.id, { fontFamily: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_FAMILIES.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Input type="number" className="h-7 text-[10px] w-16" value={selectedElement.style.fontSize || 48} onChange={(e) => updateStyle(selectedElement.id, { fontSize: Number(e.target.value) })} min={10} max={200} />
            <div className="flex gap-0.5">
              {[
                { active: selectedElement.style.fontWeight === "700" || selectedElement.style.fontWeight === "900", icon: <Bold size={13} />, fn: () => updateStyle(selectedElement.id, { fontWeight: selectedElement.style.fontWeight === "700" ? "400" : "700" }) },
                { active: selectedElement.style.fontStyle === "italic", icon: <Italic size={13} />, fn: () => updateStyle(selectedElement.id, { fontStyle: selectedElement.style.fontStyle === "italic" ? "normal" : "italic" }) },
                { active: selectedElement.style.textDecoration === "underline", icon: <Underline size={13} />, fn: () => updateStyle(selectedElement.id, { textDecoration: selectedElement.style.textDecoration === "underline" ? "none" : "underline" }) },
              ].map((b, i) => (<Button key={i} variant={b.active ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={b.fn}>{b.icon}</Button>))}
            </div>
          </div>
          <div className="flex gap-0.5">
            {["left", "center", "right"].map((a) => (
              <Button key={a} variant={selectedElement.style.textAlign === a ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={() => updateStyle(selectedElement.id, { textAlign: a })}>
                {a === "left" ? <AlignLeft size={13} /> : a === "center" ? <AlignCenter size={13} /> : <AlignRight size={13} />}
              </Button>
            ))}
          </div>
          <div className="flex gap-0.5">
            {[{ label: "Aa", value: "none" }, { label: "AA", value: "uppercase" }, { label: "aa", value: "lowercase" }, { label: "Titolo", value: "capitalize" }].map((t) => (
              <Button key={t.value} variant={(selectedElement.style.textTransform || "none") === t.value ? "default" : "outline"} size="sm" className="h-7 px-1.5 text-[10px]" onClick={() => updateStyle(selectedElement.id, { textTransform: t.value })}>
                {t.label}
              </Button>
            ))}
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1"><Label className="text-[10px]">Colore</Label><input type="color" value={selectedElement.style.color || "#ffffff"} onChange={(e) => updateStyle(selectedElement.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border" /></div>
            <div className="flex items-center gap-1"><Label className="text-[10px]">Sfondo</Label><input type="color" value={selectedElement.style.backgroundColor === "transparent" ? "#000000" : selectedElement.style.backgroundColor || "#000000"} onChange={(e) => updateStyle(selectedElement.id, { backgroundColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border" /></div>
            {selectedElement.style.backgroundColor !== "transparent" && (<Button variant="ghost" size="sm" className="h-6 text-[10px] px-1" onClick={() => updateStyle(selectedElement.id, { backgroundColor: "transparent" })}>✕</Button>)}
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Effetti testo</Label>
            <Select value={selectedElement.style.textShadow || "none"} onValueChange={(v) => updateStyle(selectedElement.id, { textShadow: v })}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Ombra testo" /></SelectTrigger>
              <SelectContent>{TEXT_SHADOWS.map((s) => <SelectItem key={s.name} value={s.value}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2 items-center">
              <Label className="text-[10px] shrink-0">Spaziatura</Label>
              <Input type="number" className="h-7 text-[10px] w-14" value={selectedElement.style.letterSpacing || 0} onChange={(e) => updateStyle(selectedElement.id, { letterSpacing: Number(e.target.value) })} min={-5} max={30} />
              <Label className="text-[10px] shrink-0">Interlinea</Label>
              <Input type="number" className="h-7 text-[10px] w-14" value={selectedElement.style.lineHeight || 1.2} onChange={(e) => updateStyle(selectedElement.id, { lineHeight: Number(e.target.value) })} min={0.5} max={3} step={0.1} />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Box</Label>
            <Select value={selectedElement.style.boxShadow || "none"} onValueChange={(v) => updateStyle(selectedElement.id, { boxShadow: v })}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Ombra box" /></SelectTrigger>
              <SelectContent>{BOX_SHADOWS.map((s) => <SelectItem key={s.name} value={s.value}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2 items-center">
              <Label className="text-[10px] shrink-0">Raggio</Label>
              <Input type="number" className="h-7 text-[10px] w-14" value={selectedElement.style.borderRadius || 0} onChange={(e) => updateStyle(selectedElement.id, { borderRadius: Number(e.target.value) })} min={0} max={100} />
              <Label className="text-[10px] shrink-0">Bordo</Label>
              <Input type="number" className="h-7 text-[10px] w-12" value={selectedElement.style.borderWidth || 0} onChange={(e) => updateStyle(selectedElement.id, { borderWidth: Number(e.target.value) })} min={0} max={20} />
              <input type="color" value={selectedElement.style.borderColor || "#ffffff"} onChange={(e) => updateStyle(selectedElement.id, { borderColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border shrink-0" />
            </div>
          </div>
          {renderCommonActions()}
        </div>
      );
    }

    // Shape / QR / Image
    return (
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {selectedElement.type === "qrcode" ? "QR Code" : selectedElement.type === "shape" ? "Forma" : "Immagine"}
        </div>
        {(selectedElement.type === "shape" || selectedElement.type === "image") && (<>
          <div className="flex items-center gap-2"><Label className="text-[10px]">Colore</Label><input type="color" value={selectedElement.style.backgroundColor || "#ffffff"} onChange={(e) => updateStyle(selectedElement.id, { backgroundColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border" /><Label className="text-[10px]">Raggio</Label><Input type="number" className="h-7 text-[10px] w-14" value={selectedElement.style.borderRadius || 0} onChange={(e) => updateStyle(selectedElement.id, { borderRadius: Number(e.target.value) })} min={0} max={9999} /></div>
          <div className="flex items-center gap-2"><Label className="text-[10px]">Bordo</Label><Input type="number" className="h-7 text-[10px] w-12" value={selectedElement.style.borderWidth || 0} onChange={(e) => updateStyle(selectedElement.id, { borderWidth: Number(e.target.value) })} min={0} max={20} /><input type="color" value={selectedElement.style.borderColor || "#ffffff"} onChange={(e) => updateStyle(selectedElement.id, { borderColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border shrink-0" /></div>
          {selectedElement.type === "shape" && (<div className="flex items-center gap-2"><Label className="text-[10px]">Rotazione</Label><Input type="number" className="h-7 text-[10px] w-16" value={selectedElement.style.rotate || 0} onChange={(e) => updateStyle(selectedElement.id, { rotate: Number(e.target.value) })} min={0} max={360} /><span className="text-[10px] text-muted-foreground">°</span></div>)}
          <Select value={selectedElement.style.boxShadow || "none"} onValueChange={(v) => updateStyle(selectedElement.id, { boxShadow: v })}><SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Ombra" /></SelectTrigger><SelectContent>{BOX_SHADOWS.map((s) => <SelectItem key={s.name} value={s.value}>{s.name}</SelectItem>)}</SelectContent></Select>
        </>)}
        {selectedElement.type === "qrcode" && (<div className="flex items-center gap-2"><Label className="text-[10px]">Raggio</Label><Input type="number" className="h-7 text-[10px] w-14" value={selectedElement.style.borderRadius || 0} onChange={(e) => updateStyle(selectedElement.id, { borderRadius: Number(e.target.value) })} min={0} max={50} /></div>)}
        {renderCommonActions()}
      </div>
    );
  };

  const renderCommonActions = () => {
    if (!selectedElement) return null;
    return (<>
      <Separator />
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <Label className="text-[10px] shrink-0">W</Label>
          <Input type="number" className="h-7 text-[10px] w-16" value={Math.round(selectedElement.width)} onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })} min={30} />
          {selectedElement.type !== "text" && selectedElement.type !== "info-group" && (<><Label className="text-[10px] shrink-0">H</Label><Input type="number" className="h-7 text-[10px] w-16" value={Math.round(selectedElement.height)} onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })} min={30} /></>)}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] shrink-0">Opacità</Label>
          <input type="range" min={0} max={1} step={0.05} value={selectedElement.style.opacity ?? 1} onChange={(e) => updateStyle(selectedElement.id, { opacity: Number(e.target.value) })} className="flex-1 accent-primary h-1" />
          <span className="text-[10px] w-8 text-right text-muted-foreground">{Math.round((selectedElement.style.opacity ?? 1) * 100)}%</span>
        </div>
      </div>
      {/* Layer assignment */}
      {layers.length > 1 && (
        <>
          <Separator />
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] shrink-0">Livello</Label>
            <Select value={selectedElement.layerId} onValueChange={(v) => updateElement(selectedElement.id, { layerId: v })}>
              <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...layers].sort((a, b) => b.order - a.order).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <Separator />
      <div className="grid grid-cols-4 gap-1">
        <Button variant="outline" size="sm" className="h-7 text-[10px] p-0" onClick={() => moveZIndex(selectedElement.id, "up")}><ChevronUp size={12} /></Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] p-0" onClick={() => moveZIndex(selectedElement.id, "down")}><ChevronDown size={12} /></Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] p-0" onClick={() => duplicateElement(selectedElement.id)}><Copy size={12} /></Button>
        <Button variant="destructive" size="sm" className="h-7 text-[10px] p-0" onClick={() => deleteElement(selectedElement.id)}><Trash2 size={12} /></Button>
      </div>
    </>);
  };

  const renderLayersPanel = () => {
    const sortedLayers = [...layers].sort((a, b) => b.order - a.order);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Livelli</div>
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={addLayer}>
            <Plus size={10} /> Nuovo
          </Button>
        </div>
        {sortedLayers.map((layer) => {
          const layerElements = [...elements].filter((el) => el.layerId === layer.id).sort((a, b) => b.zIndex - a.zIndex);
          const isActive = activeLayerId === layer.id;
          return (
            <div key={layer.id} className={`rounded-lg border transition-colors ${isActive ? "border-primary/50 bg-primary/5" : "border-border/50"}`}>
              {/* Layer header */}
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button className="shrink-0" onClick={() => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, visible: !l.visible } : l))} title={layer.visible ? "Nascondi" : "Mostra"}>
                  {layer.visible ? <Eye size={11} className="text-foreground" /> : <EyeOff size={11} className="text-muted-foreground" />}
                </button>
                {renamingLayerId === layer.id ? (
                  <Input className="h-5 text-[10px] flex-1 px-1" autoFocus defaultValue={layer.name}
                    onBlur={(e) => { setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, name: e.target.value || layer.name } : l)); setRenamingLayerId(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                ) : (
                  <button className="flex-1 text-left text-[10px] font-medium truncate" onClick={() => setActiveLayerId(layer.id)} onDoubleClick={() => setRenamingLayerId(layer.id)}>
                    {layer.name}
                    {isActive && <span className="ml-1 text-primary text-[8px]">●</span>}
                  </button>
                )}
                <button className="shrink-0" onClick={() => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, locked: !l.locked } : l))} title={layer.locked ? "Sblocca" : "Blocca"}>
                  {layer.locked ? <Lock size={10} className="text-muted-foreground" /> : <Unlock size={10} className="text-muted-foreground/40" />}
                </button>
                <div className="flex shrink-0">
                  <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => moveLayer(layer.id, "up")} title="Sopra"><ChevronUp size={10} /></button>
                  <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => moveLayer(layer.id, "down")} title="Sotto"><ChevronDown size={10} /></button>
                </div>
                {layers.length > 1 && (
                  <button className="shrink-0 text-destructive/50 hover:text-destructive" onClick={() => deleteLayer(layer.id)} title="Elimina livello"><Trash2 size={10} /></button>
                )}
              </div>
              {/* Layer elements */}
              {layerElements.length > 0 && (
                <div className="border-t border-border/30 px-1 py-0.5">
                  {layerElements.map((el) => (
                    <button key={el.id} className={`w-full text-left px-1.5 py-1 rounded text-[9px] flex items-center gap-1 transition-colors ${selectedId === el.id ? "bg-primary/20 text-primary" : "hover:bg-secondary/50 text-muted-foreground"}`}
                      onClick={() => { setSelectedId(el.id); setRightPanel("style"); }}>
                      {el.type === "text" ? <Type size={9} /> : el.type === "qrcode" ? <QrCode size={9} /> : el.type === "info-group" ? <FileText size={9} /> : el.type === "shape" ? <Square size={9} /> : <ImageIcon size={9} />}
                      <span className="truncate flex-1">{el.type === "info-group" ? "Blocco Info" : el.content.slice(0, 18)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Decorations panel (shared between desktop sidebar and mobile) ──────────
  const renderDecorationsPanel = () => (
    <div className="space-y-2">
      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {DECO_CATEGORIES.map((cat) => (
          <button key={cat.id} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${decoCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`} onClick={() => setDecoCategory(cat.id)}>
            {cat.label}
          </button>
        ))}
      </div>
      {/* Local upload */}
      <Button variant="outline" size="sm" className="w-full h-7 text-[10px] gap-1" onClick={addLocalDecoElement}>
        <Plus size={10} /> Carica da file locale
      </Button>
      {/* Items grid */}
      <div className="grid grid-cols-4 gap-1">
        {DECORATIONS.filter((d) => d.category === decoCategory).map((d) => (
          <button key={d.name}
            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-[9px] transition-colors ${activeDecorations.includes(d.name) ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground"}`}
            onClick={() => toggleDecoration(d.name)}
          >
            {d.icon}
            <span className="truncate w-full text-center leading-tight">{d.name}</span>
            {d.isPattern && <span className="text-[7px] opacity-50">pattern</span>}
          </button>
        ))}
      </div>
      {/* Per-decoration controls */}
      {activeDecorations.length > 0 && (
        <div className="space-y-1 pt-1 min-w-0 overflow-hidden">
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Regolazioni singole</Label>
          <div className="space-y-1 max-h-[22vh] overflow-y-auto pr-1">
            {activeDecorations.map((name) => {
              const settings = decoSettings[name] || { color: defaultDecoColor, opacity: defaultDecoOpacity };
              const deco = DECORATIONS.find((d) => d.name === name);
              return (
                <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 rounded-lg bg-secondary/50 p-1.5 min-w-0">
                  <div className="min-w-0 space-y-1">
                    <span className="flex items-center gap-1 text-[9px] font-medium min-w-0">
                      <span className="shrink-0">{deco?.icon}</span>
                      <span className="truncate">{name}</span>
                    </span>
                    <input type="range" min={0.05} max={1} step={0.05} value={settings.opacity} onChange={(e) => updateDecoSetting(name, { opacity: Number(e.target.value) })} className="w-full accent-primary h-1 min-w-0" />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    <input type="color" value={settings.color} onChange={(e) => updateDecoSetting(name, { color: e.target.value })} className="w-5 h-5 rounded cursor-pointer border border-border shrink-0" />
                    <span className="text-[8px] w-7 text-right text-muted-foreground shrink-0">{Math.round(settings.opacity * 100)}%</span>
                    <button className="shrink-0 text-destructive/70 hover:text-destructive" onClick={() => toggleDecoration(name)}><X size={10} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full h-6 text-[10px] text-destructive" onClick={() => { setActiveDecorations([]); setDecoSettings({}); }}>
            <X size={10} className="mr-1" /> Rimuovi tutte
          </Button>
        </div>
      )}
    </div>
  );

  // ── Background controls (shared between desktop sidebar and mobile) ────────
  const renderBackgroundControls = () => (
    <div className="space-y-2">
      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleBackgroundUpload}>
        <ImageIcon size={12} className="mr-1" /> Carica immagine
      </Button>
      {backgroundImage && (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-destructive" onClick={() => { setBackgroundImage(null); setBgImageFit("cover"); setBgImagePosX(50); setBgImagePosY(50); }}>
            <X size={12} className="mr-1" /> Rimuovi immagine
          </Button>
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Adattamento</Label>
          <div className="grid grid-cols-2 gap-1">
            {([
              { label: "Riempi", value: "cover" as const },
              { label: "Adatta largh.", value: "fitWidth" as const },
              { label: "Adatta alt.", value: "fitHeight" as const },
              { label: "Stira", value: "stretch" as const },
            ] as const).map((m) => (
              <button key={m.value} className={`h-7 rounded-md text-[10px] font-medium transition-colors ${bgImageFit === m.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`} onClick={() => setBgImageFit(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Posizione</Label>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5"><Label className="text-[10px] w-6 shrink-0">X</Label><input type="range" min={0} max={100} value={bgImagePosX} onChange={(e) => setBgImagePosX(Number(e.target.value))} className="flex-1 accent-primary h-1" /><span className="text-[10px] w-8 text-right text-muted-foreground">{bgImagePosX}%</span></div>
            <div className="flex items-center gap-1.5"><Label className="text-[10px] w-6 shrink-0">Y</Label><input type="range" min={0} max={100} value={bgImagePosY} onChange={(e) => setBgImagePosY(Number(e.target.value))} className="flex-1 accent-primary h-1" /><span className="text-[10px] w-8 text-right text-muted-foreground">{bgImagePosY}%</span></div>
          </div>
        </div>
      )}
      {!backgroundImage && (
        <>
          <Separator />
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Colore sfondo</Label>
          <div className="flex gap-1">
            <button className={`flex-1 h-7 rounded-md text-[10px] font-medium transition-colors ${bgMode === "solid" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`} onClick={() => setBgMode("solid")}>Solido</button>
            <button className={`flex-1 h-7 rounded-md text-[10px] font-medium transition-colors ${bgMode === "gradient" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`} onClick={() => setBgMode("gradient")}>Gradiente</button>
          </div>
          {bgMode === "solid" ? (
            <div className="flex items-center gap-2">
              <Label className="text-[10px] shrink-0">Colore</Label>
              <input type="color" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-border" />
              <span className="text-[10px] text-muted-foreground font-mono">{bgColor1}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-1">
                <button className={`flex-1 h-6 rounded text-[9px] font-medium ${bgGradientType === "linear" ? "bg-primary text-primary-foreground" : "bg-secondary/80 text-muted-foreground"}`} onClick={() => setBgGradientType("linear")}>Lineare</button>
                <button className={`flex-1 h-6 rounded text-[9px] font-medium ${bgGradientType === "radial" ? "bg-primary text-primary-foreground" : "bg-secondary/80 text-muted-foreground"}`} onClick={() => setBgGradientType("radial")}>Radiale</button>
              </div>
              {bgGradientType === "linear" && (
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] shrink-0">Angolo</Label>
                  <input type="range" min={0} max={360} step={15} value={bgGradientAngle} onChange={(e) => setBgGradientAngle(Number(e.target.value))} className="flex-1 accent-primary h-1" />
                  <span className="text-[10px] w-8 text-right text-muted-foreground">{bgGradientAngle}°</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-0.5">
                  <input type="color" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border" />
                  <span className="text-[8px] text-muted-foreground">Inizio</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <input type="color" value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border" />
                  <span className="text-[8px] text-muted-foreground">Fine</span>
                </div>
                {bgColor3 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="relative">
                      <input type="color" value={bgColor3} onChange={(e) => setBgColor3(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border" />
                      <button className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-3 h-3 flex items-center justify-center" onClick={() => setBgColor3(null)}><X size={7} /></button>
                    </div>
                    <span className="text-[8px] text-muted-foreground">Centro</span>
                  </div>
                ) : (
                  <button className="w-7 h-7 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary" onClick={() => setBgColor3("#888888")} title="Aggiungi colore intermedio">
                    <Plus size={12} />
                  </button>
                )}
              </div>
              <div className="h-6 rounded-md border border-border" style={{ background: buildGradientFromState() }} />
            </div>
          )}
        </>
      )}
      <Separator />
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5"><Label className="text-[10px] w-14 shrink-0">Sfocatura</Label><input type="range" min={0} max={20} step={1} value={bgBlur} onChange={(e) => setBgBlur(Number(e.target.value))} className="flex-1 accent-primary h-1" /><span className="text-[10px] w-6 text-right text-muted-foreground">{bgBlur}</span></div>
        <div className="flex items-center gap-1.5"><Label className="text-[10px] w-14 shrink-0">Oscura</Label><input type="range" min={0} max={90} step={5} value={bgDarken} onChange={(e) => setBgDarken(Number(e.target.value))} className="flex-1 accent-primary h-1" /><span className="text-[10px] w-6 text-right text-muted-foreground">{bgDarken}%</span></div>
      </div>
    </div>
  );

  return (
    <div className={`${isMobile ? "fixed inset-0 z-[110] h-[100svh] max-h-[100svh]" : "h-[100dvh]"} bg-background text-foreground flex flex-col overflow-hidden overscroll-none`}>
      {/* ── Top toolbar ──────────────────────────────────────────────────────── */}
      <div className={`sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shrink-0 ${isMobile ? "px-2 py-1 flex items-center gap-2 min-h-11" : "px-2 sm:px-3 py-1.5 flex items-center gap-1.5 sm:gap-2"}`}>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}><ArrowLeft size={16} /></Button>

        {isMobile ? (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{tournament?.title || "Editor locandina"}</p>
            <p className="text-[10px] text-muted-foreground truncate">Canvas {aspectRatio} · controlli in basso</p>
          </div>
        ) : (
          <>
            <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
              <SelectTrigger className="h-8 text-xs w-24 sm:w-40 shrink-0"><SelectValue placeholder="Torneo..." /></SelectTrigger>
              <SelectContent>{tournaments.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="h-8 text-xs w-20 sm:w-32 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r.label} value={r.label}>
                    <span className="font-mono">{r.label}</span> <span className="text-muted-foreground text-[10px] hidden sm:inline">· {r.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setPresetOpen(!presetOpen)}>
                <Sparkles size={13} /> <span className="hidden sm:inline">Preset</span> <ChevronRight size={12} className={`transition-transform ${presetOpen ? "rotate-90" : ""}`} />
              </Button>
              {presetOpen && (
                <div className="absolute top-full left-0 mt-1 z-[200] bg-card border border-border rounded-xl shadow-xl p-2 w-[320px] max-h-[70vh] overflow-auto">
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESETS.map((p) => (
                      <button key={p.name} onClick={() => applyPreset(p)} className="rounded-lg overflow-hidden border border-border/50 hover:border-primary transition-all hover:scale-105">
                        <div className="w-full" style={{ background: p.background, aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }} />
                        <div className="px-1 py-0.5 text-center"><span className="text-[9px] font-medium">{p.emoji} {p.name}</span></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator orientation="vertical" className="h-6 mx-1 hidden md:block" />

            <div className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={addTextElement}><Type size={13} /> <span className="hidden lg:inline">Testo</span></Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={addInfoGroup} disabled={!tournament}><FileText size={13} /> <span className="hidden lg:inline">Info</span></Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={addQRCode} disabled={!tournament}><QrCode size={13} /></Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={addImageElement}><ImageIcon size={13} /></Button>
              <div className="relative group shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"><Square size={13} /></Button>
                <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-[200] bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[120px]">
                  {[{ name: "Rettangolo", shape: "rect" }, { name: "Cerchio", shape: "circle" }, { name: "Arrotondato", shape: "rounded" }, { name: "Diamante", shape: "diamond" }].map((s) => (
                    <button key={s.shape} onClick={() => addShapeElement(s.shape)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary">{s.name}</button>
                  ))}
                </div>
              </div>
              <div className="relative group shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">🏷️ <span className="hidden lg:inline">Logo</span></Button>
                <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-[200] bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[160px] max-h-[50vh] overflow-auto">
                  <button onClick={addClubLogo} className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary ${!clubLogoUrl ? "opacity-40" : ""}`} disabled={!clubLogoUrl}>🏠 Logo {clubName || "Club"}</button>
                  <button onClick={addSiteLogo} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary">🌐 Logo FIB</button>
                  <button onClick={addSponsorLogo} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary">📤 Carica sponsor</button>
                  {otherClubs.filter(c => c.logo_url).length > 0 && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Altri club</div>
                      {otherClubs.filter(c => c.logo_url).map((c) => (
                        <button key={c.id} onClick={() => addOtherClubLogo(c)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary truncate">{c.name}</button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-8 text-xs hidden md:flex" onClick={() => setRightPanel(rightPanel === "layers" ? null : "layers")}><Layers size={13} /></Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs hidden md:flex" onClick={() => setRightPanel(rightPanel === "style" ? null : "style")}><Settings2 size={13} /></Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hidden md:flex" onClick={() => { if (window.confirm("Resettare tutto?")) { setElements([]); setSelectedId(null); setBackgroundImage(null); setBackgroundStyle(PRESETS[0].background); setBgBlur(0); setBgDarken(0); setActiveDecorations([]); setLayers([{ id: DEFAULT_LAYER_ID, name: "Livello 1", visible: true, locked: false, order: 0 }]); setActiveLayerId(DEFAULT_LAYER_ID); } }}><RotateCcw size={13} /></Button>
              <Button variant="default" size="sm" className="h-8 text-xs gap-1 hidden md:flex" onClick={exportPng} disabled={exporting}><Download size={13} /> {exporting ? "..." : "PNG"}</Button>
              <Button variant="secondary" size="sm" className="h-8 text-xs gap-1 hidden md:flex" onClick={saveToSystem} disabled={saving || !selectedTournamentId}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {saving ? "..." : "Salva"}
              </Button>
            </div>
          </>
        )}
      </div>
      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Left panel: Background & Decorations (desktop) ──────────────── */}
        <div className={`${isMobile ? "hidden" : "flex"} flex-col w-[220px] xl:w-[250px] border-r border-border bg-card shrink-0 overflow-hidden`}>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-full">
                  <Paintbrush size={12} /> Sfondo <ChevronRight size={12} className="ml-auto transition-transform [[data-state=open]>&]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  {renderBackgroundControls()}
                </CollapsibleContent>
              </Collapsible>
              <Separator />
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-full">
                  <Sparkles size={12} /> Decorazioni <ChevronRight size={12} className="ml-auto transition-transform [[data-state=open]>&]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  {renderDecorationsPanel()}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        </div>

        {/* ── Canvas Area ──────────────────────────────────────────────────── */}
        <div ref={containerRef}
          className="flex-1 overflow-hidden flex items-center justify-center bg-muted/20 min-w-0 relative"
          style={{ cursor: panning ? "grabbing" : "grab" }}
          onClick={() => { setSelectedId(null); setPresetOpen(false); setContextMenu(null); }}
          onWheel={handleWheel}
          onMouseDown={handleCanvasBgMouseDown}
          onTouchStart={handleCanvasTouchStart}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-lg">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => setCanvasZoom(z => Math.max(0.2, z - 0.2))}>−</Button>
            <button className="text-[10px] text-muted-foreground w-10 text-center" onClick={resetView}>{Math.round(canvasZoom * 100)}%</button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => setCanvasZoom(z => Math.min(5, z + 0.2))}>+</Button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={resetView} title="Adatta allo schermo"><Focus size={12} /></Button>
          </div>

          <div style={{
            width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale,
            position: "relative", flexShrink: 0,
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
          }}>
            <div ref={canvasRef} style={{
              width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
              transform: `scale(${scale})`, transformOrigin: "top left",
              position: "absolute", top: 0, left: 0, overflow: "hidden",
            }} className="shadow-2xl rounded-sm"
              onClick={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); setSelectedId(null); setContextMenu(null); } }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Background */}
              <div style={{
                position: "absolute", inset: 0, zIndex: 0,
                background: backgroundImage ? undefined : backgroundStyle,
                backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                backgroundSize: backgroundImage
                  ? bgImageFit === "cover" ? "cover"
                    : bgImageFit === "fitWidth" ? "100% auto"
                    : bgImageFit === "fitHeight" ? "auto 100%"
                    : "100% 100%"
                  : "cover",
                backgroundPosition: backgroundImage ? `${bgImagePosX}% ${bgImagePosY}%` : "center",
                backgroundRepeat: "no-repeat",
                filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined,
                transform: bgBlur > 0 ? "scale(1.05)" : undefined,
              }} />
              {bgDarken > 0 && <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundColor: `rgba(0,0,0,${bgDarken / 100})` }} />}
              {/* Decorations overlay */}
              {activeDecorations.map((name) => {
                const deco = DECORATIONS.find((d) => d.name === name);
                if (!deco) return null;
                const settings = decoSettings[name] || { color: defaultDecoColor, opacity: defaultDecoOpacity };
                const svgStr = deco.svg?.(settings.color, settings.opacity, CANVAS_WIDTH, CANVAS_HEIGHT);
                const backgroundImageValue = deco.assetUrl
                  ? `url(${deco.assetUrl})`
                  : svgStr
                    ? `url("data:image/svg+xml,${encodeURIComponent(svgStr)}")`
                    : undefined;

                if (!backgroundImageValue) return null;

                return (
                  <div key={name} style={{
                    position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
                    backgroundImage: backgroundImageValue,
                    backgroundSize: deco.assetUrl ? "cover" : deco.isPattern ? undefined : "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: deco.assetUrl ? "no-repeat" : deco.isPattern ? "repeat" : "no-repeat",
                    opacity: deco.assetUrl ? settings.opacity : 1,
                    mixBlendMode: deco.assetUrl ? "screen" : undefined,
                  }} />
                );
              })}
              {[...elements].sort((a, b) => getEffectiveZIndex(a) - getEffectiveZIndex(b)).map(renderElement)}
            </div>
          </div>
        </div>

        {/* ── Right panel (desktop) ────────────────────────────────────────── */}
        {rightPanel && !isMobile && (
          <div className="w-[240px] xl:w-[270px] border-l border-border bg-card shrink-0 overflow-hidden flex flex-col">
            <div className="flex items-center border-b border-border shrink-0">
              <button className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${rightPanel === "style" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setRightPanel("style")}><Settings2 size={12} className="inline mr-1" /> Stile</button>
              <button className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${rightPanel === "layers" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setRightPanel("layers")}><Layers size={12} className="inline mr-1" /> Livelli</button>
              <button className="px-2 py-2 text-muted-foreground hover:text-foreground" onClick={() => setRightPanel(null)}><X size={14} /></button>
            </div>
            <ScrollArea className="flex-1"><div className="p-3">{rightPanel === "style" ? renderStylePanel() : renderLayersPanel()}</div></ScrollArea>
          </div>
        )}
      </div>

      {/* ── Mobile bottom bar ─────────────────────────────────────────────── */}
      {isMobile && (
        <div className="border-t border-border bg-card shrink-0 flex flex-col">
          {/* Expanded panel content */}
          {mobileSheetOpen && (
            <div className="border-b border-border/50 flex flex-col" style={{ maxHeight: "40vh" }}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 shrink-0">
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                  {mobileTab === "add" ? "Aggiungi" : mobileTab === "bg" ? "Sfondo" : mobileTab === "deco" ? "Decorazioni" : mobileTab === "style" ? "Stile" : mobileTab === "layers" ? "Livelli" : mobileTab === "preset" ? "Preset" : "Azioni"}
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMobileSheetOpen(false)}><ChevronDown size={14} /></Button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain min-h-0" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="p-3">
                  {mobileTab === "add" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addTextElement(); setMobileSheetOpen(false); }}><Type size={18} /><span className="text-[10px]">Testo</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addInfoGroup(); setMobileSheetOpen(false); }} disabled={!tournament}><FileText size={18} /><span className="text-[10px]">Info</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addQRCode(); setMobileSheetOpen(false); }} disabled={!tournament}><QrCode size={18} /><span className="text-[10px]">QR Code</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addImageElement(); setMobileSheetOpen(false); }}><ImageIcon size={18} /><span className="text-[10px]">Immagine</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addShapeElement("rect"); setMobileSheetOpen(false); }}><Square size={18} /><span className="text-[10px]">Rettangolo</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addShapeElement("circle"); setMobileSheetOpen(false); }}><Circle size={18} /><span className="text-[10px]">Cerchio</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addClubLogo(); setMobileSheetOpen(false); }} disabled={!clubLogoUrl}><span className="text-[14px]">🏠</span><span className="text-[10px]">Logo Club</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addSiteLogo(); setMobileSheetOpen(false); }}><span className="text-[14px]">🌐</span><span className="text-[10px]">Logo FIB</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={() => { addSponsorLogo(); setMobileSheetOpen(false); }}><span className="text-[14px]">📤</span><span className="text-[10px]">Sponsor</span></Button>
                      </div>
                    </div>
                  )}
                  {mobileTab === "deco" && (
                    <div className="space-y-3">
                      {renderDecorationsPanel()}
                    </div>
                  )}
                  {mobileTab === "style" && renderStylePanel()}
                  {mobileTab === "layers" && renderLayersPanel()}
                  {mobileTab === "bg" && renderBackgroundControls()}
                  {mobileTab === "preset" && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {PRESETS.map((p) => (
                        <button key={p.name} onClick={() => { applyPreset(p); setMobileSheetOpen(false); }} className="rounded-lg overflow-hidden border border-border/50 hover:border-primary transition-all active:scale-95">
                          <div className="w-full" style={{ background: p.background, aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }} />
                          <div className="py-0.5 text-center"><span className="text-[9px]">{p.emoji} {p.name}</span></div>
                        </button>
                      ))}
                    </div>
                  )}
                  {mobileTab === "actions" && (
                    <div className="space-y-3">
                      <div className="space-y-2 rounded-xl border border-border/60 bg-secondary/30 p-2.5">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Impostazioni canvas</Label>
                        <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                          <SelectTrigger className="h-9 text-xs w-full"><SelectValue placeholder="Torneo..." /></SelectTrigger>
                          <SelectContent>{tournaments.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={aspectRatio} onValueChange={setAspectRatio}>
                          <SelectTrigger className="h-9 text-xs w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ASPECT_RATIOS.map((r) => (
                              <SelectItem key={r.label} value={r.label}>
                                <span className="font-mono">{r.label}</span> · <span className="text-muted-foreground text-[10px]">{r.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1" onClick={resetView}><Focus size={18} /><span className="text-[10px]">Centra</span></Button>
                        <Button variant="outline" size="sm" className="h-14 flex-col gap-1 text-destructive" onClick={() => { if (window.confirm("Resettare tutto?")) { setElements([]); setSelectedId(null); setBackgroundImage(null); setBackgroundStyle(PRESETS[0].background); setBgBlur(0); setBgDarken(0); setActiveDecorations([]); setLayers([{ id: DEFAULT_LAYER_ID, name: "Livello 1", visible: true, locked: false, order: 0 }]); setActiveLayerId(DEFAULT_LAYER_ID); } }}><RotateCcw size={18} /><span className="text-[10px]">Reset</span></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="default" size="sm" className="h-14 flex-col gap-1" onClick={exportPng} disabled={exporting}><Download size={18} /><span className="text-[10px]">{exporting ? "..." : "Esporta PNG"}</span></Button>
                        <Button variant="secondary" size="sm" className="h-14 flex-col gap-1" onClick={saveToSystem} disabled={saving || !selectedTournamentId}>
                          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}<span className="text-[10px]">{saving ? "..." : "Salva nel torneo"}</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Horizontally scrollable carousel menu */}
          <div className="flex items-stretch overflow-x-auto scrollbar-hide shrink-0" style={{ WebkitOverflowScrolling: "touch" }}>
            {([
              { id: "add" as const, icon: <Plus size={18} />, label: "Aggiungi" },
              { id: "preset" as const, icon: <Sparkles size={18} />, label: "Preset" },
              { id: "bg" as const, icon: <Paintbrush size={18} />, label: "Sfondo" },
              { id: "deco" as const, icon: <Shapes size={18} />, label: "Decora" },
              { id: "style" as const, icon: <Settings2 size={18} />, label: "Stile" },
              { id: "layers" as const, icon: <Layers size={18} />, label: "Livelli" },
              { id: "actions" as const, icon: <MoreHorizontal size={18} />, label: "Altro" },
            ] as const).map((tab) => (
              <button key={tab.id}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] px-3 py-2 text-[10px] font-medium transition-all shrink-0 border-b-2 ${
                  mobileTab === tab.id && mobileSheetOpen
                    ? "text-primary border-primary bg-primary/5"
                    : "text-muted-foreground border-transparent active:bg-secondary/50"
                }`}
                onClick={() => {
                  if (mobileTab === tab.id && mobileSheetOpen) {
                    setMobileSheetOpen(false);
                  } else {
                    setMobileTab(tab.id as any);
                    setMobileSheetOpen(true);
                  }
                }}>
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {renderContextMenu()}
    </div>
  );
};

export default FlyerEditor;
