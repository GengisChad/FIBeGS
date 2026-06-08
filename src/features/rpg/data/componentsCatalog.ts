import { supabase } from "@/integrations/supabase/client";
import { BeyType, MoveCard, Bey } from "./beys";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Comune",
  rare: "Raro",
  epic: "Epico",
  legendary: "Leggendario",
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "text-zinc-300 border-zinc-500/50 bg-zinc-500/10",
  rare: "text-sky-300 border-sky-400/50 bg-sky-400/10",
  epic: "text-fuchsia-300 border-fuchsia-400/50 bg-fuchsia-400/10",
  legendary: "text-amber-300 border-amber-400/60 bg-amber-400/10",
};

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 50, rare: 30, epic: 15, legendary: 5,
};

export const RARITY_COST: Record<Rarity, number> = {
  common: 80, rare: 220, epic: 600, legendary: 1500,
};

export const TYPE_LABELS: Record<BeyType, string> = {
  attack: "Attacco", defense: "Difesa", stamina: "Stamina", balance: "Balance",
};
export const TYPE_EMOJI: Record<BeyType, string> = {
  attack: "🔥", defense: "🛡️", stamina: "🌀", balance: "⚖️",
};

// ---------------------------------------------------------------------------
// Series (one per Bey assembled in the deck) — mirrors the site deck builder.
// ---------------------------------------------------------------------------
export type BeySeries = "BX" | "BX_INF" | "UX" | "UX_INF" | "CX" | "CX_INF";
export const SERIES_ORDER: BeySeries[] = ["BX", "BX_INF", "UX", "UX_INF", "CX", "CX_INF"];
export const SERIES_LABEL: Record<BeySeries, string> = {
  BX: "BX", BX_INF: "BX♾️", UX: "UX", UX_INF: "UX♾️", CX: "CX", CX_INF: "CX♾️",
};

export type RatchetMode = "ratchet" | "ribs";

// ---------------------------------------------------------------------------
// Granular slot kinds (one component family each).
// ---------------------------------------------------------------------------
export const SLOT_ORDER = [
  "blade_bx",
  "blade_bx_inf",
  "blade_ux",
  "blade_ux_inf",
  "cx_lock_chip",
  "cx_main",
  "cx_assist",
  "cx_over",
  "cx_metal",
  "ratchet",
  "ribs",
  "bit",
] as const;
export type SlotKind = typeof SLOT_ORDER[number];

export const SLOT_LABEL: Record<SlotKind, string> = {
  blade_bx: "Blade BX",
  blade_bx_inf: "Blade BX♾️",
  blade_ux: "Blade UX",
  blade_ux_inf: "Blade UX♾️",
  cx_lock_chip: "Lock Chip",
  cx_main: "Main Blade",
  cx_assist: "Assist Blade",
  cx_over: "Over Blade",
  cx_metal: "Metal Blade",
  ratchet: "Ratchet",
  ribs: "Ribs",
  bit: "Bit",
};

// Slot composition per series + ratchet mode. UX♾️ has no ratchet/ribs.
export const slotsForSeries = (series: BeySeries, mode: RatchetMode): SlotKind[] => {
  const tail: SlotKind[] = mode === "ribs" ? ["ribs"] : ["ratchet", "bit"];
  switch (series) {
    case "BX":     return ["blade_bx", ...tail];
    case "BX_INF": return ["blade_bx_inf", ...tail];
    case "UX":     return ["blade_ux", ...tail];
    case "UX_INF": return ["blade_ux_inf", "bit"]; // sempre solo bit, niente ratchet/ribs
    case "CX":     return ["cx_lock_chip", "cx_main", "cx_assist", ...tail];
    case "CX_INF": return ["cx_lock_chip", "cx_over", "cx_metal", "cx_assist", ...tail];
  }
};

export const seriesAllowsRibs = (series: BeySeries) => series !== "UX_INF";

// ---------------------------------------------------------------------------
// Category mapping (specific IDs from collection_categories)
// ---------------------------------------------------------------------------
const CAT = {
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

export interface RawComponent {
  id: string;
  name: string;
  image_url: string | null;
  category_id: string;
  is_infinite: boolean;
}

export interface ComponentSetting {
  component_id: string;
  rarity: Rarity;
  bey_type: BeyType;
  bey_type_manual: boolean;
  enabled: boolean;
}

export interface ComponentStat {
  component_id: string;
  stat_name: string;
  stat_value: number;
}

export interface CatalogComponent extends RawComponent {
  rarity: Rarity;
  bey_type: BeyType;
  bey_type_is_manual: boolean;
  enabled: boolean;
  stats: Record<string, number>;
  slot: SlotKind;
}

const ancestorsOf = (catId: string, all: { id: string; parent_id: string | null }[]) => {
  const out: string[] = [catId];
  let cur = all.find((c) => c.id === catId);
  while (cur?.parent_id) {
    out.push(cur.parent_id);
    cur = all.find((c) => c.id === cur!.parent_id);
  }
  return out;
};

const slotForComponent = (
  c: RawComponent,
  all: { id: string; parent_id: string | null }[],
): SlotKind | null => {
  const a = ancestorsOf(c.category_id, all);
  if (a.includes(CAT.UX_INF_BLADES)) return "blade_ux_inf";
  if (a.includes(CAT.UX_BLADES)) return "blade_ux";
  if (a.includes(CAT.BX_BLADES)) return c.is_infinite ? "blade_bx_inf" : "blade_bx";
  if (a.includes(CAT.CX_LOCK_CHIPS)) return "cx_lock_chip";
  if (a.includes(CAT.CX_ASSIST_BLADES)) return "cx_assist";
  if (a.includes(CAT.CX_OVER_BLADE)) return "cx_over";
  if (a.includes(CAT.CX_METAL_BLADE)) return "cx_metal";
  if (a.includes(CAT.CX_MAIN_BLADE)) return c.is_infinite ? null : "cx_main";
  if (a.includes(CAT.RATCHETS)) return "ratchet";
  if (a.includes(CAT.RIBS)) return "ribs";
  if (a.includes(CAT.BITS)) return "bit";
  return null;
};

export async function loadGameComponents(): Promise<CatalogComponent[]> {
  const [{ data: cats }, { data: comps }, { data: settings }, { data: stats }] = await Promise.all([
    supabase.from("collection_categories").select("id, parent_id"),
    supabase.from("collection_components").select("id, name, image_url, category_id, is_infinite").order("name"),
    (supabase as any).from("rpg_component_settings").select("component_id, rarity, bey_type, bey_type_manual, enabled"),
    (supabase as any).from("collection_component_stats").select("component_id, stat_name, stat_value"),
  ]);

  const allCats = cats ?? [];
  const settingsMap = new Map<string, ComponentSetting>((settings ?? []).map((s: any) => [s.component_id, s]));
  const statsByComp = new Map<string, Record<string, number>>();
  for (const s of (stats ?? []) as ComponentStat[]) {
    const r = statsByComp.get(s.component_id) ?? {};
    r[s.stat_name] = s.stat_value;
    statsByComp.set(s.component_id, r);
  }

  const result: CatalogComponent[] = [];
  for (const c of (comps ?? []) as RawComponent[]) {
    const slot = slotForComponent(c, allCats);
    if (!slot) continue;
    const setting = settingsMap.get(c.id);
    const stats = statsByComp.get(c.id) ?? {};
    const isManual = setting?.bey_type_manual ?? false;
    const effectiveType: BeyType = isManual && setting?.bey_type ? setting.bey_type : autoTypeFromStats(stats);
    result.push({
      ...c,
      slot,
      rarity: setting?.rarity ?? "common",
      bey_type: effectiveType,
      bey_type_is_manual: isManual,
      enabled: setting?.enabled ?? true,
      stats,
    });
  }
  return result;
}

// Auto-classify a component type from its imported stats.
// Picks the dominant stat among ATK/DEF/STA, otherwise balance.
export function autoTypeFromStats(stats: Record<string, number>): BeyType {
  const atk = stats["ATK"] ?? 0;
  const def = stats["DEF"] ?? 0;
  const sta = stats["STA"] ?? 0;
  const max = Math.max(atk, def, sta);
  if (max <= 0) return "balance";
  const leaders: BeyType[] = [];
  if (atk === max) leaders.push("attack");
  if (def === max) leaders.push("defense");
  if (sta === max) leaders.push("stamina");
  return leaders.length === 1 ? leaders[0] : "balance";
}

// ---------------------------------------------------------------------------
// Assembly / battle helpers
// ---------------------------------------------------------------------------
export const resolveBeyType = (parts: CatalogComponent[]): BeyType => {
  const counts: Record<BeyType, number> = { attack: 0, defense: 0, stamina: 0, balance: 0 };
  parts.forEach((p) => { counts[p.bey_type]++; });
  const max = Math.max(...Object.values(counts));
  const winners = (Object.keys(counts) as BeyType[]).filter((k) => counts[k] === max);
  return winners.length === 1 ? winners[0] : "balance";
};

export const sumStats = (parts: CatalogComponent[]): Record<string, number> => {
  const out: Record<string, number> = {};
  parts.forEach((p) => {
    Object.entries(p.stats).forEach(([k, v]) => {
      out[k] = (out[k] ?? 0) + v;
    });
  });
  return out;
};

const cardsFor = (type: BeyType, prefix: string, dmgBonus = 0): MoveCard[] => {
  const b = Math.round(dmgBonus);
  switch (type) {
    case "attack":
      return [
        { id: `${prefix}-1`, name: "Affondo", cost: 1, damage: 6 + b },
        { id: `${prefix}-2`, name: "Carica", cost: 3, damage: 16 + b },
        { id: `${prefix}-3`, name: "Spirale Letale", cost: 5, damage: 28 + b },
        { id: `${prefix}-4`, name: "Onda d'Urto", cost: 4, damage: 18 + b, effect: "stun", effectValue: 1 },
      ];
    case "defense":
      return [
        { id: `${prefix}-1`, name: "Colpo Solido", cost: 2, damage: 8 + b },
        { id: `${prefix}-2`, name: "Muraglia", cost: 3, damage: 4, effect: "shield", effectValue: 18 },
        { id: `${prefix}-3`, name: "Contraccolpo", cost: 4, damage: 20 + b },
        { id: `${prefix}-4`, name: "Riparazione", cost: 4, damage: 0, effect: "heal", effectValue: 22 },
      ];
    case "stamina":
      return [
        { id: `${prefix}-1`, name: "Vortice", cost: 1, damage: 5 + b },
        { id: `${prefix}-2`, name: "Spin Eterno", cost: 4, damage: 14 + b, effect: "heal", effectValue: 12 },
        { id: `${prefix}-3`, name: "Tornado", cost: 5, damage: 22 + b },
        { id: `${prefix}-4`, name: "Drenaggio", cost: 3, damage: 10 + b, effect: "heal", effectValue: 8 },
      ];
    case "balance":
    default:
      return [
        { id: `${prefix}-1`, name: "Jab", cost: 1, damage: 7 + b },
        { id: `${prefix}-2`, name: "Colpo Misurato", cost: 3, damage: 14 + b },
        { id: `${prefix}-3`, name: "Perno", cost: 4, damage: 18 + b, effect: "shield", effectValue: 8 },
        { id: `${prefix}-4`, name: "Spin Surge", cost: 5, damage: 24 + b },
      ];
  }
};

const BASE_HP: Record<BeyType, number> = { attack: 90, defense: 140, stamina: 110, balance: 115 };
const BASE_STAMINA: Record<BeyType, number> = { attack: 60, defense: 80, stamina: 130, balance: 90 };

export type BeyParts = Partial<Record<SlotKind, CatalogComponent | null>>;

export interface BattleStats {
  attack: number;
  defense: number;
  burstRes: number;
  stamina: number;
}

export interface AssembledBey {
  position: number;
  series: BeySeries;
  ratchetMode: RatchetMode;
  parts: BeyParts;
  type: BeyType;
  totalStats: Record<string, number>;
  battleStats: BattleStats;
  hp: number;        // burst resistance pool (used in battle as durability)
  stamina: number;   // stamina pool
  name: string;
}

export const assembleBey = (
  position: number,
  series: BeySeries,
  ratchetMode: RatchetMode,
  parts: BeyParts,
): AssembledBey => {
  const filled = Object.values(parts).filter(Boolean) as CatalogComponent[];
  const type = filled.length ? resolveBeyType(filled) : "balance";
  const totalStats = sumStats(filled);
  const battleStats: BattleStats = {
    attack: totalStats["ATK"] ?? 0,
    defense: totalStats["DEF"] ?? 0,
    burstRes: totalStats["BURST RES"] ?? 0,
    stamina: totalStats["STA"] ?? 0,
  };
  const hp = BASE_HP[type] + Math.round(battleStats.burstRes * 2.5 + battleStats.defense * 0.8);
  const stamina = BASE_STAMINA[type] + Math.round(battleStats.stamina * 3);
  const primary =
    parts.cx_over ?? parts.cx_metal ?? parts.cx_main ??
    parts.blade_ux_inf ?? parts.blade_ux ??
    parts.blade_bx_inf ?? parts.blade_bx;
  const name = primary?.name ?? `Bey ${position}`;
  return { position, series, ratchetMode, parts, type, totalStats, battleStats, hp, stamina, name };
};

export const assembledToBey = (a: AssembledBey, idx: number) => {
  const dmgBonus = Math.round(a.battleStats.attack / 6);
  // Build stacked layers for visual: bottom→top.
  // CX: assist(bottom) → main / over+metal → lock chip(top).
  // BX/UX/UX♾️/BX♾️: single blade, no stacking.
  const layers: { url: string; z: number }[] = [];
  const push = (c: any, z: number) => { if (c?.image_url) layers.push({ url: c.image_url, z }); };
  if (a.series === "CX" || a.series === "CX_INF") {
    push(a.parts.cx_assist, 1);
    if (a.series === "CX_INF") {
      push(a.parts.cx_over, 2);
      push(a.parts.cx_metal, 3);
    } else {
      push(a.parts.cx_main, 2);
    }
    push(a.parts.cx_lock_chip, 4);
  } else {
    push(a.parts.blade_bx, 1);
    push(a.parts.blade_bx_inf, 1);
    push(a.parts.blade_ux, 1);
    push(a.parts.blade_ux_inf, 1);
  }
  return {
    id: `gd-${idx}`,
    name: a.name,
    type: a.type,
    hp: a.hp,
    stamina: a.stamina,
    attackStat: a.battleStats.attack,
    defenseStat: a.battleStats.defense,
    burstResStat: a.battleStats.burstRes,
    staminaStat: a.battleStats.stamina,
    emoji: TYPE_EMOJI[a.type],
    cards: cardsFor(a.type, `gd-${idx}`, dmgBonus),
    partsImages: layers,
    series: a.series,
  } as Bey;
};

// ---------------------------------------------------------------------------
// Starter components auto-granted to every new player.
// ---------------------------------------------------------------------------
export const STARTER_COMPONENT_IDS: string[] = [
  "b78215bf-edfa-449d-9c7f-b8e7fa81124d", // Dran Sword
  "85f28f85-a92c-4c9e-9c4e-e9d1e94994f0", // Hells Scythe
  "76418cbc-5c39-4156-add2-c8238e44fbbf", // Knight Shield
  "306db5d3-e687-42ca-a17a-bf8f9d855ae4", // Wizard Arrow
  "467f4c65-a635-4ba5-9dc1-5129705ff7d2", // 3-60
  "33cb56c4-6de1-42ce-a935-7df6ab131e6b", // 4-60
  "62ea9a7c-e81b-43a5-9ca7-c8e1852bcca2", // 3-80
  "315f91f6-1e89-4f0a-b612-ba3431d00daa", // 4-80
  "20e823c2-3779-4a95-b367-79ef96a58d71", // Flat
  "9222c89b-6c7a-421e-9fb3-4441676ed77f", // Taper
  "9dc8764b-5e3a-4668-b7e8-b4a4b25cb6a8", // Needle
  "b59eeb90-cc44-4ddc-ba91-b73cfbda4d52", // Ball
];
