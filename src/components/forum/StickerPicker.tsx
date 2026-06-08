import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickerPickerProps {
  onSelect: (stickerUrl: string) => void;
  onClose: () => void;
}

interface Sticker {
  id: string;
  name: string;
  url: string;
}

export const StickerPicker = ({ onSelect, onClose }: StickerPickerProps) => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStickers = async () => {
      const { data } = await supabase
        .from("forum_stickers" as any)
        .select("id, name, url")
        .order("sort_order", { ascending: true });
      setStickers((data as any[]) || []);
      setLoading(false);
    };
    fetchStickers();
  }, []);

  return (
    <div className="w-[340px] bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-sm font-medium">Stickers</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>
      <div className="h-72 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : stickers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Nessuno sticker disponibile
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => onSelect(sticker.url)}
                className="rounded-lg p-3 border border-border hover:border-primary/50 hover:bg-accent transition-colors cursor-pointer flex items-center justify-center aspect-square min-h-[90px]"
                title={sticker.name}
              >
                <img
                  src={sticker.url}
                  alt={sticker.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
