import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Swords } from "lucide-react";

const BLADE_TYPE_LABELS: Record<string, string> = {
  BX: "BX", UX: "UX", CX: "CX", BX_INF: "BX♾️", UX_INF: "UX♾️", CX_INF: "CX♾️",
};

const COMPONENT_ORDER: Record<string, number> = {
  blade: 0, lock_chip: 0, main_blade: 1, over_blade: 1, metal_blade: 2, assist_blade: 3, ratchet: 10, ribs: 10, bit: 11,
};

interface BeyDisplay {
  blade_type: string;
  components: { component_name: string; component_image: string | null; variant_name: string | null; variant_image: string | null; component_type: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  userId: string;
  playerName: string;
}

export const MatchDeckView = ({ open, onOpenChange, matchId, userId, playerName }: Props) => {
  const [beyblades, setBeyblades] = useState<BeyDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) fetchDeck();
  }, [open, matchId, userId]);

  const fetchDeck = async () => {
    setLoading(true);

    const { data: selections } = await (supabase as any)
      .from("tournament_match_decks")
      .select("deck_beyblade_id, position")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .order("position");

    if (!selections || selections.length === 0) {
      setBeyblades([]);
      setLoading(false);
      return;
    }

    const beyIds = selections.map((s: any) => s.deck_beyblade_id);

    const { data: beys } = await (supabase as any)
      .from("deck_beyblades")
      .select("id, blade_type")
      .in("id", beyIds);

    const { data: comps } = await (supabase as any)
      .from("deck_beyblade_components")
      .select("deck_beyblade_id, component_type, component_id, variant_id")
      .in("deck_beyblade_id", beyIds);

    const compIds = [...new Set((comps || []).map((c: any) => c.component_id))] as string[];
    const varIds = (comps || []).filter((c: any) => c.variant_id).map((c: any) => c.variant_id) as string[];

    const [{ data: components }, { data: variants }] = await Promise.all([
      compIds.length > 0
        ? supabase.from("collection_components").select("id, name, image_url").in("id", compIds)
        : Promise.resolve({ data: [] }),
      varIds.length > 0
        ? supabase.from("collection_component_variants").select("id, variant_name, image_url").in("id", varIds)
        : Promise.resolve({ data: [] }),
    ]);

    const compMap = new Map((components || []).map((c: any) => [c.id, c]));
    const varMap = new Map((variants || []).map((v: any) => [v.id, v]));
    const beyMap = new Map((beys || []).map((b: any) => [b.id, b]));

    // Maintain selection order
    const result: BeyDisplay[] = selections.map((s: any) => {
      const bey = beyMap.get(s.deck_beyblade_id);
      const beyComps = (comps || [])
        .filter((c: any) => c.deck_beyblade_id === s.deck_beyblade_id)
        .map((c: any) => {
          const comp = compMap.get(c.component_id);
          const variant = c.variant_id ? varMap.get(c.variant_id) : null;
          return {
            component_type: c.component_type,
            component_name: comp?.name || "?",
            component_image: comp?.image_url || null,
            variant_name: variant?.variant_name || null,
            variant_image: variant?.image_url || null,
          };
        })
        .sort((a: any, b: any) => (COMPONENT_ORDER[a.component_type] ?? 5) - (COMPONENT_ORDER[b.component_type] ?? 5));

      return {
        blade_type: (bey as any)?.blade_type || "BX",
        components: beyComps,
      };
    });

    setBeyblades(result);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Swords size={16} className="text-primary" />
            Deck di {playerName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Caricamento...</div>
        ) : beyblades.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Nessun deck riportato.</div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {beyblades.map((bey, i) => (
              <div key={i} className="bg-secondary/30 rounded-xl p-2 space-y-1.5">
                <div className="text-center">
                  <span className="text-[9px] font-medium text-primary uppercase tracking-[0.2em]">
                    {BLADE_TYPE_LABELS[bey.blade_type] || bey.blade_type}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {bey.components.map((comp, ci) => {
                    const img = comp.variant_image || comp.component_image;
                    return (
                      <div key={ci} className="flex flex-col items-center">
                        {img ? (
                          <img src={img} alt={comp.component_name} className="w-10 h-10 rounded-md object-contain bg-background border border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-background border border-border flex items-center justify-center text-[8px] text-muted-foreground">
                            {comp.component_name.slice(0, 3)}
                          </div>
                        )}
                        <span className="text-[8px] text-muted-foreground text-center leading-tight mt-0.5 truncate max-w-[50px]">
                          {comp.component_name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
