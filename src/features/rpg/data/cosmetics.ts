// Cosmetic catalog for the RPG character. Each option has an id, a gender
// availability flag, an optional shop price (0 = base, included with new PG),
// an optional era (past / modern / future) for outfits, and a color/SVG hint.

export type Gender = "male" | "female";
export type Era = "past" | "modern" | "future";

export interface Cosmetic {
  id: string;
  label: string;
  gender: "any" | Gender;
  price: number; // 0 means base / free
  color?: string;
  era?: Era; // mainly for outfits
}

export const HAIR: Cosmetic[] = [
  // Male
  { id: "short_dark", label: "Corti scuri", gender: "male", price: 0, color: "#2a1a0d" },
  { id: "short_blonde", label: "Corti biondi", gender: "male", price: 80, color: "#e6c97a" },
  { id: "spiky_red", label: "A spuntoni rossi", gender: "male", price: 150, color: "#c0392b" },
  { id: "buzz_white", label: "Rasati bianchi", gender: "male", price: 200, color: "#e8e8e8" },
  { id: "mohawk_cyan", label: "Mohawk cyan", gender: "male", price: 260, color: "#22d3ee" },
  // Female
  { id: "long_dark", label: "Lunghi scuri", gender: "female", price: 0, color: "#2a1a0d" },
  { id: "twin_pink", label: "Codini rosa", gender: "female", price: 150, color: "#ff4fa3" },
  { id: "bob_blonde", label: "Caschetto biondo", gender: "female", price: 80, color: "#e6c97a" },
  { id: "ponytail_purple", label: "Coda viola", gender: "female", price: 200, color: "#7c3aed" },
  { id: "braids_silver", label: "Trecce argentee", gender: "female", price: 260, color: "#cbd5e1" },
];

export const EYES: Cosmetic[] = [
  { id: "brown", label: "Castani", gender: "any", price: 0, color: "#5a3520" },
  { id: "blue", label: "Azzurri", gender: "any", price: 50, color: "#2a8fd6" },
  { id: "green", label: "Verdi", gender: "any", price: 50, color: "#2ecc71" },
  { id: "red", label: "Rossi", gender: "any", price: 120, color: "#e74c3c" },
  { id: "gold", label: "Oro", gender: "any", price: 200, color: "#f1c40f" },
];

export const SKIN: Cosmetic[] = [
  { id: "fair", label: "Chiara", gender: "any", price: 0, color: "#f7d8b3" },
  { id: "tan", label: "Ambrata", gender: "any", price: 0, color: "#d9a577" },
  { id: "dark", label: "Scura", gender: "any", price: 0, color: "#8a5a3b" },
  { id: "pale", label: "Pallida", gender: "any", price: 0, color: "#f3e6d8" },
];

export const OUTFITS: Cosmetic[] = [
  // Base
  { id: "tunic_blue", label: "Tunica blu (base M)", gender: "male", price: 0, color: "#2a6fc9", era: "modern" },
  { id: "tunic_pink", label: "Tunica rosa (base F)", gender: "female", price: 0, color: "#d96a9c", era: "modern" },

  // ── MALE — Past
  { id: "m_past_samurai", label: "Samurai (passato)", gender: "male", price: 280, color: "#8b1e1e", era: "past" },
  { id: "m_past_knight", label: "Cavaliere medievale", gender: "male", price: 300, color: "#94a3b8", era: "past" },
  // ── MALE — Modern
  { id: "m_modern_jacket", label: "Giacca urbana", gender: "male", price: 180, color: "#1f2937", era: "modern" },
  { id: "m_modern_streetwear", label: "Streetwear hype", gender: "male", price: 220, color: "#f97316", era: "modern" },
  // ── MALE — Future
  { id: "m_future_cyber", label: "Tuta cyber", gender: "male", price: 340, color: "#0ea5e9", era: "future" },
  { id: "m_future_mech", label: "Esoscheletro mech", gender: "male", price: 420, color: "#475569", era: "future" },

  // ── FEMALE — Past
  { id: "f_past_kimono", label: "Kimono di seta", gender: "female", price: 280, color: "#be185d", era: "past" },
  { id: "f_past_noble", label: "Abito nobiliare", gender: "female", price: 300, color: "#7e22ce", era: "past" },
  // ── FEMALE — Modern
  { id: "f_modern_chic", label: "Look chic", gender: "female", price: 180, color: "#0f172a", era: "modern" },
  { id: "f_modern_idol", label: "Idol pop", gender: "female", price: 220, color: "#ec4899", era: "modern" },
  // ── FEMALE — Future
  { id: "f_future_neon", label: "Neon racer", gender: "female", price: 340, color: "#a855f7", era: "future" },
  { id: "f_future_holo", label: "Holo armor", gender: "female", price: 420, color: "#14b8a6", era: "future" },

  // Legacy unisex (kept for backward compat with existing owned items)
  { id: "armor_silver", label: "Armatura argento", gender: "any", price: 250, color: "#bdc3c7", era: "past" },
  { id: "ninja_black", label: "Tuta ninja", gender: "any", price: 300, color: "#1a1a1a", era: "past" },
  { id: "hero_red", label: "Eroe rosso", gender: "any", price: 220, color: "#e74c3c", era: "modern" },
  { id: "mage_purple", label: "Veste del mago", gender: "any", price: 280, color: "#7e3a91", era: "past" },
  { id: "champion_gold", label: "Campione d'oro", gender: "any", price: 500, color: "#f1c40f", era: "future" },
];

export const ALL_COSMETICS: Cosmetic[] = [...HAIR, ...EYES, ...SKIN, ...OUTFITS];

export const findCosmetic = (id: string) => ALL_COSMETICS.find((c) => c.id === id);

// Base cosmetics that every new character owns for free
export const BASE_OWNED = ALL_COSMETICS.filter((c) => c.price === 0).map((c) => c.id);

export const isOwned = (owned: string[], id: string) => {
  const c = findCosmetic(id);
  if (!c) return false;
  if (c.price === 0) return true;
  return owned.includes(id);
};

export const filterByGender = (list: Cosmetic[], gender: Gender) =>
  list.filter((c) => c.gender === "any" || c.gender === gender);

export const filterByEra = (list: Cosmetic[], era: Era | "all") =>
  era === "all" ? list : list.filter((c) => c.era === era);
