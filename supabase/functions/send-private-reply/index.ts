import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore npm specifier
import _sodium from "https://esm.sh/libsodium-wrappers@0.7.13";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64encode(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const chatId = typeof body?.chat_id === 'string' ? body.chat_id : null;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!chatId || !text) {
      return new Response(JSON.stringify({ error: 'chat_id and text required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (text.length > 4000) {
      return new Response(JSON.stringify({ error: 'text too long' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: chat, error: chatErr } = await service
      .from('private_chats')
      .select('user_a, user_b')
      .eq('id', chatId)
      .maybeSingle();
    if (chatErr || !chat || (chat.user_a !== userId && chat.user_b !== userId)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const peerId = chat.user_a === userId ? chat.user_b : chat.user_a;

    const [{ data: myKey }, { data: peerKey }, { data: peerProfile }] = await Promise.all([
      service.from('user_chat_keys').select('public_key, private_key').eq('user_id', userId).maybeSingle(),
      service.from('user_chat_keys').select('public_key').eq('user_id', peerId).maybeSingle(),
      service.from('profiles').select('public_key').eq('user_id', peerId).maybeSingle(),
    ]);
    const peerPublicKey = peerKey?.public_key || peerProfile?.public_key;
    if (!myKey?.private_key || !peerPublicKey) {
      return new Response(JSON.stringify({ error: 'Encryption keys unavailable' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await _sodium.ready;
    const sodium = _sodium;
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const cipher = sodium.crypto_box_easy(
      new TextEncoder().encode(text),
      nonce,
      b64decode(peerPublicKey),
      b64decode(myKey.private_key),
    );

    const { error: insertErr } = await service.from('private_messages').insert({
      chat_id: chatId,
      sender_id: userId,
      content_encrypted: b64encode(cipher),
      nonce: b64encode(nonce),
    });
    if (insertErr) {
      console.error('Insert error:', insertErr.message);
      return new Response(JSON.stringify({ error: 'Insert failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Error:', e?.message);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
