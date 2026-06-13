import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COLLECTION_ASSETS_BUCKET, COLLECTION_ASSETS_PROJECT_URL, uploadCollectionImage, uploadCollectionRemoteImage } from "@/lib/collectionAssets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Link, ArrowLeft, Image, Palette, BarChart3, FolderTree, MoveRight, Search, Check, Layers3, Network, GitBranch, MoreHorizontal, RefreshCw, Database, DownloadCloud } from "lucide-react";

interface Category {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  parent_id: string | null;
  is_products_only: boolean;
}

interface Component {
  id: string;
  category_id: string;
  name: string;
  image_url: string | null;
  weight_min: number | null;
  weight_max: number | null;
  recommended_price: number | null;
  sort_order: number;
  is_infinite: boolean;
}

const BX_BLADE_CATEGORY_ID = "0e250c0a-3316-49e8-8335-7aa68cc3dce5";


interface ComponentLink {
  id: string;
  parent_component_id: string;
  linked_component_id: string;
}

interface Variant {
  id: string;
  component_id: string;
  variant_name: string;
  image_url: string | null;
  sort_order: number;
}

interface VariantLink {
  id: string;
  parent_variant_id: string;
  linked_variant_id: string;
}

interface ComponentStat {
  id: string;
  component_id: string;
  stat_name: string;
  stat_value: number;
  stat_order: number;
}

interface BeytrackrPart {
  id: string;
  name: string;
  category: string;
  productLine?: string | null;
  type?: string | null;
  weight?: string | number | null;
  imageUrl?: string | null;
  hasbroName?: string | null;
  stats?: Record<string, unknown> | null;
  variants?: Array<{
    name?: string | null;
    color?: string | null;
    colors?: string[] | null;
    imageUrl?: string | null;
    productLine?: string | null;
  }> | null;
}

interface BeytrackrPreview {
  total: number;
  matched: number;
  importable: number;
  categories: Record<string, number>;
}

interface BeytrackrCategoryTarget {
  key: string;
  name: string;
  sortOrder: number;
}

const DEFAULT_STAT_NAMES = ["ATK", "DEF", "STA", "VEL", "PESO", "BURST RES"];
const BEYTRACKR_API_KEY = "AIzaSyBqUdwtLHZUUlhVaxzsfwBo72hPW8HkFfU";
const BEYTRACKR_PARTS_ENDPOINT = "https://firestore.googleapis.com/v1/projects/beytrackr/databases/(default)/documents/beyblade-x-parts";
const BEYTRACKR_ORIGIN = "https://beytrackr.com";

const BEYTRACKR_CATEGORY_LABELS: Record<string, string> = {
  blade: "Blade",
  ratchet: "Ratchet",
  bit: "Bit",
  "lock-chip": "Lock chip",
  "main-blade": "Main blade",
  "over-blade": "Over blade",
  "metal-blade": "Metal blade",
  "assist-blade": "Assist blade",
  ribs: "RIBS",
  ribl: "RIBL",
  "x-over": "X-Over",
  collab: "Collab",
};

const BEYTRACKR_TAXONOMY: BeytrackrCategoryTarget[] = [
  { key: "blade", name: "BLADE", sortOrder: 10 },
  { key: "lock-chip", name: "LOCK CHIP", sortOrder: 11 },
  { key: "main-blade", name: "MAIN BLADE", sortOrder: 12 },
  { key: "over-blade", name: "OVER BLADE", sortOrder: 13 },
  { key: "metal-blade", name: "METAL BLADE", sortOrder: 14 },
  { key: "assist-blade", name: "ASSIST BLADE", sortOrder: 15 },
  { key: "ratchet", name: "RATCHET", sortOrder: 16 },
  { key: "bit", name: "BIT", sortOrder: 17 },
  { key: "ribs", name: "RIBS", sortOrder: 18 },
  { key: "ribl", name: "RIBL", sortOrder: 19 },
  { key: "x-over", name: "X-OVER", sortOrder: 20 },
  { key: "collab", name: "COLLAB", sortOrder: 21 },
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getTokens = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter(token => token.length > 1 && !["bey", "blade", "complete", "completo", "completi", "set"].includes(token));

const normalizeKey = (value: string) => normalizeText(value).replace(/\s+/g, "");

const resolveBeytrackrImageUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${BEYTRACKR_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
};

const readFirestoreValue = (value: any): any => {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, nested]) => [key, readFirestoreValue(nested)])
    );
  }
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(readFirestoreValue);
  return undefined;
};

const readBeytrackrDoc = (doc: any): BeytrackrPart => ({
  id: doc.name?.split("/").pop() ?? "",
  ...Object.fromEntries(Object.entries(doc.fields ?? {}).map(([key, value]) => [key, readFirestoreValue(value)])),
});

const fetchBeytrackrParts = async () => {
  const parts: BeytrackrPart[] = [];
  let pageToken = "";
  do {
    const response = await fetch(
      `${BEYTRACKR_PARTS_ENDPOINT}?pageSize=300&key=${BEYTRACKR_API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`
    );
    if (!response.ok) throw new Error(`BeyTrackr non raggiungibile (${response.status})`);
    const data = await response.json();
    parts.push(...((data.documents ?? []) as any[]).map(readBeytrackrDoc));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return parts.filter(part => part.name && part.category);
};

const parseWeight = (weight: string | number | null | undefined) => {
  if (typeof weight === "number") return Number.isFinite(weight) ? weight : null;
  if (!weight) return null;
  const normalized = String(weight).replace(",", ".").match(/[\d.]+/);
  return normalized ? Number(normalized[0]) : null;
};

const statValue = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object") {
    const values = Object.values(value as Record<string, unknown>).map(statValue).filter(Number.isFinite);
    return values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : 0;
  }
  return 0;
};

const buildStatsFromBeytrackr = (part: BeytrackrPart) => {
  const raw = part.stats ?? {};
  const weight = parseWeight(part.weight);
  return [
    { name: "ATK", value: statValue(raw.attack) },
    { name: "DEF", value: statValue(raw.defense) },
    { name: "STA", value: statValue(raw.stamina) },
    { name: "VEL", value: statValue(raw.dash ?? raw.speed ?? raw.height) },
    { name: "PESO", value: weight ?? 0 },
    { name: "BURST RES", value: statValue(raw.burst ?? raw.burstResistance) },
  ];
};

const getBeytrackrVariantName = (variant: NonNullable<BeytrackrPart["variants"]>[number]) => {
  const colorText = (variant.colors ?? []).filter(Boolean).join(" / ");
  return [variant.name, colorText || variant.color].filter(Boolean).join(" - ");
};

const getPartMatchNames = (part: BeytrackrPart) => {
  const names = new Set<string>();
  const addName = (value?: string | null) => {
    if (!value) return;
    names.add(normalizeKey(value));
    const parenthetical = value.match(/^(.+?)\s*\((.+?)\)/);
    if (parenthetical) {
      names.add(normalizeKey(parenthetical[1]));
      names.add(normalizeKey(parenthetical[2]));
      const words = normalizeText(parenthetical[2]).split(" ").filter(Boolean);
      const lastWord = words.at(-1);
      if (lastWord && lastWord.length > 1) names.add(normalizeKey(lastWord));
    }
  };
  addName(part.name);
  addName(part.hasbroName);
  return Array.from(names);
};

const getVariantMatchKeys = (variant: NonNullable<BeytrackrPart["variants"]>[number]) => {
  const keys = new Set<string>();
  const addKey = (value?: string | null) => {
    if (value) keys.add(normalizeKey(value));
  };
  addKey(getBeytrackrVariantName(variant));
  addKey(variant.name);
  addKey(variant.color);
  (variant.colors ?? []).forEach(color => {
    addKey(color);
    addKey(`${color} ver`);
    addKey(`${color} version`);
  });
  return Array.from(keys);
};

const findMatchingVariant = (
  existingVariants: Variant[],
  variant: NonNullable<BeytrackrPart["variants"]>[number]
) => {
  const keys = getVariantMatchKeys(variant);
  const exact = existingVariants.find(existing => keys.includes(normalizeKey(existing.variant_name)));
  if (exact) return exact;
  const colorKeys = [variant.color, ...(variant.colors ?? [])].filter(Boolean).map(color => normalizeKey(color!));
  if (!colorKeys.length) return null;
  return existingVariants.find(existing => {
    const existingKey = normalizeKey(existing.variant_name);
    return colorKeys.some(colorKey => existingKey.includes(colorKey));
  }) ?? null;
};

const fetchPagedRows = async <T,>(queryFactory: (from: number, to: number) => any) => {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
};

// ─── Grid Picker for Components ───
const ComponentGridPicker = ({
  label, value, onChange, multiValue, onMultiChange, components, categories, excludeId, excludeIds, filterCategoryIds,
}: {
  label: string;
  value?: string;
  onChange?: (id: string) => void;
  multiValue?: string[];
  onMultiChange?: (ids: string[]) => void;
  components: Component[];
  categories: Category[];
  excludeId?: string;
  excludeIds?: string[];
  filterCategoryIds?: string[];
}) => {
  const [search, setSearch] = useState("");
  const isMulti = !!onMultiChange;
  const selectedIds = isMulti ? (multiValue || []) : (value ? [value] : []);
  const allExcluded = [...(excludeId ? [excludeId] : []), ...(excludeIds || [])];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return components
      .filter(c => !allExcluded.includes(c.id) && c.name.toLowerCase().includes(q) && (!filterCategoryIds || filterCategoryIds.includes(c.category_id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [components, allExcluded.join(","), search, filterCategoryIds]);

  const grouped = useMemo(() => {
    const map = new Map<string, Component[]>();
    filtered.forEach(c => {
      const cat = categories.find(cat => cat.id === c.category_id);
      const catName = cat?.name ?? "Altro";
      if (!map.has(catName)) map.set(catName, []);
      map.get(catName)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, categories]);

  const handleClick = (id: string) => {
    if (isMulti) {
      const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
      onMultiChange!(next);
    } else {
      onChange!(id);
      setSearch("");
    }
  };

  const selectedComps = components.filter(c => selectedIds.includes(c.id));
  const showGrid = isMulti || selectedComps.length === 0;

  return (
    <div className="space-y-2">
      <Label>{label} {isMulti && selectedIds.length > 0 && <span className="text-primary ml-1">({selectedIds.length} selezionati)</span>}</Label>
      {!isMulti && selectedComps.length === 1 && (
        <div className="flex items-center gap-2 p-2 rounded-md border border-primary bg-primary/5">
          <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
            {selectedComps[0].image_url ? <img src={selectedComps[0].image_url} className="w-full h-full object-contain" /> : <Image size={14} className="text-muted-foreground" />}
          </div>
          <span className="text-sm font-medium truncate">{selectedComps[0].name}</span>
          <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs" onClick={() => onChange!("")}>Cambia</Button>
        </div>
      )}
      {isMulti && selectedComps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedComps.map(c => (
            <Badge key={c.id} variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20" onClick={() => handleClick(c.id)}>
              {c.image_url && <img src={c.image_url} className="w-4 h-4 rounded object-contain" />}
              <span className="text-[10px]">{c.name}</span>
              <span className="text-destructive">×</span>
            </Badge>
          ))}
        </div>
      )}
      {showGrid && (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca componente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
          <div className="max-h-[45vh] overflow-y-auto border border-border rounded-md">
            {grouped.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">Nessun risultato</p>}
            {grouped.map(([catName, comps]) => (
              <div key={catName}>
                <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-2 py-1 text-xs font-semibold text-muted-foreground border-b border-border">{catName}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 p-1.5">
                  {comps.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleClick(c.id)}
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-md border text-center transition-all hover:ring-2 hover:ring-primary ${isSelected ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:bg-accent"}`}
                      >
                        {isMulti && isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check size={10} className="text-primary-foreground" />
                          </div>
                        )}
                        <div className="w-10 h-10 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                          {c.image_url ? <img src={c.image_url} className="w-full h-full object-contain" /> : <Image size={16} className="text-muted-foreground" />}
                        </div>
                        <span className="text-[10px] leading-tight line-clamp-2 break-all">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Grid Picker for Variants ───
const VariantGridPicker = ({
  label, value, onChange, multiValue, onMultiChange, variants, components, categories, excludeId, excludeIds, filterCategoryIds,
}: {
  label: string;
  value?: string;
  onChange?: (id: string) => void;
  multiValue?: string[];
  onMultiChange?: (ids: string[]) => void;
  variants: Variant[];
  components: Component[];
  categories: Category[];
  excludeId?: string;
  excludeIds?: string[];
  filterCategoryIds?: string[];
}) => {
  const [search, setSearch] = useState("");
  const isMulti = !!onMultiChange;
  const selectedIds = isMulti ? (multiValue || []) : (value ? [value] : []);
  const allExcluded = [...(excludeId ? [excludeId] : []), ...(excludeIds || [])];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return variants
      .filter(v => {
        if (allExcluded.includes(v.id)) return false;
        if (filterCategoryIds) {
          const comp = components.find(c => c.id === v.component_id);
          if (!comp || !filterCategoryIds.includes(comp.category_id)) return false;
        }
        return v.variant_name.toLowerCase().includes(q) || components.find(c => c.id === v.component_id)?.name.toLowerCase().includes(q);
      })
      .sort((a, b) => a.variant_name.localeCompare(b.variant_name));
  }, [variants, allExcluded.join(","), search, components, filterCategoryIds]);

  const grouped = useMemo(() => {
    const map = new Map<string, Variant[]>();
    filtered.forEach(v => {
      const comp = components.find(c => c.id === v.component_id);
      const cat = comp ? categories.find(cat => cat.id === comp.category_id) : null;
      const groupName = cat ? `${cat.name} → ${comp?.name}` : comp?.name ?? "Altro";
      if (!map.has(groupName)) map.set(groupName, []);
      map.get(groupName)!.push(v);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, components, categories]);

  const handleClick = (id: string) => {
    if (isMulti) {
      const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
      onMultiChange!(next);
    } else {
      onChange!(id);
      setSearch("");
    }
  };

  const selectedVars = variants.filter(v => selectedIds.includes(v.id));
  const showGrid = isMulti || selectedVars.length === 0;

  return (
    <div className="space-y-2">
      <Label>{label} {isMulti && selectedIds.length > 0 && <span className="text-primary ml-1">({selectedIds.length} selezionati)</span>}</Label>
      {!isMulti && selectedVars.length === 1 && (() => {
        const selectedVar = selectedVars[0];
        const selectedComp = components.find(c => c.id === selectedVar.component_id);
        return (
          <div className="flex items-center gap-2 p-2 rounded-md border border-primary bg-primary/5">
            <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
              {selectedVar.image_url ? <img src={selectedVar.image_url} className="w-full h-full object-contain" /> : <Palette size={14} className="text-primary" />}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-medium truncate block">{selectedVar.variant_name}</span>
              <span className="text-xs text-muted-foreground truncate block">{selectedComp?.name}</span>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs" onClick={() => onChange!("")}>Cambia</Button>
          </div>
        );
      })()}
      {isMulti && selectedVars.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedVars.map(v => (
            <Badge key={v.id} variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20" onClick={() => handleClick(v.id)}>
              {v.image_url && <img src={v.image_url} className="w-4 h-4 rounded object-contain" />}
              <span className="text-[10px]">{v.variant_name}</span>
              <span className="text-destructive">×</span>
            </Badge>
          ))}
        </div>
      )}
      {showGrid && (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca variante o componente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
          <div className="max-h-[45vh] overflow-y-auto border border-border rounded-md">
            {grouped.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">Nessun risultato</p>}
            {grouped.map(([groupName, vars]) => (
              <div key={groupName}>
                <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-2 py-1 text-xs font-semibold text-muted-foreground border-b border-border">{groupName}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 p-1.5">
                  {vars.map(v => {
                    const isSelected = selectedIds.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleClick(v.id)}
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-md border text-center transition-all hover:ring-2 hover:ring-primary ${isSelected ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:bg-accent"}`}
                      >
                        {isMulti && isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check size={10} className="text-primary-foreground" />
                          </div>
                        )}
                        <div className="w-10 h-10 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                          {v.image_url ? <img src={v.image_url} className="w-full h-full object-contain" /> : <Palette size={16} className="text-primary" />}
                        </div>
                        <span className="text-[10px] leading-tight line-clamp-2 break-all">{v.variant_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const CollectionAdminTab = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [allComponents, setAllComponents] = useState<Component[]>([]);
  const [links, setLinks] = useState<ComponentLink[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [allVariants, setAllVariants] = useState<Variant[]>([]);
  const [variantLinks, setVariantLinks] = useState<VariantLink[]>([]);
  const [componentStats, setComponentStats] = useState<ComponentStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Category form
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catImageFile, setCatImageFile] = useState<File | null>(null);
  const [catSortOrder, setCatSortOrder] = useState(0);
  const [catParentId, setCatParentId] = useState<string | null>(null);
  const [catIsProductsOnly, setCatIsProductsOnly] = useState(false);

  // Component form
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<Component | null>(null);
  const [compName, setCompName] = useState("");
  const [compImageFile, setCompImageFile] = useState<File | null>(null);
  const [compWeightMin, setCompWeightMin] = useState("");
  const [compWeightMax, setCompWeightMax] = useState("");
  const [compPrice, setCompPrice] = useState("");
  const [compSortOrder, setCompSortOrder] = useState(0);
  const [componentSearch, setComponentSearch] = useState("");

  // Link form
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkParentId, setLinkParentId] = useState("");
  const [linkTargetIds, setLinkTargetIds] = useState<string[]>([]);

  // Variant form
  const [varDialogOpen, setVarDialogOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<Variant | null>(null);
  const [varCompId, setVarCompId] = useState("");
  const [varName, setVarName] = useState("");
  const [varImageFile, setVarImageFile] = useState<File | null>(null);
  const [varSortOrder, setVarSortOrder] = useState(0);

  // Variant link form
  const [varLinkDialogOpen, setVarLinkDialogOpen] = useState(false);
  const [varLinkParentId, setVarLinkParentId] = useState("");
  const [varLinkTargetIds, setVarLinkTargetIds] = useState<string[]>([]);

  // Stats dialog
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsCompId, setStatsCompId] = useState("");
  const [editingStats, setEditingStats] = useState<{ name: string; value: number }[]>([]);

  // Move component dialog
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveCompId, setMoveCompId] = useState("");
  const [moveTargetCatId, setMoveTargetCatId] = useState("");
  const [beytrackrParts, setBeytrackrParts] = useState<BeytrackrPart[]>([]);
  const [beytrackrPreview, setBeytrackrPreview] = useState<BeytrackrPreview | null>(null);
  const [beytrackrLoading, setBeytrackrLoading] = useState(false);
  const [beytrackrSyncing, setBeytrackrSyncing] = useState(false);
  const [beytrackrOrganizing, setBeytrackrOrganizing] = useState(false);
  const [beytrackrMirroring, setBeytrackrMirroring] = useState(false);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from("collection_categories").select("*").order("sort_order");
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  }, []);

  const fetchComponents = useCallback(async (categoryId: string) => {
    const { data } = await supabase.from("collection_components").select("*").eq("category_id", categoryId).order("sort_order");
    setComponents((data as Component[]) ?? []);
  }, []);

  const fetchAllComponents = useCallback(async () => {
    const data = await fetchPagedRows<Component>((from, to) =>
      supabase.from("collection_components").select("*").order("name").range(from, to)
    );
    setAllComponents(data);
  }, []);

  const fetchLinks = useCallback(async () => {
    const { data } = await supabase.from("collection_component_links").select("*");
    setLinks((data as ComponentLink[]) ?? []);
  }, []);

  const fetchVariants = useCallback(async (categoryId: string) => {
    const { data: comps } = await supabase.from("collection_components").select("id").eq("category_id", categoryId);
    if (comps && comps.length > 0) {
      const ids = comps.map(c => c.id);
      const { data } = await supabase.from("collection_component_variants").select("*").in("component_id", ids).order("sort_order");
      setVariants((data as Variant[]) ?? []);
    } else {
      setVariants([]);
    }
  }, []);

  const fetchAllVariants = useCallback(async () => {
    const data = await fetchPagedRows<Variant>((from, to) =>
      supabase.from("collection_component_variants").select("*").order("variant_name").range(from, to)
    );
    setAllVariants(data);
  }, []);

  const fetchVariantLinks = useCallback(async () => {
    const { data } = await supabase.from("collection_variant_links").select("*");
    setVariantLinks((data as VariantLink[]) ?? []);
  }, []);

  const fetchComponentStats = useCallback(async () => {
    const data = await fetchPagedRows<ComponentStat>((from, to) =>
      supabase.from("collection_component_stats").select("*").order("stat_order").range(from, to)
    );
    setComponentStats(data);
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchAllComponents();
    fetchLinks();
    fetchAllVariants();
    fetchVariantLinks();
    fetchComponentStats();
  }, [fetchCategories, fetchAllComponents, fetchLinks, fetchAllVariants, fetchVariantLinks, fetchComponentStats]);

  useEffect(() => {
    if (selectedCategory) {
      fetchComponents(selectedCategory.id);
      fetchVariants(selectedCategory.id);
      setComponentSearch("");
    }
  }, [selectedCategory, fetchComponents, fetchVariants]);

  const beyCategoryIds = useMemo(() => {
    const beyCompletiCat = categories.find(c => normalizeText(c.name).includes("bey completi"));
    return beyCompletiCat
      ? [beyCompletiCat.id, ...categories.filter(c => c.parent_id === beyCompletiCat.id).map(c => c.id)]
      : undefined;
  }, [categories]);

  const collectionSummary = useMemo(() => {
    const rootCount = categories.filter(c => !c.parent_id).length;
    const childCount = categories.length - rootCount;
    return {
      rootCount,
      childCount,
      componentCount: allComponents.length,
      variantCount: allVariants.length,
      componentLinkCount: links.length,
      variantLinkCount: variantLinks.length,
    };
  }, [categories, allComponents, allVariants, links, variantLinks]);

  const componentLinkSuggestions = useMemo(() => {
    if (!linkParentId) return [];
    const parent = allComponents.find(c => c.id === linkParentId);
    if (!parent) return [];
    const parentTokens = getTokens(parent.name);
    const existingTargets = new Set([
      ...links.filter(l => l.parent_component_id === linkParentId).map(l => l.linked_component_id),
      ...linkTargetIds,
      linkParentId,
    ]);

    return allComponents
      .filter(c => !existingTargets.has(c.id) && !(beyCategoryIds ?? []).includes(c.category_id))
      .map(c => ({
        component: c,
        score: getTokens(c.name).filter(token => parentTokens.includes(token)).length,
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.component.name.localeCompare(b.component.name))
      .slice(0, 12)
      .map(item => item.component);
  }, [allComponents, beyCategoryIds, linkParentId, linkTargetIds, links]);

  const variantLinkSuggestions = useMemo(() => {
    if (!varLinkParentId) return [];
    const parentVariant = allVariants.find(v => v.id === varLinkParentId);
    if (!parentVariant) return [];
    const parentComponent = allComponents.find(c => c.id === parentVariant.component_id);
    const linkedComponentIds = new Set(
      links.filter(l => l.parent_component_id === parentVariant.component_id).map(l => l.linked_component_id)
    );
    const parentTokens = getTokens(`${parentComponent?.name ?? ""} ${parentVariant.variant_name}`);
    const existingTargets = new Set([
      ...variantLinks.filter(l => l.parent_variant_id === varLinkParentId).map(l => l.linked_variant_id),
      ...varLinkTargetIds,
      varLinkParentId,
    ]);

    return allVariants
      .filter(v => !existingTargets.has(v.id) && linkedComponentIds.has(v.component_id))
      .map(v => ({
        variant: v,
        score: getTokens(v.variant_name).filter(token => parentTokens.includes(token)).length,
      }))
      .filter(item => item.score > 0 || linkedComponentIds.has(item.variant.component_id))
      .sort((a, b) => {
        const aComp = allComponents.find(c => c.id === a.variant.component_id)?.name ?? "";
        const bComp = allComponents.find(c => c.id === b.variant.component_id)?.name ?? "";
        return b.score - a.score || `${aComp} ${a.variant.variant_name}`.localeCompare(`${bComp} ${b.variant.variant_name}`);
      })
      .slice(0, 12)
      .map(item => item.variant);
  }, [allComponents, allVariants, links, varLinkParentId, varLinkTargetIds, variantLinks]);

  const componentByMatchName = useMemo(() => {
    const map = new Map<string, Component>();
    allComponents.forEach(component => map.set(normalizeKey(component.name), component));
    return map;
  }, [allComponents]);

  const findBeytrackrCategoryId = useCallback((part: BeytrackrPart) => {
    const target = BEYTRACKR_TAXONOMY.find(item => item.key === part.category);
    if (!target) return null;
    return categories.find(cat => !cat.parent_id && normalizeKey(cat.name) === normalizeKey(target.name))?.id ?? null;
  }, [categories]);

  const buildBeytrackrPreview = useCallback((parts: BeytrackrPart[]) => {
    const categoriesCount: Record<string, number> = {};
    let matched = 0;
    let importable = 0;

    parts.forEach(part => {
      categoriesCount[part.category] = (categoriesCount[part.category] ?? 0) + 1;
      const match = getPartMatchNames(part).some(name => componentByMatchName.has(name));
      if (match) matched += 1;
      else if (findBeytrackrCategoryId(part)) importable += 1;
    });

    const preview = { total: parts.length, matched, importable, categories: categoriesCount };
    setBeytrackrPreview(preview);
    return preview;
  }, [componentByMatchName, findBeytrackrCategoryId]);

  const scanBeytrackr = async () => {
    setBeytrackrLoading(true);
    try {
      const parts = await fetchBeytrackrParts();
      setBeytrackrParts(parts);
      const preview = buildBeytrackrPreview(parts);
      toast({ title: `BeyTrackr letto: ${preview.total} parti, ${preview.matched} match` });
    } catch (error) {
      console.error(error);
      toast({ title: "Errore lettura BeyTrackr", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setBeytrackrLoading(false);
    }
  };

  const mirrorBeytrackrImage = async (
    imageUrl: string | null,
    folder: "components" | "variants",
    fileNameSeed: string
  ) => {
    if (!imageUrl) return null;
    const externalAsset = imageUrl.includes("beytrackr.com") || imageUrl.includes("firebasestorage.googleapis.com");
    if (externalAsset) return imageUrl;
    try {
      return await uploadCollectionRemoteImage(imageUrl, folder, fileNameSeed);
    } catch (error) {
      console.warn("BeyTrackr image mirror failed", error);
      return imageUrl;
    }
  };

  const upsertBeytrackrStats = async (componentId: string, part: BeytrackrPart) => {
    await supabase.from("collection_component_stats").delete().eq("component_id", componentId);
    const inserts = buildStatsFromBeytrackr(part).map((stat, index) => ({
      component_id: componentId,
      stat_name: stat.name,
      stat_value: Math.round(stat.value),
      stat_order: index,
    }));
    await supabase.from("collection_component_stats").insert(inserts);
  };

  const syncBeytrackrVariants = async (componentId: string, part: BeytrackrPart) => {
    const sourceVariants = (part.variants ?? [])
      .map((variant, index) => ({ variant, name: getBeytrackrVariantName(variant), index }))
      .filter(item => item.name);
    if (!sourceVariants.length) return 0;

    const { data: existingRows } = await supabase
      .from("collection_component_variants")
      .select("id, variant_name")
      .eq("component_id", componentId);
    const existingList = ((existingRows ?? []) as Variant[]);
    let created = 0;

    for (const item of sourceVariants) {
      if (findMatchingVariant(existingList, item.variant)) continue;
      const remoteImage = resolveBeytrackrImageUrl(item.variant.imageUrl);
      const imageUrl = await mirrorBeytrackrImage(remoteImage, "variants", `${part.category}_${part.name}_${item.name}`);
      await supabase.from("collection_component_variants").insert({
        component_id: componentId,
        variant_name: item.name,
        image_url: imageUrl,
        sort_order: item.index,
      });
      created += 1;
    }
    return created;
  };

  const syncBeytrackr = async (mode: "matched" | "missing") => {
    const sourceParts = beytrackrParts.length ? beytrackrParts : await fetchBeytrackrParts();
    if (!beytrackrParts.length) {
      setBeytrackrParts(sourceParts);
      buildBeytrackrPreview(sourceParts);
    }

    setBeytrackrSyncing(true);
    try {
      let updated = 0;
      let created = 0;
      let variantsCreated = 0;

      for (const part of sourceParts) {
        const matchedComponent = getPartMatchNames(part).map(name => componentByMatchName.get(name)).find(Boolean);
        const weight = parseWeight(part.weight);
        const imageUrl = resolveBeytrackrImageUrl(part.imageUrl);

        if (matchedComponent && mode === "matched") {
          const mirroredImage = matchedComponent.image_url ? matchedComponent.image_url : await mirrorBeytrackrImage(imageUrl, "components", `${part.category}_${part.name}`);
          await supabase.from("collection_components").update({
            weight_min: weight,
            weight_max: weight,
            image_url: mirroredImage,
          }).eq("id", matchedComponent.id);
          await upsertBeytrackrStats(matchedComponent.id, part);
          variantsCreated += await syncBeytrackrVariants(matchedComponent.id, part);
          updated += 1;
        }

        if (!matchedComponent && mode === "missing") {
          const categoryId = findBeytrackrCategoryId(part);
          if (!categoryId) continue;
          const mirroredImage = await mirrorBeytrackrImage(imageUrl, "components", `${part.category}_${part.name}`);
          const { data, error } = await supabase
            .from("collection_components")
            .insert({
              category_id: categoryId,
              name: part.name,
              image_url: mirroredImage,
              weight_min: weight,
              weight_max: weight,
              sort_order: allComponents.length + created,
            })
            .select("id")
            .single();
          if (error || !data) continue;
          await upsertBeytrackrStats(data.id, part);
          variantsCreated += await syncBeytrackrVariants(data.id, part);
          created += 1;
        }
      }

      toast({
        title: mode === "matched" ? "Match BeyTrackr aggiornati" : "Parti BeyTrackr importate",
        description: `${updated} aggiornate, ${created} create, ${variantsCreated} varianti aggiunte`,
      });
      await fetchAllComponents();
      await fetchAllVariants();
      await fetchComponentStats();
      if (selectedCategory) {
        await fetchComponents(selectedCategory.id);
        await fetchVariants(selectedCategory.id);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Sync BeyTrackr non riuscito", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setBeytrackrSyncing(false);
    }
  };

  const getBeytrackrPartsForAction = async () => {
    if (beytrackrParts.length) return beytrackrParts;
    const parts = await fetchBeytrackrParts();
    setBeytrackrParts(parts);
    buildBeytrackrPreview(parts);
    return parts;
  };

  const ensurePartCategory = async (
    target: BeytrackrCategoryTarget,
    currentCategories: Category[]
  ): Promise<{ id: string; categories: Category[] }> => {
    const aliases: Record<string, string[]> = {
      blade: ["blades bx ux ux", "bx basic line", "ux unique line", "ux"],
      "lock-chip": ["cx lock chips"],
      "main-blade": ["cx main blade", "main blade", "main blade infinity expand"],
      "over-blade": ["cx over blade", "cx over blade infinity expand"],
      "metal-blade": ["cx metal blade", "cx metal blade infinity expand"],
      "assist-blade": ["cx assist blades"],
      ratchet: ["ratchets"],
      bit: ["bits"],
      ribs: ["ribs ratchet integrated bits"],
      ribl: ["ribl"],
      "x-over": ["x over"],
      collab: ["collab"],
    };

    const wanted = normalizeKey(target.name);
    const candidates = [wanted, ...(aliases[target.key] ?? []).map(normalizeKey)];
    const reusable = currentCategories.find(cat => candidates.includes(normalizeKey(cat.name)) && normalizeText(cat.name) !== "bey completi");

    if (reusable) {
      const { data, error } = await supabase
        .from("collection_categories")
        .update({
          name: target.name,
          parent_id: null,
          sort_order: target.sortOrder,
          is_products_only: false,
        })
        .eq("id", reusable.id)
        .select("*")
        .single();
      if (error) throw error;
      return {
        id: reusable.id,
        categories: currentCategories.map(cat => cat.id === reusable.id ? (data as Category) : cat),
      };
    }

    const { data, error } = await supabase
      .from("collection_categories")
      .insert({
        name: target.name,
        parent_id: null,
        sort_order: target.sortOrder,
        is_products_only: false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { id: (data as Category).id, categories: [...currentCategories, data as Category] };
  };

  const organizeBeytrackrTaxonomy = async () => {
    setBeytrackrOrganizing(true);
    try {
      const parts = await getBeytrackrPartsForAction();
      let currentCategories = [...categories];
      const targetIds = new Map<string, string>();

      const beyCompleti = currentCategories.find(cat => normalizeText(cat.name) === "bey completi");
      if (beyCompleti) {
        await supabase.from("collection_categories").update({ sort_order: 0, parent_id: null, is_products_only: false }).eq("id", beyCompleti.id);
      }

      for (const target of BEYTRACKR_TAXONOMY) {
        const ensured = await ensurePartCategory(target, currentCategories);
        currentCategories = ensured.categories;
        targetIds.set(target.key, ensured.id);
      }

      const matchByName = new Map<string, BeytrackrPart>();
      parts.forEach(part => getPartMatchNames(part).forEach(name => matchByName.set(name, part)));

      const componentMoves: { id: string; category_id: string }[] = [];
      allComponents.forEach(component => {
        const part = matchByName.get(normalizeKey(component.name));
        const targetId = part ? targetIds.get(part.category) : null;
        if (targetId && component.category_id !== targetId) {
          componentMoves.push({ id: component.id, category_id: targetId });
        }
      });

      for (const move of componentMoves) {
        await supabase.from("collection_components").update({ category_id: move.category_id }).eq("id", move.id);
      }

      const activeCategoryIds = new Set([
        beyCompleti?.id,
        ...currentCategories.filter(cat => cat.parent_id === beyCompleti?.id).map(cat => cat.id),
        ...Array.from(targetIds.values()),
        currentCategories.find(cat => cat.is_products_only)?.id,
      ].filter(Boolean) as string[]);

      const moveTargetByComponentId = new Map(componentMoves.map(move => [move.id, move.category_id]));
      const finalComponentCategoryIds = new Set(
        allComponents.map(component => moveTargetByComponentId.get(component.id) ?? component.category_id)
      );
      const obsolete = currentCategories.filter(cat => !activeCategoryIds.has(cat.id));
      for (const category of obsolete) {
        if (finalComponentCategoryIds.has(category.id)) continue;
        await supabase.from("collection_categories").delete().eq("id", category.id);
      }

      toast({ title: "Categorie riorganizzate", description: `${componentMoves.length} componenti spostati nelle categorie BeyTrackr` });
      await fetchCategories();
      await fetchAllComponents();
      if (selectedCategory) {
        await fetchComponents(selectedCategory.id);
        await fetchVariants(selectedCategory.id);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Riorganizzazione non riuscita", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setBeytrackrOrganizing(false);
    }
  };

  const mirrorBeytrackrImages = async () => {
    setBeytrackrMirroring(true);
    try {
      const parts = await getBeytrackrPartsForAction();
      const componentByName = new Map<string, Component>();
      allComponents.forEach(component => componentByName.set(normalizeKey(component.name), component));

      let componentImages = 0;
      let variantImages = 0;

      for (const part of parts) {
        const matchingComponents = Array.from(
          new Map(
            getPartMatchNames(part)
              .map(name => componentByName.get(name))
              .filter(Boolean)
              .map(component => [component!.id, component!])
          ).values()
        );
        if (!matchingComponents.length) continue;

        const remoteImage = resolveBeytrackrImageUrl(part.imageUrl);
        for (const component of matchingComponents) {
          if (remoteImage && (!component.image_url || !component.image_url.includes(`${COLLECTION_ASSETS_BUCKET}/components`))) {
            const imageUrl = await mirrorBeytrackrImage(remoteImage, "components", `${part.category}_${part.name}_${component.name}`);
            await supabase.from("collection_components").update({ image_url: imageUrl }).eq("id", component.id);
            componentImages += 1;
          }

          const existingVariants = allVariants.filter(variant => variant.component_id === component.id);
          for (const variant of part.variants ?? []) {
            const variantName = getBeytrackrVariantName(variant);
            if (!variantName) continue;
            const existing = findMatchingVariant(existingVariants, variant);
            const remoteVariantImage = resolveBeytrackrImageUrl(variant.imageUrl);
            if (!existing || !remoteVariantImage) continue;
            if (!existing.image_url || !existing.image_url.includes(`${COLLECTION_ASSETS_BUCKET}/variants`)) {
              const imageUrl = await mirrorBeytrackrImage(remoteVariantImage, "variants", `${part.category}_${part.name}_${variantName}_${component.name}`);
              await supabase.from("collection_component_variants").update({ image_url: imageUrl }).eq("id", existing.id);
              variantImages += 1;
            }
          }
        }
      }

      toast({ title: "Immagini collezione aggiornate", description: `${componentImages} componenti, ${variantImages} varianti` });
      await fetchAllComponents();
      await fetchAllVariants();
      if (selectedCategory) {
        await fetchComponents(selectedCategory.id);
        await fetchVariants(selectedCategory.id);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Mirror immagini non riuscito", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setBeytrackrMirroring(false);
    }
  };

  // ─── Category CRUD ───
  const openCatDialog = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCatName(cat.name);
      setCatSortOrder(cat.sort_order);
      setCatParentId(cat.parent_id);
      setCatIsProductsOnly(cat.is_products_only);
    } else {
      setEditingCat(null);
      setCatName("");
      setCatSortOrder(categories.length);
      setCatParentId(null);
      setCatIsProductsOnly(false);
    }
    setCatImageFile(null);
    setCatDialogOpen(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) return;
    let imageUrl = editingCat?.image_url ?? null;
    if (catImageFile) {
      try { imageUrl = await uploadCollectionImage(catImageFile, "categories"); }
      catch { toast({ title: "Errore upload immagine", variant: "destructive" }); return; }
    }
    const payload: any = { name: catName, image_url: imageUrl, sort_order: catSortOrder, parent_id: catParentId || null, is_products_only: catIsProductsOnly };
    if (editingCat) {
      await supabase.from("collection_categories").update(payload).eq("id", editingCat.id);
    } else {
      await supabase.from("collection_categories").insert(payload);
    }
    toast({ title: editingCat ? "Categoria aggiornata" : "Categoria creata" });
    setCatDialogOpen(false);
    fetchCategories();
  };

  const deleteCat = async (id: string) => {
    await supabase.from("collection_categories").delete().eq("id", id);
    if (selectedCategory?.id === id) setSelectedCategory(null);
    toast({ title: "Categoria eliminata" });
    fetchCategories();
  };

  // ─── Component CRUD ───
  const openCompDialog = (comp?: Component) => {
    if (comp) {
      setEditingComp(comp);
      setCompName(comp.name);
      setCompWeightMin(comp.weight_min?.toString() ?? "");
      setCompWeightMax(comp.weight_max?.toString() ?? "");
      setCompPrice(comp.recommended_price?.toString() ?? "");
      setCompSortOrder(comp.sort_order);
    } else {
      setEditingComp(null);
      setCompName("");
      setCompWeightMin("");
      setCompWeightMax("");
      setCompPrice("");
      setCompSortOrder(components.length);
    }
    setCompImageFile(null);
    setCompDialogOpen(true);
  };

  const saveComp = async () => {
    if (!compName.trim() || !selectedCategory) return;
    let imageUrl = editingComp?.image_url ?? null;
    if (compImageFile) {
      try { imageUrl = await uploadCollectionImage(compImageFile, "components"); }
      catch { toast({ title: "Errore upload immagine", variant: "destructive" }); return; }
    }
    const payload = {
      name: compName, category_id: selectedCategory.id, image_url: imageUrl,
      weight_min: compWeightMin ? parseFloat(compWeightMin) : null,
      weight_max: compWeightMax ? parseFloat(compWeightMax) : null,
      recommended_price: compPrice ? parseFloat(compPrice) : null,
      sort_order: compSortOrder,
    };
    if (editingComp) {
      await supabase.from("collection_components").update(payload).eq("id", editingComp.id);
    } else {
      await supabase.from("collection_components").insert(payload);
    }
    toast({ title: editingComp ? "Componente aggiornato" : "Componente creato" });
    setCompDialogOpen(false);
    fetchComponents(selectedCategory.id);
    fetchAllComponents();
  };

  const deleteComp = async (id: string) => {
    await supabase.from("collection_components").delete().eq("id", id);
    toast({ title: "Componente eliminato" });
    if (selectedCategory) fetchComponents(selectedCategory.id);
    fetchAllComponents();
  };

  // ─── Move Component ───
  const openMoveDialog = (compId: string) => {
    setMoveCompId(compId);
    setMoveTargetCatId("");
    setMoveDialogOpen(true);
  };

  const moveComponent = async () => {
    if (!moveCompId || !moveTargetCatId) return;
    await supabase.from("collection_components").update({ category_id: moveTargetCatId }).eq("id", moveCompId);
    toast({ title: "Componente spostato" });
    setMoveDialogOpen(false);
    if (selectedCategory) fetchComponents(selectedCategory.id);
    fetchAllComponents();
  };


  const toggleInfinite = async (comp: Component) => {
    const newVal = !comp.is_infinite;
    await supabase.from("collection_components").update({ is_infinite: newVal } as any).eq("id", comp.id);
    toast({ title: newVal ? "♾️ attivato" : "♾️ disattivato" });
    if (selectedCategory) fetchComponents(selectedCategory.id);
    fetchAllComponents();
  };

  const isBladeCategory = selectedCategory?.id === BX_BLADE_CATEGORY_ID;



  // ─── Links ───
  const saveLink = async () => {
    if (!linkParentId || linkTargetIds.length === 0) return;
    const toInsert = linkTargetIds.filter(id => id !== linkParentId).map(id => ({
      parent_component_id: linkParentId, linked_component_id: id,
    }));
    if (toInsert.length === 0) return;
    const { error } = await supabase.from("collection_component_links").insert(toInsert);
    if (error) toast({ title: "Link già esistente o errore", variant: "destructive" });
    else toast({ title: `${toInsert.length} link creati` });
    setLinkDialogOpen(false);
    fetchLinks();
  };

  const deleteLink = async (id: string) => {
    await supabase.from("collection_component_links").delete().eq("id", id);
    toast({ title: "Link rimosso" });
    fetchLinks();
  };

  const deleteLinksByParent = async (parentId: string) => {
    const ids = links.filter(l => l.parent_component_id === parentId).map(l => l.id);
    if (ids.length === 0) return;
    await supabase.from("collection_component_links").delete().in("id", ids);
    toast({ title: `${ids.length} link rimossi` });
    fetchLinks();
  };

  // ─── Variant CRUD ───
  const openVarDialog = (compId: string, v?: Variant) => {
    setVarCompId(compId);
    if (v) {
      setEditingVar(v);
      setVarName(v.variant_name);
      setVarSortOrder(v.sort_order);
    } else {
      setEditingVar(null);
      setVarName("");
      setVarSortOrder(0);
    }
    setVarImageFile(null);
    setVarDialogOpen(true);
  };

  const saveVar = async () => {
    if (!varName.trim() || !varCompId) return;
    let imageUrl = editingVar?.image_url ?? null;
    if (varImageFile) {
      try { imageUrl = await uploadCollectionImage(varImageFile, "variants"); }
      catch { toast({ title: "Errore upload immagine", variant: "destructive" }); return; }
    }
    if (editingVar) {
      await supabase.from("collection_component_variants").update({
        variant_name: varName, image_url: imageUrl, sort_order: varSortOrder,
      }).eq("id", editingVar.id);
    } else {
      await supabase.from("collection_component_variants").insert({
        component_id: varCompId, variant_name: varName, image_url: imageUrl, sort_order: varSortOrder,
      });
    }
    toast({ title: editingVar ? "Variante aggiornata" : "Variante creata" });
    setVarDialogOpen(false);
    if (selectedCategory) fetchVariants(selectedCategory.id);
    fetchAllVariants();
  };

  const deleteVar = async (id: string) => {
    await supabase.from("collection_component_variants").delete().eq("id", id);
    toast({ title: "Variante eliminata" });
    if (selectedCategory) fetchVariants(selectedCategory.id);
    fetchAllVariants();
  };

  // ─── Variant Links ───
  const saveVarLink = async () => {
    if (!varLinkParentId || varLinkTargetIds.length === 0) return;
    const toInsert = varLinkTargetIds.filter(id => id !== varLinkParentId).map(id => ({
      parent_variant_id: varLinkParentId, linked_variant_id: id,
    }));
    if (toInsert.length === 0) return;
    const { error } = await supabase.from("collection_variant_links").insert(toInsert);
    if (error) toast({ title: "Link già esistente o errore", variant: "destructive" });
    else toast({ title: `${toInsert.length} link variante creati` });
    setVarLinkDialogOpen(false);
    fetchVariantLinks();
  };

  const deleteVarLink = async (id: string) => {
    await supabase.from("collection_variant_links").delete().eq("id", id);
    toast({ title: "Link variante rimosso" });
    fetchVariantLinks();
  };

  const deleteVarLinksByParent = async (parentId: string) => {
    const ids = variantLinks.filter(l => l.parent_variant_id === parentId).map(l => l.id);
    if (ids.length === 0) return;
    await supabase.from("collection_variant_links").delete().in("id", ids);
    toast({ title: `${ids.length} link variante rimossi` });
    fetchVariantLinks();
  };

  // ─── Stats ───
  const openStatsDialog = (compId: string) => {
    setStatsCompId(compId);
    const existing = componentStats.filter(s => s.component_id === compId).sort((a, b) => a.stat_order - b.stat_order);
    const stats = Array.from({ length: 6 }, (_, i) => ({
      name: existing[i]?.stat_name ?? DEFAULT_STAT_NAMES[i],
      value: existing[i]?.stat_value ?? 0,
    }));
    setEditingStats(stats);
    setStatsDialogOpen(true);
  };

  const saveStats = async () => {
    if (!statsCompId) return;
    // Delete existing stats for this component
    await supabase.from("collection_component_stats").delete().eq("component_id", statsCompId);
    // Insert new stats
    const inserts = editingStats.map((s, i) => ({
      component_id: statsCompId,
      stat_name: s.name,
      stat_value: s.value,
      stat_order: i,
    }));
    const { error } = await supabase.from("collection_component_stats").insert(inserts);
    if (error) {
      toast({ title: "Errore salvataggio statistiche", variant: "destructive" });
    } else {
      toast({ title: "Statistiche aggiornate" });
    }
    setStatsDialogOpen(false);
    fetchComponentStats();
  };

  const getCompName = (id: string) => allComponents.find(c => c.id === id)?.name ?? "?";
  const getCatName = (compId: string) => {
    const comp = allComponents.find(c => c.id === compId);
    return comp ? categories.find(cat => cat.id === comp.category_id)?.name ?? "" : "";
  };
  const getVarLabel = (id: string) => {
    const v = allVariants.find(x => x.id === id);
    if (!v) return "?";
    const comp = allComponents.find(c => c.id === v.component_id);
    return `${comp?.name ?? "?"} → ${v.variant_name}`;
  };

  // Helper: get root categories and sub-categories
  const rootCategories = categories.filter(c => !c.parent_id);
  const getSubCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId);
  const groupedComponentLinks = useMemo(() => {
    const grouped = new Map<string, ComponentLink[]>();
    links.forEach(link => {
      if (!grouped.has(link.parent_component_id)) grouped.set(link.parent_component_id, []);
      grouped.get(link.parent_component_id)!.push(link);
    });
    return Array.from(grouped.entries()).sort((a, b) => getCompName(a[0]).localeCompare(getCompName(b[0])));
  }, [links, allComponents]);
  const groupedVariantLinks = useMemo(() => {
    const grouped = new Map<string, VariantLink[]>();
    variantLinks.forEach(link => {
      if (!grouped.has(link.parent_variant_id)) grouped.set(link.parent_variant_id, []);
      grouped.get(link.parent_variant_id)!.push(link);
    });
    return Array.from(grouped.entries()).sort((a, b) => getVarLabel(a[0]).localeCompare(getVarLabel(b[0])));
  }, [variantLinks, allVariants, allComponents]);
  const selectedParentCategory = selectedCategory?.parent_id
    ? categories.find(c => c.id === selectedCategory.parent_id)
    : null;
  const filteredComponents = useMemo(() => {
    const q = normalizeText(componentSearch);
    if (!q) return components;
    return components.filter(component => {
      const componentVariants = variants.filter(v => v.component_id === component.id);
      return normalizeText(`${component.name} ${componentVariants.map(v => v.variant_name).join(" ")}`).includes(q);
    });
  }, [componentSearch, components, variants]);
  const selectedCategoryStats = useMemo(() => ({
    components: components.length,
    variants: variants.length,
    withStats: components.filter(c => componentStats.some(s => s.component_id === c.id)).length,
  }), [components, variants, componentStats]);

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  // ─── Category List View ───
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl">Struttura Collezione</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                ["Categorie", collectionSummary.rootCount],
                ["Sotto-cat.", collectionSummary.childCount],
                ["Componenti", collectionSummary.componentCount],
                ["Varianti", collectionSummary.variantCount],
                ["Link parti", collectionSummary.componentLinkCount],
                ["Link varianti", collectionSummary.variantLinkCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border bg-secondary/25 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Asset collezione</p>
              <p>
                Upload immagini su <span className="font-mono text-xs">{COLLECTION_ASSETS_PROJECT_URL}/storage/files/buckets/{COLLECTION_ASSETS_BUCKET}</span>.
                Le cartelle usate sono <span className="font-mono text-xs">categories</span>, <span className="font-mono text-xs">components</span> e <span className="font-mono text-xs">variants</span>.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database size={18} className="text-primary" />
                  BeyTrackr Sync
                </CardTitle>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Legge la libreria pubblica BeyTrackr e applica pesi, statistiche, immagini e varianti solo alle tabelle collezione.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={scanBeytrackr} disabled={beytrackrLoading || beytrackrSyncing} className="gap-2">
                  <RefreshCw size={14} className={beytrackrLoading ? "animate-spin" : ""} />
                  Analizza
                </Button>
                <Button size="sm" onClick={() => syncBeytrackr("matched")} disabled={beytrackrLoading || beytrackrSyncing} className="gap-2">
                  <DownloadCloud size={14} />
                  Aggiorna match
                </Button>
                <Button variant="secondary" size="sm" onClick={() => syncBeytrackr("missing")} disabled={beytrackrLoading || beytrackrSyncing} className="gap-2">
                  <Plus size={14} />
                  Importa mancanti
                </Button>
                <Button variant="outline" size="sm" onClick={organizeBeytrackrTaxonomy} disabled={beytrackrLoading || beytrackrSyncing || beytrackrOrganizing} className="gap-2">
                  <FolderTree size={14} />
                  Riordina categorie
                </Button>
                <Button variant="outline" size="sm" onClick={mirrorBeytrackrImages} disabled={beytrackrLoading || beytrackrSyncing || beytrackrMirroring} className="gap-2">
                  <Image size={14} />
                  Completa immagini
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                ["Parti lette", beytrackrPreview?.total ?? "-"],
                ["Match esistenti", beytrackrPreview?.matched ?? "-"],
                ["Importabili", beytrackrPreview?.importable ?? "-"],
                ["Fonte", "Firestore"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-secondary/20 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
            {beytrackrPreview && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(beytrackrPreview.categories)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([category, count]) => (
                    <Badge key={category} variant="outline" className="rounded-md text-[11px]">
                      {BEYTRACKR_CATEGORY_LABELS[category] ?? category}: {count}
                    </Badge>
                  ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              I match usano il nome normalizzato della parte. Le immagini remote vengono copiate nel bucket Supabase quando il browser puo leggerle; in caso contrario resta l'URL remoto come fallback.
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="taxonomy" className="space-y-4">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="grid h-auto w-max min-w-full grid-cols-3 gap-1 p-1 sm:min-w-0">
              <TabsTrigger value="taxonomy" className="gap-1.5 text-xs sm:text-sm">
                <Layers3 size={14} /> Struttura
              </TabsTrigger>
              <TabsTrigger value="component-links" className="gap-1.5 text-xs sm:text-sm">
                <Network size={14} /> Link parti
              </TabsTrigger>
              <TabsTrigger value="variant-links" className="gap-1.5 text-xs sm:text-sm">
                <GitBranch size={14} /> Link varianti
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="taxonomy" className="mt-0">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Categorie e sotto-categorie</CardTitle>
              <p className="text-sm text-muted-foreground">Apri una categoria per gestire componenti, varianti e statistiche.</p>
            </div>
            <Button size="sm" onClick={() => openCatDialog()} className="w-full sm:w-auto">
              <Plus size={14} className="mr-1" /> Nuova Categoria
            </Button>
          </CardHeader>
          <CardContent>
            {rootCategories.length === 0 ? (
              <p className="text-muted-foreground">Nessuna categoria creata.</p>
            ) : (
              <div className="space-y-6">
                {rootCategories.map(cat => {
                  const subs = getSubCategories(cat.id);
                  return (
                    <div key={cat.id}>
                      {/* Parent category */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="relative group flex-1 border border-border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all flex items-center gap-3 p-3 bg-card"
                          onClick={() => setSelectedCategory(cat)}
                        >
                          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-muted rounded-md flex items-center justify-center overflow-hidden shrink-0">
                            {cat.image_url ? <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" /> : <Image className="h-6 w-6 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">
                              {cat.name}
                              {cat.is_products_only && <span className="ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded bg-primary/10 text-primary">📦 Prodotti</span>}
                            </p>
                            {subs.length > 0 && (
                              <p className="text-xs text-muted-foreground"><FolderTree size={10} className="inline mr-1" />{subs.length} sotto-categorie</p>
                            )}
                          </div>
                          <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openCatDialog(cat); }}><Edit size={12} /></Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); }}><Trash2 size={12} /></Button>
                          </div>
                        </div>
                      </div>
                      {/* Sub-categories */}
                      {subs.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:ml-8">
                          {subs.map(sub => (
                            <div
                              key={sub.id}
                              className="relative group border border-border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all flex items-center gap-3 bg-secondary/20 p-2"
                              onClick={() => setSelectedCategory(sub)}
                            >
                              <div className="h-12 w-12 bg-muted flex items-center justify-center rounded-md overflow-hidden shrink-0">
                                {sub.image_url ? <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover" /> : <Image className="h-5 w-5 text-muted-foreground" />}
                              </div>
                              <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{sub.name}</p></div>
                              <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openCatDialog(sub); }}><Edit size={10} /></Button>
                                <Button size="icon" variant="destructive" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteCat(sub.id); }}><Trash2 size={10} /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

        {/* Component Links */}
          <TabsContent value="component-links" className="mt-0">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Collegamenti componenti</CardTitle>
              <p className="text-sm text-muted-foreground">Definisci quali parti vengono spuntate quando un BEY completo viene selezionato.</p>
            </div>
            <Button size="sm" onClick={() => { setLinkParentId(""); setLinkTargetIds([]); setLinkDialogOpen(true); }} className="w-full sm:w-auto">
              <Link size={14} className="mr-1" /> Nuovo Link
            </Button>
          </CardHeader>
          <CardContent>
            {links.length === 0 ? (
              <p className="text-muted-foreground">Nessun collegamento.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="grid gap-3 lg:hidden">
                  {groupedComponentLinks.map(([parentId, childLinks]) => (
                      <div key={parentId} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm truncate">{getCompName(parentId)}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{getCatName(parentId)}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {childLinks.map(l => (
                            <Badge key={l.id} variant="secondary" className="gap-1 pr-1">
                              {getCompName(l.linked_component_id)}
                              <button onClick={() => deleteLink(l.id)} className="ml-1 hover:text-destructive"><Trash2 size={10} /></button>
                            </Badge>
                          ))}
                        </div>
                        <Button size="sm" variant="destructive" className="w-full" onClick={() => deleteLinksByParent(parentId)}>
                          <Trash2 size={12} className="mr-1" /> Rimuovi tutti
                        </Button>
                      </div>
                    ))}
                </div>
                {/* Desktop table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Componente Padre</TableHead><TableHead>Categoria</TableHead>
                      <TableHead>→ Componenti Collegati</TableHead><TableHead>Azioni</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {groupedComponentLinks.map(([parentId, childLinks]) => (
                          <TableRow key={parentId}>
                            <TableCell className="font-medium">{getCompName(parentId)}</TableCell>
                            <TableCell><Badge variant="outline">{getCatName(parentId)}</Badge></TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {childLinks.map(l => (
                                  <Badge key={l.id} variant="secondary" className="gap-1 pr-1">
                                    {getCompName(l.linked_component_id)}
                                    <button onClick={() => deleteLink(l.id)} className="ml-1 hover:text-destructive"><Trash2 size={10} /></button>
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="destructive" onClick={() => deleteLinksByParent(parentId)} title="Rimuovi tutti">
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>

        {/* Variant Links */}
          <TabsContent value="variant-links" className="mt-0">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Collegamenti varianti</CardTitle>
              <p className="text-sm text-muted-foreground">Associa varianti colore dei BEY completi alle varianti delle singole parti.</p>
            </div>
            <Button size="sm" onClick={() => { setVarLinkParentId(""); setVarLinkTargetIds([]); setVarLinkDialogOpen(true); }} className="w-full sm:w-auto">
              <Link size={14} className="mr-1" /> Nuovo Link Variante
            </Button>
          </CardHeader>
          <CardContent>
            {variantLinks.length === 0 ? (
              <p className="text-muted-foreground">Nessun collegamento variante.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="grid gap-3 lg:hidden">
                  {groupedVariantLinks.map(([parentId, childLinks]) => (
                      <div key={parentId} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                        <p className="font-semibold text-sm">{getVarLabel(parentId)}</p>
                        <div className="flex flex-wrap gap-1">
                          {childLinks.map(l => (
                            <Badge key={l.id} variant="secondary" className="gap-1 pr-1">
                              {getVarLabel(l.linked_variant_id)}
                              <button onClick={() => deleteVarLink(l.id)} className="ml-1 hover:text-destructive"><Trash2 size={10} /></button>
                            </Badge>
                          ))}
                        </div>
                        <Button size="sm" variant="destructive" className="w-full" onClick={() => deleteVarLinksByParent(parentId)}>
                          <Trash2 size={12} className="mr-1" /> Rimuovi tutti
                        </Button>
                      </div>
                    ))}
                </div>
                {/* Desktop table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Variante Padre</TableHead><TableHead>→ Varianti Collegate</TableHead><TableHead>Azioni</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {groupedVariantLinks.map(([parentId, childLinks]) => (
                          <TableRow key={parentId}>
                            <TableCell className="font-medium">{getVarLabel(parentId)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {childLinks.map(l => (
                                  <Badge key={l.id} variant="secondary" className="gap-1 pr-1">
                                    {getVarLabel(l.linked_variant_id)}
                                    <button onClick={() => deleteVarLink(l.id)} className="ml-1 hover:text-destructive"><Trash2 size={10} /></button>
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="destructive" onClick={() => deleteVarLinksByParent(parentId)} title="Rimuovi tutti">
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>

        {/* Category Dialog */}
        <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
          <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
            <DialogHeader><DialogTitle>{editingCat ? "Modifica Categoria" : "Nuova Categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={catName} onChange={e => setCatName(e.target.value)} /></div>
              <div><Label>Immagine</Label><Input type="file" accept="image/*" onChange={e => setCatImageFile(e.target.files?.[0] ?? null)} /></div>
              <div>
                <Label>Categoria Padre (opzionale)</Label>
                <Select value={catParentId ?? "none"} onValueChange={v => setCatParentId(v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Nessuna (root)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna (root)</SelectItem>
                    {categories.filter(c => !c.parent_id && c.id !== editingCat?.id).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ordine</Label><Input type="number" value={catSortOrder} onChange={e => setCatSortOrder(parseInt(e.target.value) || 0)} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cat-products-only" checked={catIsProductsOnly} onChange={e => setCatIsProductsOnly(e.target.checked)} className="rounded border-border" />
                <Label htmlFor="cat-products-only" className="text-sm cursor-pointer">Solo Prodotti (nascosta dalla collezione, usata per ordini club)</Label>
              </div>
              <Button onClick={saveCat} className="w-full">Salva</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Link Dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo Collegamento</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Quando il componente padre viene spuntato, anche il collegato verrà spuntato automaticamente.</p>
            <div className="space-y-4">
              {(() => {
                return (
                  <ComponentGridPicker
                    label="Componente Padre"
                    value={linkParentId}
                    onChange={setLinkParentId}
                    components={allComponents}
                    categories={categories}
                    excludeIds={linkTargetIds}
                    filterCategoryIds={beyCategoryIds}
                  />
                );
              })()}
              {linkParentId && (
                <div className="rounded-lg border border-border bg-secondary/25 p-3 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Suggerimenti parti</p>
                      <p className="text-xs text-muted-foreground">Basati sul nome del BEY completo e sui componenti gia caricati.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={componentLinkSuggestions.length === 0}
                      onClick={() => setLinkTargetIds(prev => Array.from(new Set([...prev, ...componentLinkSuggestions.map(c => c.id)])))}
                    >
                      Aggiungi suggeriti
                    </Button>
                  </div>
                  {componentLinkSuggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {componentLinkSuggestions.map(c => (
                        <Badge
                          key={c.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20"
                          onClick={() => setLinkTargetIds(prev => prev.includes(c.id) ? prev : [...prev, c.id])}
                        >
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nessun suggerimento automatico: usa la ricerca sotto.</p>
                  )}
                </div>
              )}
              <ComponentGridPicker
                label="Componenti Collegati (multi-selezione)"
                multiValue={linkTargetIds}
                onMultiChange={setLinkTargetIds}
                components={allComponents}
                categories={categories}
                excludeId={linkParentId}
              />
              <Button onClick={saveLink} className="w-full" disabled={!linkParentId || linkTargetIds.length === 0}>
                Crea {linkTargetIds.length > 0 ? `${linkTargetIds.length} Collegamenti` : "Collegamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Variant Link Dialog */}
        <Dialog open={varLinkDialogOpen} onOpenChange={setVarLinkDialogOpen}>
          <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo Collegamento Variante</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Quando la variante padre viene spuntata, anche la variante collegata verrà spuntata automaticamente.</p>
            <div className="space-y-4">
              {(() => {
                return (
                  <VariantGridPicker
                    label="Variante Padre"
                    value={varLinkParentId}
                    onChange={setVarLinkParentId}
                    variants={allVariants}
                    components={allComponents}
                    categories={categories}
                    excludeIds={varLinkTargetIds}
                    filterCategoryIds={beyCategoryIds}
                  />
                );
              })()}
              {varLinkParentId && (
                <div className="rounded-lg border border-border bg-secondary/25 p-3 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Suggerimenti varianti colore</p>
                      <p className="text-xs text-muted-foreground">Propone varianti delle parti collegate al BEY completo selezionato.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={variantLinkSuggestions.length === 0}
                      onClick={() => setVarLinkTargetIds(prev => Array.from(new Set([...prev, ...variantLinkSuggestions.map(v => v.id)])))}
                    >
                      Aggiungi suggerite
                    </Button>
                  </div>
                  {variantLinkSuggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {variantLinkSuggestions.map(v => (
                        <Badge
                          key={v.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20"
                          onClick={() => setVarLinkTargetIds(prev => prev.includes(v.id) ? prev : [...prev, v.id])}
                        >
                          {getVarLabel(v.id)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Collega prima le parti del BEY completo oppure usa la ricerca sotto.</p>
                  )}
                </div>
              )}
              <VariantGridPicker
                label="Varianti Collegate (multi-selezione)"
                multiValue={varLinkTargetIds}
                onMultiChange={setVarLinkTargetIds}
                variants={allVariants}
                components={allComponents}
                categories={categories}
                excludeId={varLinkParentId}
              />
              <Button onClick={saveVarLink} className="w-full" disabled={!varLinkParentId || varLinkTargetIds.length === 0}>
                Crea {varLinkTargetIds.length > 0 ? `${varLinkTargetIds.length} Collegamenti` : "Collegamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Move Component Dialog */}
        <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
          <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
            <DialogHeader><DialogTitle>Sposta Componente</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Seleziona la categoria di destinazione per "{getCompName(moveCompId)}".</p>
            <div className="space-y-4">
              <div>
                <Label>Categoria Destinazione</Label>
                <Select value={moveTargetCatId} onValueChange={setMoveTargetCatId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.parent_id ? `  ↳ ${c.name}` : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={moveComponent} className="w-full">Sposta</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stats Dialog */}
        <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
          <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
            <DialogHeader><DialogTitle>Statistiche – {getCompName(statsCompId)}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {editingStats.map((s, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.name}
                      onChange={e => {
                        const copy = [...editingStats];
                        copy[i] = { ...copy[i], name: e.target.value };
                        setEditingStats(copy);
                      }}
                      className="flex-1 h-8 text-sm"
                      placeholder={`Stat ${i + 1}`}
                    />
                    <span className="text-sm font-mono w-8 text-right">{s.value}</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[s.value]}
                    onValueChange={([val]) => {
                      const copy = [...editingStats];
                      copy[i] = { ...copy[i], value: val };
                      setEditingStats(copy);
                    }}
                  />
                </div>
              ))}
              <Button onClick={saveStats} className="w-full">Salva Statistiche</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Components List View (with variants) ───
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button size="icon" variant="outline" className="shrink-0" onClick={() => setSelectedCategory(null)}>
              <ArrowLeft size={18} />
            </Button>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <button className="hover:text-foreground" onClick={() => setSelectedCategory(null)}>Collezione</button>
                {selectedParentCategory && (
                  <>
                    <span>/</span>
                    <button className="hover:text-foreground" onClick={() => setSelectedCategory(selectedParentCategory)}>{selectedParentCategory.name}</button>
                  </>
                )}
              </div>
              <h2 className="text-lg font-semibold leading-tight sm:text-xl">{selectedCategory.name}</h2>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{selectedCategoryStats.components} componenti</Badge>
                <Badge variant="outline" className="text-[10px]">{selectedCategoryStats.variants} varianti</Badge>
                <Badge variant="outline" className="text-[10px]">{selectedCategoryStats.withStats} stats</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row xl:w-auto">
            <div className="relative sm:min-w-72">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={componentSearch}
                onChange={e => setComponentSearch(e.target.value)}
                placeholder="Cerca componenti o varianti..."
                className="h-9 pl-8"
              />
            </div>
            <Button size="sm" onClick={() => openCompDialog()} className="gap-1.5">
              <Plus size={14} /> Nuovo componente
            </Button>
          </div>
        </div>
      </div>

      {components.length === 0 ? (
        <Card className="border-dashed bg-card">
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <Image className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nessun componente in questa categoria</p>
              <p className="text-sm text-muted-foreground">Crea il primo elemento di {selectedCategory.name}.</p>
            </div>
            <Button onClick={() => openCompDialog()} className="gap-1.5">
              <Plus size={14} /> Nuovo componente
            </Button>
          </CardContent>
        </Card>
      ) : filteredComponents.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="flex min-h-40 items-center justify-center text-center text-sm text-muted-foreground">
            Nessun componente corrisponde alla ricerca.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredComponents.map(c => {
            const compVariants = variants.filter(v => v.component_id === c.id);
            const compStats = componentStats.filter(s => s.component_id === c.id);
            const visibleVariants = compVariants.slice(0, 5);
            const hiddenVariantsCount = Math.max(0, compVariants.length - visibleVariants.length);
            return (
              <div key={c.id} className="group rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/40">
                <div className="flex gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted p-1.5 sm:h-20 sm:w-20">
                    {c.image_url ? <img src={c.image_url} alt={c.name} className="h-full w-full object-contain" /> : <Image size={22} className="text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">{c.name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>#{c.sort_order}</span>
                          {(c.weight_min != null || c.weight_max != null) && <span>{c.weight_min ?? "?"}-{c.weight_max ?? "?"}g</span>}
                          {c.recommended_price != null && <span>EUR {c.recommended_price}</span>}
                          <span>{compVariants.length} var.</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isBladeCategory && (
                          <button
                            onClick={() => toggleInfinite(c)}
                            className={`h-7 rounded px-2 text-[10px] font-bold transition-all ${
                              c.is_infinite ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                            }`}
                          >
                            INF
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <MoreHorizontal size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openCompDialog(c)}>
                              <Edit size={14} className="mr-2" /> Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openMoveDialog(c.id)}>
                              <MoveRight size={14} className="mr-2" /> Sposta
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteComp(c.id)} className="text-destructive">
                              <Trash2 size={14} className="mr-2" /> Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant={compStats.length > 0 ? "default" : "outline"} className="h-7 px-2 text-[11px]" onClick={() => openStatsDialog(c.id)}>
                        <BarChart3 size={12} className="mr-1" /> Stats
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => openVarDialog(c.id)}>
                        <Plus size={12} className="mr-1" /> Variante
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex min-h-8 items-center gap-1.5 overflow-hidden border-t border-border pt-2">
                  {visibleVariants.length > 0 ? (
                    <>
                      {visibleVariants.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          title={v.variant_name}
                          onClick={() => openVarDialog(c.id, v)}
                          className="flex min-w-0 max-w-[8.5rem] items-center gap-1 rounded-md border border-border bg-secondary/20 px-1.5 py-1 text-[10px] hover:border-primary/50 hover:bg-primary/10"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                            {v.image_url ? <img src={v.image_url} alt={v.variant_name} className="h-full w-full object-contain" /> : <Palette size={11} className="text-primary" />}
                          </span>
                          <span className="truncate">{v.variant_name}</span>
                        </button>
                      ))}
                      {hiddenVariantsCount > 0 && (
                        <Badge variant="secondary" className="h-7 shrink-0 text-[10px]">+{hiddenVariantsCount}</Badge>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openVarDialog(c.id)}
                      className="w-full rounded-md border border-dashed border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    >
                      Nessuna variante. Aggiungi colore o versione.
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card className="hidden">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setSelectedCategory(null)}><ArrowLeft size={18} /></Button>
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl truncate">{selectedCategory.name}</CardTitle>
              <p className="text-sm text-muted-foreground truncate">{components.length} componenti · {variants.length} varianti</p>
            </div>
          </div>
          <Button size="sm" onClick={() => openCompDialog()} className="w-full lg:w-auto">
            <Plus size={14} className="mr-1" /> <span className="hidden sm:inline">Nuovo Componente</span><span className="sm:hidden">Nuovo</span>
          </Button>
        </CardHeader>
        <CardContent>
          {components.length === 0 ? (
            <p className="text-muted-foreground">Nessun componente in questa categoria.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="grid gap-3 xl:hidden">
                {components.map(c => {
                  const compVariants = variants.filter(v => v.component_id === c.id);
                  const compStats = componentStats.filter(s => s.component_id === c.id);
                  return (
                    <div key={c.id} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                          {c.image_url ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" /> : <Image size={18} className="text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm truncate">{c.name}</p>
                            {isBladeCategory && (
                              <button
                                onClick={() => toggleInfinite(c)}
                                className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  c.is_infinite
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                }`}
                                title={c.is_infinite ? "Rimuovi ♾️" : "Segna come ♾️"}
                              >
                                ♾️
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            {(c.weight_min != null || c.weight_max != null) && <span>⚖️ {c.weight_min ?? "?"}g – {c.weight_max ?? "?"}g</span>}
                            {c.recommended_price != null && <span>💰 €{c.recommended_price}</span>}
                            <span>📊 #{c.sort_order}</span>
                          </div>
                        </div>
                      </div>
                      {/* Stats button */}
                      <Button size="sm" variant={compStats.length > 0 ? "default" : "outline"} className="h-8 text-xs w-full" onClick={() => openStatsDialog(c.id)}>
                        <BarChart3 size={12} className="mr-1" /> Stats: {compStats.length > 0 ? "Modifica" : "Aggiungi"}
                      </Button>
                      {/* Variants */}
                      {compVariants.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">Varianti</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {compVariants.map(v => (
                              <div key={v.id} className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1">
                                <Palette size={12} className="text-primary shrink-0" />
                                <span className="text-xs flex-1 truncate">{v.variant_name}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => openVarDialog(c.id, v)}><Edit size={10} /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => deleteVar(v.id)}><Trash2 size={10} /></Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button size="sm" variant="outline" className="h-8 text-xs w-full" onClick={() => openVarDialog(c.id)}>
                        <Plus size={10} className="mr-1" /> Aggiungi variante
                      </Button>
                      {/* Actions */}
                      <div className="flex gap-1 pt-1 border-t border-border">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openCompDialog(c)}><Edit size={12} className="mr-1" /> Modifica</Button>
                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => openMoveDialog(c.id)} title="Sposta"><MoveRight size={14} /></Button>
                        <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => deleteComp(c.id)}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop table */}
                <div className="hidden xl:block overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Img</TableHead><TableHead>Nome</TableHead>{isBladeCategory && <TableHead>♾️</TableHead>}<TableHead>Peso</TableHead>
                    <TableHead>Prezzo</TableHead><TableHead>Stats</TableHead><TableHead>Varianti</TableHead><TableHead>Ordine</TableHead><TableHead>Azioni</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {components.map(c => {
                      const compVariants = variants.filter(v => v.component_id === c.id);
                      const compStats = componentStats.filter(s => s.component_id === c.id);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            {c.image_url ? <img src={c.image_url} alt={c.name} className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 bg-muted rounded flex items-center justify-center"><Image size={16} className="text-muted-foreground" /></div>}
                          </TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          {isBladeCategory && (
                            <TableCell>
                              <button
                                onClick={() => toggleInfinite(c)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                                  c.is_infinite
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                }`}
                              >
                                ♾️
                              </button>
                            </TableCell>
                          )}
                          <TableCell>{c.weight_min != null || c.weight_max != null ? `${c.weight_min ?? "?"}g – ${c.weight_max ?? "?"}g` : "-"}</TableCell>
                          <TableCell>{c.recommended_price != null ? `€${c.recommended_price}` : "-"}</TableCell>
                          <TableCell>
                            <Button size="sm" variant={compStats.length > 0 ? "default" : "outline"} className="h-7 text-xs" onClick={() => openStatsDialog(c.id)}>
                              <BarChart3 size={12} className="mr-1" /> {compStats.length > 0 ? "Modifica" : "Aggiungi"}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {compVariants.map(v => (
                                <div key={v.id} className="flex items-center gap-1.5">
                                  <Palette size={12} className="text-primary" />
                                  <span className="text-xs">{v.variant_name}</span>
                                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => openVarDialog(c.id, v)}><Edit size={10} /></Button>
                                  <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteVar(v.id)}><Trash2 size={10} /></Button>
                                </div>
                              ))}
                              <Button size="sm" variant="ghost" className="h-6 text-xs w-fit" onClick={() => openVarDialog(c.id)}>
                                <Plus size={10} className="mr-1" /> Aggiungi variante
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{c.sort_order}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openCompDialog(c)} title="Modifica"><Edit size={14} /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openMoveDialog(c.id)} title="Sposta in altra categoria"><MoveRight size={14} /></Button>
                              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => deleteComp(c.id)}><Trash2 size={14} /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Component Dialog */}
      <Dialog open={compDialogOpen} onOpenChange={setCompDialogOpen}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingComp ? "Modifica Componente" : "Nuovo Componente"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={compName} onChange={e => setCompName(e.target.value)} /></div>
            <div><Label>Immagine</Label><Input type="file" accept="image/*" onChange={e => setCompImageFile(e.target.files?.[0] ?? null)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Peso Min (g)</Label><Input type="number" value={compWeightMin} onChange={e => setCompWeightMin(e.target.value)} /></div>
              <div><Label>Peso Max (g)</Label><Input type="number" value={compWeightMax} onChange={e => setCompWeightMax(e.target.value)} /></div>
            </div>
            <div><Label>Prezzo Consigliato (€)</Label><Input type="number" value={compPrice} onChange={e => setCompPrice(e.target.value)} /></div>
            <div><Label>Ordine</Label><Input type="number" value={compSortOrder} onChange={e => setCompSortOrder(parseInt(e.target.value) || 0)} /></div>
            <Button onClick={saveComp} className="w-full">Salva</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={varDialogOpen} onOpenChange={setVarDialogOpen}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingVar ? "Modifica Variante" : "Nuova Variante"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome Variante</Label><Input value={varName} onChange={e => setVarName(e.target.value)} placeholder="es. Rosso, Blu Metal, Gold..." /></div>
            <div><Label>Immagine</Label><Input type="file" accept="image/*" onChange={e => setVarImageFile(e.target.files?.[0] ?? null)} /></div>
            <div><Label>Ordine</Label><Input type="number" value={varSortOrder} onChange={e => setVarSortOrder(parseInt(e.target.value) || 0)} /></div>
            <Button onClick={saveVar} className="w-full">Salva</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Component Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Sposta Componente</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Seleziona la categoria di destinazione per "{getCompName(moveCompId)}".</p>
          <div className="space-y-4">
            <div>
              <Label>Categoria Destinazione</Label>
              <Select value={moveTargetCatId} onValueChange={setMoveTargetCatId}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.id !== selectedCategory?.id).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.parent_id ? `  ↳ ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={moveComponent} className="w-full">Sposta</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Statistiche – {getCompName(statsCompId)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {editingStats.map((s, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={s.name}
                    onChange={e => {
                      const copy = [...editingStats];
                      copy[i] = { ...copy[i], name: e.target.value };
                      setEditingStats(copy);
                    }}
                    className="flex-1 h-8 text-sm"
                    placeholder={`Stat ${i + 1}`}
                  />
                  <span className="text-sm font-mono w-8 text-right">{s.value}</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[s.value]}
                  onValueChange={([val]) => {
                    const copy = [...editingStats];
                    copy[i] = { ...copy[i], value: val };
                    setEditingStats(copy);
                  }}
                />
              </div>
            ))}
            <Button onClick={saveStats} className="w-full">Salva Statistiche</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollectionAdminTab;
