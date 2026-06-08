import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore npm specifier
import webpush from "https://esm.sh/web-push@3.6.7";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
// @ts-ignore npm specifier
import _sodium from "https://esm.sh/libsodium-wrappers@0.7.13";

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function decryptPrivateMessage(
  serviceClient: any,
  recipientId: string,
  senderId: string,
  contentEncrypted: string,
  nonce: string,
): Promise<string | null> {
  try {
    const [{ data: currentKey }, { data: senderProfile }, { data: recipientHistory }, { data: senderHistory }] = await Promise.all([
      serviceClient.from('user_chat_keys').select('private_key').eq('user_id', recipientId).maybeSingle(),
      serviceClient.from('profiles').select('public_key').eq('user_id', senderId).maybeSingle(),
      serviceClient.from('user_chat_key_history').select('private_key').eq('user_id', recipientId),
      serviceClient.from('user_chat_key_history').select('public_key').eq('user_id', senderId),
    ]);
    if (!senderProfile?.public_key) return null;

    // Try every historic recipient private key against every historic sender public key.
    const privateCandidates: string[] = [];
    const publicCandidates: string[] = [];
    if (currentKey?.private_key) privateCandidates.push(currentKey.private_key);
    for (const row of (recipientHistory ?? []) as Array<{ private_key: string }>) {
      if (row?.private_key && !privateCandidates.includes(row.private_key)) privateCandidates.push(row.private_key);
    }
    if (senderProfile.public_key) publicCandidates.push(senderProfile.public_key);
    for (const row of (senderHistory ?? []) as Array<{ public_key: string }>) {
      if (row?.public_key && !publicCandidates.includes(row.public_key)) publicCandidates.push(row.public_key);
    }
    if (privateCandidates.length === 0 || publicCandidates.length === 0) return null;

    await _sodium.ready;
    const sodium = _sodium;
    const cipher = b64decode(contentEncrypted);
    const n = b64decode(nonce);
    for (const sk of privateCandidates) {
      for (const pub of publicCandidates) {
        try {
          const plain = sodium.crypto_box_open_easy(cipher, n, b64decode(pub), b64decode(sk));
          return new TextDecoder().decode(plain);
        } catch { /* try next historic key combination */ }
      }
    }
    console.warn('Decryption failed: no key in history matched the ciphertext');
    return null;
  } catch (e: any) {
    console.warn('Decryption failed:', e?.message);
    return null;
  }
}

function toBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer as ArrayBuffer;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// --- FCM v1 helpers ---

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function createSignedJwt(serviceAccount: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(toBuffer(enc.encode(JSON.stringify(header))));
  const payloadB64 = base64url(toBuffer(enc.encode(JSON.stringify(payload))));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const keyData = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    enc.encode(unsignedToken)
  );

  const signatureB64 = base64url(new Uint8Array(signature) as unknown as ArrayBuffer);
  return `${unsignedToken}.${signatureB64}`;
}

async function getAccessToken(serviceAccount: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const jwt = await createSignedJwt(serviceAccount);
  const resp = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to get access token: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function sendFcmV1(projectId: string, accessToken: string, fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  // iOS category for inline-reply action (must match registerActionTypes id on the client
  // and be backed by a Notification Service Extension for true text input on iOS).
  const category = (data && (data as any).category) || (data && (data as any).kind === "private" ? "MSG_REPLY" : undefined);
  const message: any = {
    message: {
      token: fcmToken,
      notification: { title, body },
      android: {
        priority: "high",
        notification: {
          channel_id: "default",
          sound: "default",
          default_vibrate_timings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            "mutable-content": 1,
            ...(category ? { category } : {}),
          },
        },
      },
    },
  };
  if (data && Object.keys(data).length > 0) {
    const stringData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      stringData[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    message.message.data = stringData;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`FCM v1 error: ${resp.status} ${errText}`);
    return false;
  }
  await resp.text();
  return true;
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID');
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const requestBody = await req.json();
    const { user_ids, title, body, data } = requestBody || {};
    const privateMessageId = typeof data?.message_id === 'string' ? data.message_id : null;

    let uniqueUserIds: string[] = [];
    let isPrivateMessagePush = false;

    if (privateMessageId) {
      const { data: message, error: messageError } = await serviceClient
        .from('private_messages')
        .select('id, chat_id, sender_id, content_encrypted, nonce')
        .eq('id', privateMessageId)
        .maybeSingle();

      if (messageError || !message) {
        console.error('Private message lookup failed:', messageError?.message);
        return new Response(JSON.stringify({ error: 'Private message not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: chat, error: chatError } = await serviceClient
        .from('private_chats')
        .select('user_a, user_b')
        .eq('id', message.chat_id)
        .maybeSingle();

      if (chatError || !chat || (chat.user_a !== message.sender_id && chat.user_b !== message.sender_id)) {
        console.error('Private chat lookup failed:', chatError?.message);
        return new Response(JSON.stringify({ error: 'Invalid private chat' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const recipientId = chat.user_a === message.sender_id ? chat.user_b : chat.user_a;
      uniqueUserIds = [recipientId];
      isPrivateMessagePush = true;

      // Try to decrypt the message server-side using the recipient's escrowed private key
      if (message.content_encrypted && message.nonce) {
        const plaintext = await decryptPrivateMessage(
          serviceClient,
          recipientId,
          message.sender_id,
          message.content_encrypted,
          message.nonce,
        );
        if (plaintext) {
          // Truncate long messages for the notification surface
          const trimmed = plaintext.length > 180 ? plaintext.slice(0, 177) + '…' : plaintext;
          requestBody.body = trimmed;
          requestBody.data = {
            ...(requestBody.data || {}),
            reply_enabled: 'true',
          };
        }
      }
    } else {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing authorization' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user identity
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: userError } = await authClient.auth.getUser();
      if (userError || !userData?.user) {
        console.error('Auth error:', userError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userId = userData.user.id;
      console.log('Authenticated user:', userId);

      // Check if caller is admin/staff or club staff
      const { data: roles } = await serviceClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'staff', 'moderator']);

      const isStaff = roles && roles.length > 0;

      const { data: clubMembership } = await serviceClient
        .from('club_members')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['leader', 'staff']);

      const isClubStaff = clubMembership && clubMembership.length > 0;

      if (!isStaff && !isClubStaff) {
        console.error('Forbidden: user is not staff/admin/club-staff');
        return new Response(JSON.stringify({ error: 'Forbidden: staff/admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return new Response(JSON.stringify({ error: 'user_ids array required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      uniqueUserIds = [...new Set(user_ids.map(String))];
    }
    const notifTitle = title || 'Notifica Torneo';
    const notifBody = (typeof requestBody.body === 'string' ? requestBody.body : body) || 'Hai un match da giocare!';
    const effectiveData = isPrivateMessagePush ? (requestBody.data || data) : data;
    const notifLink = typeof effectiveData?.url === 'string' ? effectiveData.url : null;

    console.log('Sending to user_ids:', uniqueUserIds);

    let inAppError: { message?: string } | null = null;
    if (!isPrivateMessagePush) {
      const { error } = await serviceClient
        .from('notifications')
        .insert(uniqueUserIds.map((recipientId) => ({
          user_id: recipientId,
          type: 'match_ready',
          title: notifTitle,
          message: notifBody,
          link: notifLink,
          push_sent: true,
        })));
      inAppError = error;
    }

    if (inAppError) {
      console.error('Failed to create in-app notifications:', inAppError.message);
    }

    // Get push subscriptions
    const { data: subscriptions, error: subError } = await serviceClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', uniqueUserIds)
      .order('created_at', { ascending: false });

    if (subError) {
      console.error('Failed to fetch subscriptions:', subError.message);
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    console.log('Found subscriptions:', subscriptions?.length ?? 0);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({
        sent: 0,
        failed: 0,
        requested: uniqueUserIds.length,
        inAppCreated: inAppError ? 0 : uniqueUserIds.length,
        message: 'No push subscriptions found for these users',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deduplicate by endpoint so the same user can receive notifications on multiple devices
    const seenEndpoints = new Set<string>();
    const uniqueSubs = subscriptions.filter(sub => {
      if (!sub.endpoint || seenEndpoints.has(sub.endpoint)) return false;
      seenEndpoints.add(sub.endpoint);
      return true;
    });

    // Separate FCM (native) and Web Push subscriptions
    const fcmSubs = uniqueSubs.filter(s => s.endpoint.startsWith('fcm:'));
    const webSubs = uniqueSubs.filter(s => !s.endpoint.startsWith('fcm:'));

    let sent = 0;
    let failed = 0;

    // --- Send FCM v1 notifications ---
    if (fcmSubs.length > 0) {
      if (!FCM_SERVICE_ACCOUNT_JSON || !FCM_PROJECT_ID) {
        console.error('FCM_SERVICE_ACCOUNT_JSON or FCM_PROJECT_ID not configured, skipping FCM sends');
        failed += fcmSubs.length;
      } else {
        try {
          const serviceAccount = JSON.parse(FCM_SERVICE_ACCOUNT_JSON);
          const accessToken = await getAccessToken(serviceAccount);

          for (const sub of fcmSubs) {
            const fcmToken = sub.endpoint.replace('fcm:', '');
            try {
              const ok = await sendFcmV1(FCM_PROJECT_ID, accessToken, fcmToken, notifTitle, notifBody, effectiveData);
              if (ok) {
                sent++;
                console.log(`FCM sent to ${sub.user_id}`);
              } else {
                failed++;
              }
            } catch (err: any) {
              console.error(`FCM error for ${sub.user_id}:`, err?.message);
              failed++;
              if (err?.message?.includes('UNREGISTERED') || err?.message?.includes('INVALID_ARGUMENT')) {
                await serviceClient.from('push_subscriptions').delete().eq('id', sub.id);
                console.log(`Removed invalid FCM subscription ${sub.id}`);
              }
            }
          }
        } catch (err: any) {
          console.error('FCM auth error:', err?.message);
          failed += fcmSubs.length;
        }
      }
    }

    // --- Send Web Push notifications ---
    if (webSubs.length > 0) {
      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error('VAPID keys not configured, skipping web push sends');
        failed += webSubs.length;
      } else {
        webpush.setVapidDetails(
          'mailto:noreply@ibna.it',
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY
        );

        const payload = JSON.stringify({
          title: notifTitle,
          body: notifBody,
          data: effectiveData || {},
        });

        for (const sub of webSubs) {
          try {
            const pushSubscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            };

            await webpush.sendNotification(pushSubscription, payload);
            sent++;
            console.log(`Web push sent to ${sub.user_id}`);
          } catch (err: any) {
            console.error(`Web push error for ${sub.user_id}:`, err?.statusCode, err?.message);
            failed++;
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await serviceClient.from('push_subscriptions').delete().eq('id', sub.id);
              console.log(`Removed expired subscription ${sub.id}`);
            }
          }
        }
      }
    }

    if (isPrivateMessagePush && sent > 0 && notifLink) {
      await serviceClient
        .from('notifications')
        .update({ push_sent: true })
        .eq('type', 'private_message')
        .eq('link', notifLink)
        .in('user_id', uniqueUserIds);
    }

    console.log(`Results: sent=${sent}, failed=${failed}`);

    return new Response(JSON.stringify({
      sent,
      failed,
      total: uniqueSubs.length,
      requested: uniqueUserIds.length,
      inAppCreated: inAppError ? 0 : uniqueUserIds.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
