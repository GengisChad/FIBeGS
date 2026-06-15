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

const ARENA_NAMES = [
  "Arena del Novizio",
  "Stadio del Vento",
  "Cripta di Pietra",
  "Vulcano Ardente",
  "Torneo dei Campioni",
  "Cintura Xtreme",
  "Circuito Notturno",
  "Colosseo del Metallo",
  "Hangar Zero-G",
  "Finale Infinita",
];

const seededPick = <T,>(items: T[], seed: number) => items[Math.abs(seed) % items.length];

export const getRunLevel = (id: number): Level => {
  const safeId = Math.max(1, Math.floor(id) || 1);
  const fixed = LEVELS.find((l) => l.id === safeId);
  if (fixed) return fixed;

  const chapter = Math.floor((safeId - 1) / ARENA_NAMES.length) + 1;
  const baseName = seededPick(ARENA_NAMES, safeId - 1);
  const currency = 50 + Math.floor(Math.pow(safeId, 1.12) * 22);
  const gachaPoints = 1 + Math.floor(safeId / 4);
  const xp = 20 + safeId * 10;

  return {
    id: safeId,
    name: `${baseName} ${chapter}`,
    enemyDeck: [],
    reward: { currency, gachaPoints, xp },
  };
};
