// Ko-fi Webhook receiver — adds confirmed donors to faq_supporters
// Configure on Ko-fi: https://ko-fi.com/manage/webhooks → URL points here.
// Ko-fi POSTs application/x-www-form-urlencoded with field "data" = JSON string.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const verificationToken = Deno.env.get("KOFI_VERIFICATION_TOKEN");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ko-fi sends form-urlencoded with a "data" field that contains JSON
    let payload: any = null;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      const raw = form.get("data");
      if (typeof raw === "string") payload = JSON.parse(raw);
    }

    if (!payload) {
      return new Response(JSON.stringify({ error: "no payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (verificationToken && payload.verification_token !== verificationToken) {
      console.warn("Ko-fi: invalid verification token");
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messageId: string | undefined = payload.message_id || payload.kofi_transaction_id;
    const fromName: string = (payload.from_name || "Anonimo").trim();
    const email: string | null = payload.email || null;
    const amount = Number(payload.amount || 0);
    const message: string | null = payload.message || null;
    const type: string = payload.type || "Donation"; // Donation | Subscription | Shop Order | Commission

    // Idempotency: skip if already processed
    if (messageId) {
      const { data: existing } = await supabase
        .from("faq_supporters")
        .select("id")
        .eq("kofi_message_id", messageId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Try to match an existing IBNA user by email or display_name (case-insensitive)
    let matchedUserId: string | null = null;
    let displayName = fromName;
    let avatarUrl: string | null = null;

    if (email) {
      try {
        const res: any = await (supabase.auth.admin as any).getUserByEmail?.(email);
        if (res?.data?.user?.id) matchedUserId = res.data.user.id;
      } catch (_) { /* ignore */ }
    }

    if (!matchedUserId && fromName) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .ilike("display_name", fromName)
        .limit(1)
        .maybeSingle();
      if (profile) {
        matchedUserId = profile.user_id;
        displayName = profile.display_name || fromName;
        avatarUrl = profile.avatar_url;
      }
    } else if (matchedUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", matchedUserId)
        .maybeSingle();
      if (profile) {
        displayName = profile.display_name || fromName;
        avatarUrl = profile.avatar_url;
      }
    }

    // If user already has a supporter row, increment amount instead of duplicating
    if (matchedUserId) {
      const { data: existingForUser } = await supabase
        .from("faq_supporters")
        .select("id, kofi_amount")
        .eq("user_id", matchedUserId)
        .maybeSingle();
      if (existingForUser) {
        await supabase.from("faq_supporters").update({
          kofi_amount: Number(existingForUser.kofi_amount || 0) + amount,
          kofi_message_id: messageId ?? null,
          kofi_email: email,
          tier: "donor",
          is_active: true,
        }).eq("id", existingForUser.id);
        return new Response(JSON.stringify({ ok: true, updated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { error: insertErr } = await supabase.from("faq_supporters").insert({
      display_name: displayName,
      avatar_url: avatarUrl,
      tier: "donor",
      message: message?.slice(0, 500) || null,
      user_id: matchedUserId,
      kofi_message_id: messageId ?? null,
      kofi_amount: amount,
      kofi_email: email,
      is_active: true,
      sort_order: 0,
    });

    if (insertErr) {
      console.error("Ko-fi insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, type, amount, matched: !!matchedUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Ko-fi webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
