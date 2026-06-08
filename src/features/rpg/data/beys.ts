// MVP catalog of Beyblade cards built from generic component templates.
// Will be replaced by integration with the real deck system once approved.

export type BeyType = "attack" | "defense" | "stamina" | "balance";

export interface MoveCard {
  id: string;
  name: string;
  cost: number; // dice points required
  damage: number;
  effect?: "stun" | "heal" | "shield";
  effectValue?: number;
}

export interface BeyLayer { url: string; z: number; }

export interface Bey {
  id: string;
  name: string;
  type: BeyType;
  hp: number; // burst resistance pool
  stamina?: number; // stamina pool, drains each turn
  attackStat?: number;
  defenseStat?: number;
  burstResStat?: number;
  staminaStat?: number;
  emoji: string;
  cards: MoveCard[];
  partsImages?: BeyLayer[];
  series?: string;
}

export const BEY_CATALOG: Bey[] = [
  {
    id: "phoenix",
    name: "Phoenix Wing",
    type: "attack",
    hp: 90,
    emoji: "🔥",
    cards: [
      { id: "p1", name: "Slash", cost: 2, damage: 12 },
      { id: "p2", name: "Inferno Strike", cost: 5, damage: 28 },
      { id: "p3", name: "Burning Spin", cost: 3, damage: 16, effect: "stun", effectValue: 1 },
      { id: "p4", name: "Quick Hit", cost: 1, damage: 6 },
    ],
  },
  {
    id: "fortress",
    name: "Iron Fortress",
    type: "defense",
    hp: 140,
    emoji: "🛡️",
    cards: [
      { id: "f1", name: "Bash", cost: 2, damage: 8 },
      { id: "f2", name: "Bulwark", cost: 3, damage: 4, effect: "shield", effectValue: 15 },
      { id: "f3", name: "Counter", cost: 4, damage: 18 },
      { id: "f4", name: "Recover", cost: 4, damage: 0, effect: "heal", effectValue: 22 },
    ],
  },
  {
    id: "tempest",
    name: "Tempest Drift",
    type: "stamina",
    hp: 110,
    emoji: "🌀",
    cards: [
      { id: "s1", name: "Whirl", cost: 1, damage: 5 },
      { id: "s2", name: "Endless Spin", cost: 4, damage: 14, effect: "heal", effectValue: 10 },
      { id: "s3", name: "Cyclone", cost: 5, damage: 22 },
      { id: "s4", name: "Drain", cost: 3, damage: 10, effect: "heal", effectValue: 8 },
    ],
  },
  {
    id: "balance",
    name: "Equinox",
    type: "balance",
    hp: 115,
    emoji: "⚖️",
    cards: [
      { id: "b1", name: "Jab", cost: 1, damage: 7 },
      { id: "b2", name: "Steady Blow", cost: 3, damage: 14 },
      { id: "b3", name: "Pivot Strike", cost: 4, damage: 19, effect: "shield", effectValue: 8 },
      { id: "b4", name: "Spin Surge", cost: 5, damage: 24 },
    ],
  },
  {
    id: "venom",
    name: "Venom Fang",
    type: "attack",
    hp: 85,
    emoji: "🐍",
    cards: [
      { id: "v1", name: "Bite", cost: 2, damage: 11 },
      { id: "v2", name: "Toxic Spin", cost: 4, damage: 18, effect: "stun", effectValue: 1 },
      { id: "v3", name: "Lash Out", cost: 3, damage: 15 },
      { id: "v4", name: "Final Strike", cost: 6, damage: 32 },
    ],
  },
  {
    id: "golem",
    name: "Stone Golem",
    type: "defense",
    hp: 150,
    emoji: "🗿",
    cards: [
      { id: "g1", name: "Slam", cost: 2, damage: 9 },
      { id: "g2", name: "Rock Wall", cost: 3, damage: 0, effect: "shield", effectValue: 22 },
      { id: "g3", name: "Crush", cost: 5, damage: 24 },
      { id: "g4", name: "Mend", cost: 3, damage: 0, effect: "heal", effectValue: 18 },
    ],
  },
];

export const getBey = (id: string) => BEY_CATALOG.find((b) => b.id === id)!;
