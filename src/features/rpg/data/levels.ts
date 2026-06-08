import { BEY_CATALOG } from "./beys";

export interface Level {
  id: number;
  name: string;
  enemyDeck: string[]; // bey ids
  reward: { currency: number; gachaPoints: number; xp: number };
}

export const LEVELS: Level[] = [
  { id: 1, name: "Arena del Novizio", enemyDeck: ["balance", "tempest", "fortress"], reward: { currency: 50, gachaPoints: 1, xp: 20 } },
  { id: 2, name: "Stadio del Vento", enemyDeck: ["venom", "balance", "tempest"], reward: { currency: 80, gachaPoints: 1, xp: 30 } },
  { id: 3, name: "Cripta di Pietra", enemyDeck: ["golem", "fortress", "balance"], reward: { currency: 120, gachaPoints: 1, xp: 40 } },
  { id: 4, name: "Vulcano Ardente", enemyDeck: ["phoenix", "venom", "phoenix"], reward: { currency: 160, gachaPoints: 2, xp: 50 } },
  { id: 5, name: "Torneo dei Campioni", enemyDeck: ["phoenix", "golem", "venom"], reward: { currency: 250, gachaPoints: 2, xp: 70 } },
];

export const MAX_LEVEL = LEVELS.length;
export const ALL_BEY_IDS = BEY_CATALOG.map((b) => b.id);
