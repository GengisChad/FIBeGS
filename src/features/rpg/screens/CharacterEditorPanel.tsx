import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Coins, Lock, Check } from "lucide-react";
import { useRpg } from "../state/rpgStore";
import { HAIR, EYES, SKIN, OUTFITS, Cosmetic, Gender, Era, filterByGender, filterByEra, isOwned } from "../data/cosmetics";
import { toast } from "@/hooks/use-toast";

/**
 * Inline editor (no header, no back) used directly in the main menu.
 * Lets the player change gender, hair, eyes, skin, outfit and buy cosmetics.
 */
export const CharacterEditorPanel = () => {
  const { profile, setAppearance, buyCosmetic } = useRpg();
  const [tab, setTab] = useState<"gender" | "hair" | "eyes" | "skin" | "outfit">("outfit");
  const [era, setEra] = useState<Era | "all">("all");

  const select = async (key: "hair" | "eyes" | "skin" | "outfit", c: Cosmetic) => {
    if (!isOwned(profile.owned_cosmetics, c.id)) {
      const ok = await buyCosmetic(c.id, c.price);
      if (!ok) { toast({ title: "Monete insufficienti", description: `Servono ${c.price} 🪙`, variant: "destructive" }); return; }
      toast({ title: "Cosmetico sbloccato!", description: c.label });
    }
    await setAppearance({ [key]: c.id } as any);
  };

  const setGender = async (g: Gender) => {
    const next: any = { gender: g };
    const hairOk = HAIR.find((h) => h.id === profile.hair && (h.gender === "any" || h.gender === g));
    if (!hairOk) next.hair = g === "male" ? "short_dark" : "long_dark";
    const outfitOk = OUTFITS.find((o) => o.id === profile.outfit && (o.gender === "any" || o.gender === g));
    if (!outfitOk) next.outfit = g === "male" ? "tunic_blue" : "tunic_pink";
    await setAppearance(next);
  };

  const renderGrid = (key: "hair" | "eyes" | "skin" | "outfit", items: Cosmetic[]) => {
    const byGender = filterByGender(items, profile.gender);
    const list = key === "outfit" ? filterByEra(byGender, era) : byGender;
    const currentId = profile[key];
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {list.length === 0 && (
          <div className="col-span-full text-center text-xs text-muted-foreground py-4">
            Nessun elemento in questa categoria.
          </div>
        )}
        {list.map((c) => {
          const owned = isOwned(profile.owned_cosmetics, c.id);
          const active = currentId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => select(key, c)}
              className={`relative p-2.5 rounded-lg border text-left transition-all ${
                active ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                       : "border-border hover:border-primary/40 hover:bg-card/60"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: c.color }} />
                <span className="text-[11px] font-semibold truncate flex-1">{c.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              {!owned ? (
                <div className="flex items-center gap-1 text-[10px] text-amber-400">
                  <Lock className="h-3 w-3" /><Coins className="h-3 w-3" />{c.price}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground">{c.price === 0 ? "Base" : "Posseduto"}</div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["gender", "hair", "eyes", "skin", "outfit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:border-primary/40"
            }`}
          >
            {t === "gender" ? "Genere" : t === "hair" ? "Capelli" : t === "eyes" ? "Occhi" : t === "skin" ? "Pelle" : "Vestiti"}
          </button>
        ))}
      </div>

      {tab === "gender" && (
        <div className="grid grid-cols-2 gap-3">
          {(["male", "female"] as Gender[]).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={`p-4 rounded-lg border text-center transition-all ${
                profile.gender === g ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="text-3xl mb-1">{g === "male" ? "♂" : "♀"}</div>
              <div className="text-sm font-bold">{g === "male" ? "Maschio" : "Femmina"}</div>
            </button>
          ))}
        </div>
      )}
      {tab === "hair" && renderGrid("hair", HAIR)}
      {tab === "eyes" && renderGrid("eyes", EYES)}
      {tab === "skin" && renderGrid("skin", SKIN)}
      {tab === "outfit" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: "all", label: "Tutte" },
              { id: "past", label: "Passato" },
              { id: "modern", label: "Moderno" },
              { id: "future", label: "Futuro" },
            ] as { id: Era | "all"; label: string }[]).map((e) => (
              <button
                key={e.id}
                onClick={() => setEra(e.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  era === e.id ? "bg-accent text-accent-foreground" : "bg-card border border-border hover:border-accent/40"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
          {renderGrid("outfit", OUTFITS)}
        </div>
      )}
    </Card>
  );
};
