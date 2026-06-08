/**
 * Lightweight localStorage persister for react-query.
 * Caches specific query keys to avoid re-fetching on app reload.
 * Reduces Supabase egress significantly for data that rarely changes.
 */

const CACHE_PREFIX = "rq_cache_";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour default

interface CacheEntry<T = unknown> {
  data: T;
  ts: number; // timestamp
}

/** Persistable query keys and their max-age in ms */
const PERSIST_CONFIG: Record<string, number> = {
  // Practically immutable
  regions: 7 * 24 * 60 * 60 * 1000,            // 7d
  municipalities: 7 * 24 * 60 * 60 * 1000,     // 7d
  // Admin-managed catalog data
  "collection-catalog": 6 * 60 * 60 * 1000,    // 6h
  "forum-stickers": 7 * 24 * 60 * 60 * 1000,   // 7d
  "competitive-settings": 24 * 60 * 60 * 1000, // 24h
  badges: 24 * 60 * 60 * 1000,                 // 24h
  "achievements-catalog": 24 * 60 * 60 * 1000, // 24h
  "faq-history": 7 * 24 * 60 * 60 * 1000,      // 7d
  "faq-supporters": 24 * 60 * 60 * 1000,       // 24h
  "media-categories": 24 * 60 * 60 * 1000,     // 24h
  "media-seasons": 12 * 60 * 60 * 1000,        // 12h
  // Semi-dynamic
  "rankings-data-v8": 15 * 60 * 1000,          // 15min
  "ranking-seasons": 6 * 60 * 60 * 1000,       // 6h
  "clubs-list": 2 * 60 * 60 * 1000,            // 2h
  "club-member-counts": 60 * 60 * 1000,        // 1h
  "active-tournaments": 5 * 60 * 1000,         // 5min
  "completed-tournaments": 2 * 60 * 60 * 1000, // 2h
  "ibna-events": 30 * 60 * 1000,               // 30min
  "tournaments-preview": 5 * 60 * 1000,        // 5min
  "leaderboard-widget": 30 * 60 * 1000,        // 30min
  "news-feed": 15 * 60 * 1000,                 // 15min
  "instagram-feed": 60 * 60 * 1000,            // 1h
  "active-clubs": 60 * 60 * 1000,              // 1h
  "guides-list": 12 * 60 * 60 * 1000,          // 12h
  "rules-list": 24 * 60 * 60 * 1000,           // 24h
};

export function shouldPersist(queryKey: readonly unknown[]): boolean {
  const key = String(queryKey[0]);
  return key in PERSIST_CONFIG;
}

export function getMaxAge(queryKey: readonly unknown[]): number {
  const key = String(queryKey[0]);
  return PERSIST_CONFIG[key] ?? MAX_AGE_MS;
}

export function getCached<T>(queryKey: readonly unknown[]): T | undefined {
  const key = String(queryKey[0]);
  if (!PERSIST_CONFIG[key]) return undefined;
  
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > PERSIST_CONFIG[key]) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

export function setCache<T>(queryKey: readonly unknown[], data: T): void {
  const key = String(queryKey[0]);
  if (!PERSIST_CONFIG[key]) return;
  
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable - silently fail
  }
}

/** Clear all persisted query caches */
export function clearQueryCache(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
  keys.forEach(k => localStorage.removeItem(k));
}
