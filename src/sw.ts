/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Workbox precaching (injected by vite-plugin-pwa)
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Allow the page to trigger immediate activation of a waiting SW (used by UpdateAvailableBanner).
self.addEventListener('message', (event) => {
  if ((event as ExtendableMessageEvent).data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- Runtime caching strategies ---

// Supabase Storage images — large persistent cache. purgeOnQuotaError handles browser quotas.
registerRoute(
  /^https:\/\/zhqxwcnnyqrlizlowtgd\.supabase\.co\/storage\/v1\/(?:object|render)\/.*/i,
  new CacheFirst({
    cacheName: 'supabase-images-v3',
    plugins: [
      new ExpirationPlugin({ maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 90, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    matchOptions: { ignoreVary: true },
  })
);

// External images
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
  new CacheFirst({
    cacheName: 'external-images-v2',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Avatars / user-uploaded media via Supabase signed URLs (covered above by storage rule)

// Giphy media
registerRoute(
  /^https:\/\/media[0-9]*\.giphy\.com\/.*/i,
  new CacheFirst({
    cacheName: 'giphy-media',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Google Fonts
registerRoute(
  /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Supabase API - aggressive caching for read-heavy / mostly-static endpoints
registerRoute(
  /^https:\/\/zhqxwcnnyqrlizlowtgd\.supabase\.co\/rest\/v1\/(regions|municipalities|collection_categories|collection_components|collection_component_variants|collection_component_stats|collection_component_links|collection_variant_links|badges|achievements|forum_stickers|faq_history_entries|faq_supporters_public|competitive_settings|media_categories|media_seasons|guides|rules|judge_courses|judge_course_steps)/i,
  new CacheFirst({
    cacheName: 'supabase-static-api-v2',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 12, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Stale-while-revalidate-ish (NetworkFirst with timeout) for semi-dynamic listings
registerRoute(
  /^https:\/\/zhqxwcnnyqrlizlowtgd\.supabase\.co\/rest\/v1\/(clubs|tournaments|championships|events|news|ibna_events|profiles_public)/i,
  new NetworkFirst({
    cacheName: 'supabase-listings-v1',
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 30, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Do not runtime-cache dynamic Supabase REST data: tournament registrations,
// payments, profiles, and match state must always reflect the live database.

// --- Push Notification Handling ---

// Visual style per notification type. Mirror of src/lib/notificationStyles.ts
// (keep in sync — SW cannot import TS modules with lucide deps).
const PUSH_STYLES: Record<string, { emoji: string; color: string }> = {
  badge_earned:       { emoji: "🏅", color: "#eab308" },
  achievement_earned: { emoji: "✨", color: "#f59e0b" },
  club_tournament:    { emoji: "⚔️", color: "#dc2626" },
  match_ready:        { emoji: "🎮", color: "#ef4444" },
  staff_announcement: { emoji: "📢", color: "#3b82f6" },
  announcement:       { emoji: "📣", color: "#3b82f6" },
  ranking_record:     { emoji: "🏆", color: "#10b981" },
  market_like:        { emoji: "💗", color: "#ec4899" },
  deck_like:          { emoji: "👍", color: "#8b5cf6" },
  club_invite:        { emoji: "🤝", color: "#06b6d4" },
  club_approved:      { emoji: "✅", color: "#22c55e" },
  parent_request:     { emoji: "👨‍👦", color: "#6366f1" },
  forum_reply:        { emoji: "💬", color: "#14b8a6" },
  mention:            { emoji: "@",  color: "#d946ef" },
  report:             { emoji: "⚠️", color: "#f97316" },
};

self.addEventListener('push', (event) => {
  let data = {
    title: 'FIB',
    body: 'Hai una nuova notifica',
    data: {} as Record<string, any>,
    type: '' as string,
    image: '' as string,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data.title = parsed.title || data.title;
      data.body = parsed.body || data.body;
      data.data = parsed.data || {};
      data.type = parsed.type || parsed.data?.type || '';
      data.image = parsed.image || parsed.data?.image || '';
    }
  } catch {
    try {
      if (event.data) {
        data.body = event.data.text();
      }
    } catch {}
  }

  const style = PUSH_STYLES[data.type] || { emoji: '🔔', color: '#dc2626' };
  // Prepend emoji to title only if it isn't already present
  const decoratedTitle = data.title.startsWith(style.emoji)
    ? data.title
    : `${style.emoji} ${data.title}`;

  const isPrivate = data.type === 'private_message';
  const replyEnabled = isPrivate && (data.data as any)?.reply_enabled === 'true';

  const actions: Array<{ action: string; title: string; type?: string; placeholder?: string }> = [];
  if (replyEnabled) {
    actions.push({ action: 'reply', type: 'text', title: 'Rispondi', placeholder: 'Scrivi un messaggio…' });
    actions.push({ action: 'open', title: 'Apri chat' });
  }

  const options: NotificationOptions & {
    image?: string;
    vibrate?: number[];
    renotify?: boolean;
    actions?: Array<{ action: string; title: string; type?: string; placeholder?: string }>;
  } = {
    body: data.body,
    icon: '/notification-large.png',
    badge: '/notification-icon.png',
    image: data.image || undefined,
    vibrate: [200, 100, 200],
    data: { ...data.data, type: data.type, accent: style.color },
    tag: isPrivate ? `ibna-chat-${(data.data as any)?.chat_id || 'x'}` : `ibna-${data.type || 'generic'}-${Date.now()}`,
    renotify: true,
    requireInteraction: data.type === 'match_ready' || data.type === 'club_invite',
    actions: actions.length > 0 ? actions : undefined,
  };

  event.waitUntil(
    self.registration.showNotification(decoratedTitle, options as NotificationOptions)
  );
});

// --- Auth token storage (synced from the page so SW can act on the user's behalf) ---
const AUTH_IDB = 'ibna_sw_auth';
const AUTH_STORE = 'auth';
function openAuthDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(AUTH_IDB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(AUTH_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
type StoredSession = { access_token?: string; refresh_token?: string; expires_at?: number; user_id?: string };
async function readSession(): Promise<StoredSession | null> {
  const db = await openAuthDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(AUTH_STORE, 'readonly').objectStore(AUTH_STORE).get('session');
    tx.onsuccess = () => resolve((tx.result as StoredSession) || null);
    tx.onerror = () => resolve(null);
  });
}
async function writeSession(s: StoredSession): Promise<void> {
  const db = await openAuthDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(AUTH_STORE, 'readwrite');
    tx.objectStore(AUTH_STORE).put(s, 'session');
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
async function getAuthToken(): Promise<string | null> {
  const s = await readSession();
  if (!s?.access_token) { console.warn('[SW] no session in IDB'); return null; }
  const valid = !s.expires_at || Date.now() / 1000 < s.expires_at - 30;
  if (valid) return s.access_token;
  if (!s.refresh_token) { console.warn('[SW] token expired, no refresh_token'); return null; }
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok) { console.warn('[SW] refresh failed', r.status); return null; }
    const j = await r.json();
    const next: StoredSession = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at,
      user_id: s.user_id,
    };
    await writeSession(next);
    return j.access_token as string;
  } catch (e) {
    console.warn('[SW] refresh threw', e);
    return null;
  }
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data;
  if (msg?.type === 'AUTH_SYNC') {
    event.waitUntil((async () => {
      const db = await openAuthDb();
      if (!db) return;
      const tx = db.transaction(AUTH_STORE, 'readwrite');
      tx.objectStore(AUTH_STORE).put(msg.session, 'session');
    })());
  } else if (msg?.type === 'AUTH_CLEAR') {
    event.waitUntil((async () => {
      const db = await openAuthDb();
      if (!db) return;
      const tx = db.transaction(AUTH_STORE, 'readwrite');
      tx.objectStore(AUTH_STORE).delete('session');
    })());
  }
});

const SUPABASE_URL = 'https://zhqxwcnnyqrlizlowtgd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocXh3Y25ueXFybGl6bG93dGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjE4ODAsImV4cCI6MjA5MTM5Nzg4MH0.r6YQZgfRIRSOGBiZCb7HvLR8cnpX3QXRlxR-owBdLO4';

async function focusOrOpen(url: string): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clients) {
    if ('focus' in c) {
      try { await (c as WindowClient).navigate(url); } catch {}
      return void (c as WindowClient).focus();
    }
  }
  await self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  const ev = event as NotificationEvent & { reply?: string };
  const notifData = (event.notification.data || {}) as any;
  const urlToOpen: string = notifData.url || '/';
  const chatId: string | undefined = notifData.chat_id;

  // Inline reply (Chrome Android / Chrome desktop)
  if (event.action === 'reply' && ev.reply && chatId) {
    event.notification.close();
    const replyText = ev.reply.toString();
    event.waitUntil((async () => {
      console.log('[SW] inline reply received, chat', chatId, 'len', replyText.length);
      const token = await getAuthToken();
      if (!token) {
        console.warn('[SW] no token → fallback to open chat');
        const u = new URL(urlToOpen, self.location.origin);
        u.searchParams.set('prefill', replyText);
        await self.registration.showNotification('⚠️ Apri l\'app per inviare', {
          body: 'Sessione scaduta — tocca per aprire la chat e completare l\'invio.',
          icon: '/notification-large.png',
          badge: '/notification-icon.png',
          tag: `ibna-chat-${chatId}-failed`,
          data: { url: u.pathname + u.search, chat_id: chatId },
        } as NotificationOptions);
        return;
      }
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-private-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_ANON,
          },
          body: JSON.stringify({ chat_id: chatId, text: replyText }),
        });
        console.log('[SW] send-private-reply status', resp.status);
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          console.warn('[SW] reply failed', resp.status, errText);
          const u = new URL(urlToOpen, self.location.origin);
          u.searchParams.set('prefill', replyText);
          await self.registration.showNotification('⚠️ Risposta non inviata', {
            body: 'Tocca per aprire la chat e riprovare.',
            icon: '/notification-large.png',
            badge: '/notification-icon.png',
            tag: `ibna-chat-${chatId}-failed`,
            data: { url: u.pathname + u.search, chat_id: chatId },
          } as NotificationOptions);
          return;
        }
        await self.registration.showNotification('✅ Risposta inviata', {
          body: replyText.length > 80 ? replyText.slice(0, 77) + '…' : replyText,
          icon: '/notification-large.png',
          badge: '/notification-icon.png',
          tag: `ibna-chat-${chatId}-sent`,
          silent: true,
        } as NotificationOptions);
      } catch (e) {
        console.error('[SW] reply threw', e);
        const u = new URL(urlToOpen, self.location.origin);
        u.searchParams.set('prefill', replyText);
        await self.registration.showNotification('⚠️ Risposta non inviata', {
          body: 'Errore di rete — tocca per aprire la chat.',
          icon: '/notification-large.png',
          badge: '/notification-icon.png',
          tag: `ibna-chat-${chatId}-failed`,
          data: { url: u.pathname + u.search, chat_id: chatId },
        } as NotificationOptions);
      }
    })());
    return;
  }

  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});
