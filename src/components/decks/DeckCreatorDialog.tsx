import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BookOpen, Check, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Info, Layers3, Plus, ShieldCheck, Swords } from "lucide-react";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { ComponentPicker, type ComponentSelection } from "./ComponentPicker";

// Category IDs from the collection system
const CATEGORY_IDS = {
  BX_BLADES: "0e250c0a-3316-49e8-8335-7aa68cc3dce5",
  UX_BLADES: "013cda73-fe5f-4c16-b110-14c58866f78a",
  UX_INF_BLADES: "600b7ec0-d268-4acd-8a01-a2269706dd2e",
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

type ComponentField = {
  key: string;
  label: string;
  categoryIds: string[];
  filterInfinite?: boolean | null;
};

export const getComponentFields = (bladeType: BladeType, ratchetType: "ratchet" | "ribs") => {
  const fields: ComponentField[] = [];

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

const STEP_DEFS = [
  { id: "rules", label: "Regole Builder", short: "Regole", icon: BookOpen },
  { id: "bey-1", label: "Creazione Bey 1", short: "Bey 1", icon: Swords },
  { id: "bey-2", label: "Creazione Bey 2", short: "Bey 2", icon: Swords },
  { id: "bey-3", label: "Creazione Bey 3", short: "Bey 3", icon: Swords },
  { id: "summary", label: "Riepilogo Deck", short: "Recap", icon: ClipboardList },
] as const;
const STAT_ORDER = ["ATK", "DEF", "STA", "BURST RES", "WGT", "DB"];

const defaultBeyblade = (): BeybladeConfig => ({
  blade_type: "BX",
  ratchet_type: "ratchet",
  components: {},
});

const selectionName = (selection?: ComponentSelection | null) => {
  if (!selection) return "Non selezionato";
  return selection.variant_name ? `${selection.component_name} (${selection.variant_name})` : selection.component_name;
};

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

const getSelectedParts = (beyblade: BeybladeConfig) =>
  getRequiredFields(beyblade)
    .map(field => ({ field, selection: beyblade.components[field.key] || null }))
    .filter(item => item.selection);

const getPrimaryName = (beyblade: BeybladeConfig, idx: number) => {
  const primary =
    beyblade.components.over_blade ||
    beyblade.components.metal_blade ||
    beyblade.components.main_blade ||
    beyblade.components.blade;
  return selectionName(primary) || `Bey ${idx + 1}`;
};

const sumStats = (beyblade: BeybladeConfig) => {
  const stats: Record<string, number> = {};
  Object.values(beyblade.components).forEach(selection => {
    Object.entries(selection?.stats || {}).forEach(([key, value]) => {
      stats[key] = (stats[key] || 0) + value;
    });
  });
  return stats;
};

const orderedStats = (stats: Record<string, number>) => {
  const keys = Object.keys(stats).filter(key => stats[key] > 0);
  return keys.sort((a, b) => {
    const ai = STAT_ORDER.indexOf(a);
    const bi = STAT_ORDER.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.localeCompare(b);
  });
};

const isBeyComplete = (beyblade: BeybladeConfig) =>
  getRequiredFields(beyblade).every(field => !!beyblade.components[field.key]);

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

const canNavigateToStep = (targetStep: number, beyblades: BeybladeConfig[]) => {
  if (targetStep <= 1) return true;
  const requiredCompletedBeys = Math.min(targetStep - 1, 3);
  return beyblades.slice(0, requiredCompletedBeys).every(isBeyComplete);
};

const StepRail = ({
  step,
  setStep,
  beyblades,
}: {
  step: number;
  setStep: (step: number) => void;
  beyblades: BeybladeConfig[];
}) => (
  <div className="px-4 sm:px-6 pb-3">
    <div className="md:hidden">
      <div className="relative h-12 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />
        <div
          className="flex h-full items-center transition-transform duration-300 ease-out"
          style={{ transform: `translateX(calc(50% - ${step * 56 + 28}px))` }}
        >
          {STEP_DEFS.map((s, idx) => {
            const isActive = idx === step;
            const isDone = idx < step;
            const isReachable = canNavigateToStep(idx, beyblades);
            const Ico = s.icon;
            const distance = Math.abs(idx - step);
            const opacity = !isReachable ? 0.22 : distance === 0 ? 1 : distance === 1 ? 0.55 : distance === 2 ? 0.28 : 0.12;
            const scale = isActive ? 1.15 : 0.85;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!isReachable}
                onClick={() => setStep(idx)}
                aria-label={`Step ${idx + 1}: ${s.label}`}
                className="flex shrink-0 items-center justify-center disabled:cursor-not-allowed"
                style={{ width: 56, opacity, transition: "opacity 300ms ease, transform 300ms ease", transform: `scale(${scale})` }}
              >
                <span className="cte-dot" data-active={isActive ? 1 : 0} data-done={isDone ? 1 : 0}>
                  {isDone ? <Check size={16} strokeWidth={2.5} /> : <Ico size={16} strokeWidth={2.2} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 text-center">
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Step {step + 1} / {STEP_DEFS.length}</span>
        <div className="font-display text-sm font-bold cte-title-accent">{STEP_DEFS[step].label}</div>
      </div>
    </div>

    <div className="hidden flex-wrap gap-1.5 pb-2 md:flex">
      {STEP_DEFS.map((s, idx) => {
        const isActive = idx === step;
        const isDone = idx < step;
        const isReachable = canNavigateToStep(idx, beyblades);
        const Ico = s.icon;
        return (
          <button
            key={s.id}
            type="button"
            disabled={!isReachable}
            onClick={() => setStep(idx)}
            className="cte-pill disabled:cursor-not-allowed disabled:opacity-40"
            data-active={isActive ? 1 : 0}
            data-done={isDone ? 1 : 0}
          >
            <span className="cte-pill-num">{isDone ? "✓" : idx + 1}</span>
            <Ico size={13} strokeWidth={2.4} />
            <span className="whitespace-nowrap">{s.short}</span>
          </button>
        );
      })}
    </div>

    <div className="cte-progress mt-1">
      <i style={{ width: `${((step + 1) / STEP_DEFS.length) * 100}%` }} />
    </div>
  </div>
);

const StatPanel = ({ beyblade }: { beyblade: BeybladeConfig }) => {
  const stats = sumStats(beyblade);
  const keys = orderedStats(stats);

  return (
    <div className="rounded-lg border border-border bg-card/80 p-3">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={15} className="text-primary" />
        <h4 className="font-display text-sm">Statistiche</h4>
      </div>
      {keys.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Seleziona i componenti per vedere la somma delle statistiche importate.
        </p>
      ) : (
        <div className="space-y-2">
          {keys.map(key => {
            const value = stats[key];
            const pct = Math.min(100, value);
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-muted-foreground">{key}</span>
                  <span className="font-bold text-foreground">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PartsPanel = ({ beyblade }: { beyblade: BeybladeConfig }) => {
  const parts = getSelectedParts(beyblade);

  return (
    <div className="rounded-lg border border-border bg-card/80 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Layers3 size={15} className="text-primary" />
        <h4 className="font-display text-sm">Componenti</h4>
      </div>
      {parts.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          La build apparirà qui man mano che scegli le parti.
        </p>
      ) : (
        <div className="space-y-2">
          {parts.map(({ field, selection }) => {
            const image = selection?.variant_image || selection?.component_image;
            return (
              <div key={field.key} className="flex items-center gap-2 rounded-md bg-secondary/35 p-2">
                {image ? (
                  <img src={image} alt="" className="h-9 w-9 shrink-0 rounded-md bg-background object-contain" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-xs text-muted-foreground">?</div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{field.label}</p>
                  <p className="truncate text-xs font-semibold">{selectionName(selection)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const RulesStep = () => (
  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Info size={18} className="text-primary" />
        <h3 className="font-display text-lg">Regole deck building</h3>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>Un deck è composto da 3 Bey completi. Ogni Bey va costruito scegliendo prima la serie e poi tutti gli slot richiesti.</p>
        <p>Le serie BX, UX e CX usano Blade o layer CX più Ratchet e Bit; dove consentito puoi passare alla modalità Ribs. UX♾️ usa Blade UX♾️ e Bit, senza Ratchet o Ribs.</p>
        <p>Per eventi ufficiali o format specifici, controlla sempre il regolamento dell’organizzatore: il builder aiuta a comporre il deck, ma non sostituisce la verifica torneo.</p>
      </div>
    </div>

    <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <CircleAlert size={18} className="text-primary" />
        <h3 className="font-display text-lg">Come usare il builder</h3>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>Gli step 2, 3 e 4 costruiscono rispettivamente Bey 1, Bey 2 e Bey 3. Da desktop trovi i componenti scelti a sinistra, il builder al centro e le statistiche a destra.</p>
        <p>Da mobile la costruzione resta in verticale e i pannelli di controllo scendono sotto i selettori, così non rubano spazio alla scelta delle parti.</p>
        <p className="font-medium text-foreground">Disclaimer: le statistiche sono indicative e possono differire leggermente dalla resa reale del componente.</p>
      </div>
    </div>
  </div>
);

const BeyStep = ({
  idx,
  beyblade,
  updateBeyblade,
  updateComponent,
}: {
  idx: number;
  beyblade: BeybladeConfig;
  updateBeyblade: (idx: number, updates: Partial<BeybladeConfig>) => void;
  updateComponent: (beyIdx: number, key: string, val: ComponentSelection | null) => void;
}) => {
  const fields = getComponentFields(beyblade.blade_type, beyblade.ratchet_type);
  const requiredFields = getRequiredFields(beyblade);
  const bladeComp = beyblade.components["blade"] || beyblade.components["main_blade"];
  const isClockMirage = bladeComp?.component_name === "Clock Mirage";
  const canUseRibs = beyblade.blade_type !== "UX_INF" && !isClockMirage;
  const missingCount = requiredFields.filter(field => !beyblade.components[field.key]).length;

  return (
    <div className="grid gap-3 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
      <div className="order-2 lg:order-1">
        <PartsPanel beyblade={beyblade} />
      </div>

      <div className="order-1 space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4 lg:order-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Step {idx + 2}</p>
            <h3 className="font-display text-lg">Creazione Bey {idx + 1}</h3>
            <p className="text-xs text-muted-foreground">
              {missingCount === 0 ? "Bey completo" : `${missingCount} slot da completare`}
            </p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-semibold">
            {BLADE_TYPES.find(type => type.id === beyblade.blade_type)?.label}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Serie</Label>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {BLADE_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => updateBeyblade(idx, { blade_type: type.id })}
                className={`min-h-10 rounded-lg border px-2 text-xs font-semibold transition-all ${
                  beyblade.blade_type === type.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {canUseRibs && (
          <div className="space-y-2">
            <Label className="text-xs">Sistema finale</Label>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-secondary/35 p-1">
              {(["ratchet", "ribs"] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateBeyblade(idx, { ratchet_type: mode })}
                  className={`h-9 rounded-md text-xs font-semibold transition-all ${
                    beyblade.ratchet_type === mode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  {mode === "ratchet" ? "Ratchet + Bit" : "Ribs"}
                </button>
              ))}
            </div>
          </div>
        )}

        {isClockMirage && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground">
            Clock Mirage richiede la modalità Ratchet e mostra solo Ratchet compatibili.
          </div>
        )}

        <div className="space-y-3">
          {fields.map(field => {
            if (field.key === "ribs" && isClockMirage) return null;
            return (
              <div key={`${idx}-${field.key}-${beyblade.blade_type}-${beyblade.ratchet_type}`} className="space-y-1.5">
                <Label className="text-xs">{field.label}</Label>
                <ComponentPicker
                  categoryIds={field.categoryIds}
                  label={field.label}
                  value={beyblade.components[field.key] || null}
                  onChange={(sel) => updateComponent(idx, field.key, sel)}
                  filterInfinite={field.filterInfinite}
                  nameEndsWith={isClockMirage && field.key === "ratchet" ? "5" : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="order-3">
        <StatPanel beyblade={beyblade} />
      </div>
    </div>
  );
};

const SummaryStep = ({
  name,
  setName,
  description,
  setDescription,
  beyblades,
}: {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  beyblades: BeybladeConfig[];
}) => {
  const missing = getMissingSelections(beyblades);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 font-display text-lg">Dettagli deck</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="deck-name" className="text-xs">Nome Deck *</Label>
              <Input
                id="deck-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Es. Il mio deck competitivo"
                className="mt-1 rounded-lg"
              />
            </div>
            <div>
              <Label htmlFor="deck-desc" className="text-xs">Descrizione</Label>
              <Textarea
                id="deck-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descrivi strategia, match-up o note sul deck..."
                className="mt-1 min-h-24 rounded-lg"
              />
            </div>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
              <CircleAlert size={16} />
              Componenti mancanti
            </div>
            <p className="text-xs text-muted-foreground">{missing.join(", ")}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {beyblades.map((beyblade, idx) => {
          const stats = sumStats(beyblade);
          const keys = orderedStats(stats).slice(0, 4);
          return (
            <div key={idx} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Bey {idx + 1}</p>
                  <h4 className="truncate font-display text-sm">{getPrimaryName(beyblade, idx)}</h4>
                </div>
                <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                  {BLADE_TYPES.find(type => type.id === beyblade.blade_type)?.label}
                </span>
              </div>
              <div className="space-y-1.5">
                {getRequiredFields(beyblade).map(field => {
                  const selection = beyblade.components[field.key];
                  return (
                    <div key={field.key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{field.label}</span>
                      <span className="max-w-[170px] truncate font-medium">{selectionName(selection)}</span>
                    </div>
                  );
                })}
              </div>
              {keys.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {keys.map(key => (
                    <span key={key} className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                      {key} {stats[key]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DeckCreatorDialog = ({ onCreated, trigger, editDeck, editBeyblades, externalOpen, onExternalOpenChange }: DeckCreatorDialogProps) => {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    else setInternalOpen(v);
  };

  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [beyblades, setBeyblades] = useState<BeybladeConfig[]>([
    defaultBeyblade(),
    defaultBeyblade(),
    defaultBeyblade(),
  ]);

  const isEditMode = !!editDeck;
  const isDeckComplete = getMissingSelections(beyblades).length === 0;

  useEffect(() => {
    if (open) {
      setStep(0);
      setConfirmOpen(false);
    }
    if (open && editDeck) {
      setName(editDeck.name);
      setDescription(editDeck.description || "");
      if (editBeyblades && editBeyblades.length > 0) {
        const filled = [...editBeyblades];
        while (filled.length < 3) filled.push(defaultBeyblade());
        setBeyblades(filled);
      }
    }
  }, [open, editDeck?.id, editBeyblades]);

  useEffect(() => {
    if (!open) return;
    const ids = new Set<string>();
    beyblades.forEach(beyblade => {
      Object.values(beyblade.components).forEach(selection => {
        if (selection?.component_id && !selection.stats) ids.add(selection.component_id);
      });
    });
    if (ids.size === 0) return;

    const hydrateStats = async () => {
      const { data } = await (supabase as any)
        .from("collection_component_stats")
        .select("component_id, stat_name, stat_value")
        .in("component_id", Array.from(ids));
      const byId = new Map<string, Record<string, number>>();
      (data || []).forEach((stat: any) => {
        const current = byId.get(stat.component_id) || {};
        current[stat.stat_name] = stat.stat_value;
        byId.set(stat.component_id, current);
      });
      setBeyblades(prev => prev.map(beyblade => {
        const components = { ...beyblade.components };
        Object.entries(components).forEach(([key, selection]) => {
          if (selection?.component_id && !selection.stats) {
            components[key] = { ...selection, stats: byId.get(selection.component_id) || {} };
          }
        });
        return { ...beyblade, components };
      }));
    };

    hydrateStats();
  }, [open, beyblades]);

  const updateBeyblade = (idx: number, updates: Partial<BeybladeConfig>) => {
    setBeyblades(prev => prev.map((b, i) => {
      if (i !== idx) return b;

      if (updates.blade_type && updates.blade_type !== b.blade_type) {
        return { ...b, ...updates, ratchet_type: updates.blade_type === "UX_INF" ? "ratchet" : b.ratchet_type, components: {} };
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
      const isClockMirage = (key === "blade" || key === "main_blade") && val?.component_name === "Clock Mirage";
      if (isClockMirage && b.ratchet_type === "ribs") {
        delete newComps.ribs;
        delete newComps.bit;
        return { ...b, ratchet_type: "ratchet" as const, components: newComps };
      }
      return { ...b, components: newComps };
    }));
  };

  const validateDeckDetails = () => {
    if (!user) { toast.error("Devi essere autenticato"); return false; }
    if (!name.trim()) { toast.error("Inserisci un nome per il deck"); return false; }

    const profanityError = validateNoProfanity(name, description);
    if (profanityError) { toast.error(profanityError); return false; }

    const missingSelections = getMissingSelections(beyblades);
    if (missingSelections.length > 0) {
      toast.error(`Completa tutte le parti prima di pubblicare: ${missingSelections.slice(0, 3).join(", ")}${missingSelections.length > 3 ? "..." : ""}`);
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateDeckDetails()) return;

    setSaving(true);

    try {
      if (isEditMode) {
        const { error: updateError } = await (supabase as any)
          .from("decks")
          .update({ name: name.trim(), description: description.trim() || null })
          .eq("id", editDeck!.id);
        if (updateError) throw updateError;

        await (supabase as any)
          .from("deck_beyblades")
          .delete()
          .eq("deck_id", editDeck!.id);

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
        const { data: deck, error: deckError } = await (supabase as any)
          .from("decks")
          .insert({ user_id: user!.id, name: name.trim(), description: description.trim() || null })
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

      setConfirmOpen(false);
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
    setStep(0);
    setConfirmOpen(false);
    setName("");
    setDescription("");
    setBeyblades([defaultBeyblade(), defaultBeyblade(), defaultBeyblade()]);
  };

  const handleCancel = () => {
    setOpen(false);
    if (!isEditMode) resetForm();
  };

  const goNext = () => {
    if (step >= 1 && step <= 3 && !isBeyComplete(beyblades[step - 1])) {
      toast.error(`Completa Bey ${step} prima di continuare`);
      return;
    }
    setStep(prev => Math.min(4, prev + 1));
  };

  const primaryButtonLabel = useMemo(() => {
    if (step < 4) return "Avanti";
    if (saving) return "Salvataggio...";
    return isEditMode ? "Conferma modifiche" : "Crea deck";
  }, [isEditMode, saving, step]);

  const stepBody = (
    <>
      {step === 0 && <RulesStep />}
      {step >= 1 && step <= 3 && (
        <BeyStep
          idx={step - 1}
          beyblade={beyblades[step - 1]}
          updateBeyblade={updateBeyblade}
          updateComponent={updateComponent}
        />
      )}
      {step === 4 && (
        <SummaryStep
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          beyblades={beyblades}
        />
      )}
    </>
  );

  const dialogContent = (
    <DialogContent className="max-w-7xl max-h-[88vh] sm:max-h-[90vh] max-sm:top-[2%] max-sm:translate-y-0 max-sm:h-[96dvh] max-sm:max-h-[96dvh] overflow-hidden p-0 [&>button.absolute]:hidden">
      <DialogHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <DialogTitle className="flex items-center gap-2 text-base">
          <Swords size={18} className="text-primary" />
          {isEditMode ? "Modifica Deck" : "Crea Nuovo Deck"}
        </DialogTitle>
      </DialogHeader>

      <StepRail step={step} setStep={setStep} beyblades={beyblades} />

      <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-y-contain sm:px-6 [@media(pointer:coarse)]:[-webkit-overflow-scrolling:touch]">
        {stepBody}
      </div>

      <div className="shrink-0 border-t border-[color:var(--ibnf-acid-line)] bg-background/95 px-4 py-3 supports-[backdrop-filter]:bg-background/80 sm:px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(prev => Math.max(0, prev - 1))}
              disabled={saving || step === 0}
              className="cte-btn-ghost"
            >
              <ChevronLeft size={15} />
              Indietro
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="cte-btn-ghost"
            >
              Annulla
            </button>
          </div>
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">
            Step {step + 1} / {STEP_DEFS.length} · <span className="cte-title-accent">{STEP_DEFS[step].label}</span>
          </span>
          <button
            type="button"
            onClick={step < 4 ? goNext : () => validateDeckDetails() && setConfirmOpen(true)}
            disabled={saving || (step === 4 && (!name.trim() || !isDeckComplete))}
            className={step < 4 ? "cte-btn-primary" : "cte-btn-submit"}
          >
            {primaryButtonLabel}
            {step < 4 && <ChevronRight size={15} />}
          </button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEditMode ? "Salvare le modifiche al deck?" : "Creare questo deck?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno salvati 3 Bey completi nel deck "{name.trim()}". Controlla che combinazioni, varianti e descrizione siano corrette prima di confermare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Rivedi</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={saving}>
              {saving ? "Salvataggio..." : "Conferma"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
