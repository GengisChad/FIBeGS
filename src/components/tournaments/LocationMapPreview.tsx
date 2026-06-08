import { MapPin } from "lucide-react";
import { useMemo } from "react";

interface Props {
  location: string;
  city: string;
}

/**
 * Lightweight, key-less Google Maps embed (uses public maps.google.com search embed).
 * Shows a marker pointing at the address (location, city, Italia).
 */
export const LocationMapPreview = ({ location, city }: Props) => {
  const query = useMemo(() => {
    const parts = [location, city, "Italia"].filter(Boolean).map(s => s.trim()).filter(Boolean);
    return parts.join(", ");
  }, [location, city]);

  if (!query || (!location && !city)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-40 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground">
        <MapPin size={28} className="opacity-60" />
        <p className="text-xs">Inserisci luogo e città per vedere l'anteprima mappa</p>
      </div>
    );
  }

  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&hl=it&z=15&output=embed`;
  return (
    <div className="rounded-xl overflow-hidden border-2 border-border h-44 sm:h-52 relative">
      <iframe
        src={src}
        title="Anteprima mappa sede"
        className="w-full h-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/90 backdrop-blur border border-border text-[11px] font-medium shadow-sm pointer-events-none">
        <MapPin size={12} className="text-primary" />
        <span className="truncate max-w-[220px]">{query}</span>
      </div>
    </div>
  );
};
