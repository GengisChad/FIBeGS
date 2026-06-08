// Procedural enemy decks: combos built from REAL catalog components,
// scaled by level (rarity weight + allowed series).
import { Bey } from "./beys";
import {
  CatalogComponent,
  BeySeries,
  RatchetMode,
  SlotKind,
  slotsForSeries,
  assembleBey,
  assembledToBey,
  Rarity,
} from "./componentsCatalog";

const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

const seriesPoolForLevel = (level: number): BeySeries[] => {
  if (level <= 1) return ["BX"];
  if (level === 2) return ["BX", "BX"];
  if (level === 3) return ["BX", "BX_INF", "UX"];
  if (level === 4) return ["UX", "CX", "BX_INF"];
  return ["CX", "CX_INF", "UX_INF"]; // level 5+
};

// Cap the rarity tier the enemy is allowed to pull, by level.
const maxRarityForLevel = (level: number): Rarity => {
  if (level <= 1) return "common";
  if (level === 2) return "rare";
  if (level === 3) return "rare";
  if (level === 4) return "epic";
  return "legendary";
};

const mulberry32 = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickRandom = <T,>(arr: T[], rand: () => number): T | null =>
  arr.length ? arr[Math.floor(rand() * arr.length)] : null;

export function generateEnemyDeck(
  level: number,
  catalog: CatalogComponent[],
  seed = level * 9176 + 1,
): Bey[] {
  const rand = mulberry32(seed);
  const maxRank = RARITY_RANK[maxRarityForLevel(level)];
  const pool = catalog.filter(
    (c) => c.enabled && RARITY_RANK[c.rarity] <= maxRank,
  );
  const bySlot = new Map<SlotKind, CatalogComponent[]>();
  for (const c of pool) {
    if (!bySlot.has(c.slot)) bySlot.set(c.slot, []);
    bySlot.get(c.slot)!.push(c);
  }

  const seriesList = seriesPoolForLevel(level);
  const result: Bey[] = [];
  for (let i = 0; i < 3; i++) {
    // Pick a series available with enough components, fall back to BX.
    let series: BeySeries = seriesList[i % seriesList.length];
    let mode: RatchetMode = rand() > 0.85 ? "ribs" : "ratchet";
    let slots = slotsForSeries(series, mode);
    const haveAll = (sl: SlotKind[]) => sl.every((s) => (bySlot.get(s)?.length ?? 0) > 0);
    if (!haveAll(slots)) {
      mode = "ratchet";
      slots = slotsForSeries(series, mode);
    }
    if (!haveAll(slots)) {
      series = "BX";
      slots = slotsForSeries(series, mode);
    }
    if (!haveAll(slots)) {
      // Last resort: empty bey fallback so loop never fails
      const a = assembleBey(i + 1, "BX", "ratchet", {});
      result.push(assembledToBey(a, i + 1000));
      continue;
    }

    const parts: any = {};
    for (const s of slots) {
      const list = bySlot.get(s)!;
      parts[s] = pickRandom(list, rand);
    }
    const a = assembleBey(i + 1, series, mode, parts);
    result.push(assembledToBey(a, i + 1000));
  }
  return result;
}
