import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Link, ArrowLeft, Image, Palette, BarChart3, FolderTree, MoveRight, Search, Check } from "lucide-react";

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

const DEFAULT_STAT_NAMES = ["ATK", "DEF", "STA", "VEL", "PESO", "BURST RES"];

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
          <div className="max-h-44 overflow-y-auto border border-border rounded-md">
            {grouped.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">Nessun risultato</p>}
            {grouped.map(([catName, comps]) => (
              <div key={catName}>
                <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-2 py-1 text-xs font-semibold text-muted-foreground border-b border-border">{catName}</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 p-1">
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
          <div className="max-h-44 overflow-y-auto border border-border rounded-md">
            {grouped.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">Nessun risultato</p>}
            {grouped.map(([groupName, vars]) => (
              <div key={groupName}>
                <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-2 py-1 text-xs font-semibold text-muted-foreground border-b border-border">{groupName}</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 p-1">
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
    const { data } = await supabase.from("collection_components").select("*").order("name");
    setAllComponents((data as Component[]) ?? []);
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
    const { data } = await supabase.from("collection_component_variants").select("*").order("variant_name");
    setAllVariants((data as Variant[]) ?? []);
  }, []);

  const fetchVariantLinks = useCallback(async () => {
    const { data } = await supabase.from("collection_variant_links").select("*");
    setVariantLinks((data as VariantLink[]) ?? []);
  }, []);

  const fetchComponentStats = useCallback(async () => {
    const { data } = await supabase.from("collection_component_stats").select("*").order("stat_order");
    setComponentStats((data as ComponentStat[]) ?? []);
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
    }
  }, [selectedCategory, fetchComponents, fetchVariants]);

  const uploadImage = async (file: File, path: string) => {
    file = await prepareImageForUpload(file, { maxDimension: 1024, preservePng: true });
    const ext = file.name.split(".").pop();
    const filePath = `${path}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("collection-images").upload(filePath, file, { contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("collection-images").getPublicUrl(filePath);
    return data.publicUrl;
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
      try { imageUrl = await uploadImage(catImageFile, "categories"); }
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
      try { imageUrl = await uploadImage(compImageFile, "components"); }
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
      try { imageUrl = await uploadImage(varImageFile, "variants"); }
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

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  // Helper: get root categories and sub-categories
  const rootCategories = categories.filter(c => !c.parent_id);
  const getSubCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  // ─── Category List View ───
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Categorie Collezione</CardTitle>
            <Button size="sm" onClick={() => openCatDialog()}>
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
                          <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center overflow-hidden shrink-0">
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
                          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openCatDialog(cat); }}><Edit size={12} /></Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); }}><Trash2 size={12} /></Button>
                          </div>
                        </div>
                      </div>
                      {/* Sub-categories */}
                      {subs.length > 0 && (
                        <div className="ml-4 sm:ml-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
                          {subs.map(sub => (
                            <div
                              key={sub.id}
                              className="relative group border border-border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                              onClick={() => setSelectedCategory(sub)}
                            >
                              <div className="aspect-square bg-muted flex items-center justify-center">
                                {sub.image_url ? <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover" /> : <Image className="h-10 w-10 text-muted-foreground" />}
                              </div>
                              <div className="p-2 bg-card"><p className="font-semibold text-xs truncate">{sub.name}</p></div>
                              <div className="absolute top-1 right-1 flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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

        {/* Component Links */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Collegamenti Componenti</CardTitle>
            <Button size="sm" onClick={() => { setLinkParentId(""); setLinkTargetIds([]); setLinkDialogOpen(true); }}>
              <Link size={14} className="mr-1" /> Nuovo Link
            </Button>
          </CardHeader>
          <CardContent>
            {links.length === 0 ? (
              <p className="text-muted-foreground">Nessun collegamento.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {(() => {
                    const grouped = new Map<string, ComponentLink[]>();
                    links.forEach(l => {
                      if (!grouped.has(l.parent_component_id)) grouped.set(l.parent_component_id, []);
                      grouped.get(l.parent_component_id)!.push(l);
                    });
                    return Array.from(grouped.entries()).map(([parentId, childLinks]) => (
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
                    ));
                  })()}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Componente Padre</TableHead><TableHead>Categoria</TableHead>
                      <TableHead>→ Componenti Collegati</TableHead><TableHead>Azioni</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {(() => {
                        const grouped = new Map<string, ComponentLink[]>();
                        links.forEach(l => {
                          if (!grouped.has(l.parent_component_id)) grouped.set(l.parent_component_id, []);
                          grouped.get(l.parent_component_id)!.push(l);
                        });
                        return Array.from(grouped.entries()).map(([parentId, childLinks]) => (
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
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Variant Links */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Collegamenti Varianti</CardTitle>
            <Button size="sm" onClick={() => { setVarLinkParentId(""); setVarLinkTargetIds([]); setVarLinkDialogOpen(true); }}>
              <Link size={14} className="mr-1" /> Nuovo Link Variante
            </Button>
          </CardHeader>
          <CardContent>
            {variantLinks.length === 0 ? (
              <p className="text-muted-foreground">Nessun collegamento variante.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {(() => {
                    const grouped = new Map<string, VariantLink[]>();
                    variantLinks.forEach(l => {
                      if (!grouped.has(l.parent_variant_id)) grouped.set(l.parent_variant_id, []);
                      grouped.get(l.parent_variant_id)!.push(l);
                    });
                    return Array.from(grouped.entries()).map(([parentId, childLinks]) => (
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
                    ));
                  })()}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Variante Padre</TableHead><TableHead>→ Varianti Collegate</TableHead><TableHead>Azioni</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {(() => {
                        const grouped = new Map<string, VariantLink[]>();
                        variantLinks.forEach(l => {
                          if (!grouped.has(l.parent_variant_id)) grouped.set(l.parent_variant_id, []);
                          grouped.get(l.parent_variant_id)!.push(l);
                        });
                        return Array.from(grouped.entries()).map(([parentId, childLinks]) => (
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
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Category Dialog */}
        <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
          <DialogContent>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nuovo Collegamento</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Quando il componente padre viene spuntato, anche il collegato verrà spuntato automaticamente.</p>
            <div className="space-y-4">
              {(() => {
                const beyCompletiCat = categories.find(c => c.name.toUpperCase().includes("BEY COMPLETI"));
                const beyIds = beyCompletiCat
                  ? [beyCompletiCat.id, ...categories.filter(c => c.parent_id === beyCompletiCat.id).map(c => c.id)]
                  : undefined;
                return (
                  <ComponentGridPicker
                    label="Componente Padre"
                    value={linkParentId}
                    onChange={setLinkParentId}
                    components={allComponents}
                    categories={categories}
                    excludeIds={linkTargetIds}
                    filterCategoryIds={beyIds}
                  />
                );
              })()}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nuovo Collegamento Variante</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Quando la variante padre viene spuntata, anche la variante collegata verrà spuntata automaticamente.</p>
            <div className="space-y-4">
              {(() => {
                const beyCompletiCat = categories.find(c => c.name.toUpperCase().includes("BEY COMPLETI"));
                const beyIds = beyCompletiCat
                  ? [beyCompletiCat.id, ...categories.filter(c => c.parent_id === beyCompletiCat.id).map(c => c.id)]
                  : undefined;
                return (
                  <VariantGridPicker
                    label="Variante Padre"
                    value={varLinkParentId}
                    onChange={setVarLinkParentId}
                    variants={allVariants}
                    components={allComponents}
                    categories={categories}
                    excludeIds={varLinkTargetIds}
                    filterCategoryIds={beyIds}
                  />
                );
              })()}
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
          <DialogContent>
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
          <DialogContent className="max-w-md">
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
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setSelectedCategory(null)}><ArrowLeft size={18} /></Button>
            <CardTitle className="text-lg sm:text-xl truncate">{selectedCategory.name}</CardTitle>
          </div>
          <Button size="sm" onClick={() => openCompDialog()}>
            <Plus size={14} className="mr-1" /> <span className="hidden sm:inline">Nuovo Componente</span><span className="sm:hidden">Nuovo</span>
          </Button>
        </CardHeader>
        <CardContent>
          {components.length === 0 ? (
            <p className="text-muted-foreground">Nessun componente in questa categoria.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {components.map(c => {
                  const compVariants = variants.filter(v => v.component_id === c.id);
                  const compStats = componentStats.filter(s => s.component_id === c.id);
                  return (
                    <div key={c.id} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
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
                      <Button size="sm" variant={compStats.length > 0 ? "default" : "outline"} className="h-7 text-xs w-full" onClick={() => openStatsDialog(c.id)}>
                        <BarChart3 size={12} className="mr-1" /> Stats: {compStats.length > 0 ? "Modifica" : "Aggiungi"}
                      </Button>
                      {/* Variants */}
                      {compVariants.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">Varianti</p>
                          {compVariants.map(v => (
                            <div key={v.id} className="flex items-center gap-1.5 pl-1">
                              <Palette size={12} className="text-primary shrink-0" />
                              <span className="text-xs flex-1 truncate">{v.variant_name}</span>
                              <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => openVarDialog(c.id, v)}><Edit size={10} /></Button>
                              <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive shrink-0" onClick={() => deleteVar(v.id)}><Trash2 size={10} /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => openVarDialog(c.id)}>
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
              <div className="hidden md:block overflow-x-auto">
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
        <DialogContent>
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
        <DialogContent>
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
        <DialogContent>
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
        <DialogContent className="max-w-md">
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
