import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;

type Kind = "tournament" | "championship" | "club";

interface Props {
  kind: Kind;
  id: string; // tournament id, championship slug, or club id
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary" | "hero";
  label?: string;
  className?: string;
}

const directUrl = (kind: Kind, id: string) => {
  if (kind === "tournament") return `https://ibna.it/tournaments/${id}`;
  if (kind === "championship") return `https://ibna.it/campionati/${id}`;
  return `https://ibna.it/clubs/${id}`;
};

// Share link uses the ibna.it domain. Social previews fall back to the static
// og:image defined in index.html (dynamic per-resource previews require a
// server-side proxy on the ibna.it domain which is not available on Lovable).
const buildShareUrl = (kind: Kind, id: string) => directUrl(kind, id);

export const SharePreviewButton = ({
  kind,
  id,
  size = "sm",
  variant = "outline",
  label = "Condividi",
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"share" | "direct" | null>(null);
  const shareUrl = buildShareUrl(kind, id);
  const direct = directUrl(kind, id);

  const copy = async (text: string, which: "share" | "direct") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast.success("Link copiato!");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Impossibile copiare il link");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
        setOpen(false);
        return;
      } catch {
        /* user cancelled */
      }
    }
    copy(shareUrl, "share");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} variant={variant} className={`gap-2 ${className ?? ""}`}>
          <Share2 size={14} />
          {size !== "icon" && label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-2">
        <p className="text-xs font-medium">Condividi link</p>
        <p className="text-[11px] text-muted-foreground break-all">{shareUrl}</p>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-2" onClick={nativeShare}>
            <Share2 size={14} /> Condividi
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => copy(shareUrl, "share")}>
            {copied === "share" ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
