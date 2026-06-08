import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

interface GifItem {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

export const GifPicker = ({ onSelect, onClose }: GifPickerProps) => {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const searchGifs = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("giphy-search", {
        body: { query: searchQuery, limit: 24 },
      });
      if (!error && data?.gifs) {
        setGifs(data.gifs);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    searchGifs(""); // trending
  }, [searchGifs]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => searchGifs(val), 400);
    setDebounceTimer(timer);
  };

  return (
    <div className="w-[340px] bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-sm font-medium">Cerca GIF</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input
            placeholder="Cerca su Giphy..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-8 h-8 text-sm bg-secondary border-border"
            autoFocus
          />
        </div>
      </div>
      <div className="h-72 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Nessuna GIF trovata
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(gif.url)}
                className="rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors cursor-pointer bg-secondary/30"
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-24 object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 border-t border-border">
        <img src="https://media.giphy.com/attribution/poweredby-giphy.png" alt="Powered by GIPHY" className="h-3 opacity-50" />
      </div>
    </div>
  );
};
