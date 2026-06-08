// Reply to a private chat from a push notification's inline-reply action.
// The reply is stored as PLAINTEXT (with nonce == "plaintext") because the
// server cannot perform E2E encryption on behalf of the user. The client
// recognizes this nonce and renders the message without decryption.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: ue } = await authClient.auth.getUser();
    if (ue || !u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const chatId: string | undefined = body.chat_id;
    const text: string | undefined = body.text;
    if (!chatId || !text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "chat_id and text required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (text.length > 2000) {
      return new Response(JSON.stringify({ error: "text too long" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Verify the caller participates in the chat
    const { data: chat } = await svc.from("private_chats").select("user_a, user_b").eq("id", chatId).maybeSingle();
    if (!chat || (chat.user_a !== u.user.id && chat.user_b !== u.user.id)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Store as plaintext fallback: nonce sentinel, content_encrypted = base64(text)
    const contentB64 = btoa(unescape(encodeURIComponent(text.trim())));
    const { error } = await svc.from("private_messages").insert({
      chat_id: chatId,
      sender_id: u.user.id,
      content_encrypted: contentB64,
      nonce: "plaintext",
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("reply-from-notification error", e);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
