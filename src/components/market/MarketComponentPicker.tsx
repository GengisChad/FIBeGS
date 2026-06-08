import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X, Package, FolderOpen, ChevronLeft, Image } from "lucide-react";

interface Category {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  parent_id: string | null;
}

interface CollectionComponent {
  id: string;
  name: string;
  image_url: string | null;
  recommended_price: number | null;
  category_id: string;
}

interface MarketComponentPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const MarketComponentPicker = ({ selectedIds, onChange }: MarketComponentPickerProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [components, setComponents] = useState<CollectionComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [catRes, compRes] = await Promise.all([
        supabase.from("collection_categories").select("id, name, image_url, sort_order, parent_id").order("sort_order"),
        supabase.from("collection_components").select("id, name, image_url, recommended_price, category_id").order("sort_order"),
      ]);
      setCategories(catRes.data ?? []);
      setComponents(compRes.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const rootCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const getSubCategories = useCallback((parentId: string) => categories.filter((c) => c.parent_id === parentId), [categories]);

  const selectedCat = categories.find((c) => c.id === selectedCategoryId);
  const subCats = selectedCat ? getSubCategories(selectedCat.id) : [];
  const isRootWithSubs = selectedCat && !selectedCat.parent_id && subCats.length > 0;

  const categoryComponents = useMemo(() => {
    if (!selectedCategoryId) return [];
    return components.filter((c) => c.category_id === selectedCategoryId);
  }, [selectedCategoryId, components]);

  // Search across all components
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return components.filter((c) => c.name.toLowerCase().includes(q));
  }, [components, search]);

  const selectedComponents = useMemo(
    () => components.filter((c) => selectedIds.includes(c.id)),
    [components, selectedIds]
  );

  const totalRecommended = useMemo(
    () => selectedComponents.reduce((sum, c) => sum + (c.recommended_price || 0), 0),
    [selectedComponents]
  );

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  };

  const goBack = () => {
    if (selectedCat?.parent_id) {
      setSelectedCategoryId(selectedCat.parent_id);
    } else {
      setSelectedCategoryId(null);
    }
  };

  if (loading) return <p className="text-xs text-muted-foreground py-8 text-center">Caricamento...</p>;

  // Items to render in the grid
  const isSearching = search.trim().length > 0;
  const gridItems = isSearching ? searchResults : categoryComponents;
  const showCategories = !isSearching && !selectedCategoryId;
  const showSubCategories = !isSearching && isRootWithSubs;

  return (
    <div className="flex flex-col min-h-0 h-full gap-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <Label className="flex items-center gap-1.5 shrink-0">
          <Package size={14} /> Collega Prodotti
        </Label>
        {totalRecommended > 0 && (
          <span className="text-xs text-muted-foreground">
            Consigliato: <span className="font-bold text-primary">€{totalRecommended.toFixed(2)}</span>
            <span className="ml-1 opacity-70">({selectedComponents.length})</span>
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome..."
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Selected badges */}
      {selectedComponents.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto shrink-0">
          {selectedComponents.map((c) => (
            <Badge
              key={c.id}
              variant="secondary"
              className="gap-1 text-[11px] pr-1 cursor-pointer hover:bg-destructive/20 shrink-0"
              onClick={() => toggle(c.id)}
            >
              {c.name}
              {c.recommended_price != null && (
                <span className="text-muted-foreground">€{c.recommended_price}</span>
              )}
              <X size={10} />
            </Badge>
          ))}
        </div>
      )}

      {/* Navigation breadcrumb */}
      {!isSearching && selectedCategoryId && (
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          <ChevronLeft size={14} />
          {selectedCat?.parent_id
            ? categories.find((c) => c.id === selectedCat.parent_id)?.name
            : "Categorie"}
        </button>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 border rounded-md bg-secondary/5 overflow-y-auto market-picker-scroll">
        {/* Root categories grid */}
        {showCategories && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-1.5 p-1.5">
            {rootCategories.map((cat) => {
              const subs = getSubCategories(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className="flex flex-col items-center border border-border rounded-md overflow-hidden hover:border-primary/50 hover:bg-secondary/20 transition-all text-left"
                >
                  <div className="w-full aspect-square bg-muted flex items-center justify-center p-2">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-full h-full object-contain" loading="lazy" />
                    ) : (
                      <FolderOpen size={18} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-1.5 w-full bg-card">
                    <p className="font-semibold text-[9px] leading-tight line-clamp-2 text-center">{cat.name}</p>
                    {subs.length > 0 && (
                      <p className="text-[8px] text-muted-foreground text-center mt-0.5">
                        {subs.length} sotto-cat.
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Sub-categories grid */}
        {showSubCategories && (
          <div className="p-1.5 space-y-2">
            <p className="text-[11px] text-muted-foreground font-medium px-1">{selectedCat?.name} — Sotto-categorie</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-1.5">
              {subCats.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(sub.id)}
                  className="flex flex-col items-center border border-border rounded-md overflow-hidden hover:border-primary/50 hover:bg-secondary/20 transition-all"
                >
                  <div className="w-full aspect-square bg-muted flex items-center justify-center p-2">
                    {sub.image_url ? (
                      <img src={sub.image_url} alt={sub.name} className="w-full h-full object-contain" loading="lazy" />
                    ) : (
                      <FolderOpen size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-1 w-full bg-card">
                    <p className="font-semibold text-[9px] leading-tight truncate text-center">{sub.name}</p>
                  </div>
                </button>
              ))}
            </div>
            {/* Also show direct components of parent if any */}
            {categoryComponents.length > 0 && (
              <>
                <p className="text-[11px] text-muted-foreground font-medium px-1 pt-1">Componenti</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                  {categoryComponents.map((c) => (
                    <ComponentCell key={c.id} component={c} selected={selectedIds.includes(c.id)} onToggle={toggle} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Components grid (leaf category or search) */}
        {!showCategories && !showSubCategories && gridItems && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 p-1.5">
            {gridItems.map((c) => (
              <ComponentCell key={c.id} component={c} selected={selectedIds.includes(c.id)} onToggle={toggle} />
            ))}
            {gridItems.length === 0 && (
              <p className="col-span-full text-xs text-muted-foreground text-center py-8">
                {isSearching ? "Nessun risultato" : "Nessun componente in questa categoria"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Extracted component cell for reuse
const ComponentCell = ({
  component: c,
  selected,
  onToggle,
}: {
  component: CollectionComponent;
  selected: boolean;
  onToggle: (id: string) => void;
}) => (
  <button
    type="button"
    onClick={() => onToggle(c.id)}
    className={`relative flex flex-col items-center p-1 rounded-md border text-center transition-all ${
      selected
        ? "border-primary bg-primary/10 ring-1 ring-primary"
        : "border-border hover:border-primary/40 hover:bg-secondary/20"
    }`}
  >
    <div className="w-full aspect-square bg-secondary/30 rounded overflow-hidden mb-0.5">
      {c.image_url ? (
        <img src={c.image_url} alt={c.name} className="w-full h-full object-contain" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <Package size={14} />
        </div>
      )}
    </div>
    <p className="text-[9px] leading-tight line-clamp-2 w-full">{c.name}</p>
    {c.recommended_price != null && (
      <p className="text-[8px] text-muted-foreground">€{c.recommended_price}</p>
    )}
    {selected && (
      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
        <span className="text-[7px] text-primary-foreground font-bold">✓</span>
      </div>
    )}
  </button>
);

export default MarketComponentPicker;
