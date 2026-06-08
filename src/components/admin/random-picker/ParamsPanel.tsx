import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save, Sliders } from "lucide-react";
import { SimParams, DEFAULT_PARAMS } from "./types";
import { toast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Props {
  params: SimParams;
  setParams: (p: SimParams) => void;
}

const FIELDS: { key: keyof SimParams; label: string; group: string }[] = [
  { key: "arenaRadius", label: "Raggio arena", group: "Arena" },
  { key: "centerGravity", label: "Gravità centrale", group: "Arena" },
  { key: "railSpeed", label: "Vel. su rail", group: "Arena" },
  { key: "railSlingshotBoost", label: "Boost slancio", group: "Arena" },
  { key: "railGripChance", label: "Prob. aggancio rail", group: "Arena" },
  { key: "minDuration", label: "Durata minima (s)", group: "Arena" },
  { key: "orbitForce", label: "Forza orbitale", group: "Arena" },
  { key: "beybladeRadius", label: "Raggio beyblade", group: "Beyblade" },
  { key: "initialStamina", label: "Stamina iniziale", group: "Beyblade" },
  { key: "initialDurability", label: "Resistenza iniziale", group: "Beyblade" },
  { key: "staminaDrainPerSec", label: "Drain stamina/sec", group: "Beyblade" },
  { key: "launchSpeedMin", label: "Vel. lancio min", group: "Beyblade" },
  { key: "launchSpeedMax", label: "Vel. lancio max", group: "Beyblade" },
  { key: "attackDamage", label: "ATK · danno", group: "Tipi" },
  { key: "attackRecoil", label: "ATK · rinculo", group: "Tipi" },
  { key: "attackOrbitFactor", label: "ATK · orbita larga", group: "Tipi" },
  { key: "attackSpeedMultiplier", label: "ATK · vel. mul", group: "Tipi" },
  { key: "defenseDamage", label: "DEF · danno", group: "Tipi" },
  { key: "defenseRecoil", label: "DEF · rinculo", group: "Tipi" },
  { key: "defenseCenterPull", label: "DEF · pull centro", group: "Tipi" },
  { key: "staminaDamage", label: "STA · danno", group: "Tipi" },
  { key: "staminaRecoil", label: "STA · rinculo", group: "Tipi" },
  { key: "staminaDrainMultiplier", label: "STA · drain mod", group: "Tipi" },
  { key: "staminaOrbitRadius", label: "STA · raggio orbita", group: "Tipi" },
  { key: "damageMultiplier", label: "Moltiplicatore danno", group: "Globale" },
  { key: "bounciness", label: "Rimbalzo", group: "Globale" },
  { key: "friction", label: "Attrito", group: "Globale" },
  { key: "slingshotStaminaCost", label: "Costo stamina dash", group: "Globale" },
  { key: "maxCollisionSpeed", label: "Vel. max post-coll.", group: "Globale" },
];

const STORAGE_KEY = "rp_baseline_params_v1";
const STEP_PCT = 0.05;

function loadBaseline(): SimParams {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PARAMS, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  return { ...DEFAULT_PARAMS };
}

function valueFromOffset(baseline: number, offset: number) {
  if (baseline === 0) return offset * 0.01;
  return baseline * (1 + offset * STEP_PCT);
}

function offsetFromValue(baseline: number, value: number) {
  if (baseline === 0) return Math.round(value / 0.01);
  const o = (value / baseline - 1) / STEP_PCT;
  return Math.max(-10, Math.min(10, Math.round(o)));
}

export default function ParamsPanel({ params, setParams }: Props) {
  const [baseline, setBaseline] = useState<SimParams>(() => loadBaseline());
  const groups = Array.from(new Set(FIELDS.map((f) => f.group)));

  useEffect(() => {
    setParams({ ...baseline });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveBaseline = () => {
    setBaseline({ ...params });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    } catch {
      /* noop */
    }
    toast({
      title: "Default aggiornati",
      description: "Lo 0 dei regolatori ora corrisponde ai valori attuali.",
    });
  };

  const resetToBaseline = () => setParams({ ...baseline });
  const resetFactory = () => {
    setBaseline({ ...DEFAULT_PARAMS });
    setParams({ ...DEFAULT_PARAMS });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  };

  const modifiedCount = FIELDS.filter((f) => {
    const o = offsetFromValue(Number(baseline[f.key]), Number(params[f.key]));
    return o !== 0;
  }).length;

  return (
    <Card className="max-h-[calc(100vh-2rem)] flex flex-col">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sliders size={14} className="text-muted-foreground" /> Parametri
          </span>
          {modifiedCount > 0 && (
            <span className="text-[10px] font-mono text-primary">
              {modifiedCount} modif.
            </span>
          )}
        </CardTitle>
        <div className="grid grid-cols-3 gap-1.5 pt-2">
          <Button variant="default" size="sm" onClick={saveBaseline} className="h-7 text-[10px]">
            <Save size={11} className="mr-1" /> Salva
          </Button>
          <Button variant="outline" size="sm" onClick={resetToBaseline} className="h-7 text-[10px]">
            <RotateCcw size={11} className="mr-1" /> Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={resetFactory} className="h-7 text-[10px]">
            Factory
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          Ogni step = ±5% del baseline.
        </p>
      </CardHeader>

      <CardContent className="overflow-y-auto p-0 flex-1">
        <Accordion type="multiple" defaultValue={groups} className="px-3">
          {groups.map((g) => (
            <AccordionItem key={g} value={g} className="border-b last:border-b-0">
              <AccordionTrigger className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:no-underline py-2.5">
                {g}
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <table className="w-full text-[10px]">
                  <tbody>
                    {FIELDS.filter((f) => f.group === g).map((f) => {
                      const baseVal = Number(baseline[f.key]);
                      const curVal = Number(params[f.key]);
                      const offset = offsetFromValue(baseVal, curVal);
                      const isModified = offset !== 0;
                      return (
                        <tr key={f.key} className="border-b border-border/30 last:border-0">
                          <td className="py-2 pr-2 align-middle w-[42%]">
                            <div className={`truncate ${isModified ? "text-primary font-medium" : ""}`}>
                              {f.label}
                            </div>
                            <div className="font-mono text-[9px] text-muted-foreground">
                              {curVal.toFixed(3)}
                            </div>
                          </td>
                          <td className="py-2 align-middle">
                            <Slider
                              min={-10}
                              max={10}
                              step={1}
                              value={[offset]}
                              onValueChange={([v]) =>
                                setParams({ ...params, [f.key]: valueFromOffset(baseVal, v) })
                              }
                            />
                          </td>
                          <td className="py-2 pl-2 align-middle w-8 text-right">
                            <span
                              className={`font-mono text-[10px] ${
                                isModified ? "text-primary font-bold" : "text-muted-foreground"
                              }`}
                            >
                              {offset > 0 ? "+" : ""}
                              {offset}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
