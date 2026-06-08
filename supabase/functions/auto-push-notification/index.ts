import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore npm specifier
import webpush from "https://esm.sh/web-push@3.6.7";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

function toBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer as ArrayBuffer;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// --- FCM v1 helpers ---

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createSignedJwt(sa: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const headerB64 = base64url(toBuffer(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))));
  const payloadB64 = base64url(toBuffer(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri, iat: now, exp: now + 3600,
  }))));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const keyData = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(unsignedToken));
  return `${unsignedToken}.${base64url(toBuffer(new Uint8Array(signature)))}`;
}

async function getAccessToken(sa: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const jwt = await createSignedJwt(sa);
  const resp = await fetch(sa.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!resp.ok) throw new Error(`Access token failed: ${resp.status}`);
  return (await resp.json()).access_token;
}

// Visual style per notification type for FCM/web push
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

async function sendFcmV1(
  projectId: string,
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  notifType: string,
  data?: Record<string, string>,
): Promise<boolean> {
  const style = PUSH_STYLES[notifType] || { emoji: "🔔", color: "#dc2626" };
  const decoratedTitle = title.startsWith(style.emoji) ? title : `${style.emoji} ${title}`;

  const message: any = {
    message: {
      token: fcmToken,
      notification: { title: decoratedTitle, body },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'default',
          sound: 'default',
          default_vibrate_timings: true,
          icon: 'ic_notification', // monochrome small icon in android res/drawable
          color: style.color,
          notification_priority: 'PRIORITY_HIGH',
        },
      },
    },
  };
  if (data && Object.keys(data).length > 0) {
    message.message.data = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  }
  const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!resp.ok) { console.error(`FCM error: ${resp.status} ${await resp.text()}`); return false; }
  await resp.text();
  return true;
}

// --- Main handler: batch process pending push notifications ---

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const internalSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // No additional auth check: Supabase platform already requires a valid JWT
    // (anon key is sent by the pg_cron schedule). The function only flushes
    // pre-existing notifications via the service role; it does not accept user input.

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID');

    const serviceClient = createClient(SUPABASE_URL, internalSecret);

    // Auto-expire notifications older than 24h so the queue never gets stuck on a backlog
    await serviceClient
      .from('notifications')
      .update({ push_sent: true })
      .eq('push_eligible', true)
      .eq('push_sent', false)
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Fetch up to 200 unsent notifications that are eligible for push.
    // Process NEWEST FIRST: a recent notification is far more useful than an old one,
    // and this prevents new notifications from being starved by an existing backlog.
    const { data: pending, error: fetchErr } = await serviceClient
      .from('notifications')
      .select('id, user_id, type, title, message, link')
      .eq('push_sent', false)
      .eq('push_eligible', true)
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchErr) {
      console.error('Fetch error:', fetchErr.message);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mark as sent immediately to prevent re-processing
    const pendingIds = pending.map(n => n.id);
    await serviceClient.from('notifications').update({ push_sent: true }).in('id', pendingIds);

    // Get unique user IDs
    const userIds = [...new Set(pending.map(n => n.user_id))];

    // Fetch all subscriptions for these users in one query
    const { data: allSubs } = await serviceClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (!allSubs || allSubs.length === 0) {
      console.log(`No subscriptions for ${userIds.length} users, ${pending.length} notifications marked sent`);
      return new Response(JSON.stringify({ processed: pending.length, sent: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Group subscriptions by user_id, deduplicate by endpoint
    const subsByUser = new Map<string, typeof allSubs>();
    for (const sub of allSubs) {
      if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
      const userSubs = subsByUser.get(sub.user_id)!;
      if (!userSubs.some(s => s.endpoint === sub.endpoint)) userSubs.push(sub);
    }

    let sent = 0, failed = 0;

    // Prepare FCM access token once if needed
    const hasFcmSubs = allSubs.some(s => s.endpoint.startsWith('fcm:'));
    let fcmAccessToken: string | null = null;
    if (hasFcmSubs && FCM_SERVICE_ACCOUNT_JSON && FCM_PROJECT_ID) {
      try {
        fcmAccessToken = await getAccessToken(JSON.parse(FCM_SERVICE_ACCOUNT_JSON));
      } catch (e: any) { console.error('FCM auth error:', e.message); }
    }

    // Set up VAPID once if needed
    const hasWebSubs = allSubs.some(s => !s.endpoint.startsWith('fcm:'));
    if (hasWebSubs && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails('mailto:noreply@ibna.it', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    }

    // Process each notification
    for (const notif of pending) {
      const subs = subsByUser.get(notif.user_id);
      if (!subs) continue;

      const notifType = (notif as any).type || '';
      const style = PUSH_STYLES[notifType] || { emoji: '🔔', color: '#dc2626' };
      const pushData: Record<string, string> = { type: notifType };
      if (notif.link) pushData.url = notif.link;

      for (const sub of subs) {
        if (sub.endpoint.startsWith('fcm:')) {
          if (!fcmAccessToken || !FCM_PROJECT_ID) { failed++; continue; }
          try {
            const ok = await sendFcmV1(FCM_PROJECT_ID, fcmAccessToken, sub.endpoint.replace('fcm:', ''), notif.title, notif.message || '', notifType, pushData);
            if (ok) sent++; else failed++;
          } catch (err: any) {
            failed++;
            if (err?.message?.includes('UNREGISTERED') || err?.message?.includes('INVALID_ARGUMENT')) {
              await serviceClient.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        } else {
          if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) { failed++; continue; }
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({
                title: notif.title,
                body: notif.message || '',
                type: notifType,
                data: pushData,
              })
            );
            sent++;
          } catch (err: any) {
            failed++;
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await serviceClient.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      }
    }

    console.log(`Batch push: processed=${pending.length}, sent=${sent}, failed=${failed}`);
    return new Response(JSON.stringify({ processed: pending.length, sent, failed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
