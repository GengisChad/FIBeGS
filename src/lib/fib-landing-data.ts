// Dati MOCK isolati per il landing B (Direzione B). Solo UI.
// TODO (sola lettura): mappare a Supabase via le query gia' esistenti, come per la Direzione A.
export type Stat = { key: string; label: string; value: number; icon: "users" | "shield" | "pin" | "trophy"; premium?: boolean };
export type Club = { id: string; name: string; city: string; ring: string; featured?: boolean };
export type Player = { rank: number; name: string; city: string; points: number };
export type Service = { label: string; icon: "pin" | "gear" | "stream" | "shop" | "qr"; group: "arene" | "media" };

export const stats: Stat[] = [
  { key: "bladers", label: "Bladers registrati", value: 4199, icon: "users", premium: true },
  { key: "clubs", label: "Club attivi", value: 143, icon: "shield" },
  { key: "regions", label: "Regioni attive", value: 19, icon: "pin" },
  { key: "tournaments", label: "Tornei 2026", value: 654, icon: "trophy" },
];

export const clubs: Club[] = [
  { id: "reali", name: "Reali", city: "Bari", ring: "#b64bff" },
  { id: "ghost", name: "GHOST__23", city: "Reina", ring: "#b64bff" },
  { id: "mist", name: "Mistirious reaper", city: "Casoria", ring: "#7a2cff" },
  { id: "gengis", name: "GengisChad", city: "Roma", ring: "#a6ff00", featured: true },
  { id: "freud", name: "_Freud911", city: "Casandrino", ring: "#7a2cff" },
  { id: "marsh", name: "Marshxq20", city: "Napoli", ring: "#3fd0ff" },
  { id: "nion", name: "Nion", city: "Catania", ring: "#a6ff00" },
];

export const leaderboard: Player[] = [
  { rank: 1, name: "GHOST__23", city: "Roma", points: 268 },
  { rank: 2, name: "BladerF", city: "Casoria", points: 260 },
  { rank: 3, name: "Freud911", city: "Roma", points: 260 },
  { rank: 4, name: "Mistirious reaper", city: "Casoria", points: 256 },
  { rank: 5, name: "_Tronky_", city: "Catania", points: 252 },
  { rank: 6, name: "Marshxq120", city: "Casandrino", points: 252 },
  { rank: 7, name: "Nonnechik99", city: "Napoli", points: 248 },
  { rank: 8, name: "Emapan13", city: "Catania", points: 244 },
  { rank: 9, name: "Camistar", city: "Bologna", points: 240 },
  { rank: 10, name: "Il_mitico_ulisse", city: "Napoli", points: 236 },
];

export const nextEvent = {
  place: "OFFTIME Arena, Roma",
  date: "Domenica 14 Giugno, 2026",
  checkin: "10:00",
  startsInSeconds: 3 * 3600 + 14 * 60, // countdown demo
};

export const services: Service[] = [
  { label: "OFFTIME", icon: "pin", group: "arene" },
  { label: "18 Centri", icon: "pin", group: "arene" },
  { label: "Reodlator", icon: "gear", group: "arene" },
  { label: "Streaming Zone", icon: "stream", group: "media" },
  { label: "Shop", icon: "shop", group: "media" },
  { label: "Check-in QR", icon: "qr", group: "media" },
];
