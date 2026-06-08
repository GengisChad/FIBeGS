import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Swords } from "lucide-react";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { ComponentPicker, type ComponentSelection } from "./ComponentPicker";

// Category IDs from the collection system
const CATEGORY_IDS = {
  BX_BLADES: "0e250c0a-3316-49e8-8335-7aa68cc3dce5",
  UX_BLADES: "ef1f779e-6420-4098-85a3-635a66071c68",
  UX_INF_BLADES: "602d69c6-0057-4182-bf5e-c51cd8d35e4e",
  CX_LOCK_CHIPS: "77b6cad1-ec63-4789-8bd9-e7d3a163bf38",
  CX_MAIN_BLADE: "45be08ad-aef4-4abc-88db-1360d0f191b6",
  CX_ASSIST_BLADES: "ca1ead83-6b1f-45e3-8d35-135c49080fb6",
  CX_OVER_BLADE: "72bbebda-e857-4fb1-9dcd-c24b08e49456",
  CX_METAL_BLADE: "e447712d-2e78-48b0-a23d-e8d07509666f",
  RATCHETS: "72b70737-a6dc-48cd-b6b2-60835699e2fe",
  RIBS: "fed7d00c-c464-45f7-ad0b-f3d68b644a46",
  BITS: "09abb9d0-4ba7-40e8-97b7-e2f96058ee28",
};

export const BLADE_TYPES = [
  { id: "BX", label: "BX" },
  { id: "UX", label: "UX" },
  { id: "CX", label: "CX" },
  { id: "BX_INF", label: "BX♾️" },
  { id: "UX_INF", label: "UX♾️" },
  { id: "CX_INF", label: "CX♾️" },
] as const;

export type BladeType = typeof BLADE_TYPES[number]["id"];

export interface BeybladeConfig {
  blade_type: BladeType;
  ratchet_type: "ratchet" | "ribs";
  components: Record<string, ComponentSelection | null>;
}

export const getComponentFields = (bladeType: BladeType, ratchetType: "ratchet" | "ribs") => {
  const fields: { key: string; label: string; categoryIds: string[]; filterInfinite?: boolean | null }[] = [];

  switch (bladeType) {
    case "BX":
      fields.push({ key: "blade", label: "Blade", categoryIds: [CATEGORY_IDS.BX_BLADES], filterInfinite: false });
      break;
    case "BX_INF":
      fields.push({ key: "blade", label: "Blade BX♾️", categoryIds: [CATEGORY_IDS.BX_BLADES], filterInfinite: true });
      break;
    case "UX":
      fields.push({ key: "blade", label: "Blade", categoryIds: [CATEGORY_IDS.UX_BLADES] });
      break;
    case "UX_INF":
      fields.push({ key: "blade", label: "Blade UX♾️", categoryIds: [CATEGORY_IDS.UX_INF_BLADES] });
      fields.push({ key: "bit", label: "Bit", categoryIds: [CATEGORY_IDS.BITS] });
      return fields;
    case "CX":
      fields.push({ key: "lock_chip", label: "Lock Chip", categoryIds: [CATEGORY_IDS.CX_LOCK_CHIPS] });
      fields.push({ key: "main_blade", label: "Main Blade", categoryIds: [CATEGORY_IDS.CX_MAIN_BLADE], filterInfinite: false });
      fields.push({ key: "assist_blade", label: "Assist Blade", categoryIds: [CATEGORY_IDS.CX_ASSIST_BLADES] });
      break;
    case "CX_INF":
      fields.push({ key: "lock_chip", label: "Lock Chip", categoryIds: [CATEGORY_IDS.CX_LOCK_CHIPS] });
      fields.push({ key: "over_blade", label: "Over Blade", categoryIds: [CATEGORY_IDS.CX_OVER_BLADE] });
      fields.push({ key: "metal_blade", label: "Metal Blade", categoryIds: [CATEGORY_IDS.CX_METAL_BLADE] });
      fields.push({ key: "assist_blade", label: "Assist Blade", categoryIds: [CATEGORY_IDS.CX_ASSIST_BLADES] });
      break;
  }

  if (ratchetType === "ribs") {
    fields.push({ key: "ribs", label: "Ribs", categoryIds: [CATEGORY_IDS.RIBS] });
  } else {
    fields.push({ key: "ratchet", label: "Ratchet", categoryIds: [CATEGORY_IDS.RATCHETS] });
    fields.push({ key: "bit", label: "Bit", categoryIds: [CATEGORY_IDS.BITS] });
  }

  return fields;
};

const defaultBeyblade = (): BeybladeConfig => ({
  blade_type: "BX",
  ratchet_type: "ratchet",
  components: {},
});

const getRequiredFields = (beyblade: BeybladeConfig) => {
  const bladeComp = beyblade.components["blade"] || beyblade.components["main_blade"];
  const isClockMirage = bladeComp?.component_name === "Clock Mirage";
  return getComponentFields(beyblade.blade_type, beyblade.ratchet_type)
    .filter(field => !(field.key === "ribs" && isClockMirage));
};

const getMissingSelections = (beyblades: BeybladeConfig[]) => {
  return beyblades.flatMap((beyblade, idx) =>
    getRequiredFields(beyblade)
      .filter(field => !beyblade.components[field.key])
      .map(field => `Bey ${idx + 1}: ${field.label}`)
  );
};

interface EditDeckData {
  id: string;
  name: string;
  description: string | null;
}

interface DeckCreatorDialogProps {
  onCreated: () => void;
  trigger?: React.ReactNode;
  editDeck?: EditDeckData | null;
  editBeyblades?: BeybladeConfig[];
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export const DeckCreatorDialog = ({ onCreated, trigger, editDeck, editBeyblades, externalOpen, onExternalOpenChange }: DeckCreatorDialogProps) => {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    else setInternalOpen(v);
  };

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [beyblades, setBeyblades] = useState<BeybladeConfig[]>([
    defaultBeyblade(),
    defaultBeyblade(),
    defaultBeyblade(),
  ]);

  const isEditMode = !!editDeck;

  useEffect(() => {
    if (open && editDeck) {
      setName(editDeck.name);
      setDescription(editDeck.description || "");
      if (editBeyblades && editBeyblades.length > 0) {
        const filled = [...editBeyblades];
        while (filled.length < 3) filled.push(defaultBeyblade());
        setBeyblades(filled);
      }
    }
  }, [open, editDeck?.id]);

  const updateBeyblade = (idx: number, updates: Partial<BeybladeConfig>) => {
    setBeyblades(prev => prev.map((b, i) => {
      if (i !== idx) return b;
      
      if (updates.blade_type && updates.blade_type !== b.blade_type) {
        return { ...b, ...updates, components: {} };
      }
      
      if (updates.ratchet_type && updates.ratchet_type !== b.ratchet_type) {
        const newComps = { ...b.components };
        delete newComps.ratchet;
        delete newComps.ribs;
        delete newComps.bit;
        return { ...b, ratchet_type: updates.ratchet_type, components: newComps };
      }
      
      return { ...b, ...updates };
    }));
  };

  const updateComponent = (beyIdx: number, key: string, val: ComponentSelection | null) => {
    setBeyblades(prev => prev.map((b, i) => {
      if (i !== beyIdx) return b;
      const newComps = { ...b.components, [key]: val };
      // If selecting Clock Mirage blade, force ratchet mode and clear ribs/bit
      const isClockMirage = (key === "blade" || key === "main_blade") && val?.component_name === "Clock Mirage";
      if (isClockMirage && b.ratchet_type === "ribs") {
        delete newComps.ribs;
        delete newComps.bit;
        return { ...b, ratchet_type: "ratchet" as const, components: newComps };
      }
      return { ...b, components: newComps };
    }));
  };

  const handleSave = async () => {
    if (!user) { toast.error("Devi essere autenticato"); return; }
    if (!name.trim()) { toast.error("Inserisci un nome per il deck"); return; }

    const profanityError = validateNoProfanity(name, description);
    if (profanityError) { toast.error(profanityError); return; }

    const missingSelections = getMissingSelections(beyblades);
    if (missingSelections.length > 0) {
      toast.error(`Completa tutte le parti prima di pubblicare: ${missingSelections.slice(0, 3).join(", ")}${missingSelections.length > 3 ? "..." : ""}`);
      return;
    }

    setSaving(true);

    try {
      if (isEditMode) {
        // Update existing deck
        const { error: updateError } = await (supabase as any)
          .from("decks")
          .update({ name: name.trim(), description: description.trim() || null })
          .eq("id", editDeck!.id);
        if (updateError) throw updateError;

        // Delete old beyblades (cascade deletes components)
        await (supabase as any)
          .from("deck_beyblades")
          .delete()
          .eq("deck_id", editDeck!.id);

        // Re-insert beyblades
        for (let i = 0; i < 3; i++) {
          const b = beyblades[i];
          const compEntries = getRequiredFields(b).map(field => [field.key, b.components[field.key]] as const);

          const { data: bey, error: beyError } = await (supabase as any)
            .from("deck_beyblades")
            .insert({
              deck_id: editDeck!.id,
              position: i + 1,
              blade_type: b.blade_type,
              ratchet_type: b.blade_type === "UX_INF" ? null : b.ratchet_type,
            })
            .select("id")
            .single();
          if (beyError) throw beyError;

          const componentInserts = compEntries.map(([compType, sel]) => ({
            deck_beyblade_id: bey.id,
            component_type: compType,
            component_id: sel!.component_id,
            variant_id: sel!.variant_id,
          }));
          const { error: compError } = await (supabase as any)
            .from("deck_beyblade_components")
            .insert(componentInserts);
          if (compError) throw compError;
        }

        toast.success("Deck aggiornato!");
      } else {
        // Create new deck
        const { data: deck, error: deckError } = await (supabase as any)
          .from("decks")
          .insert({ user_id: user.id, name: name.trim(), description: description.trim() || null })
          .select("id")
          .single();
        if (deckError) throw deckError;

        for (let i = 0; i < 3; i++) {
          const b = beyblades[i];
          const compEntries = getRequiredFields(b).map(field => [field.key, b.components[field.key]] as const);

          const { data: bey, error: beyError } = await (supabase as any)
            .from("deck_beyblades")
            .insert({
              deck_id: deck.id,
              position: i + 1,
              blade_type: b.blade_type,
              ratchet_type: b.blade_type === "UX_INF" ? null : b.ratchet_type,
            })
            .select("id")
            .single();
          if (beyError) throw beyError;

          const componentInserts = compEntries.map(([compType, sel]) => ({
            deck_beyblade_id: bey.id,
            component_type: compType,
            component_id: sel!.component_id,
            variant_id: sel!.variant_id,
          }));
          const { error: compError } = await (supabase as any)
            .from("deck_beyblade_components")
            .insert(componentInserts);
          if (compError) throw compError;
        }

        toast.success("Deck creato!");
      }

      setOpen(false);
      resetForm();
      onCreated();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Errore sconosciuto"));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setBeyblades([defaultBeyblade(), defaultBeyblade(), defaultBeyblade()]);
  };

  const handleCancel = () => {
    setOpen(false);
    if (!isEditMode) resetForm();
  };

  const isDeckComplete = getMissingSelections(beyblades).length === 0;

  const dialogContent = (
    <DialogContent className="max-w-6xl max-h-[85vh] sm:max-h-[90vh] max-sm:top-[2%] max-sm:translate-y-0 max-sm:h-[96dvh] max-sm:max-h-[96dvh] overflow-hidden p-0 [&>button.absolute]:hidden">
      <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
        <DialogTitle className="flex items-center gap-2 text-base">
          <Swords size={18} className="text-primary" />
          {isEditMode ? "Modifica Deck" : "Crea Nuovo Deck"}
        </DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 overscroll-y-contain [@media(pointer:coarse)]:[-webkit-overflow-scrolling:touch]">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="deck-name" className="text-xs">Nome Deck *</Label>
              <Input
                id="deck-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Es. Il mio deck competitivo"
                className="rounded-xl mt-0.5 h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="deck-desc" className="text-xs">Descrizione</Label>
              <Input
                id="deck-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descrivi la strategia..."
                className="rounded-xl mt-0.5 h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {beyblades.map((bey, idx) => {
            const fields = getComponentFields(bey.blade_type, bey.ratchet_type);
            // Detect if selected blade is "Clock Mirage"
            const bladeComp = bey.components["blade"] || bey.components["main_blade"];
            const isClockMirage = bladeComp?.component_name === "Clock Mirage";
            return (
              <div key={idx} className="bg-secondary/20 rounded-xl border border-border p-3 space-y-2">
                <h4 className="font-display text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                  Bey {idx + 1}
                </h4>

                <div className="flex flex-wrap gap-1">
                  {BLADE_TYPES.map(bt => (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() => updateBeyblade(idx, { blade_type: bt.id })}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                        bey.blade_type === bt.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                      }`}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {fields.map(field => {
                    const isRatchetField = field.key === "ratchet" || field.key === "ribs";
                    // Skip ribs field if Clock Mirage is selected
                    if (field.key === "ribs" && isClockMirage) return null;
                    return (
                      <div key={`${idx}-${field.key}-${bey.blade_type}-${bey.ratchet_type}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {field.label}
                          </span>
                          {isRatchetField && bey.blade_type !== "UX_INF" && !isClockMirage && (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => updateBeyblade(idx, { ratchet_type: "ratchet" })}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                                  bey.ratchet_type === "ratchet"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                }`}
                              >
                                Ratchet
                              </button>
                              <button
                                type="button"
                                onClick={() => updateBeyblade(idx, { ratchet_type: "ribs" })}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                                  bey.ratchet_type === "ribs"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                }`}
                              >
                                Ribs
                              </button>
                            </div>
                          )}
                        </div>
                        <ComponentPicker
                          categoryIds={field.categoryIds}
                          value={bey.components[field.key] || null}
                          onChange={(sel) => updateComponent(idx, field.key, sel)}
                          filterInfinite={field.filterInfinite}
                          nameEndsWith={isClockMirage && field.key === "ratchet" ? "5" : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 sm:px-6 py-3 bg-background/95 supports-[backdrop-filter]:bg-background/80 flex items-center gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || !isDeckComplete}
          className="flex-1 rounded-xl h-10"
        >
          {saving ? "Salvataggio..." : isEditMode ? "Salva Modifiche" : "Salva Deck"}
        </Button>
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={saving}
          className="flex-1 rounded-xl h-10"
        >
          Annulla
        </Button>
      </div>
    </DialogContent>
  );

  if (externalOpen !== undefined) {
    return (
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && !isEditMode) resetForm(); }}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus size={16} />
            Crea Deck
          </Button>
        )}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
};
