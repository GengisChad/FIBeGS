import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Swords, Check, X } from "lucide-react";

interface BeybladeOption {
  id: string;
  deck_id: string;
  deck_name: string;
  blade_type: string;
  position: number;
  components: { component_type: string; component_name: string; component_image: string | null; variant_name: string | null; variant_image: string | null }[];
}

const BLADE_TYPE_LABELS: Record<string, string> = {
  BX: "BX", UX: "UX", CX: "CX", BX_INF: "BX♾️", UX_INF: "UX♾️", CX_INF: "CX♾️",
};

const COMPONENT_ORDER: Record<string, number> = {
  blade: 0, lock_chip: 0, main_blade: 1, over_blade: 1, metal_blade: 2, assist_blade: 3, ratchet: 10, ribs: 10, bit: 11,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  onSaved: () => void;
}

export const MatchDeckReportDialog = ({ open, onOpenChange, matchId, onSaved }: Props) => {
  const { user } = useAuth();
  const [beyblades, setBeyblades] = useState<BeybladeOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]); // deck_beyblade_id[]
  const [existing, setExisting] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user) fetchData();
  }, [open, user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch user's published decks
    const { data: decks } = await (supabase as any)
      .from("decks")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!decks || decks.length === 0) {
      setBeyblades([]);
      setLoading(false);
      return;
    }

    const deckIds = decks.map((d: any) => d.id);
    const deckNameMap = new Map(decks.map((d: any) => [d.id, d.name]));

    // Fetch all beyblades from user's decks
    const { data: beys } = await (supabase as any)
      .from("deck_beyblades")
      .select("id, deck_id, position, blade_type, ratchet_type")
      .in("deck_id", deckIds)
      .order("position");

    if (!beys || beys.length === 0) {
      setBeyblades([]);
      setLoading(false);
      return;
    }

    const beyIds = beys.map((b: any) => b.id);
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

    const options: BeybladeOption[] = beys.map((b: any) => {
      const beyComps = (comps || [])
        .filter((c: any) => c.deck_beyblade_id === b.id)
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
        id: b.id,
        deck_id: b.deck_id,
        deck_name: deckNameMap.get(b.deck_id) || "Deck",
        blade_type: b.blade_type,
        position: b.position,
        components: beyComps,
      };
    });

    setBeyblades(options);

    // Fetch existing selections for this match
    const { data: existingSelections } = await (supabase as any)
      .from("tournament_match_decks")
      .select("deck_beyblade_id, position")
      .eq("match_id", matchId)
      .eq("user_id", user.id)
      .order("position");

    if (existingSelections && existingSelections.length > 0) {
      const ids = existingSelections.map((s: any) => s.deck_beyblade_id);
      setSelected(ids);
      setExisting(ids);
    } else {
      setSelected([]);
      setExisting([]);
    }

    setLoading(false);
  };

  const toggleBeyblade = (beyId: string) => {
    setSelected(prev => {
      if (prev.includes(beyId)) return prev.filter(id => id !== beyId);
      if (prev.length >= 3) return prev;
      return [...prev, beyId];
    });
  };

  const handleSave = async () => {
    if (!user || selected.length !== 3) return;
    setSaving(true);

    // Delete existing selections
    await (supabase as any)
      .from("tournament_match_decks")
      .delete()
      .eq("match_id", matchId)
      .eq("user_id", user.id);

    // Insert new
    const inserts = selected.map((beyId, i) => ({
      match_id: matchId,
      user_id: user.id,
      deck_beyblade_id: beyId,
      position: i + 1,
    }));

    const { error } = await (supabase as any)
      .from("tournament_match_decks")
      .insert(inserts);

    if (error) {
      toast.error("Errore nel salvataggio");
    } else {
      toast.success("Deck del match salvato!");
      onSaved();
      onOpenChange(false);
    }
    setSaving(false);
  };

  // Group beyblades by deck
  const deckGroups = new Map<string, { name: string; beys: BeybladeOption[] }>();
  beyblades.forEach(b => {
    if (!deckGroups.has(b.deck_id)) {
      deckGroups.set(b.deck_id, { name: b.deck_name, beys: [] });
    }
    deckGroups.get(b.deck_id)!.beys.push(b);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords size={18} className="text-primary" />
            Riporta Deck Utilizzato
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Seleziona i 3 BEY che hai utilizzato in questo match. Puoi sceglierli dai tuoi deck pubblicati.
        </p>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Caricamento...</div>
        ) : beyblades.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Non hai ancora pubblicato nessun deck. Vai alla sezione Deck per crearne uno!
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selection counter */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Selezionati: <span className={selected.length === 3 ? "text-primary font-bold" : "text-muted-foreground"}>{selected.length}/3</span>
              </span>
              {selected.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelected([])}>
                  <X size={10} className="mr-1" /> Reset
                </Button>
              )}
            </div>

            {Array.from(deckGroups.entries()).map(([deckId, group]) => (
              <div key={deckId} className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.name}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {group.beys.map(bey => {
                    const isSelected = selected.includes(bey.id);
                    const isDisabled = !isSelected && selected.length >= 3;
                    return (
                      <button
                        key={bey.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => toggleBeyblade(bey.id)}
                        className={`relative rounded-xl border p-2 transition-all text-left ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : isDisabled
                            ? "border-border opacity-40"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check size={10} className="text-primary-foreground" />
                          </div>
                        )}
                        <div className="text-center mb-1">
                          <span className="text-[8px] font-bold text-primary uppercase tracking-wider">
                            {BLADE_TYPE_LABELS[bey.blade_type] || bey.blade_type}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          {bey.components.map((comp, ci) => {
                            const img = comp.variant_image || comp.component_image;
                            return (
                              <div key={ci} className="flex flex-col items-center">
                                {img ? (
                                  <img src={img} alt={comp.component_name} className="w-8 h-8 rounded-md object-contain bg-background border border-border" />
                                ) : (
                                  <div className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center text-[7px] text-muted-foreground">
                                    {comp.component_name.slice(0, 3)}
                                  </div>
                                )}
                                <span className="text-[7px] text-muted-foreground text-center leading-tight mt-0.5 truncate max-w-[40px]">
                                  {comp.component_name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <Button
              onClick={handleSave}
              disabled={saving || selected.length !== 3}
              className="w-full gap-2"
            >
              <Check size={14} />
              {saving ? "Salvataggio..." : "Salva Deck del Match"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
