import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { BeybladeType, TYPE_COLORS } from "./types";

const BUCKET = "random-picker-assets";
const SPRITE_PREFIX = "sprites/";
const ARENA_KEY = "arena/arena.png";
const TYPES_STORAGE_KEY = "random-picker-sprite-types";

export interface SpriteAsset {
  name: string;
  url: string;
  type: BeybladeType | "any";
}

interface Props {
  onSpritesChange: (sprites: SpriteAsset[]) => void;
  onArenaChange: (url: string | null) => void;
}

function loadTypes(): Record<string, BeybladeType | "any"> {
  try {
    return JSON.parse(localStorage.getItem(TYPES_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveTypes(map: Record<string, BeybladeType | "any">) {
  localStorage.setItem(TYPES_STORAGE_KEY, JSON.stringify(map));
}

export default function AssetManager({ onSpritesChange, onArenaChange }: Props) {
  const [sprites, setSprites] = useState<SpriteAsset[]>([]);
  const [arenaUrl, setArenaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [arenaUploading, setArenaUploading] = useState(false);

  const refreshSprites = async () => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("sprites", { limit: 200, sortBy: { column: "name", order: "asc" } });
    if (error) {
      toast({ title: "Errore lista sprite", description: error.message, variant: "destructive" });
      return;
    }
    const typesMap = loadTypes();
    const items: SpriteAsset[] = (data || [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((f) => {
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(SPRITE_PREFIX + f.name);
        return { name: f.name, url: pub.publicUrl, type: typesMap[f.name] || "any" };
      });
    setSprites(items);
    onSpritesChange(items);
  };

  const refreshArena = async () => {
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(ARENA_KEY);
    try {
      const r = await fetch(pub.publicUrl, { method: "HEAD" });
      if (r.ok) {
        const url = pub.publicUrl + `?t=${Date.now()}`;
        setArenaUrl(url);
        onArenaChange(url);
      } else {
        setArenaUrl(null);
        onArenaChange(null);
      }
    } catch {
      setArenaUrl(null);
      onArenaChange(null);
    }
  };

  useEffect(() => {
    refreshSprites();
    refreshArena();
  }, []); // eslint-disable-line

  const updateSpriteType = (name: string, type: BeybladeType | "any") => {
    const typesMap = loadTypes();
    typesMap[name] = type;
    saveTypes(typesMap);
    const next = sprites.map((s) => (s.name === name ? { ...s, type } : s));
    setSprites(next);
    onSpritesChange(next);
  };

  const handleSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let f of Array.from(files)) {
        f = await prepareImageForUpload(f, { maxDimension: 512, preservePng: true });
        const safeName = f.name.replace(/[^\w.\-]/g, "_");
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(SPRITE_PREFIX + safeName, f, { upsert: true, contentType: f.type });
        if (error) throw error;
      }
      toast({ title: "Sprite caricati", description: `${files.length} file` });
      await refreshSprites();
    } catch (err: any) {
      toast({ title: "Upload fallito", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleArenaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let f = e.target.files?.[0];
    if (!f) return;
    setArenaUploading(true);
    try {
      f = await prepareImageForUpload(f, { maxDimension: 1600 });
      const { error } = await supabase.storage.from(BUCKET).upload(ARENA_KEY, f, { upsert: true, contentType: f.type });
      if (error) throw error;
      toast({ title: "Arena aggiornata" });
      await refreshArena();
    } catch (err: any) {
      toast({ title: "Upload fallito", description: err.message, variant: "destructive" });
    } finally {
      setArenaUploading(false);
      e.target.value = "";
    }
  };

  const deleteSprite = async (name: string) => {
    const { error } = await supabase.storage.from(BUCKET).remove([SPRITE_PREFIX + name]);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    const typesMap = loadTypes();
    delete typesMap[name];
    saveTypes(typesMap);
    await refreshSprites();
  };

  const counts = sprites.reduce(
    (acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ImageIcon size={14} className="text-muted-foreground" /> Assets
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {sprites.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Texture arena</Label>
          <div className="flex items-center gap-3">
            {arenaUrl ? (
              <img
                src={arenaUrl}
                alt="arena"
                className="h-14 w-20 object-cover rounded-md border"
              />
            ) : (
              <div className="h-14 w-20 rounded-md border border-dashed flex items-center justify-center text-[10px] text-muted-foreground bg-muted/30">
                default
              </div>
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={handleArenaUpload}
              disabled={arenaUploading}
              className="text-xs h-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Upload size={11} /> Sprite Beyblade
          </Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={handleSpriteUpload}
            disabled={uploading}
            className="text-xs h-8"
          />
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLORS.attack }} />
              ATK {counts.attack || 0}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLORS.defense }} />
              DEF {counts.defense || 0}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLORS.stamina }} />
              STA {counts.stamina || 0}
            </span>
            <span className="ml-auto">ANY {counts.any || 0}</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Imposta il tipo per ogni sprite. Sprite "ANY" sono usate come fallback.
          </p>
          {sprites.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {sprites.map((s) => (
                <div
                  key={s.name}
                  className="relative group rounded-md border bg-muted/30 p-1 hover:border-primary/50 transition-colors space-y-1"
                  style={{
                    borderLeftColor:
                      s.type === "any" ? undefined : TYPE_COLORS[s.type as BeybladeType],
                    borderLeftWidth: s.type === "any" ? undefined : 2,
                  }}
                >
                  <img src={s.url} alt={s.name} className="w-full h-12 object-contain" />
                  <Select
                    value={s.type}
                    onValueChange={(v) => updateSpriteType(s.name, v as BeybladeType | "any")}
                  >
                    <SelectTrigger className="h-5 w-full text-[9px] px-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">ANY</SelectItem>
                      <SelectItem value="attack">ATK</SelectItem>
                      <SelectItem value="defense">DEF</SelectItem>
                      <SelectItem value="stamina">STA</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteSprite(s.name)}
                  >
                    <Trash2 size={10} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
