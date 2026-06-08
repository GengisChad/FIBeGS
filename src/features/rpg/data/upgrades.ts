export interface Upgrade {
  id: string;
  name: string;
  description: string;
  apply: (mods: RunMods) => RunMods;
}

export interface RunMods {
  extraDice: number;
  bonusDamage: number;
  bonusShield: number;
  bonusHpPercent: number; // applied at battle start
  costReduction: number;
  healBetweenBeys: number; // % heal next bey when one falls
}

export const initialMods: RunMods = {
  extraDice: 0,
  bonusDamage: 0,
  bonusShield: 0,
  bonusHpPercent: 0,
  costReduction: 0,
  healBetweenBeys: 0,
};

export const UPGRADE_POOL: Upgrade[] = [
  { id: "dice", name: "Dado Extra", description: "+1 dado per turno", apply: (m) => ({ ...m, extraDice: m.extraDice + 1 }) },
  { id: "dmg", name: "Lama Affilata", description: "+3 danni ad ogni carta", apply: (m) => ({ ...m, bonusDamage: m.bonusDamage + 3 }) },
  { id: "shield", name: "Corazza", description: "+5 scudo iniziale", apply: (m) => ({ ...m, bonusShield: m.bonusShield + 5 }) },
  { id: "hp", name: "Anima Forte", description: "+15% HP per ogni bey", apply: (m) => ({ ...m, bonusHpPercent: m.bonusHpPercent + 15 }) },
  { id: "cost", name: "Efficienza", description: "-1 costo carte (min 1)", apply: (m) => ({ ...m, costReduction: m.costReduction + 1 }) },
  { id: "heal", name: "Rigenerazione", description: "Cura 30% del prossimo bey", apply: (m) => ({ ...m, healBetweenBeys: m.healBetweenBeys + 30 }) },
];

export function pickRandomUpgrades(n = 3): Upgrade[] {
  const pool = [...UPGRADE_POOL];
  const out: Upgrade[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
