import { Instagram, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const InstagramFeed = () => {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 card-glow">
      <div className="flex items-center gap-2 mb-3">
        <Instagram size={18} className="text-primary" />
        <h3 className="font-display text-lg gradient-text">Instagram</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Seguici per aggiornamenti!
      </p>
      <a
        href="https://www.instagram.com/beyblade_news_italia/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
          <Instagram size={14} /> @beyblade_news_italia <ExternalLink size={12} />
        </Button>
      </a>
    </div>
  );
};
