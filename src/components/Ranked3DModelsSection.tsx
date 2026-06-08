import { useEffect, useRef, useState } from "react";
import { Box, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEditableText } from "@/components/admin/AdminEditableText";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Ranked3DModel {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  download_url: string;
  category: string;
  sort_order: number;
}

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  stadium: "Stadi",
  accessory: "Accessori",
  part: "Parti",
  altro: "Altro",
};

const ModelCard = ({ model }: { model: Ranked3DModel }) => (
  <div className="group/card relative h-full rounded-2xl border border-border bg-card overflow-hidden flex flex-col hover:border-primary/60 hover:shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.35)] transition-all">
    <div className="aspect-square w-full bg-muted/40 overflow-hidden flex items-center justify-center">
      {model.image_url ? (
        <img
          src={model.image_url}
          alt={model.name}
          className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      ) : (
        <Box size={56} className="text-muted-foreground" />
      )}
    </div>
    <div className="p-4 flex-1 flex flex-col gap-3">
      <div className="flex-1">
        <h4 className="font-semibold text-base leading-tight">{model.name}</h4>
        {model.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{model.description}</p>
        )}
      </div>
      <a
        href={model.download_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Download size={16} />
        SCARICA
      </a>
    </div>
  </div>
);

const CategoryCarousel = ({ models }: { models: Ranked3DModel[] }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  if (models.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10 text-sm">
        Nessun modello disponibile in questa categoria.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Fade laterali (solo desktop) */}
      <div className="hidden md:block pointer-events-none absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="hidden md:block pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />

      {models.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scorri a sinistra"
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-card border border-border items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors shadow-lg"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scorri a destra"
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-card border border-border items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors shadow-lg"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scroll-smooth px-4 md:px-12 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {models.map((m) => (
          <div
            key={m.id}
            data-card
            className="snap-center shrink-0 w-[85%] sm:w-[60%] md:w-[calc((100%-48px)/3)] lg:w-[calc((100%-64px)/4)]"
          >
            <ModelCard model={m} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const Ranked3DModelsSection = () => {
  const [models, setModels] = useState<Ranked3DModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase
        .from("ranked_3d_models" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order") as any);
      setModels((data as Ranked3DModel[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || models.length === 0) return null;

  const grouped = models.reduce<Record<string, Ranked3DModel[]>>((acc, m) => {
    const cat = m.category || "altro";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  const categoryOrder = ["stadium", "accessory", "part", "altro"];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
  );

  const labelFor = (cat: string) =>
    DEFAULT_CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);

  return (
    <section className="py-12 md:py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 md:mb-10">
          <AdminEditableText
            settingKey="ranked3d_eyebrow"
            defaultValue="Stampa 3D"
            as="span"
            className="text-primary font-medium uppercase tracking-wider text-sm"
          />
          <h2 className="section-title mt-2">
            MODELLI 3D <span className="gradient-text">AMMESSI</span>
          </h2>
          <AdminEditableText
            settingKey="ranked3d_subtitle"
            defaultValue="Modelli 3D scaricabili approvati per l'uso nei tornei ranked ufficiali."
            multiline
            as="p"
            className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm"
          />
        </div>

        <Tabs defaultValue={sortedCategories[0]} className="w-full max-w-6xl mx-auto">
          <TabsList
            className="mx-auto mb-6 grid w-full max-w-2xl"
            style={{ gridTemplateColumns: `repeat(${sortedCategories.length}, minmax(0, 1fr))` }}
          >
            {sortedCategories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="gap-2">
                <Box size={14} />
                {labelFor(cat)}
              </TabsTrigger>
            ))}
          </TabsList>
          {sortedCategories.map((cat) => (
            <TabsContent key={cat} value={cat}>
              <CategoryCarousel models={grouped[cat]} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
};
