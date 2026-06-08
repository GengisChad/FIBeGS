import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useMunicipalities } from "@/hooks/useCachedQuery";
import { MapPin } from "lucide-react";

interface Municipality {
  id: string;
  name: string;
  province: string;
  province_code: string;
}

interface CityComboboxProps {
  value: string;
  onChange: (city: string, isValid?: boolean) => void;
  regionId?: string;
  /** When true, ignore regionId and search across ALL Italian municipalities. */
  allowAllRegions?: boolean;
  placeholder?: string;
  className?: string;
}

export const CityCombobox = ({
  value,
  onChange,
  regionId,
  allowAllRegions = false,
  placeholder = "Cerca comune...",
  className,
}: CityComboboxProps) => {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: allMunicipalities } = useMunicipalities();

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const effectiveRegionId = (allowAllRegions || showAllRegions) ? undefined : regionId;

  const results: Municipality[] = useMemo(() => {
    if (!allMunicipalities || query.length < 2) return [];
    const q = query.toLowerCase();
    let pool = allMunicipalities as any[];
    if (effectiveRegionId) pool = pool.filter((m) => m.region_id === effectiveRegionId);
    return pool
      .filter((m) => m.name.toLowerCase().startsWith(q))
      .slice(0, 20)
      .map((m) => ({ id: m.id, name: m.name, province: m.province, province_code: m.province_code }));
  }, [allMunicipalities, query, effectiveRegionId]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setOpen(true);
    onChange(val, false);
  };

  const handleSelect = (m: Municipality) => {
    setQuery(m.name);
    onChange(m.name, true);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className={`pl-9 ${className || ""}`}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelect(m)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
            >
              <span>{m.name}</span>
              <span className="text-xs text-muted-foreground">({m.province_code})</span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg p-3 text-sm text-muted-foreground text-center space-y-2">
          <div>Nessun comune trovato{effectiveRegionId ? " in questa regione" : ""}.</div>
          {!allowAllRegions && regionId && !showAllRegions && (
            <button
              type="button"
              onClick={() => setShowAllRegions(true)}
              className="text-xs underline text-primary hover:text-primary/80"
            >
              Cerca in tutte le regioni d'Italia
            </button>
          )}
        </div>
      )}
      {open && (allowAllRegions || showAllRegions) && regionId && results.length > 0 && (
        <div className="mt-1 text-[10px] text-muted-foreground px-1">
          Ricerca estesa a tutta Italia.{" "}
          {!allowAllRegions && (
            <button type="button" onClick={() => setShowAllRegions(false)} className="underline">
              limita alla regione
            </button>
          )}
        </div>
      )}
    </div>
  );
};
