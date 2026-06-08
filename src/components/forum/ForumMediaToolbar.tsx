import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import { GifPicker } from "./GifPicker";
import { StickerPicker } from "./StickerPicker";

interface ForumMediaToolbarProps {
  onGifSelect: (gifUrl: string) => void;
  onStickerSelect: (stickerUrl: string) => void;
}

export const ForumMediaToolbar = ({ onGifSelect, onStickerSelect }: ForumMediaToolbarProps) => {
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [pickerPlacement, setPickerPlacement] = useState<"top" | "bottom">("top");
  const gifBtnRef = useRef<HTMLButtonElement>(null);
  const stickerBtnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const openTimestamp = useRef(0);

  useEffect(() => {
    if (!showGifPicker && !showStickerPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Ignore clicks within 100ms of opening (same interaction)
      if (Date.now() - openTimestamp.current < 150) return;
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (gifBtnRef.current?.contains(target)) return;
      if (stickerBtnRef.current?.contains(target)) return;
      setShowGifPicker(false);
      setShowStickerPicker(false);
    };

    document.addEventListener("pointerdown", handleClickOutside, true);
    return () => document.removeEventListener("pointerdown", handleClickOutside, true);
  }, [showGifPicker, showStickerPicker]);

  const positionPicker = useCallback((rect: DOMRect, type: "gif" | "sticker") => {
    const pickerWidth = 340;
    const estimatedHeight = type === "gif" ? 430 : 360;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    let openAbove = spaceAbove >= estimatedHeight || spaceAbove > spaceBelow;
    if (openAbove && rect.top - estimatedHeight < 8) openAbove = false;
    if (!openAbove && rect.bottom + estimatedHeight > window.innerHeight - 8) openAbove = true;

    const left = Math.max(8, Math.min(rect.left - 120, window.innerWidth - pickerWidth - 8));
    const top = openAbove ? rect.top - 8 : rect.bottom + 8;

    setPickerPlacement(openAbove ? "top" : "bottom");
    setPickerPos({ top, left });
  }, []);

  const openGif = useCallback(() => {
    if (showGifPicker) {
      setShowGifPicker(false);
      return;
    }
    if (gifBtnRef.current) {
      positionPicker(gifBtnRef.current.getBoundingClientRect(), "gif");
    }
    openTimestamp.current = Date.now();
    setShowGifPicker(true);
    setShowStickerPicker(false);
  }, [positionPicker, showGifPicker]);

  const openSticker = useCallback(() => {
    if (showStickerPicker) {
      setShowStickerPicker(false);
      return;
    }
    if (stickerBtnRef.current) {
      positionPicker(stickerBtnRef.current.getBoundingClientRect(), "sticker");
    }
    openTimestamp.current = Date.now();
    setShowStickerPicker(true);
    setShowGifPicker(false);
  }, [positionPicker, showStickerPicker]);

  const pickerPortal = (showGifPicker || showStickerPicker) ? createPortal(
    <div
      ref={pickerRef}
      className="fixed z-[9999]"
      style={{ top: pickerPos.top, left: pickerPos.left, transform: pickerPlacement === "top" ? "translateY(-100%)" : "none" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {showGifPicker && (
        <GifPicker
          onSelect={(url) => { onGifSelect(url); setShowGifPicker(false); }}
          onClose={() => setShowGifPicker(false)}
        />
      )}
      {showStickerPicker && (
        <StickerPicker
          onSelect={(url) => { onStickerSelect(url); setShowStickerPicker(false); }}
          onClose={() => setShowStickerPicker(false)}
        />
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="flex items-center gap-0.5">
      <Button
        ref={gifBtnRef}
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-1.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openGif(); }}
      >
        <span className="font-bold text-[10px] border border-current rounded px-0.5 leading-none">GIF</span>
      </Button>

      <Button
        ref={stickerBtnRef}
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-1.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openSticker(); }}
      >
        <Smile size={14} />
      </Button>

      {pickerPortal}
    </div>
  );
};
