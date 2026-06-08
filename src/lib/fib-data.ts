// ============================================================
// FIB — DATI MOCK isolati (UI-only) usati SOLO come fallback.
// I dati reali arrivano in sola lettura da Supabase via
// src/components/fib/useFibHomeData.ts (stesse query della home).
// I numeri qui replicano gli screenshot per fedelta' del mockup.
// ============================================================

export type Stat = { key: string; label: string; value: number; icon: 'users' | 'shield' | 'pin' | 'trophy' };
export type Player = { rank: number; name: string; club?: string; city?: string; points: number; verified?: boolean };
export type Club = { id: string; name: string; city: string; members: number; logoUrl?: string | null };
export type Tournament = {
  id: string; day: string; month: string; name: string;
  kind: 'Nazionale' | 'Regionale' | 'Club' | 'Unranked';
  city: string; entrants: number; open: boolean;
};

export const fibStats: Stat[] = [
  { key: 'bladers', label: 'Bladers registrati', value: 4199, icon: 'users' },
  { key: 'clubs', label: 'Club attivi', value: 143, icon: 'shield' },
  { key: 'regions', label: 'Regioni', value: 19, icon: 'pin' },
  { key: 'tournaments', label: 'Tornei 2026', value: 654, icon: 'trophy' },
];

// Top 3 per il podio (1° al centro, con glow viola)
export const fibPodium: Player[] = [
  { rank: 2, name: 'BladerF', club: 'Casoria Bladers', city: 'Casoria', points: 260 },
  { rank: 1, name: 'GHOST__23', club: 'Royal Blade', city: 'Roma', points: 268, verified: true },
  { rank: 3, name: 'Freud911', club: 'Royal Blade', city: 'Roma', points: 260 },
];

export const fibClubs: Club[] = [
  { id: 'royal', name: 'Royal Blade', city: 'Roma', members: 45 },
  { id: 'casoria', name: 'Casoria Bladers', city: 'Casoria', members: 38 },
  { id: 'catania', name: 'Catania Spinners', city: 'Catania', members: 41 },
];

export const fibTournaments: Tournament[] = [
  { id: 'roma', day: '24', month: 'MAG', name: 'Roma Open', kind: 'Nazionale', city: 'Roma (RM)', entrants: 128, open: true },
  { id: 'sicily', day: '07', month: 'GIU', name: 'Sicily Clash', kind: 'Regionale', city: 'Catania (CT)', entrants: 96, open: true },
];

export const fibSeason = {
  year: new Date().getFullYear(),
  status: 'IN CORSO',
  // 0..11, mese corrente evidenziato
  currentMonth: new Date().getMonth(),
  months: ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'],
};

export const fibProfile = {
  name: 'GengisChad',
  rank: 144,
  coins: 140,
  notifications: 3,
};
