import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, X, Check } from "lucide-react";
import { isHiddenPlaceholderComponentName } from "@/lib/collectionComponentFilters";

export interface ComponentSelection {
  component_id: string;
  component_name: string;
  component_image: string | null;
  variant_id: string | null;
  variant_name: string | null;
  variant_image: string | null;
  stats?: Record<string, number>;
}

interface ComponentPickerProps {
  categoryIds: string[];
  label?: string;
  value: ComponentSelection | null;
  onChange: (sel: ComponentSelection | null) => void;
  filterInfinite?: boolean | null;
  nameEndsWith?: string;
}

interface CollectionComponent {
  id: string;
  name: string;
  image_url: string | null;
  category_id: string;
  sort_order: number;
  stats?: Record<string, number>;
}

interface ComponentVariant {
  id: string;
  component_id: string;
  variant_name: string;
  image_url: string | null;
  sort_order: number;
}

export const ComponentPicker = ({ categoryIds, label, value, onChange, filterInfinite, nameEndsWith }: ComponentPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [components, setComponents] = useState<CollectionComponent[]>([]);
  const [variants, setVariants] = useState<ComponentVariant[]>([]);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<CollectionComponent | null>(null);
  const [showVariants, setShowVariants] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open, categoryIds, filterInfinite, nameEndsWith]);

  const fetchData = async () => {
    // Fetch categories to resolve children
    const { data: cats } = await supabase
      .from("collection_categories")
      .select("id, name, parent_id");
    
    setAllCategories(cats || []);

    // Include every descendant category. Some BeyTrackr imports land under nested folders.
    const allCatIds = new Set(categoryIds);
    let changed = true;
    while (changed) {
      changed = false;
      (cats || []).forEach(c => {
        if (c.parent_id && allCatIds.has(c.parent_id) && !allCatIds.has(c.id)) {
          allCatIds.add(c.id);
          changed = true;
        }
      });
    }

    const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
    const uniqueByName = (items: CollectionComponent[]) => {
      const map = new Map<string, CollectionComponent>();
      items.forEach(item => {
        const key = `${item.category_id}:${normalizeName(item.name)}`;
        const current = map.get(key);
        if (!current || (!current.image_url && item.image_url) || item.sort_order < current.sort_order) {
          map.set(key, item);
        }
      });
      return [...map.values()].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    };

    const statsMap = new Map<string, Record<string, number>>();
    const attachStats = async (items: CollectionComponent[]) => {
      if (items.length === 0) return items;
      const { data: stats } = await (supabase as any)
        .from("collection_component_stats")
        .select("component_id, stat_name, stat_value")
        .in("component_id", items.map(c => c.id));
      (stats || []).forEach((stat: any) => {
        const current = statsMap.get(stat.component_id) || {};
        current[stat.stat_name] = stat.stat_value;
        statsMap.set(stat.component_id, current);
      });
      return items.map(item => ({ ...item, stats: statsMap.get(item.id) || {} }));
    };

    const withFallbackImages = async (items: CollectionComponent[]) => {
      const fallbackNameFor = (name: string) => {
        const parts = name.trim().split(/\s+/);
        const suffix = parts[parts.length - 1];
        if (parts.length > 1 && /^[A-Z0-9-]{1,4}$/.test(suffix)) {
          return parts.slice(0, -1).join(" ");
        }
        return null;
      };

      const missing = items.filter(item => !item.image_url);
      const fallbackNames = [...new Set(missing.map(item => fallbackNameFor(item.name)).filter(Boolean))] as string[];
      if (fallbackNames.length === 0) return items;

      const { data: fallbackComps } = await supabase
        .from("collection_components")
        .select("name, image_url")
        .in("name", fallbackNames);
      const imagesByName = new Map((fallbackComps || []).filter(c => c.image_url).map(c => [c.name, c.image_url]));

      return items.map(item => {
        if (item.image_url) return item;
        const fallbackName = fallbackNameFor(item.name);
        return fallbackName && imagesByName.has(fallbackName)
          ? { ...item, image_url: imagesByName.get(fallbackName) || null }
          : item;
      });
    };

    const runQuery = async (ids: string[], infiniteFilter?: boolean | null) => {
      let query = supabase
        .from("collection_components")
        .select("id, name, image_url, category_id, sort_order, is_infinite")
        .in("category_id", ids)
        .order("sort_order");

      if (infiniteFilter === true) {
        query = query.eq("is_infinite", true);
      } else if (infiniteFilter === false) {
        query = query.eq("is_infinite", false);
      }

      const { data } = await query;
      return data || [];
    };

    let comps = await runQuery(Array.from(allCatIds), filterInfinite);
    if (comps.length === 0 && filterInfinite !== undefined && filterInfinite !== null) {
      // Imported catalogs can place Infinity parts directly in dedicated categories
      // without setting is_infinite consistently. The category still wins.
      comps = await runQuery(Array.from(allCatIds), null);
    }
    comps = comps.filter(comp => !isHiddenPlaceholderComponentName(comp.name));

    const componentsWithImages = await withFallbackImages(comps as CollectionComponent[]);
    const hydratedComponents = await attachStats(uniqueByName(componentsWithImages));
    setComponents(hydratedComponents);

    if (hydratedComponents.length > 0) {
      const compIds = hydratedComponents.map(c => c.id);
      const { data: vars } = await supabase
        .from("collection_component_variants")
        .select("id, component_id, variant_name, image_url, sort_order")
        .in("component_id", compIds)
        .order("sort_order");
      setVariants(vars || []);
    }
  };

  const filtered = components.filter(c => {
    const q = search.toLowerCase().trim();
    const variantMatch = variants.some(v => v.component_id === c.id && v.variant_name.toLowerCase().includes(q));
    if (q && !c.name.toLowerCase().includes(q) && !variantMatch) return false;
    if (nameEndsWith && !c.name.endsWith(nameEndsWith)) return false;
    return true;
  });

  const componentVariants = selectedComponent
    ? variants.filter(v => v.component_id === selectedComponent.id)
    : [];

  const handleSelectComponent = (comp: CollectionComponent) => {
    const compVars = variants.filter(v => v.component_id === comp.id);
    if (compVars.length > 0) {
      setSelectedComponent(comp);
      setShowVariants(true);
    } else {
      onChange({
        component_id: comp.id,
        component_name: comp.name,
        component_image: comp.image_url,
        variant_id: null,
        variant_name: null,
        variant_image: null,
        stats: comp.stats || {},
      });
      setOpen(false);
      setSearch("");
      setShowVariants(false);
      setSelectedComponent(null);
    }
  };

  const handleSelectVariant = (variant: ComponentVariant) => {
    if (!selectedComponent) return;
    onChange({
      component_id: selectedComponent.id,
      component_name: selectedComponent.name,
      component_image: selectedComponent.image_url,
      variant_id: variant.id,
      variant_name: variant.variant_name,
      variant_image: variant.image_url,
      stats: selectedComponent.stats || {},
    });
    setOpen(false);
    setSearch("");
    setShowVariants(false);
    setSelectedComponent(null);
  };

  const displayImage = value?.variant_image || value?.component_image;
  const displayName = value ? (value.variant_name ? `${value.component_name} (${value.variant_name})` : value.component_name) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setShowVariants(false); setSelectedComponent(null); setSearch(""); } }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 p-1.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors text-left min-h-[40px]"
        >
          {value ? (
            <>
              {displayImage && (
                <img src={displayImage} alt="" className="w-7 h-7 rounded-md object-contain bg-background" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                <p className="text-sm font-medium truncate">{displayName}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <div className="flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
              <p className="text-sm text-muted-foreground">Seleziona...</p>
            </div>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{showVariants ? `Varianti di ${selectedComponent?.name}` : `Seleziona ${label}`}</DialogTitle>
        </DialogHeader>

        {showVariants && (
          <button
            type="button"
            onClick={() => { setShowVariants(false); setSelectedComponent(null); }}
            className="text-sm text-primary hover:underline self-start mb-2"
          >
            ← Torna alla lista
          </button>
        )}

        {!showVariants && (
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca..."
              className="pl-9 h-9 rounded-xl"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!showVariants ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map(comp => {
                const isSelected = value?.component_id === comp.id;
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => handleSelectComponent(comp)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    {comp.image_url ? (
                      <img src={comp.image_url} alt={comp.name} className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-xs">?</div>
                    )}
                    <span className="text-[10px] text-center leading-tight line-clamp-2 font-medium">{comp.name}</span>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check size={10} className="text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-8">Nessun componente trovato</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {/* Option: base component (no variant) */}
              <button
                type="button"
                onClick={() => {
                  if (selectedComponent) {
                    onChange({
                      component_id: selectedComponent.id,
                      component_name: selectedComponent.name,
                      component_image: selectedComponent.image_url,
                      variant_id: null,
                      variant_name: null,
                      variant_image: null,
                      stats: selectedComponent.stats || {},
                    });
                    setOpen(false);
                    setShowVariants(false);
                    setSelectedComponent(null);
                  }
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all"
              >
                {selectedComponent?.image_url ? (
                  <img src={selectedComponent.image_url} alt="" className="w-12 h-12 object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-xs">?</div>
                )}
                <span className="text-[10px] text-center leading-tight font-medium">Standard</span>
              </button>
              {componentVariants.map(v => {
                const isSelected = value?.variant_id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVariant(v)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    {v.image_url ? (
                      <img src={v.image_url} alt={v.variant_name} className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-xs">?</div>
                    )}
                    <span className="text-[10px] text-center leading-tight line-clamp-2 font-medium">{v.variant_name}</span>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check size={10} className="text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
