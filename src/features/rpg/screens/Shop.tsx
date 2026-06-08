import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Coins, Check, Lock, ShoppingBag, Package, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRpg } from "../state/rpgStore";
import { HAIR, EYES, OUTFITS, SKIN, Cosmetic, isOwned, filterByGender, filterByEra, Era } from "../data/cosmetics";
import { HDAvatar } from "../components/HDAvatar";
import { CatalogComponent, RARITY_COLORS, RARITY_COST, RARITY_LABELS, RARITY_WEIGHT, Rarity, TYPE_EMOJI, loadGameComponents } from "../data/componentsCatalog";
import { grantComponent } from "../state/gameDeckStore";
import { toast } from "@/hooks/use-toast";

type Cat = "outfit" | "hair" | "eyes" | "skin";
type Tab = "cosmetics" | "components";

const COS_TABS: { id: Cat; label: string; items: Cosmetic[] }[] = [
  { id: "outfit", label: "Vestiti", items: OUTFITS },
  { id: "hair", label: "Capelli", items: HAIR },
  { id: "eyes", label: "Occhi", items: EYES },
  { id: "skin", label: "Pelle", items: SKIN },
];

const ERAS: { id: Era | "all"; label: string }[] = [
  { id: "all", label: "Tutte" },
  { id: "past", label: "Passato" },
  { id: "modern", label: "Moderno" },
  { id: "future", label: "Futuro" },
];

const pickByRarity = (pool: CatalogComponent[], rarity: Rarity): CatalogComponent | null => {
  const arr = pool.filter((c) => c.rarity === rarity);
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
};

export const Shop = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const { profile, buyCosmetic, setAppearance, freeMode, addCurrency } = useRpg();
  const [tab, setTab] = useState<Tab>("components");
  const [cat, setCat] = useState<Cat>("outfit");
  const [era, setEra] = useState<Era | "all">("all");
  const [pool, setPool] = useState<CatalogComponent[]>([]);
  const [buying, setBuying] = useState<Rarity | null>(null);
  const [lastDrop, setLastDrop] = useState<{ comp: CatalogComponent; duplicate: boolean } | null>(null);

  useEffect(() => {
    loadGameComponents().then((c) => setPool(c.filter((x) => x.enabled)));
  }, []);

  const baseItems = useMemo(() => filterByGender(COS_TABS.find((t) => t.id === cat)!.items, profile.gender).filter((c) => c.price > 0), [cat, profile.gender]);
  const items = cat === "outfit" ? filterByEra(baseItems, era) : baseItems;

  const buyCosmeticItem = async (c: Cosmetic) => {
    if (isOwned(profile.owned_cosmetics, c.id)) {
      await setAppearance({ [cat]: c.id } as any);
      toast({ title: "Cosmetico equipaggiato", description: c.label });
      return;
    }
    if (!freeMode && profile.currency < c.price) {
      toast({ title: "Monete insufficienti", variant: "destructive" });
      return;
    }
    const ok = await buyCosmetic(c.id, c.price);
    if (ok) {
      await setAppearance({ [cat]: c.id } as any);
      toast({ title: freeMode ? "Sbloccato (debug)" : "Acquistato!", description: c.label });
    }
  };

  const buyRandomComponent = async (rarity: Rarity) => {
    if (!user) return;
    const cost = RARITY_COST[rarity];
    if (!freeMode && profile.currency < cost) {
      toast({ title: "Monete insufficienti", variant: "destructive" });
      return;
    }
    const picked = pickByRarity(pool, rarity);
    if (!picked) {
      toast({ title: "Nessun componente disponibile in questa rarità", variant: "destructive" });
      return;
    }
    setBuying(rarity);
    try {
      if (!freeMode) await addCurrency(-cost);
      const { duplicate } = await grantComponent(user.id, picked.id);
      if (duplicate) await addCurrency(Math.round(cost * 0.25));
      setLastDrop({ comp: picked, duplicate });
      toast({ title: duplicate ? "Doppione!" : `${RARITY_LABELS[rarity]} ottenuto!`, description: picked.name });
    } finally {
      setBuying(null);
    }
  };

  const previewProps = (c: Cosmetic) => ({ gender: profile.gender, hair: profile.hair, eyes: profile.eyes, skin: profile.skin, outfit: profile.outfit, [cat]: c.id } as any);

  const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Button>
        <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Shop</h2></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
          <Coins className="h-4 w-4 text-amber-400" /><span className="text-sm font-bold">{profile.currency}</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => setTab("components")} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${tab === "components" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
          <Package className="h-3.5 w-3.5 inline mr-1" />Componenti Bey
        </button>
        <button onClick={() => setTab("cosmetics")} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${tab === "cosmetics" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
          <Sparkles className="h-3.5 w-3.5 inline mr-1" />Cosmetici
        </button>
      </div>

      {tab === "components" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Acquista un componente casuale di una specifica rarità. I doppioni rimborsano il 25% del costo.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {RARITIES.map((r) => (
              <Card key={r} className={`p-4 space-y-2 border ${RARITY_COLORS[r]}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{RARITY_LABELS[r]}</span>
                  <span className="text-[10px] text-muted-foreground">{RARITY_WEIGHT[r]}% pool</span>
                </div>
                <div className="flex items-center gap-1 text-sm"><Coins className="h-3.5 w-3.5 text-amber-400" /><span className="font-bold">{RARITY_COST[r]}</span></div>
                <Button size="sm" className="w-full" disabled={buying !== null} onClick={() => buyRandomComponent(r)}>
                  {buying === r ? "..." : "Acquista"}
                </Button>
              </Card>
            ))}
          </div>
          {lastDrop && (
            <Card className="p-3 flex items-center gap-3 border-primary/40">
              <div className="w-14 h-14 bg-muted/30 rounded overflow-hidden flex items-center justify-center shrink-0">
                {lastDrop.comp.image_url ? <img src={lastDrop.comp.image_url} alt={lastDrop.comp.name} className="w-full h-full object-contain" /> : <div className="text-2xl">{TYPE_EMOJI[lastDrop.comp.bey_type]}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase text-muted-foreground">Ultimo drop {lastDrop.duplicate && "(doppione)"}</div>
                <div className="font-bold truncate">{lastDrop.comp.name}</div>
                <span className={`text-[10px] px-1 rounded border ${RARITY_COLORS[lastDrop.comp.rarity]}`}>{RARITY_LABELS[lastDrop.comp.rarity]}</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "cosmetics" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {COS_TABS.map((t) => (
              <button key={t.id} onClick={() => setCat(t.id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${cat === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>{t.label}</button>
            ))}
          </div>
          {cat === "outfit" && (
            <div className="flex flex-wrap gap-1.5">
              {ERAS.map((e) => (
                <button key={e.id} onClick={() => setEra(e.id)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${era === e.id ? "bg-accent text-accent-foreground" : "bg-card border border-border"}`}>{e.label}</button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((c) => {
              const owned = isOwned(profile.owned_cosmetics, c.id);
              const equipped = profile[cat as "hair" | "eyes" | "skin" | "outfit"] === c.id;
              const canAfford = freeMode || profile.currency >= c.price;
              return (
                <Card key={c.id} className={`p-3 flex flex-col items-center gap-2 transition-all ${equipped ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/40"}`}>
                  <div className="bg-gradient-to-b from-primary/10 to-card rounded-lg p-2 w-full h-36 flex justify-center overflow-hidden">
                    <HDAvatar size={78} animated={false} {...previewProps(c)} />
                  </div>
                  <div className="text-center w-full">
                    <div className="text-xs font-bold truncate">{c.label}</div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-amber-400 mt-0.5">
                      <Coins className="h-3 w-3" />{c.price}
                    </div>
                  </div>
                  {equipped ? (
                    <Button size="sm" variant="secondary" className="w-full" disabled><Check className="h-3 w-3 mr-1" />Equipaggiato</Button>
                  ) : owned ? (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => buyCosmeticItem(c)}>Indossa</Button>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => buyCosmeticItem(c)} disabled={!canAfford}>
                      {!canAfford && <Lock className="h-3 w-3 mr-1" />}{canAfford ? "Acquista" : "Bloccato"}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
