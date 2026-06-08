import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Download, Camera, Upload, Wand2, Image as ImageIcon, Loader2,
  Sparkles, RefreshCcw, Palette, RotateCcw, Plus, Trash2, Swords, User as UserIcon,
} from "lucide-react";
import ibnaLogo from "@/assets/logo.png";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { ComponentPicker, type ComponentSelection } from "@/components/decks/ComponentPicker";
import {
  BLADE_TYPES, type BladeType, type BeybladeConfig, getComponentFields,
} from "@/components/decks/DeckCreatorDialog";

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
  tournamentId: string;
  tournamentTitle: string;
  tournamentDate: string;
  club: { id: string; name: string; banner_url: string | null; logo_url?: string | null } | null;
  isRanked?: boolean;
}

type Mode = "combined" | "individual";
type BgMode = "solid" | "gradient" | "clubBanner";
type FrameStyle = "neon" | "corners" | "minimal" | "double" | "scanline" | "none";

type ComboComponent = { name: string; image: HTMLImageElement | null; imageUrl: string | null };
type Combo = { id: string; name: string; components: ComboComponent[] };

interface PlayerStats {
  tournament: { wins: number; losses: number; matches: number };
  season: { points: number; wins: number; rank: number | null; seasonName: string | null };
}

interface PlayerAssets {
  photo: HTMLImageElement | null;
  photoIsCutout: boolean;
  rawPhotoDataUrl: string | null;
  combos: Combo[];
  stats: PlayerStats | null;
  photoScale: number;   // 0.5 – 2 (default 1)
  photoOffsetX: number; // px (default 0)
  photoOffsetY: number; // px (default 0)
}

const PRESET_THEMES: { name: string; colors: [string, string, string] }[] = [
  { name: "FIB Site", colors: ["#f59e0b", "#0f172a", "#ffd166"] },
  { name: "Vulcano",   colors: ["#dc2626", "#1c1917", "#f59e0b"] },
  { name: "Cyber",     colors: ["#a855f7", "#0b0b1f", "#22d3ee"] },
  { name: "Foresta",   colors: ["#16a34a", "#0f1f17", "#fde047"] },
  { name: "Oro Nero",  colors: ["#facc15", "#0a0a0a", "#ffffff"] },
  { name: "Tramonto",  colors: ["#fb7185", "#1e1b4b", "#fde68a"] },
];

const CANVAS_SIZE = 1080;

let _bgRemovalPromise: Promise<any> | null = null;
const loadBgRemoval = (): Promise<any> => {
  if (_bgRemovalPromise) return _bgRemovalPromise;
  const url = "https://esm.sh/@imgly/background-removal@1.6.0?bundle";
  _bgRemovalPromise = (new Function("u", "return import(u)") as any)(url)
    .catch((err: any) => { _bgRemovalPromise = null; throw err; });
  return _bgRemovalPromise;
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const filterPhoto = async (dataUrl: string): Promise<string> => {
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.filter = "contrast(1.15) saturate(1.2) brightness(1.05)";
  ctx.drawImage(img, 0, 0);
  return c.toDataURL("image/png");
};

// Clean fringe noise on cutout PNG: alpha threshold + 1-px erosion + tight bbox trim
const cleanCutoutEdges = async (blobOrUrl: Blob | string): Promise<string> => {
  const url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const img = await loadImage(url);
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 3; i < d.length; i += 4) {
    const a = d[i];
    if (a < 90) d[i] = 0;
    else if (a < 200) d[i] = Math.round(a * 0.88);
  }
  const w = c.width, h = c.height;
  const orig = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4 + 3;
      if (orig[i] === 0) continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (orig[((y + dy) * w + (x + dx)) * 4 + 3] > 110) count++;
        }
      }
      if (count < 3) d[i] = 0;
    }
  }
  ctx.putImageData(id, 0, 0);

  // 3) Tight alpha bounding box trim so vertical/horizontal alignment matches actual content
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = d[(y * w + x) * 4 + 3];
      if (a > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return c.toDataURL("image/png");
  const pad = 2;
  const tx = Math.max(0, minX - pad);
  const ty = Math.max(0, minY - pad);
  const tw = Math.min(w, maxX + pad) - tx;
  const th = Math.min(h, maxY + pad) - ty;
  const trimmed = document.createElement("canvas");
  trimmed.width = tw; trimmed.height = th;
  trimmed.getContext("2d")!.drawImage(c, tx, ty, tw, th, 0, 0, tw, th);
  return trimmed.toDataURL("image/png");
};

const extractPalette = async (src: string, count = 4): Promise<string[]> => {
  try {
    const img = await loadImage(src);
    const c = document.createElement("canvas");
    const s = 64; c.width = s; c.height = s;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, s, s);
    const data = ctx.getImageData(0, 0, s, s).data;
    const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]; if (a < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max < 24 || min > 235) continue;
      if (max - min < 18) continue;
      const k = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const v = buckets.get(k) || { r: 0, g: 0, b: 0, n: 0 };
      v.r += r; v.g += g; v.b += b; v.n += 1;
      buckets.set(k, v);
    }
    const list = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, count);
    return list.map(v => {
      const r = Math.round(v.r / v.n), g = Math.round(v.g / v.n), b = Math.round(v.b / v.n);
      return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`;
    });
  } catch { return []; }
};

// ============================ CAMERA DIALOG ============================
const CameraCaptureDialog = ({
  open, onOpenChange, onCapture,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCapture: (dataUrl: string) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    stop(); setError(null); setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch (e: any) {
      setError(e?.message || "Impossibile accedere alla fotocamera");
    }
  }, [facing]);

  useEffect(() => {
    if (open) start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  const snap = () => {
    const v = videoRef.current; if (!v) return;
    const w = v.videoWidth, h = v.videoHeight;
    const size = Math.min(w, h);
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d")!;
    if (facing === "user") { ctx.translate(size, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, (w - size) / 2, (h - size) / 2, size, size, 0, 0, size, size);
    onCapture(c.toDataURL("image/png"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Scatta foto</DialogTitle></DialogHeader>
        <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover"
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} />
          {!ready && !error && <div className="absolute inset-0 flex items-center justify-center text-white/70"><Loader2 className="animate-spin" /></div>}
          {error && <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm p-4 text-center">{error}</div>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setFacing(f => f === "user" ? "environment" : "user")} className="gap-2">
            <RotateCcw size={16} /> Inverti
          </Button>
          <Button onClick={snap} disabled={!ready} className="gap-2 flex-1">
            <Camera size={16} /> Scatta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================ DECK BUILDER DIALOG (deck-style) ============================
const defaultBey = (): BeybladeConfig => ({ blade_type: "BX", ratchet_type: "ratchet", components: {} });

const beyToCombo = async (b: BeybladeConfig, idx: number): Promise<Combo | null> => {
  const fields = getComponentFields(b.blade_type, b.ratchet_type);
  const bladeComp = b.components["blade"] || b.components["main_blade"];
  const isClockMirage = bladeComp?.component_name === "Clock Mirage";
  const usedFields = fields.filter(f => !(f.key === "ribs" && isClockMirage));
  const sels = usedFields.map(f => b.components[f.key]).filter(Boolean) as ComponentSelection[];
  if (sels.length === 0) return null;
  const components: ComboComponent[] = await Promise.all(sels.map(async (s) => {
    const url = s.variant_image || s.component_image;
    const image = url ? await loadImage(url).catch(() => null) : null;
    const name = s.variant_name ? `${s.component_name} ${s.variant_name}` : s.component_name;
    return { name, imageUrl: url, image };
  }));
  const name = components.map(c => c.name).join(" ");
  return { id: `bey-${idx}-${Date.now()}`, name, components };
};

const DeckBuilderDialog = ({
  open, onOpenChange, userId, current, onConfirm,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  userId: string; current: Combo[];
  onConfirm: (combos: Combo[]) => void;
}) => {
  const [tab, setTab] = useState<"manual" | "decks">("manual");
  const [beys, setBeys] = useState<BeybladeConfig[]>([defaultBey(), defaultBey(), defaultBey()]);
  const [activeBeys, setActiveBeys] = useState<boolean[]>([true, false, false]);
  const [saving, setSaving] = useState(false);

  // existing decks
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [decks, setDecks] = useState<{ id: string; name: string; beys: { id: string; name: string; components: { id: string; name: string; image_url: string | null }[] }[] }[]>([]);

  useEffect(() => {
    if (open) {
      setBeys([defaultBey(), defaultBey(), defaultBey()]);
      setActiveBeys([true, current.length > 1, current.length > 2]);
      setTab("manual");
    }
  }, [open, current.length]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      setLoadingDecks(true);
      const { data: decksData } = await (supabase as any)
        .from("decks").select("id, name").eq("user_id", userId).order("created_at", { ascending: false });
      if (!decksData || decksData.length === 0) { if (!cancelled) { setDecks([]); setLoadingDecks(false); } return; }
      const deckIds = decksData.map((d: any) => d.id);
      const { data: beysData } = await (supabase as any)
        .from("deck_beyblades").select("id, deck_id, position").in("deck_id", deckIds).order("position");
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

      const built = decksData.map((d: any) => {
        const dBeys = (beysData || []).filter((b: any) => b.deck_id === d.id).map((b: any) => {
          const myComps = (comps || [])
            .filter((c: any) => c.deck_beyblade_id === b.id)
            .sort((a: any, x: any) => (ORDER[a.component_type] ?? 5) - (ORDER[x.component_type] ?? 5));
          const picks = myComps.map((c: any) => {
            const variant = c.variant_id ? varMap.get(c.variant_id) as any : null;
            const comp = compMap.get(c.component_id) as any;
            return {
              id: variant?.id || comp?.id || `${b.id}-${c.component_type}`,
              name: comp?.name || variant?.variant_name || "?",
              image_url: variant?.image_url || comp?.image_url || null,
            };
          });
          const name = picks.map((p: any) => p.name).join(" ");
          return { id: b.id, name, components: picks };
        }).filter((b: any) => b.components.length > 0);
        return { id: d.id, name: d.name, beys: dBeys };
      }).filter((d: any) => d.beys.length > 0);

      if (!cancelled) { setDecks(built); setLoadingDecks(false); }
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  const updateBey = (idx: number, updates: Partial<BeybladeConfig>) => {
    setBeys(prev => prev.map((b, i) => {
      if (i !== idx) return b;
      if (updates.blade_type && updates.blade_type !== b.blade_type) {
        return { ...b, ...updates, components: {} };
      }
      if (updates.ratchet_type && updates.ratchet_type !== b.ratchet_type) {
        const newComps = { ...b.components };
        delete newComps.ratchet; delete newComps.ribs; delete newComps.bit;
        return { ...b, ratchet_type: updates.ratchet_type, components: newComps };
      }
      return { ...b, ...updates };
    }));
  };

  const updateComp = (beyIdx: number, key: string, val: ComponentSelection | null) => {
    setBeys(prev => prev.map((b, i) => {
      if (i !== beyIdx) return b;
      const newComps = { ...b.components, [key]: val };
      const isClockMirage = (key === "blade" || key === "main_blade") && val?.component_name === "Clock Mirage";
      if (isClockMirage && b.ratchet_type === "ribs") {
        delete newComps.ribs; delete newComps.bit;
        return { ...b, ratchet_type: "ratchet" as const, components: newComps };
      }
      return { ...b, components: newComps };
    }));
  };

  const toggleBey = (i: number) => {
    setActiveBeys(prev => prev.map((a, idx) => idx === i ? !a : a));
  };

  const importFromDeckBey = async (b: { id: string; name: string; components: { id: string; name: string; image_url: string | null }[] }) => {
    // Build a Combo straight from saved deck data
    const components: ComboComponent[] = await Promise.all(b.components.map(async (c) => ({
      name: c.name,
      imageUrl: c.image_url,
      image: c.image_url ? await loadImage(c.image_url).catch(() => null) : null,
    })));
    const combo: Combo = { id: `import-${b.id}-${Date.now()}`, name: b.name, components };
    // Append to current builder result (will be returned on Confirm)
    setImportedCombos(prev => prev.length >= 3 ? prev : [...prev, combo]);
    toast.success(`Aggiunto: ${combo.name}`);
  };

  const [importedCombos, setImportedCombos] = useState<Combo[]>([]);
  useEffect(() => { if (open) setImportedCombos([]); }, [open]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const out: Combo[] = [...importedCombos];
      if (tab === "manual") {
        for (let i = 0; i < beys.length; i++) {
          if (!activeBeys[i]) continue;
          if (out.length >= 3) break;
          const combo = await beyToCombo(beys[i], i);
          if (combo) out.push(combo);
        }
      }
      if (out.length === 0) {
        toast.error("Configura almeno una combo");
        setSaving(false);
        return;
      }
      onConfirm(out.slice(0, 3));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Swords size={18} className="text-primary" /> Componi il deck del giocatore
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)} className="px-4 sm:px-6">
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1">Componi manualmente</TabsTrigger>
            <TabsTrigger value="decks" className="flex-1">Dai deck del giocatore</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 pt-3">
          {tab === "manual" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Configura fino a 3 Bey. Disattiva quelli che non vuoi includere.</p>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {beys.map((bey, idx) => {
                  const fields = getComponentFields(bey.blade_type, bey.ratchet_type);
                  const bladeComp = bey.components["blade"] || bey.components["main_blade"];
                  const isClockMirage = bladeComp?.component_name === "Clock Mirage";
                  const isActive = activeBeys[idx];
                  return (
                    <div key={idx} className={`bg-secondary/20 rounded-xl border p-3 space-y-2 transition-opacity ${isActive ? "border-border" : "border-border/40 opacity-50"}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-display text-xs flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                          Bey {idx + 1}
                        </h4>
                        <Switch checked={isActive} onCheckedChange={() => toggleBey(idx)} />
                      </div>

                      {isActive && (
                        <>
                          <div className="flex flex-wrap gap-1">
                            {BLADE_TYPES.map(bt => (
                              <button key={bt.id} type="button" onClick={() => updateBey(idx, { blade_type: bt.id as BladeType })}
                                className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                                  bey.blade_type === bt.id
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                }`}>{bt.label}</button>
                            ))}
                          </div>
                          <div className="space-y-1.5">
                            {fields.map(field => {
                              const isRatchetField = field.key === "ratchet" || field.key === "ribs";
                              if (field.key === "ribs" && isClockMirage) return null;
                              return (
                                <div key={`${idx}-${field.key}-${bey.blade_type}-${bey.ratchet_type}`}>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.label}</span>
                                    {isRatchetField && bey.blade_type !== "UX_INF" && !isClockMirage && (
                                      <div className="flex gap-1">
                                        <button type="button" onClick={() => updateBey(idx, { ratchet_type: "ratchet" })}
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${bey.ratchet_type === "ratchet" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>Ratchet</button>
                                        <button type="button" onClick={() => updateBey(idx, { ratchet_type: "ribs" })}
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${bey.ratchet_type === "ribs" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>Ribs</button>
                                      </div>
                                    )}
                                  </div>
                                  <ComponentPicker
                                    categoryIds={field.categoryIds}
                                    label={field.label}
                                    value={bey.components[field.key] || null}
                                    onChange={(sel) => updateComp(idx, field.key, sel)}
                                    filterInfinite={field.filterInfinite}
                                    nameEndsWith={isClockMirage && field.key === "ratchet" ? "5" : undefined}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "decks" && (
            <div className="space-y-3">
              {loadingDecks && <div className="py-6 text-center"><Loader2 className="animate-spin mx-auto" /></div>}
              {!loadingDecks && decks.length === 0 && <p className="text-sm text-muted-foreground">Nessun deck disponibile per questo giocatore.</p>}
              {decks.map(d => (
                <div key={d.id}>
                  <h4 className="font-semibold text-sm mb-2">{d.name}</h4>
                  <div className="space-y-2">
                    {d.beys.map(b => (
                      <button key={b.id} onClick={() => importFromDeckBey(b)} disabled={importedCombos.length >= 3}
                        className="w-full flex items-center gap-2 border border-border hover:border-primary rounded-lg p-2 text-left disabled:opacity-50">
                        <div className="flex gap-1">
                          {b.components.slice(0, 4).map((c, i) => (
                            c.image_url
                              ? <img key={i} src={c.image_url} alt="" className="h-9 w-9 rounded border border-border object-contain bg-secondary/40" />
                              : <div key={i} className="h-9 w-9 rounded border border-border bg-secondary/40" />
                          ))}
                        </div>
                        <div className="text-sm font-medium truncate flex-1">{b.name}</div>
                        <Plus size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {importedCombos.length > 0 && (
            <div className="mt-4 border-t border-border pt-3 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Importate dai deck ({importedCombos.length}/3)</Label>
              {importedCombos.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 bg-secondary/30 rounded p-2">
                  <div className="flex gap-1 flex-1">
                    {c.components.slice(0, 4).map((cmp, j) => (
                      cmp.imageUrl
                        ? <img key={j} src={cmp.imageUrl} alt="" className="h-8 w-8 rounded border border-border object-contain bg-secondary/40" />
                        : <div key={j} className="h-8 w-8 rounded border border-border bg-secondary/40" />
                    ))}
                  </div>
                  <div className="text-xs truncate flex-1">{c.name}</div>
                  <Button size="icon" variant="ghost" onClick={() => setImportedCombos(prev => prev.filter((_, x) => x !== i))}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-4 sm:px-6 pb-4 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
            Conferma deck
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================ DRAW HELPERS ============================
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const FRAME_STYLES: { id: FrameStyle; label: string }[] = [
  { id: "neon",     label: "Neon Fade" },
  { id: "corners",  label: "L Corners" },
  { id: "minimal",  label: "Minimal Box" },
  { id: "double",   label: "Double Stroke" },
  { id: "scanline", label: "Scanline" },
  { id: "none",     label: "Nessuna" },
];

const neonLine = (
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number,
  color: string, thickness = 2,
) => {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0,    "rgba(0,0,0,0)");
  g.addColorStop(0.15, color);
  g.addColorStop(0.85, color);
  g.addColorStop(1,    "rgba(0,0,0,0)");
  ctx.save();
  ctx.strokeStyle = g; ctx.lineWidth = thickness;
  ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
};

const drawFrame = (
  ctx: CanvasRenderingContext2D, style: FrameStyle,
  cx: number, cy: number, radius: number,
  primary: string, accent: string, isChampion: boolean,
) => {
  const x = cx - radius, y = cy - radius, s = radius * 2;
  const pad = 10;
  const ox = x - pad, oy = y - pad, os = s + pad * 2;

  switch (style) {
    case "none": {
      // Just a neon underline at the base of the portrait
      neonLine(ctx, ox - 30, oy + os + 6, ox + os + 30, oy + os + 6, accent, 2.5);
      break;
    }
    case "neon": {
      neonLine(ctx, ox - 20, oy - 6,  ox + os + 20, oy - 6,  accent, 2);
      neonLine(ctx, ox - 20, oy + os + 6, ox + os + 20, oy + os + 6, accent, 2);
      neonLine(ctx, ox - 10, oy + 10, ox - 10, oy + os - 10, primary, 1.5);
      neonLine(ctx, ox + os + 10, oy + 10, ox + os + 10, oy + os - 10, primary, 1.5);
      break;
    }
    case "corners": {
      const L = Math.max(28, radius * 0.35);
      const t = 4;
      ctx.save();
      ctx.shadowColor = accent; ctx.shadowBlur = 12;
      ctx.fillStyle = accent;
      ctx.fillRect(ox, oy, L, t); ctx.fillRect(ox, oy, t, L);
      ctx.fillRect(ox + os - L, oy, L, t); ctx.fillRect(ox + os - t, oy, t, L);
      ctx.fillRect(ox, oy + os - t, L, t); ctx.fillRect(ox, oy + os - L, t, L);
      ctx.fillRect(ox + os - L, oy + os - t, L, t); ctx.fillRect(ox + os - t, oy + os - L, t, L);
      ctx.restore();
      break;
    }
    case "minimal": {
      ctx.save();
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      drawRoundedRect(ctx, ox, oy, os, os, 14); ctx.stroke();
      ctx.restore();
      break;
    }
    case "double": {
      ctx.save();
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      drawRoundedRect(ctx, ox, oy, os, os, 14); ctx.stroke();
      ctx.strokeStyle = `${primary}cc`; ctx.lineWidth = 1;
      drawRoundedRect(ctx, ox + 6, oy + 6, os - 12, os - 12, 10); ctx.stroke();
      ctx.restore();
      break;
    }
    case "scanline": {
      neonLine(ctx, ox, oy - 4, ox + os, oy - 4, accent, 3);
      neonLine(ctx, ox, oy + os + 4, ox + os, oy + os + 4, accent, 3);
      ctx.save();
      ctx.fillStyle = `${primary}aa`;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(ox + 10 + i * 14, oy - 12, 2, 4);
        ctx.fillRect(ox + os - 18 - i * 14, oy + os + 8, 2, 4);
      }
      ctx.restore();
      break;
    }
  }

  if (isChampion) {
    ctx.save();
    ctx.fillStyle = accent;
    ctx.font = "900 18px Inter, system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = accent; ctx.shadowBlur = 10;
    ctx.fillText("★ CHAMPION ★", cx, oy - 26);
    ctx.restore();
  }
};

// Draws the portrait CONSTRAINED so it can never spill below or sideways outside the frame.
// Cutout images can extend upward (above the frame) for the "popping out" feel.
const drawPortrait = (
  ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, isCutout: boolean,
  cx: number, cy: number, radius: number,
  transform: { scale?: number; offsetX?: number; offsetY?: number } = {},
) => {
  if (!img) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    drawRoundedRect(ctx, cx - radius, cy - radius, radius * 2, radius * 2, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cx - radius, cy - radius, radius * 2, radius * 2, 16);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "500 16px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Foto blader", cx, cy);
    ctx.restore();
    return;
  }

  const scale = Math.max(0.3, Math.min(2.5, transform.scale ?? 1));
  const offX = transform.offsetX ?? 0;
  const offY = transform.offsetY ?? 0;

  if (isCutout) {
    ctx.save();
    // Clip to the frame bounding box so the cutout can never bleed out sideways/below
    ctx.beginPath();
    ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.clip();

    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;

    const ar = img.width / img.height;
    const boxH = radius * 2;
    const boxW = radius * 2;
    let h = boxH;
    let w = h * ar;
    if (w > boxW) { w = boxW; h = w / ar; }
    w *= scale; h *= scale;
    const dx = cx - w / 2 + offX;
    const dy = (cy + radius) - h + offY; // bottom-aligned, then user offset
    ctx.drawImage(img, dx, dy, w, h);
    ctx.restore();
  } else {
    ctx.save();
    drawRoundedRect(ctx, cx - radius, cy - radius, radius * 2, radius * 2, 18);
    ctx.clip();
    const ar = img.width / img.height;
    let dw, dh;
    if (ar > 1) { dh = radius * 2; dw = dh * ar; } else { dw = radius * 2; dh = dw / ar; }
    dw *= scale; dh *= scale;
    ctx.drawImage(img, cx - dw / 2 + offX, cy - dh / 2 + offY, dw, dh);
    ctx.restore();
  }
};

// Wrap text into multiple lines, returns lines + line-height block
const wrapTextLines = (
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2,
): string[] => {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  // If overflow, ellipsize last line
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    // detect if anything was cut
    const total = lines.join(" ");
    if (total.length < text.replace(/\s+/g, " ").length) {
      lines[maxLines - 1] = last.replace(/[.,;:\s]+$/, "") + "…";
    }
  }
  return lines;
};

// Single component tile — image always CONTAIN (no zoom/crop)
const drawComponentTile = (
  ctx: CanvasRenderingContext2D, cmp: ComboComponent,
  x: number, y: number, size: number, primary: string,
) => {
  ctx.save();
  drawRoundedRect(ctx, x, y, size, size, Math.max(6, size * 0.1));
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();
  ctx.clip();
  if (cmp.image) {
    const ar = cmp.image.width / cmp.image.height;
    const inner = size * 0.92;
    let dw = inner, dh = inner;
    if (ar > 1) { dh = inner / ar; } else { dw = inner * ar; }
    ctx.drawImage(cmp.image, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  }
  ctx.restore();
  ctx.save();
  drawRoundedRect(ctx, x, y, size, size, Math.max(6, size * 0.1));
  ctx.strokeStyle = `${primary}99`; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
};

// Compact horizontal combo strip (for combined mode below each player)
const drawComboStrip = (
  ctx: CanvasRenderingContext2D, combo: Combo,
  x: number, y: number, width: number, compSize: number,
  primary: string, nameSize = 14,
): number => {
  const n = combo.components.length || 1;
  const gap = 6;
  const totalCompW = Math.min(width - 8, n * compSize + (n - 1) * gap);
  const realCompSize = (totalCompW - (n - 1) * gap) / n;
  const startX = x + (width - totalCompW) / 2;

  // pre-measure name
  ctx.save();
  ctx.font = `700 ${nameSize}px Inter, sans-serif`;
  const lines = wrapTextLines(ctx, combo.name || combo.components.map(c => c.name).join(" ") || "—", width - 16, 2);
  ctx.restore();

  const nameBlockH = lines.length * (nameSize + 2);
  const blockH = realCompSize + 14 + nameBlockH + 12;

  ctx.save();
  drawRoundedRect(ctx, x, y, width, blockH, 10);
  ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
  ctx.strokeStyle = `${primary}55`; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();

  combo.components.forEach((cmp, i) => {
    drawComponentTile(ctx, cmp, startX + i * (realCompSize + gap), y + 7, realCompSize, primary);
  });

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${nameSize}px Inter, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  lines.forEach((ln, li) => {
    ctx.fillText(ln, x + width / 2, y + realCompSize + 14 + li * (nameSize + 2));
  });
  ctx.restore();

  return blockH;
};

// Vertical deck columns (used by individual mode): up to 3 cols, each combo = column.
// Each component is a large tile stacked vertically with name (wraps to 2 lines) below it.
const drawDeckColumns = (
  ctx: CanvasRenderingContext2D, combos: Combo[],
  x: number, y: number, totalW: number, totalH: number,
  primary: string, accent: string,
  options: { compact?: boolean; showEmpty?: boolean } = {},
) => {
  const compact = !!options.compact;
  const n = combos.length;
  if (n === 0) {
    if (options.showEmpty === false) return;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "500 16px Inter, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Nessuna combo selezionata", x, y + 20);
    ctx.restore();
    return;
  }
  const colGap = compact ? 8 : 14;
  const colW = (totalW - colGap * (n - 1)) / n;
  const headerH = compact ? 28 : 36;

  combos.forEach((c, i) => {
    const cx = x + i * (colW + colGap);

    ctx.save();
    drawRoundedRect(ctx, cx, y, colW, totalH, compact ? 8 : 12);
    ctx.fillStyle = compact ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.36)";
    ctx.fill();
    ctx.strokeStyle = `${primary}${compact ? "44" : "66"}`; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // column header
    ctx.save();
    ctx.fillStyle = accent;
    ctx.font = `900 ${compact ? 10 : 13}px Inter, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(`COMBO ${i + 1}`, cx + colW / 2, y + (compact ? 8 : 10));
    ctx.fillStyle = `${primary}77`;
    ctx.fillRect(cx + colW / 2 - 18, y + headerH - 7, 36, 2);
    ctx.restore();

    const items = c.components;
    const itemCount = items.length || 1;
    const availH = totalH - headerH - 8;
    const slot = availH / itemCount;
    // Tile: square, fits column width but leaves room for 2 name lines below
    const nameSize = compact ? (colW < 92 ? 8 : 9) : (colW < 130 ? 11 : 12);
    const maxLines = compact && colW < 92 ? 1 : 2;
    const reservedName = nameSize * maxLines + 10;
    const maxTile = compact ? 58 : 96;
    const tileSize = Math.min(maxTile, colW - (compact ? 10 : 12), Math.max(compact ? 34 : 58, slot - reservedName - 8));

    items.forEach((cmp, j) => {
      const slotY = y + headerH + 4 + j * slot;
      const blockH = tileSize + 6 + reservedName;
      const blockY = slotY + Math.max(0, (slot - blockH) / 2);
      const tileX = cx + (colW - tileSize) / 2;
      drawComponentTile(ctx, cmp, tileX, blockY, tileSize, primary);

      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${nameSize}px Inter, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const lines = wrapTextLines(ctx, cmp.name || "—", colW - 8, maxLines);
      lines.forEach((ln, li) => {
        ctx.fillText(ln, cx + colW / 2, blockY + tileSize + 6 + li * (nameSize + 2));
      });
      ctx.restore();
    });
  });
};

// ============================ MAIN ============================
export const Top3BannerEditor = ({
  open, onOpenChange, top3, tournamentId, tournamentTitle, tournamentDate, club, isRanked = true,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<Mode>("combined");
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [theme, setTheme] = useState<[string, string, string]>(PRESET_THEMES[0].colors);
  const [autoTheme, setAutoTheme] = useState(false);
  const [bgMode, setBgMode] = useState<BgMode>("gradient");
  const [bgBlur, setBgBlur] = useState(20);
  const [bgDarken, setBgDarken] = useState(55);
  const [showIbnaLogo, setShowIbnaLogo] = useState(true);
  const [showClubLogo, setShowClubLogo] = useState(true);
  const [enableShadow, setEnableShadow] = useState(true);
  const [enableGlow, setEnableGlow] = useState(true);
  const [enablePattern, setEnablePattern] = useState(true);
  const [frameStyle, setFrameStyle] = useState<FrameStyle>("corners");
  const [layout, setLayout] = useState<"trio" | "row" | "stack">("trio");
  const [autoRemoveBg, setAutoRemoveBg] = useState(true);
  const [bgRemovalLoading, setBgRemovalLoading] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [deckBuilderOpen, setDeckBuilderOpen] = useState(false);

  const [assets, setAssets] = useState<Record<string, PlayerAssets>>(() => {
    const map: Record<string, PlayerAssets> = {};
    top3.forEach(p => { map[p.user_id] = { photo: null, photoIsCutout: false, rawPhotoDataUrl: null, combos: [], stats: null, photoScale: 1, photoOffsetX: 0, photoOffsetY: 0 }; });
    return map;
  });

  const [ibnaImg, setIbnaImg] = useState<HTMLImageElement | null>(null);
  const [clubLogoImg, setClubLogoImg] = useState<HTMLImageElement | null>(null);
  const [clubBannerImg, setClubBannerImg] = useState<HTMLImageElement | null>(null);
  const [avatarImgs, setAvatarImgs] = useState<Record<string, HTMLImageElement | null>>({});

  useEffect(() => { loadImage(ibnaLogo).then(setIbnaImg).catch(() => {}); }, []);
  useEffect(() => {
    if (club?.logo_url) loadImage(club.logo_url).then(setClubLogoImg).catch(() => setClubLogoImg(null));
    if (club?.banner_url) loadImage(club.banner_url).then(setClubBannerImg).catch(() => setClubBannerImg(null));
  }, [club?.logo_url, club?.banner_url]);
  useEffect(() => {
    top3.forEach(p => {
      if (p.avatar && !avatarImgs[p.user_id]) {
        loadImage(p.avatar).then(img => setAvatarImgs(prev => ({ ...prev, [p.user_id]: img }))).catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top3]);

  useEffect(() => {
    if (!autoTheme || !club?.logo_url) return;
    (async () => {
      const palette = await extractPalette(club.logo_url!, 4);
      if (palette.length >= 1) {
        setTheme([palette[0], palette[1] || "#0f172a", palette[2] || palette[1] || "#fbbf24"]);
      }
    })();
  }, [autoTheme, club?.logo_url]);

  // ---- Fetch player stats on open ----
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: season } = await (supabase as any)
        .from("ranking_seasons").select("id, name").eq("is_active", true).maybeSingle();
      const seasonName = season?.name || null;

      const { data: matches } = await (supabase as any)
        .from("tournament_matches")
        .select("player1_id, player2_id, winner_id, status")
        .eq("tournament_id", tournamentId)
        .eq("status", "completed");

      const ids = top3.map(p => p.user_id);
      const { data: profiles } = await (supabase as any)
        .from("profiles").select("user_id, points, wins").in("user_id", ids);
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const newStats: Record<string, PlayerStats> = {};
      for (const p of top3) {
        let wins = 0, losses = 0, total = 0;
        (matches || []).forEach((m: any) => {
          if (m.player1_id === p.user_id || m.player2_id === p.user_id) {
            total++;
            if (m.winner_id === p.user_id) wins++;
            else if (m.winner_id) losses++;
          }
        });
        const prof: any = profMap.get(p.user_id);
        const points = prof?.points ?? 0;
        const seasonWins = prof?.wins ?? 0;
        let rank: number | null = null;
        if (points > 0) {
          const [{ count: gt }, { count: eq }] = await Promise.all([
            (supabase as any).from("profiles").select("*", { count: "exact", head: true }).gt("points", points)
              .not("display_name", "like", "[BOT]%").not("display_name", "like", "[Guest]%"),
            (supabase as any).from("profiles").select("*", { count: "exact", head: true }).eq("points", points).gt("wins", seasonWins)
              .not("display_name", "like", "[BOT]%").not("display_name", "like", "[Guest]%"),
          ]);
          rank = (gt || 0) + (eq || 0) + 1;
        }
        newStats[p.user_id] = {
          tournament: { wins, losses, matches: total },
          season: { points, wins: seasonWins, rank, seasonName },
        };
      }
      if (!cancelled) {
        setAssets(prev => {
          const next = { ...prev };
          for (const [uid, s] of Object.entries(newStats)) next[uid] = { ...next[uid], stats: s };
          return next;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [open, tournamentId, top3]);

  // ---- Photo handlers ----
  const runBgRemovalCore = useCallback(async (rawDataUrl: string): Promise<{ img: HTMLImageElement } | null> => {
    try {
      const mod: any = await Promise.race([
        loadBgRemoval(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout caricamento modello AI (60s)")), 60000)),
      ]);
      const removeBackground = mod.default || mod.removeBackground || mod;
      const blob: Blob = await Promise.race([
        removeBackground(rawDataUrl),
        new Promise<Blob>((_, rej) => setTimeout(() => rej(new Error("Timeout rimozione sfondo (90s)")), 90000)),
      ]);
      const cleanedUrl = await cleanCutoutEdges(blob);
      const filtered = await filterPhoto(cleanedUrl);
      const img = await loadImage(filtered);
      return { img };
    } catch (e: any) {
      console.error("[bg-removal]", e);
      _bgRemovalPromise = null; // allow retry next time
      toast.error(e?.message || "Rimozione sfondo fallita");
      return null;
    }
  }, []);

  const ingestPhoto = useCallback(async (playerId: string, rawDataUrl: string, autoRemove: boolean) => {
    // First show the raw filtered photo immediately
    const filtered = await filterPhoto(rawDataUrl);
    const rawImg = await loadImage(filtered);
    setAssets(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], photo: rawImg, photoIsCutout: false, rawPhotoDataUrl: rawDataUrl },
    }));

    if (autoRemove) {
      setBgRemovalLoading(true);
      const t = toast.loading("Rimuovo lo sfondo (AI da CDN, può richiedere ~30s al primo uso)...");
      const result = await runBgRemovalCore(rawDataUrl);
      toast.dismiss(t);
      setBgRemovalLoading(false);
      if (result) {
        setAssets(prev => ({ ...prev, [playerId]: { ...prev[playerId], photo: result.img, photoIsCutout: true } }));
        toast.success("Sfondo rimosso e bordi puliti");
      } else {
        toast.error("Rimozione sfondo fallita. Puoi riprovare manualmente.");
      }
    }
  }, [runBgRemovalCore]);

  const handlePhotoFile = useCallback((playerId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => ingestPhoto(playerId, reader.result as string, autoRemoveBg);
    reader.readAsDataURL(file);
  }, [ingestPhoto, autoRemoveBg]);

  const runBgRemovalManual = useCallback(async (playerId: string) => {
    const a = assets[playerId];
    if (!a?.rawPhotoDataUrl) { toast.error("Carica/scatta prima una foto"); return; }
    setBgRemovalLoading(true);
    const t = toast.loading("Rimuovo lo sfondo...");
    const result = await runBgRemovalCore(a.rawPhotoDataUrl);
    toast.dismiss(t);
    setBgRemovalLoading(false);
    if (result) {
      setAssets(prev => ({ ...prev, [playerId]: { ...prev[playerId], photo: result.img, photoIsCutout: true } }));
      toast.success("Sfondo rimosso");
    } else {
      toast.error("Errore. Verifica connessione.");
    }
  }, [assets, runBgRemovalCore]);

  const restoreOriginalPhoto = useCallback(async (playerId: string) => {
    const a = assets[playerId];
    if (!a?.rawPhotoDataUrl) return;
    const filtered = await filterPhoto(a.rawPhotoDataUrl);
    const img = await loadImage(filtered);
    setAssets(prev => ({ ...prev, [playerId]: { ...prev[playerId], photo: img, photoIsCutout: false } }));
  }, [assets]);

  const applyCombos = useCallback((playerId: string, combos: Combo[]) => {
    setAssets(prev => ({ ...prev, [playerId]: { ...prev[playerId], combos } }));
  }, []);

  // ---- Drawing ----
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    const [c1, c2] = theme;
    if (bgMode === "clubBanner" && clubBannerImg) {
      const ir = clubBannerImg.width / clubBannerImg.height;
      let dw = CANVAS_SIZE, dh = CANVAS_SIZE;
      if (ir > 1) { dw = CANVAS_SIZE * ir; } else { dh = CANVAS_SIZE / ir; }
      const dx = (CANVAS_SIZE - dw) / 2, dy = (CANVAS_SIZE - dh) / 2;
      ctx.save();
      ctx.filter = `blur(${bgBlur}px)`;
      ctx.drawImage(clubBannerImg, dx, dy, dw, dh);
      ctx.restore();
      ctx.fillStyle = `rgba(0,0,0,${bgDarken / 100})`;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    } else if (bgMode === "solid") {
      ctx.fillStyle = c2; ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    } else {
      const grad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    if (enablePattern) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = theme[2];
      ctx.lineWidth = 2;
      for (let i = -CANVAS_SIZE; i < CANVAS_SIZE * 2; i += 36) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CANVAS_SIZE, CANVAS_SIZE); ctx.stroke();
      }
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.3, CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }, [theme, bgMode, bgBlur, bgDarken, clubBannerImg, enablePattern]);

  const drawHeader = useCallback((ctx: CanvasRenderingContext2D) => {
    if (showIbnaLogo && ibnaImg) {
      const size = 96;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 12;
      ctx.drawImage(ibnaImg, 40, 36, size, size); ctx.restore();
    }
    if (showClubLogo && clubLogoImg) {
      const size = 96;
      const lx = CANVAS_SIZE - 40 - size, ly = 36;
      const cx = lx + size / 2, cy = ly + size / 2, r = size / 2;
      ctx.save();
      // Solid circular plate (drop shadow)
      ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 12;
      ctx.fillStyle = "#0b0f1a";
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Same rendering as club profile: centered cover image inside a circular mask.
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.clip();
      const diameter = (r - 2) * 2;
      const ar = clubLogoImg.width / clubLogoImg.height;
      let dw = diameter, dh = diameter;
      if (ar > 1) { dw = diameter * ar; } else { dh = diameter / ar; }
      ctx.drawImage(clubLogoImg, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
      // Thin accent ring
      ctx.save();
      ctx.strokeStyle = `${theme[2]}cc`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // Title only — FIB x Club · TYPE · YEAR is in the footer
    ctx.fillStyle = theme[0];
    ctx.fillRect(CANVAS_SIZE / 2 - 60, 158, 120, 4);
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
    ctx.font = "900 46px Inter, system-ui, sans-serif";
    const title = tournamentTitle.length > 38 ? tournamentTitle.slice(0, 36) + "…" : tournamentTitle;
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 8;
    ctx.fillText(title, CANVAS_SIZE / 2, 136);
    ctx.shadowBlur = 0;
  }, [showIbnaLogo, ibnaImg, showClubLogo, clubLogoImg, tournamentTitle, theme]);


  // Player portrait + labels (no combos here — combos rendered separately below the neon line)
  const drawPlayerBlock = useCallback((
    ctx: CanvasRenderingContext2D, player: Player, cx: number, cy: number, radius: number, isLg: boolean,
  ) => {
    const a = assets[player.user_id];
    const img = a?.photo || avatarImgs[player.user_id] || null;
    const isCutout = !!a?.photoIsCutout;
    const placementColor = player.placement === 1 ? "#facc15" : player.placement === 2 ? "#d4d4d8" : "#b45309";
    const accentForFrame = player.placement === 1 ? theme[2] : placementColor;

    if (enableGlow) {
      const g = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.7);
      g.addColorStop(0, `${placementColor}55`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(cx - radius * 2, cy - radius * 2, radius * 4, radius * 4);
    }

    drawPortrait(ctx, img, isCutout, cx, cy, radius, {
      scale: a?.photoScale, offsetX: a?.photoOffsetX, offsetY: a?.photoOffsetY,
    });
    drawFrame(ctx, frameStyle, cx, cy, radius, theme[0], accentForFrame, player.placement === 1);
  }, [assets, avatarImgs, enableGlow, theme, frameStyle]);

  // Per-player labels (drawn in their own band, never on the neon baseline)
  const drawPlayerLabels = useCallback((
    ctx: CanvasRenderingContext2D, player: Player, cx: number, y: number, isLg: boolean,
  ) => {
    const placementColor = player.placement === 1 ? "#facc15" : player.placement === 2 ? "#d4d4d8" : "#b45309";
    const placementLabel = player.placement === 1 ? "1° CAMPIONE" : player.placement === 2 ? "2° POSTO" : "3° POSTO";
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = placementColor;
    ctx.font = `900 ${isLg ? 22 : 16}px Inter, sans-serif`;
    ctx.fillText(placementLabel, cx, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${isLg ? 30 : 22}px Inter, sans-serif`;
    const name = player.name.length > 22 ? player.name.slice(0, 20) + "…" : player.name;
    ctx.fillText(name, cx, y + (isLg ? 36 : 30));
  }, []);

  // Stack of combo strips inside a column (combined mode)
  const drawPlayerCombos = useCallback((
    ctx: CanvasRenderingContext2D, player: Player, x: number, y: number, w: number, maxH: number,
  ) => {
    const combos = assets[player.user_id]?.combos || [];
    if (combos.length === 0) return;
    drawDeckColumns(ctx, combos.slice(0, 3), x, y, w, maxH, theme[0], theme[2], { compact: true, showEmpty: false });
  }, [assets, theme]);

  // Individual mode: big portrait left, 3-col vertical deck right, compact stats bottom
  const drawIndividual = useCallback((ctx: CanvasRenderingContext2D, player: Player) => {
    const a = assets[player.user_id];
    const img = a?.photo || avatarImgs[player.user_id] || null;
    const isCutout = !!a?.photoIsCutout;
    const placementColor = player.placement === 1 ? "#facc15" : player.placement === 2 ? "#d4d4d8" : "#b45309";
    const accentForFrame = player.placement === 1 ? theme[2] : placementColor;

    const combos = a?.combos || [];
    const hasDeck = combos.length > 0;

    // Left visual column; right deck column grows/shrinks based on configured combos.
    const portraitR = hasDeck ? 182 : 235;
    const portraitCx = hasDeck ? 250 : CANVAS_SIZE / 2;
    const portraitBottom = hasDeck ? 585 : 650;
    const portraitCy = portraitBottom - portraitR;

    if (enableGlow) {
      const g = ctx.createRadialGradient(portraitCx, portraitCy, portraitR * 0.2, portraitCx, portraitCy, portraitR * 1.7);
      g.addColorStop(0, `${placementColor}55`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(portraitCx - portraitR * 2, portraitCy - portraitR * 2, portraitR * 4, portraitR * 4);
    }
    drawPortrait(ctx, img, isCutout, portraitCx, portraitCy, portraitR, {
      scale: a?.photoScale, offsetX: a?.photoOffsetX, offsetY: a?.photoOffsetY,
    });
    drawFrame(ctx, frameStyle, portraitCx, portraitCy, portraitR, theme[0], accentForFrame, player.placement === 1);

    // Neon baseline: separate from text; when frame = none this is already drawn by drawFrame.
    const portraitLineY = portraitBottom + 26;
    if (frameStyle !== "none") {
      neonLine(ctx, portraitCx - portraitR - 34, portraitLineY,
                    portraitCx + portraitR + 34, portraitLineY, theme[2], 2.5);
    }

    const placementLabel = player.placement === 1 ? "1° CAMPIONE" : player.placement === 2 ? "2° POSTO" : "3° POSTO";
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = placementColor;
    ctx.font = "900 22px Inter, sans-serif";
    ctx.fillText(placementLabel, portraitCx, portraitLineY + 62);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px Inter, sans-serif";
    const name = player.name.length > 18 ? player.name.slice(0, 16) + "…" : player.name;
    ctx.fillText(name, portraitCx, portraitLineY + 100);

    // Right: deck header + 3-column vertical deck, only when a deck exists.
    const deckX = 490;
    const deckW = CANVAS_SIZE - deckX - 48;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 22px Inter, sans-serif";
    if (hasDeck) {
      ctx.fillText("DECK UTILIZZATO", deckX, 235);
      ctx.fillStyle = theme[2];
      ctx.fillRect(deckX, 247, 90, 3);
      drawDeckColumns(ctx, combos.slice(0, 3), deckX, 270, deckW, 545, theme[0], theme[2]);
    }

    // Compact stats bar at bottom (leaves room for the footer line)
    const stats = a?.stats;
    const sy = 860;
    const sh = 86;
    ctx.save();
    drawRoundedRect(ctx, 60, sy, CANVAS_SIZE - 120, sh, 16);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill();
    ctx.strokeStyle = `${theme[0]}aa`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    const drawStat = (label: string, value: string, x: number, valueColor = "#ffffff") => {
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "600 11px Inter, sans-serif";
      ctx.fillText(label.toUpperCase(), x, sy + 28);
      ctx.fillStyle = valueColor;
      ctx.font = "900 24px Inter, sans-serif";
      ctx.fillText(value, x, sy + 58);
    };
    const drawSection = (title: string, x: number) => {
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = theme[2];
      ctx.font = "900 11px Inter, sans-serif";
      ctx.fillText(title, x, sy + 20);
    };

    drawSection("TORNEO", 80);
    drawStat("Vittorie", String(stats?.tournament.wins ?? "-"), 160, "#22c55e");
    drawStat("Sconfitte", String(stats?.tournament.losses ?? "-"), 270, "#ef4444");
    drawStat("Match", String(stats?.tournament.matches ?? "-"), 380);

    drawSection(stats?.season.seasonName ? `STAGIONE · ${stats.season.seasonName}` : "STAGIONE", 530);
    drawStat("Punti", String(stats?.season.points ?? "-"), 640, theme[2]);
    drawStat("Wins", String(stats?.season.wins ?? "-"), 770, "#22c55e");
    drawStat("Rank", stats?.season.rank ? `#${stats.season.rank}` : "-", 900);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.moveTo(485, sy + 18); ctx.lineTo(485, sy + sh - 18); ctx.stroke();
    ctx.restore();
  }, [assets, avatarImgs, enableGlow, theme, frameStyle]);

  const render = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawBackground(ctx); drawHeader(ctx);

    if (mode === "combined") {
      const champion = top3.find(p => p.placement === 1);
      const second   = top3.find(p => p.placement === 2);
      const third    = top3.find(p => p.placement === 3);

      if (layout === "trio" || layout === "row") {
        const anyDeck = top3.some(p => (assets[p.user_id]?.combos?.length || 0) > 0);
        const deckMax = Math.max(0, ...top3.map(p => assets[p.user_id]?.combos?.length || 0));
        const portraitBaseY = anyDeck ? 492 : 580;
        const champR = layout === "trio" ? (anyDeck ? 126 : 150) : 118;
        const sideR  = layout === "trio" ? (anyDeck ? 92 : 112) : 100;
        const champCy = portraitBaseY - champR;
        const sideCy  = portraitBaseY - sideR;

        const champX = CANVAS_SIZE / 2;
        const leftX  = layout === "trio" ? 200 : CANVAS_SIZE * 0.20;
        const rightX = layout === "trio" ? CANVAS_SIZE - 200 : CANVAS_SIZE * 0.80;

        if (champion) drawPlayerBlock(ctx, champion, champX, champCy, champR, true);
        if (second)   drawPlayerBlock(ctx, second,   leftX,  sideCy,  sideR,  false);
        if (third)    drawPlayerBlock(ctx, third,    rightX, sideCy,  sideR,  false);

        // Base line is only a portrait base, never a text divider.
        const lineY = portraitBaseY + 24;
        if (frameStyle !== "none") neonLine(ctx, 86, lineY, CANVAS_SIZE - 86, lineY, theme[2], 2.5);

        // Labels sit in a clean band below the visual base.
        const labelY = lineY + 58;
        if (second)   drawPlayerLabels(ctx, second,   leftX,  labelY + 6, false);
        if (champion) drawPlayerLabels(ctx, champion, champX, labelY, true);
        if (third)    drawPlayerLabels(ctx, third,    rightX, labelY + 6, false);

        // Decks occupy the lower band, responsive to active deck count.
        // Narrower columns + larger gap so they never overlap side portraits/labels.
        const colY = anyDeck ? labelY + 96 : labelY + 110;
        const colH = Math.max(120, CANVAS_SIZE - colY - 90);
        const sideGap = 36;
        const colW = Math.min(290, (CANVAS_SIZE - sideGap * 4) / 3);
        const totalW = colW * 3 + sideGap * 2;
        const startX = (CANVAS_SIZE - totalW) / 2;
        const cols = [
          { p: second,   x: startX },
          { p: champion, x: startX + (colW + sideGap) },
          { p: third,    x: startX + 2 * (colW + sideGap) },
        ];
        if (anyDeck) cols.forEach(({ p, x }) => {
          if (p) drawPlayerCombos(ctx, p, x, colY, colW, deckMax <= 1 ? Math.min(colH, 180) : colH);
        });
      } else {
        const anyDeck = top3.some(p => (assets[p.user_id]?.combos?.length || 0) > 0);
        // STACK: champion top, deck as controlled middle band, side players bottom.
        const champR = anyDeck ? 122 : 150, champBottom = anyDeck ? 438 : 510, champCy = champBottom - champR;
        if (champion) drawPlayerBlock(ctx, champion, CANVAS_SIZE / 2, champCy, champR, true);
        const champLineY = champBottom + 24;
        if (frameStyle !== "none") neonLine(ctx, 240, champLineY, CANVAS_SIZE - 240, champLineY, theme[2], 2);
        if (champion) drawPlayerLabels(ctx, champion, CANVAS_SIZE / 2, champLineY + 58, true);
        if (anyDeck && champion) drawPlayerCombos(ctx, champion, 250, champLineY + 110, 580, 170);

        const sideR = anyDeck ? 74 : 92;
        const sideBaseline = anyDeck ? 860 : 820;
        const sideCy = sideBaseline - sideR;
        if (second) {
          drawPlayerBlock(ctx, second, CANVAS_SIZE * 0.27, sideCy, sideR, false);
          if (frameStyle !== "none") neonLine(ctx, CANVAS_SIZE * 0.27 - sideR - 28, sideBaseline + 20, CANVAS_SIZE * 0.27 + sideR + 28, sideBaseline + 20, theme[2], 1.8);
          drawPlayerLabels(ctx, second, CANVAS_SIZE * 0.27, sideBaseline + 72, false);
          if (anyDeck) drawPlayerCombos(ctx, second, 60, 650, 250, 150);
        }
        if (third) {
          drawPlayerBlock(ctx, third, CANVAS_SIZE * 0.73, sideCy, sideR, false);
          if (frameStyle !== "none") neonLine(ctx, CANVAS_SIZE * 0.73 - sideR - 28, sideBaseline + 20, CANVAS_SIZE * 0.73 + sideR + 28, sideBaseline + 20, theme[2], 1.8);
          drawPlayerLabels(ctx, third, CANVAS_SIZE * 0.73, sideBaseline + 72, false);
          if (anyDeck) drawPlayerCombos(ctx, third, CANVAS_SIZE - 310, 650, 250, 150);
        }
      }
    } else {
      const p = top3[activePlayerIdx];
      if (p) drawIndividual(ctx, p);
    }

    // Footer: FIB x Club · TYPE · YEAR
    const dt = new Date(tournamentDate);
    const year = isNaN(dt.getTime()) ? "" : String(dt.getFullYear());
    const clubName = club?.name ? `FIB x ${club.name}` : "FIB";
    const typeLabel = isRanked ? "RANKED" : "NORMAL";
    const footer = [clubName, typeLabel, year].filter(Boolean).join("  ·  ");
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "700 16px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(footer, CANVAS_SIZE / 2, CANVAS_SIZE - 22);
  }, [drawBackground, drawHeader, drawPlayerBlock, drawPlayerLabels, drawPlayerCombos, drawIndividual, mode, top3, activePlayerIdx, layout, theme, assets, frameStyle, club?.name, tournamentDate, isRanked]);


  useEffect(() => { render(); }, [render, assets, avatarImgs, ibnaImg, clubLogoImg, clubBannerImg]);

  const savePng = async (filename: string, dataUrl: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import("@capacitor/filesystem"),
          import("@capacitor/share"),
        ]);
        const base64 = dataUrl.split(",")[1];
        const result = await Filesystem.writeFile({
          path: filename, data: base64, directory: Directory.Cache,
        });
        try {
          await Share.share({ title: filename, url: result.uri, dialogTitle: "Salva immagine" });
        } catch { /* user cancelled share */ }
        toast.success("Immagine pronta da salvare/condividere");
        return;
      } catch (e: any) {
        console.error("[native-save]", e);
        toast.error("Impossibile salvare sul dispositivo");
        return;
      }
    }
    const link = document.createElement("a");
    link.download = filename; link.href = dataUrl;
    document.body.appendChild(link); link.click(); link.remove();
  };

  const exportPng = async () => {
    const c = canvasRef.current; if (!c) return;
    const slug = (top3[activePlayerIdx]?.name || "podio").replace(/\W+/g, "_").toLowerCase();
    const filename = `banner${mode === "individual" ? `_${slug}` : "_top3"}.png`;
    await savePng(filename, c.toDataURL("image/png"));
  };
  const exportAllIndividual = async () => {
    for (let i = 0; i < top3.length; i++) {
      setActivePlayerIdx(i);
      await new Promise(r => setTimeout(r, 140));
      render();
      await new Promise(r => setTimeout(r, 60));
      const c = canvasRef.current; if (!c) continue;
      const slug = top3[i].name.replace(/\W+/g, "_").toLowerCase();
      await savePng(`banner_${top3[i].placement}_${slug}.png`, c.toDataURL("image/png"));
    }
    toast.success("Esportati 3 banner");
  };

  const currentPlayer = top3[activePlayerIdx];
  const currentAssets = currentPlayer ? assets[currentPlayer.user_id] : null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2"><Sparkles size={18} /> Editor Banner Top 3</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-0 flex-1 overflow-hidden">
          {/* CANVAS PANEL */}
          <div className="p-4 space-y-3 overflow-y-auto bg-black/20">
            <div className="bg-black/40 rounded-xl p-3 flex items-center justify-center">
              <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="w-full max-w-[520px] aspect-square rounded-lg" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={exportPng} className="gap-2"><Download size={16} /> Scarica PNG</Button>
              {mode === "individual" && (
                <Button variant="secondary" onClick={exportAllIndividual} className="gap-2"><Download size={16} /> Scarica tutti e 3</Button>
              )}
              <Button variant="ghost" onClick={() => render()} className="gap-2"><RefreshCcw size={16} /> Ridisegna</Button>
            </div>

            {/* Top-level: mode + layout - kept visible always */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Modalità</Label>
                <Tabs value={mode} onValueChange={v => setMode(v as Mode)} className="mt-1">
                  <TabsList className="w-full">
                    <TabsTrigger value="combined" className="flex-1 text-xs">Post unico</TabsTrigger>
                    <TabsTrigger value="individual" className="flex-1 text-xs">Post singoli</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Giocatore</Label>
                <div className="flex gap-1 mt-1">
                  {top3.map((p, i) => (
                    <Button key={p.user_id} size="sm" variant={activePlayerIdx === i ? "default" : "outline"} className="flex-1 px-1 text-xs"
                      onClick={() => setActivePlayerIdx(i)}>{p.placement}°</Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SETTINGS PANEL: tabs to avoid scroll */}
          <div className="border-l border-border flex flex-col overflow-hidden">
            <Tabs defaultValue="player" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full grid grid-cols-3 rounded-none border-b border-border bg-secondary/30">
                <TabsTrigger value="player" className="text-xs"><UserIcon size={12} className="mr-1" />Player</TabsTrigger>
                <TabsTrigger value="style" className="text-xs"><Palette size={12} className="mr-1" />Stile</TabsTrigger>
                <TabsTrigger value="bg" className="text-xs"><ImageIcon size={12} className="mr-1" />Sfondo</TabsTrigger>
              </TabsList>

              {/* TAB: PLAYER */}
              <TabsContent value="player" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <Label className="text-xs uppercase text-muted-foreground">Foto blader</Label>
                  <div className="flex items-center justify-between text-xs">
                    <span>Rimuovi sfondo automaticamente</span>
                    <Switch checked={autoRemoveBg} onCheckedChange={setAutoRemoveBg} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => setCameraOpen(true)} disabled={bgRemovalLoading}>
                      <Camera size={14} /> Scatta
                    </Button>
                    <label className="flex-1">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && currentPlayer && handlePhotoFile(currentPlayer.user_id, e.target.files[0])} />
                      <Button asChild size="sm" variant="outline" className="w-full gap-2 cursor-pointer" disabled={bgRemovalLoading}>
                        <span><Upload size={14} /> Carica</span>
                      </Button>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="secondary" className="gap-2"
                      disabled={bgRemovalLoading || !currentAssets?.rawPhotoDataUrl}
                      onClick={() => currentPlayer && runBgRemovalManual(currentPlayer.user_id)}>
                      {bgRemovalLoading ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                      Rimuovi BG
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-2"
                      disabled={!currentAssets?.rawPhotoDataUrl || !currentAssets?.photoIsCutout}
                      onClick={() => currentPlayer && restoreOriginalPhoto(currentPlayer.user_id)}>
                      <RotateCcw size={14} /> Originale
                    </Button>
                  </div>
                  {currentAssets?.photoIsCutout && (
                    <p className="text-[10px] text-muted-foreground">✓ Sfondo rimosso e bordi puliti</p>
                  )}
                </div>

                {/* Photo transform controls */}
                {currentPlayer && currentAssets?.photo && (
                  <div className="border border-border rounded-lg p-3 space-y-3">
                    <Label className="text-xs uppercase text-muted-foreground">Posizione & dimensione foto</Label>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Dimensione</span>
                        <span>{Math.round((currentAssets.photoScale ?? 1) * 100)}%</span>
                      </div>
                      <Slider
                        min={50} max={200} step={1}
                        value={[Math.round((currentAssets.photoScale ?? 1) * 100)]}
                        onValueChange={([v]) => setAssets(prev => ({
                          ...prev, [currentPlayer.user_id]: { ...prev[currentPlayer.user_id], photoScale: v / 100 },
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Spostamento orizzontale</span>
                        <span>{currentAssets.photoOffsetX ?? 0}px</span>
                      </div>
                      <Slider
                        min={-150} max={150} step={1}
                        value={[currentAssets.photoOffsetX ?? 0]}
                        onValueChange={([v]) => setAssets(prev => ({
                          ...prev, [currentPlayer.user_id]: { ...prev[currentPlayer.user_id], photoOffsetX: v },
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Spostamento verticale</span>
                        <span>{currentAssets.photoOffsetY ?? 0}px</span>
                      </div>
                      <Slider
                        min={-150} max={150} step={1}
                        value={[currentAssets.photoOffsetY ?? 0]}
                        onValueChange={([v]) => setAssets(prev => ({
                          ...prev, [currentPlayer.user_id]: { ...prev[currentPlayer.user_id], photoOffsetY: v },
                        }))}
                      />
                    </div>
                    <Button
                      size="sm" variant="ghost" className="w-full gap-2"
                      onClick={() => setAssets(prev => ({
                        ...prev,
                        [currentPlayer.user_id]: {
                          ...prev[currentPlayer.user_id],
                          photoScale: 1, photoOffsetX: 0, photoOffsetY: 0,
                        },
                      }))}
                    >
                      <RotateCcw size={14} /> Reset posizione
                    </Button>
                  </div>
                )}

                <div className="border border-border rounded-lg p-3 space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Swords size={12} /> Deck</Label>
                  <div className="text-xs text-muted-foreground">
                    {currentAssets?.combos.length || 0}/3 combo configurate
                  </div>
                  {currentAssets?.combos.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-secondary/30 rounded p-1.5">
                      <div className="flex gap-1">
                        {c.components.slice(0, 4).map((cmp, j) => (
                          cmp.imageUrl
                            ? <img key={j} src={cmp.imageUrl} alt="" className="h-7 w-7 rounded border border-border object-contain bg-secondary/40" />
                            : <div key={j} className="h-7 w-7 rounded border border-border bg-secondary/40" />
                        ))}
                      </div>
                      <div className="text-[11px] truncate flex-1" title={c.name}>{c.name || "(senza nome)"}</div>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => setDeckBuilderOpen(true)}>
                    <Swords size={14} /> Configura deck
                  </Button>
                </div>

                {mode === "individual" && currentAssets?.stats && (
                  <div className="border border-border rounded-lg p-3 text-xs space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Statistiche</Label>
                    <div className="text-muted-foreground">Torneo: <span className="text-foreground">{currentAssets.stats.tournament.wins}V - {currentAssets.stats.tournament.losses}S</span></div>
                    <div className="text-muted-foreground">Stagione: <span className="text-foreground">{currentAssets.stats.season.points} pt · #{currentAssets.stats.season.rank ?? "-"}</span></div>
                  </div>
                )}
              </TabsContent>

              {/* TAB: STILE */}
              <TabsContent value="style" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                {mode === "combined" && (
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground">Layout</Label>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      {([
                        { id: "trio",  label: "Trio" },
                        { id: "row",   label: "Fila" },
                        { id: "stack", label: "Stack" },
                      ] as const).map(l => (
                        <Button key={l.id} size="sm" variant={layout === l.id ? "default" : "outline"} onClick={() => setLayout(l.id)}>
                          {l.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Stile cornice</Label>
                  <div className="grid grid-cols-3 gap-1 mt-1">
                    {FRAME_STYLES.map(f => (
                      <Button key={f.id} size="sm" variant={frameStyle === f.id ? "default" : "outline"}
                        className="text-[10px] px-1" onClick={() => setFrameStyle(f.id)}>
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Palette size={12} /> Tema</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Auto da logo</span>
                      <Switch checked={autoTheme} onCheckedChange={setAutoTheme} />
                    </div>
                  </div>
                  {!autoTheme && (
                    <div className="grid grid-cols-3 gap-1">
                      {PRESET_THEMES.map(t => (
                        <button key={t.name} onClick={() => setTheme(t.colors)}
                          className={`p-2 rounded border ${theme[0] === t.colors[0] ? "border-primary" : "border-border"}`}>
                          <div className="flex gap-1 mb-1">
                            {t.colors.map(c => <div key={c} className="h-4 flex-1 rounded" style={{ background: c }} />)}
                          </div>
                          <div className="text-[10px]">{t.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {(["Primario", "Sfondo", "Accento"] as const).map((lbl, i) => (
                      <div key={lbl}>
                        <Label className="text-[10px] text-muted-foreground">{lbl}</Label>
                        <Input type="color" value={theme[i]} onChange={e => {
                          const next = [...theme] as [string, string, string]; next[i] = e.target.value; setTheme(next);
                        }} className="h-8 p-1" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded-lg p-3 space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Effetti & Logo</Label>
                  {[
                    ["Logo FIB", showIbnaLogo, setShowIbnaLogo],
                    ["Logo Club", showClubLogo, setShowClubLogo],
                    ["Ombra", enableShadow, setEnableShadow],
                    ["Glow podio", enableGlow, setEnableGlow],
                    ["Pattern sfondo", enablePattern, setEnablePattern],
                  ].map(([lbl, val, setter]) => (
                    <div key={lbl as string} className="flex items-center justify-between text-sm">
                      <span>{lbl as string}</span>
                      <Switch checked={val as boolean} onCheckedChange={setter as any} />
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* TAB: SFONDO */}
              <TabsContent value="bg" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <Label className="text-xs uppercase text-muted-foreground">Tipo sfondo</Label>
                  <Tabs value={bgMode} onValueChange={v => setBgMode(v as BgMode)}>
                    <TabsList className="w-full">
                      <TabsTrigger value="gradient" className="flex-1 text-xs">Gradient</TabsTrigger>
                      <TabsTrigger value="solid" className="flex-1 text-xs">Solido</TabsTrigger>
                      <TabsTrigger value="clubBanner" className="flex-1 text-xs" disabled={!clubBannerImg}>Banner club</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {bgMode === "clubBanner" && (
                    <>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Blur ({bgBlur}px)</Label>
                        <Slider value={[bgBlur]} min={0} max={60} step={2} onValueChange={v => setBgBlur(v[0])} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Oscuramento ({bgDarken}%)</Label>
                        <Slider value={[bgDarken]} min={0} max={90} step={5} onValueChange={v => setBgDarken(v[0])} />
                      </div>
                    </>
                  )}
                  {bgMode !== "clubBanner" && !clubBannerImg && (
                    <p className="text-[10px] text-muted-foreground">Il club non ha un banner caricato.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {currentPlayer && (
      <>
        <CameraCaptureDialog
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(dataUrl) => ingestPhoto(currentPlayer.user_id, dataUrl, autoRemoveBg)}
        />
        <DeckBuilderDialog
          open={deckBuilderOpen}
          onOpenChange={setDeckBuilderOpen}
          userId={currentPlayer.user_id}
          current={currentAssets?.combos || []}
          onConfirm={(combos) => applyCombos(currentPlayer.user_id, combos)}
        />
      </>
    )}
    </>
  );
};
