import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Gift, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRpg } from "../state/rpgStore";
import { CatalogComponent, RARITY_COLORS, RARITY_LABELS, RARITY_WEIGHT, Rarity, TYPE_EMOJI, loadGameComponents } from "../data/componentsCatalog";
import { grantComponent } from "../state/gameDeckStore";
import { toast } from "@/hooks/use-toast";

const SINGLE_COST = 100;
const MULTI_COST = 900;
const DUP_REFUND = 25;

const pickByRarity = (pool: CatalogComponent[]): CatalogComponent | null => {
  if (!pool.length) return null;
  // Build weighted bucket per rarity
  const byRarity: Record<Rarity, CatalogComponent[]> = { common: [], rare: [], epic: [], legendary: [] };
  pool.forEach((c) => byRarity[c.rarity].push(c));
  const totalWeight = (Object.keys(byRarity) as Rarity[]).reduce((s, r) => s + (byRarity[r].length ? RARITY_WEIGHT[r] : 0), 0);
  let n = Math.random() * totalWeight;
  for (const r of Object.keys(byRarity) as Rarity[]) {
    if (!byRarity[r].length) continue;
    if (n < RARITY_WEIGHT[r]) {
      const arr = byRarity[r];
      return arr[Math.floor(Math.random() * arr.length)];
    }
    n -= RARITY_WEIGHT[r];
  }
  return pool[Math.floor(Math.random() * pool.length)];
};

export const GachaScreen = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const { profile, addGachaPoints, addCurrency, freeMode } = useRpg();
  const [pool, setPool] = useState<CatalogComponent[]>([]);
  const [pulling, setPulling] = useState(false);
  const [results, setResults] = useState<{ comp: CatalogComponent; duplicate: boolean }[]>([]);

  useEffect(() => {
    loadGameComponents().then((c) => setPool(c.filter((x) => x.enabled)));
  }, []);

  const pull = async (count: number) => {
    if (!user) return;
    const cost = count === 10 ? MULTI_COST : SINGLE_COST;
    if (!freeMode && profile.gacha_points < cost) {
      toast({ title: "Punti gacha insufficienti", variant: "destructive" });
      return;
    }
    setPulling(true);
    setResults([]);
    try {
      if (!freeMode) await addGachaPoints(-cost);
      const out: { comp: CatalogComponent; duplicate: boolean }[] = [];
      let refunds = 0;
      for (let i = 0; i < count; i++) {
        const picked = pickByRarity(pool);
        if (!picked) continue;
        const { duplicate } = await grantComponent(user.id, picked.id);
        if (duplicate) refunds += DUP_REFUND;
        out.push({ comp: picked, duplicate });
      }
      if (refunds > 0) await addCurrency(refunds);
      setResults(out);
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Button>
        <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-fuchsia-400" /><h2 className="text-lg font-bold">Gacha Componenti</h2></div>
        <div className="text-xs px-3 py-1.5 rounded-full bg-card border border-border flex items-center gap-1"><Gift className="h-3 w-3 text-fuchsia-400" /><span className="font-bold">{profile.gacha_points}</span></div>
      </div>

      <Card className="p-4 grid sm:grid-cols-2 gap-3">
        <Button size="lg" disabled={pulling || pool.length === 0} onClick={() => pull(1)}>
          <Sparkles className="h-4 w-4 mr-2" />Pesca singola ({SINGLE_COST} 🎁)
        </Button>
        <Button size="lg" disabled={pulling || pool.length === 0} onClick={() => pull(10)} variant="secondary">
          <Sparkles className="h-4 w-4 mr-2" />Multi 10x ({MULTI_COST} 🎁)
        </Button>
      </Card>

      {pulling && <div className="text-center py-6 text-muted-foreground">Pescando...</div>}

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {results.map((r, i) => (
            <Card key={i} className={`p-2 ${r.duplicate ? "opacity-70" : ""}`}>
              <div className="aspect-square bg-muted/30 rounded mb-1 overflow-hidden flex items-center justify-center">
                {r.comp.image_url ? <img src={r.comp.image_url} alt={r.comp.name} className="w-full h-full object-contain" /> : <div className="text-2xl">{TYPE_EMOJI[r.comp.bey_type]}</div>}
              </div>
              <div className="text-[11px] font-bold truncate">{r.comp.name}</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className={`text-[9px] px-1 rounded border ${RARITY_COLORS[r.comp.rarity]}`}>{RARITY_LABELS[r.comp.rarity]}</span>
                {r.duplicate && <span className="text-[9px] text-amber-400">+{DUP_REFUND}🪙</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
